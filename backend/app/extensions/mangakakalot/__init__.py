"""
MangaKakalot Extension

A manga source extension for mangakakalot.gg
Uses Botasaurus for Cloudflare bypass.
"""

from __future__ import annotations

import os
import logging
from typing import List
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

from app.extensions.base import (
    BaseScraper, 
    MangaCard, 
    MangaDetails, 
    Chapter, 
    Filter, 
    SelectFilter, 
    SelectOption
)
from app.extensions.cloudflare import solve_cloudflare, get_cached_cookies

logger = logging.getLogger(__name__)

# Constants
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
BASE_URL = "https://www.mangakakalot.gg"
COOKIE_FILE = os.path.join(os.path.dirname(__file__), "cookies.json")


class MangaKakalot(BaseScraper):
    """
    Scraper for mangakakalot.gg
    
    Uses Botasaurus to bypass Cloudflare protection.
    """
    
    name = "MangaKakalot"
    language = "en"
    version = "1.2.0"
    base_urls = [BASE_URL]
    
    # Track if cookies have been initialized
    _cookies_initialized = False
    
    def __init__(self) -> None:
        # Set up cookie file for this extension
        if not MangaKakalot._cookies_initialized:
            from app.extensions.cloudflare import set_cookie_file
            set_cookie_file(COOKIE_FILE)
            MangaKakalot._cookies_initialized = True
        
        # Get cached cookies
        self.cookies = get_cached_cookies()
        
        # Set up HTTP client with cookies
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": UA,
                "Referer": BASE_URL,
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
            cookies=self.cookies if self.cookies else None
        )
        
        if self.cookies:
            logger.info("MangaKakalot: Using cached Cloudflare cookies")
        else:
            logger.info("MangaKakalot: No cached cookies, will solve Cloudflare on first request")

    def soup(self, html: str | bytes) -> BeautifulSoup:
        """Parse HTML with BeautifulSoup."""
        return BeautifulSoup(html, "lxml")

    def abs(self, base: str, href: str) -> str:
        """Make relative URL absolute."""
        return urljoin(base, href)

    async def _get_with_cloudflare_bypass(self, url: str) -> BeautifulSoup:
        """
        Fetch a URL, solving Cloudflare if needed.
        
        Uses cached cookies first, then Botasaurus if needed.
        """
        # Try regular request first with cached cookies
        if self.cookies:
            try:
                response = await self.client.get(url)
                if response.status_code == 200 and "Just a moment" not in response.text[:500]:
                    return self.soup(response.text)
            except Exception as e:
                logger.warning(f"Request failed with cached cookies: {e}")
        
        # Need to solve Cloudflare
        logger.info(f"Solving Cloudflare for {url}")
        html, cookies = solve_cloudflare(url, cookie_file=COOKIE_FILE)
        
        if html:
            # Update cookies for future requests
            if cookies:
                self.cookies = cookies
                # Update HTTP client cookies
                self.client = httpx.AsyncClient(
                    headers={
                        "User-Agent": UA,
                        "Referer": BASE_URL,
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                    timeout=httpx.Timeout(30.0),
                    follow_redirects=True,
                    cookies=cookies
                )
            return self.soup(html)
        
        raise Exception(f"Failed to get page: {url}")

    async def get_filters(self) -> List[Filter]:
        """Return available filters."""
        return [
            SelectFilter(
                id="type",
                name="Type",
                options=[
                    SelectOption(label="All", value=""),
                    SelectOption(label="Manga", value="manga"),
                    SelectOption(label="Manhwa", value="manhwa"),
                    SelectOption(label="Manhua", value="manhua"),
                ]
            ),
            SelectFilter(
                id="status",
                name="Status",
                options=[
                    SelectOption(label="All", value=""),
                    SelectOption(label="Ongoing", value="ongoing"),
                    SelectOption(label="Completed", value="completed"),
                ]
            ),
        ]

    def _parse_manga_cards(self, doc: BeautifulSoup, base_url: str) -> List[MangaCard]:
        """
        Parse manga cards from a list page.
        
        MangaKakalot uses a specific structure where manga items are in
        the main content area. We look for links that point to /manga/{slug}
        and extract the title from them.
        """
        cards: List[MangaCard] = []
        seen_urls = set()
        
        # Strategy 1: Look for h3 tags that contain manga links (common pattern)
        # The manga title links are in h3 elements
        h3_elements = doc.select("div.story-item h3, div.story-item h3.story-title, h3 a[href*='/manga/']")
        
        for h3 in h3_elements:
            # Get the link inside h3
            link = h3.select_one("a") if h3.name != "a" else h3
            if not link:
                continue
                
            href = link.get("href", "")
            title = link.get_text(strip=True)
            
            # Skip if not a manga page
            if not href or "/manga/" not in href or href in seen_urls:
                continue
            
            # Skip chapter links (they have /chapter/ in them)
            if "/chapter/" in href:
                continue
                
            seen_urls.add(href)
            
            if len(title) < 2:
                continue
            
            # Get thumbnail from parent container
            thumb_url = None
            parent = h3.find_parent("div")
            if parent:
                img = parent.select_one("img")
                if img:
                    thumb = img.get("src") or img.get("data-src")
                    if thumb:
                        if thumb.startswith("//"):
                            thumb_url = "https:" + thumb
                        elif not thumb.startswith("http"):
                            thumb_url = urljoin(base_url, thumb)
                        else:
                            thumb_url = thumb
            
            cards.append(
                MangaCard(
                    title=title,
                    url=self.abs(base_url, href),
                    thumbnail_url=thumb_url,
                    source=self.name,
                )
            )
        
        # Strategy 2: If no h3 items, look for any manga links at top-level
        if not cards:
            all_links = doc.select("a[href*='/manga/']")
            
            for link in all_links:
                href = link.get("href", "")
                
                # Skip if not a manga detail page
                if not href or "/chapter/" in href or href in seen_urls:
                    continue
                    
                # Only take links that point directly to /manga/slug (not /manga/slug/anything)
                # This filters out chapter links
                parsed = urlparse(href)
                path_parts = [p for p in parsed.path.split("/") if p]
                if len(path_parts) < 2 or path_parts[0] != "manga":
                    continue
                
                title = link.get_text(strip=True)
                if not title or len(title) < 2:
                    continue
                
                seen_urls.add(href)
                
                cards.append(
                    MangaCard(
                        title=title,
                        url=self.abs(base_url, href),
                        thumbnail_url=None,
                        source=self.name,
                    )
                )
        
        return cards

    async def search(self, query: str, page: int = 1, filters: List[Filter] = None) -> List[MangaCard]:
        """Search for manga."""
        # Build search URL
        q = query.replace(" ", "_")
        url = f"{BASE_URL}/search/story/{q}"
        
        try:
            doc = await self._get_with_cloudflare_bypass(url)
            cards = self._parse_manga_cards(doc, BASE_URL)
            return cards
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []

    async def popular(self, page: int = 1) -> List[MangaCard]:
        """Get popular manga."""
        url = f"{BASE_URL}/manga-list/hot-manga?page={page}"
        
        try:
            doc = await self._get_with_cloudflare_bypass(url)
            cards = self._parse_manga_cards(doc, BASE_URL)
            return cards
        except Exception as e:
            logger.error(f"Popular error: {e}")
            return []

    async def latest(self, page: int = 1) -> List[MangaCard]:
        """Get latest updated manga."""
        url = f"{BASE_URL}/manga-list/latest-manga?page={page}"
        
        try:
            doc = await self._get_with_cloudflare_bypass(url)
            cards = self._parse_manga_cards(doc, BASE_URL)
            return cards
        except Exception as e:
            logger.error(f"Latest error: {e}")
            return []

    async def details(self, manga_url: str) -> MangaDetails:
        """Get manga details."""
        doc = await self._get_with_cloudflare_bypass(manga_url)
        
        # Get title
        title = ""
        heading = doc.select_one("h1, .story-title, .manga-title, .title")
        if heading:
            title = heading.get_text(strip=True)
        
        # Get description
        description = ""
        summary = doc.select_one("div.description, div.summary, div.story-content")
        if summary:
            description = summary.get_text(strip=True)
        
        # Get author
        author = None
        author_el = doc.select_one("span.author a, div.author a, .story-author a")
        if author_el:
            author = author_el.get_text(strip=True)
            if author.startswith("Author:"):
                author = author.replace("Author:", "").strip()
        
        # Get status
        status = "unknown"
        status_el = doc.select_one("span.status, div.status, .story-status")
        if status_el:
            status_text = status_el.get_text(strip=True).lower()
            if "ongoing" in status_text:
                status = "ongoing"
            elif "completed" in status_text:
                status = "completed"
        
        # Get genres
        genres = []
        genre_elements = doc.select("div.genres a, span.genres a, .genres a")
        for a in genre_elements:
            genre_text = a.get_text(strip=True)
            if genre_text and genre_text not in genres:
                genres.append(genre_text)
        
        # Get thumbnail
        thumbnail_url = None
        img_el = doc.select_one("div.cover img, .story-cover img")
        if img_el:
            thumb = img_el.get("src") or img_el.get("data-src")
            if thumb:
                if thumb.startswith("//"):
                    thumbnail_url = "https:" + thumb
                elif not thumb.startswith("http"):
                    thumbnail_url = urljoin(manga_url, thumb)
        
        return MangaDetails(
            title=title,
            description=description,
            author=author,
            artist=None,
            status=status,
            genres=genres,
            thumbnail_url=thumbnail_url,
            source_url=manga_url,
        )

    async def chapters(self, manga_url: str) -> List[Chapter]:
        """Get chapter list."""
        doc = await self._get_with_cloudflare_bypass(manga_url)
        chapters: List[Chapter] = []
        
        # Try select element first
        chapter_select = doc.select_one("select#chapter")
        if chapter_select:
            options = chapter_select.select("option")
            for option in options:
                value = option.get("value")
                title = option.get_text(strip=True)
                if value:
                    chapters.append(
                        Chapter(
                            title=title,
                            url=self.abs(manga_url, value),
                            source=self.name,
                        )
                    )
        
        # Fallback to link list
        if not chapters:
            chapter_links = doc.select("a[href*='/chapter/']")
            for link in chapter_links:
                href = link.get("href")
                title = link.get_text(strip=True)
                if href and title and "/manga/" in href and "/chapter/" in href:
                    chapters.append(
                        Chapter(
                            title=title,
                            url=self.abs(manga_url, href),
                            source=self.name,
                        )
                    )
        
        # Reverse to get oldest first
        chapters.reverse()
        return chapters

    async def pages(self, chapter_url: str) -> List[str]:
        """Get page image URLs."""
        doc = await self._get_with_cloudflare_bypass(chapter_url)
        pages: List[str] = []
        
        # Find all images
        img_elements = doc.select(
            "div.page-images img, div#viewer img, div.chapter-content img, div.page img, img[data-src]"
        )
        
        for img in img_elements:
            src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
            if src and src not in pages:
                if src.startswith("//"):
                    src = "https:" + src
                # Skip small images (icons, buttons)
                if "icon" not in src.lower() and "button" not in src.lower():
                    pages.append(src)
        
        return pages


# Export the scraper instance for extension loader
source = MangaKakalot()
