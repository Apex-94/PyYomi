"""
MangaKakalot Extension

A manga source extension for mangakakalot.gg
Uses API endpoints for chapter listing (like Mihon extension).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import List
from urllib.parse import urljoin

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

logger = logging.getLogger(__name__)

# Constants
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
BASE_URL = "https://www.mangakakalot.gg"


class MangaKakalot(BaseScraper):
    """Scraper for mangakakalot.gg"""
    
    name = "MangaKakalot"
    language = "en"
    version = "2.0.0"
    base_urls = [BASE_URL]
    
    def __init__(self) -> None:
        self.client = httpx.AsyncClient(
            headers={
                "User-Agent": UA,
                "Referer": BASE_URL,
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout=httpx.Timeout(30.0),
            follow_redirects=True,
        )
    
    def soup(self, html: str | bytes) -> BeautifulSoup:
        """Parse HTML with BeautifulSoup."""
        return BeautifulSoup(html, "lxml")
    
    def abs(self, base: str, href: str) -> str:
        """Make relative URL absolute."""
        return urljoin(base, href)
    
    def _slug_from_title(self, title: str) -> str:
        """Convert title to URL-friendly slug."""
        return title.lower() \
            .replace("'", "") \
            .replace("'", "") \
            .re.sub(r"[^a-z0-9\s-]", "",) \
            .strip() \
            .re.sub(r"[\s-]+", "-",)
    
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
        """Parse manga cards from a list page."""
        cards: List[MangaCard] = []
        seen_urls = set()
        
        # Look for h3 tags that contain manga links
        h3_elements = doc.select("div.story-item h3, div.story-item h3.story-title, h3 a[href*='/manga/']")
        
        for h3 in h3_elements:
            link = h3.select_one("a") if h3.name != "a" else h3
            if not link:
                continue
            
            href = link.get("href", "")
            title = link.get_text(strip=True)
            
            if not href or "/manga/" not in href or href in seen_urls:
                continue
            
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
        
        # Fallback: look for any manga links
        if not cards:
            all_links = doc.select("a[href*='/manga/']")
            
            for link in all_links:
                href = link.get("href", "")
                
                if not href or "/chapter/" in href or href in seen_urls:
                    continue
                
                # Only take links that point directly to /manga/slug
                path_parts = href.split("/")
                if len(path_parts) < 4 or path_parts[-2] != "manga":
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
        q = query.replace(" ", "_")
        url = f"{BASE_URL}/search/story/{q}"
        
        try:
            response = await self.client.get(url)
            doc = self.soup(response.text)
            cards = self._parse_manga_cards(doc, BASE_URL)
            return cards
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []
    
    async def popular(self, page: int = 1) -> List[MangaCard]:
        """Get popular manga."""
        url = f"{BASE_URL}/manga-list/hot-manga?page={page}"
        
        try:
            response = await self.client.get(url)
            doc = self.soup(response.text)
            cards = self._parse_manga_cards(doc, BASE_URL)
            return cards
        except Exception as e:
            logger.error(f"Popular error: {e}")
            return []
    
    async def latest(self, page: int = 1) -> List[MangaCard]:
        """Get latest updated manga."""
        url = f"{BASE_URL}/manga-list/latest-manga?page={page}"
        
        try:
            response = await self.client.get(url)
            doc = self.soup(response.text)
            cards = self._parse_manga_cards(doc, BASE_URL)
            return cards
        except Exception as e:
            logger.error(f"Latest error: {e}")
            return []
    
    async def details(self, manga_url: str) -> MangaDetails:
        """Get manga details."""
        response = await self.client.get(manga_url)
        doc = self.soup(response.text)
        
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
        
        # Get the actual slug from URL
        slug = manga_url.rstrip("/").split("/")[-1]
        
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
        """Get chapter list using API endpoint (like Mihon extension)."""
        # Extract slug from URL
        slug = manga_url.rstrip("/").split("/")[-1]
        
        # Use API endpoint like Mihon extension
        api_url = f"{BASE_URL}/api/manga/{slug}/chapters?limit=-1"
        
        try:
            response = await self.client.get(api_url)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("success"):
                    chapters_data = data.get("data", {}).get("chapters", [])
                    
                    chapters = []
                    for item in chapters_data:
                        chapter_slug = item.get("chapter_slug")
                        if not chapter_slug:
                            continue
                        
                        chapter_name = item.get("chapter_name", "Chapter")
                        chapter_num = item.get("chapter_num", 0)
                        updated_at = item.get("updated_at")
                        
                        # Parse date
                        date_upload = 0
                        if updated_at:
                            try:
                                dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
                                date_upload = int(dt.timestamp() * 1000)
                            except:
                                pass
                        
                        chapter_url = f"{BASE_URL}/manga/{slug}/{chapter_slug}"
                        
                        chapters.append(
                            Chapter(
                                title=f"Chapter {chapter_num}: {chapter_name}" if chapter_name else f"Chapter {chapter_num}",
                                url=chapter_url,
                                source=self.name,
                            )
                        )
                    
                    # Reverse to get oldest first
                    chapters.reverse()
                    return chapters
        except Exception as e:
            logger.warning(f"API chapters failed, falling back to HTML parsing: {e}")
        
        # Fallback: parse HTML
        return await self._chapters_fallback(manga_url)
    
    async def _chapters_fallback(self, manga_url: str) -> List[Chapter]:
        """Fallback to HTML parsing for chapters."""
        response = await self.client.get(manga_url)
        doc = self.soup(response.text)
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
        
        chapters.reverse()
        return chapters
    
    async def pages(self, chapter_url: str) -> List[str]:
        """Get page image URLs."""
        response = await self.client.get(chapter_url)
        doc = self.soup(response.text)
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
