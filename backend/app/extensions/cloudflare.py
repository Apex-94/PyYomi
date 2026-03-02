"""
Cloudflare Bypass Helper using Botasaurus

This module provides a common interface for bypassing Cloudflare protection
using the Botasaurus library. It can be used by extensions that need
to access Cloudflare-protected websites.

Usage:
    from app.extensions.cloudflare import solve_cloudflare, get_cached_cookies
    
    # Get HTML from a Cloudflare-protected URL
    html, cookies = solve_cloudflare('https://example.com/page')
    
    # Or get just the cookies for reuse
    cookies = get_cached_cookies()
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from typing import Dict, Tuple, Optional

logger = logging.getLogger(__name__)

# Default cookie storage directory
CACHE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_COOKIE_FILE = os.path.join(CACHE_DIR, "cloudflare_cookies.json")

# Thread-safe cookie management
_cookie_lock = threading.Lock()
_cached_cookies: Dict[str, str] = {}
_cookie_file = DEFAULT_COOKIE_FILE


def set_cookie_file(path: str) -> None:
    """Set the cookie file path for storing/loading Cloudflare cookies."""
    global _cookie_file, _cached_cookies
    _cookie_file = path
    # Clear cached cookies so they will be reloaded from new path
    with _cookie_lock:
        _cached_cookies = {}


def get_cached_cookies() -> Dict[str, str]:
    """
    Get cached Cloudflare cookies.
    
    Returns:
        Dictionary of cookie name -> value mappings
    """
    global _cached_cookies
    
    with _cookie_lock:
        if _cached_cookies:
            return _cached_cookies.copy()
    
    # Try to load from file
    if os.path.exists(_cookie_file):
        try:
            with open(_cookie_file, 'r') as f:
                data = json.load(f)
                # Filter out any non-cookie keys (like metadata)
                cookies = {k: v for k, v in data.items() if not k.startswith('_') and isinstance(v, str)}
                if cookies:
                    with _cookie_lock:
                        _cached_cookies = cookies
                    logger.info(f"Loaded {len(cookies)} cookies from cache")
                    return cookies.copy()
        except Exception as e:
            logger.warning(f"Failed to load cookies from {_cookie_file}: {e}")
    
    return {}


def save_cookies(cookies: Dict[str, str]) -> None:
    """
    Save Cloudflare cookies to file for later reuse.
    
    Args:
        cookies: Dictionary of cookie name -> value mappings
    """
    global _cached_cookies
    
    with _cookie_lock:
        _cached_cookies = cookies.copy()
    
    try:
        with open(_cookie_file, 'w') as f:
            json.dump(cookies, f, indent=2)
        logger.info(f"Saved {len(cookies)} cookies to {_cookie_file}")
    except Exception as e:
        logger.error(f"Failed to save cookies to {_cookie_file}: {e}")


def clear_cookies() -> None:
    """Clear cached cookies (both memory and file)."""
    global _cached_cookies
    
    with _cookie_lock:
        _cached_cookies = {}
    
    if os.path.exists(_cookie_file):
        try:
            os.remove(_cookie_file)
            logger.info(f"Cleared cookie cache file: {_cookie_file}")
        except Exception as e:
            logger.warning(f"Failed to remove cookie file: {e}")


def solve_cloudflare(url: str, cookie_file: Optional[str] = None) -> Tuple[str, Dict[str, str]]:
    """
    Solve Cloudflare challenge and return page HTML and cookies.
    
    This function uses Botasaurus to create an anti-detected browser that can
    bypass Cloudflare's JavaScript challenges. It will:
    1. Try to load cookies from cache
    2. If no valid cookies, use Botasaurus to solve Cloudflare
    3. Save cookies for future use
    
    Args:
        url: The URL to fetch (must be Cloudflare-protected)
        cookie_file: Optional custom cookie file path
        
    Returns:
        Tuple of (html_content, cookies_dict)
    """
    html = ""
    cookies: Dict[str, str] = {}
    
    # Use custom cookie file if provided
    if cookie_file:
        old_cookie_file = _cookie_file
        set_cookie_file(cookie_file)
    
    try:
        # First try with cached cookies
        cached_cookies = get_cached_cookies()
        
        if cached_cookies:
            logger.info(f"Attempting request with cached cookies for {url}")
            # Try a quick request first with cached cookies
            import httpx
            ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            try:
                response = httpx.get(
                    url,
                    headers={"User-Agent": ua, "Referer": url.split('/')[0] + '//' + url.split('/')[2]},
                    cookies=cached_cookies,
                    timeout=10.0,
                    follow_redirects=True
                )
                if response.status_code == 200 and "Just a moment" not in response.text[:500]:
                    logger.info("Cached cookies worked!")
                    return response.text, cached_cookies
                else:
                    logger.info("Cached cookies didn't work, solving Cloudflare...")
            except Exception as e:
                logger.warning(f"Request with cached cookies failed: {e}")
        
        # Need to solve Cloudflare
        logger.info("Solving Cloudflare challenge with Botasaurus...")
        html, cookies = _solve_with_botasaurus(url)
        
        if cookies:
            save_cookies(cookies)
        
    finally:
        if cookie_file:
            set_cookie_file(old_cookie_file)
    
    return html, cookies


def _solve_with_botasaurus(url: str) -> Tuple[str, Dict[str, str]]:
    """
    Internal function to solve Cloudflare using Botasaurus Driver.
    
    Args:
        url: The URL to fetch
        
    Returns:
        Tuple of (html_content, cookies_dict)
    """
    html = ""
    cookies: Dict[str, str] = {}
    
    try:
        from botasaurus_driver import Driver
        
        # Create a Driver instance in headless mode with stealth options
        driver = Driver(
            headless=True,
            tiny_profile=True,  # Use minimal profile for better stealth
        )
        
        try:
            # First try regular get (might work if not blocked)
            try:
                logger.info(f"Navigating to {url} with regular get...")
                driver.get(url)
                time.sleep(3)
                page_title = driver.title
                if "Just a moment" not in page_title:
                    logger.info("Regular get worked!")
                else:
                    raise Exception("Cloudflare challenge detected")
            except Exception as e:
                logger.info(f"Regular get failed, trying Google referer: {e}")
                # Fall back to google_get with bypass
                driver.google_get(url, bypass_cloudflare=True)
                time.sleep(5)
            
            # Check if we got past Cloudflare
            page_title = driver.title
            logger.info(f"Page title after navigation: {page_title}")
            
            if "Just a moment" not in page_title:
                # Success! Get the page HTML
                html = driver.page_html
                logger.info(f"Successfully bypassed Cloudflare, got {len(html)} bytes")
                
                # Extract cookies
                driver_cookies = driver.get_cookies()
                for cookie in driver_cookies:
                    name = cookie.get('name')
                    value = cookie.get('value')
                    if name and value:
                        # Keep important Cloudflare cookies
                        if name in ['cf_clearance', '__cf_bm', '__cfduid', 'cf_challenge_response']:
                            cookies[name] = value
                
                logger.info(f"Extracted {len(cookies)} Cloudflare cookies")
            else:
                logger.warning("Cloudflare still blocking after bypass attempt")
                
        except Exception as e:
            logger.error(f"Botasaurus navigation error: {e}")
        finally:
            try:
                driver.close()
            except:
                pass
            
    except ImportError as e:
        logger.error(f"Botasaurus not installed: {e}")
        logger.info("Install with: pip install botasaurus")
    except Exception as e:
        logger.error(f"Cloudflare bypass error: {e}")
    
    return html, cookies


# Convenience function for quick testing
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python cloudflare.py <url>")
        sys.exit(1)
    
    target_url = sys.argv[1]
    print(f"Fetching {target_url}...")
    
    html, cookies = solve_cloudflare(target_url)
    
    print(f"Got HTML: {len(html)} bytes")
    print(f"Got cookies: {list(cookies.keys())}")
