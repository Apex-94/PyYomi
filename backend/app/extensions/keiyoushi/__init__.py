"""
Keiyoushi source wrapper that delegates to the JVM service.

This module provides a Python scraper implementation that forwards
requests to the Kotlin/Ktor JVM service running the manga source extensions.
"""

from typing import List, Optional
import os

from app.extensions.base import (
    BaseScraper,
    MangaCard,
    MangaDetails,
    Chapter,
    Filter,
)
from app.extensions.jvm_client import get_jvm_client


# Default source ID - can be configured via environment
DEFAULT_SOURCE_ID = os.environ.get("PYYOMI_DEFAULT_SOURCE", "mangadex-en")


class KeiyoushiSource(BaseScraper):
    """
    A scraper that delegates to the JVM source service.
    
    This allows using Keiyoushi/extensions-source extensions (written in Kotlin)
    from Python by communicating via HTTP with the JVM service.
    """
    
    name = "Keiyoushi"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://mangadex.org"]  # Default, actual URL comes from JVM service
    
    # Source ID for JVM service calls
    _source_id: str = DEFAULT_SOURCE_ID
    
    def __init__(self, source_id: Optional[str] = None):
        """Initialize with optional source ID."""
        if source_id:
            self._source_id = source_id
        self._client = None
    
    @property
    def client(self):
        """Get the JVM client."""
        if self._client is None:
            self._client = get_jvm_client()
        return self._client
    
    async def close(self):
        """Close the JVM client."""
        from app.extensions.jvm_client import close_jvm_client
        if self._client:
            await close_jvm_client()
            self._client = None
    
    async def get_filters(self) -> List[Filter]:
        """
        Get available filters for this source.
        
        Note: JVM service currently returns no filters, but this can be
        extended to provide filter support.
        """
        return []
    
    async def search(self, query: str, page: int = 1, filters: List[Filter] = None) -> List[MangaCard]:
        """Search for manga on the source."""
        try:
            result = await self.client.search(
                source_id=self._source_id,
                query=query,
                page=page,
                filters=[]  # TODO: Convert filters to JVM format
            )
            
            cards = []
            for item in result.get("items", []):
                cards.append(MangaCard(
                    title=item.get("title", "Unknown"),
                    url=item.get("url", ""),
                    thumbnail_url=item.get("thumbnail"),
                    source=self.name,
                ))
            
            return cards
        except Exception as e:
            print(f"Keiyoushi search error: {e}")
            return []
    
    async def popular(self, page: int = 1) -> List[MangaCard]:
        """Get popular manga."""
        try:
            result = await self.client.get_popular(
                source_id=self._source_id,
                page=page
            )
            
            cards = []
            for item in result.get("items", []):
                cards.append(MangaCard(
                    title=item.get("title", "Unknown"),
                    url=item.get("url", ""),
                    thumbnail_url=item.get("thumbnail"),
                    source=self.name,
                ))
            
            return cards
        except Exception as e:
            print(f"Keiyoushi popular error: {e}")
            return []
    
    async def latest(self, page: int = 1) -> List[MangaCard]:
        """Get latest updated manga."""
        try:
            result = await self.client.get_latest(
                source_id=self._source_id,
                page=page
            )
            
            cards = []
            for item in result.get("items", []):
                cards.append(MangaCard(
                    title=item.get("title", "Unknown"),
                    url=item.get("url", ""),
                    thumbnail_url=item.get("thumbnail"),
                    source=self.name,
                ))
            
            return cards
        except Exception as e:
            print(f"Keiyoushi latest error: {e}")
            return []
    
    async def details(self, manga_url: str) -> MangaDetails:
        """Get detailed metadata for a manga."""
        # Extract manga ID from URL (e.g., /manga/abc123 -> abc123)
        manga_id = manga_url.strip("/").split("/")[-1]
        
        try:
            result = await self.client.get_manga_details(
                source_id=self._source_id,
                manga_id=manga_id
            )
            
            return MangaDetails(
                title=result.get("title", "Unknown"),
                description=result.get("description", ""),
                author=result.get("author"),
                artist=result.get("artist"),
                status=result.get("status", "unknown"),
                genres=result.get("genres", []),
                thumbnail_url=result.get("thumbnail"),
                source_url=result.get("url", manga_url),
            )
        except Exception as e:
            print(f"Keiyoushi details error: {e}")
            return MangaDetails(
                title="Unknown",
                description="Failed to load manga details",
                author=None,
                artist=None,
                status="unknown",
                genres=[],
                thumbnail_url=None,
                source_url=manga_url,
            )
    
    async def chapters(self, manga_url: str) -> List[Chapter]:
        """Fetch the list of chapters for a manga."""
        manga_id = manga_url.strip("/").split("/")[-1]
        
        try:
            result = await self.client.get_chapters(
                source_id=self._source_id,
                manga_id=manga_id
            )
            
            chapters = []
            for ch in result.get("chapters", []):
                chapters.append(Chapter(
                    title=ch.get("title", ""),
                    url=ch.get("url", ""),
                    chapter_number=ch.get("number"),
                ))
            
            return chapters
        except Exception as e:
            print(f"Keiyoushi chapters error: {e}")
            return []
    
    async def pages(self, chapter_url: str) -> List[str]:
        """Fetch a list of image URLs for a chapter."""
        chapter_id = chapter_url.strip("/").split("/")[-1]
        
        try:
            result = await self.client.get_pages(
                source_id=self._source_id,
                chapter_id=chapter_id
            )
            
            return result.get("pages", [])
        except Exception as e:
            print(f"Keiyoushi pages error: {e}")
            return []


# Source instance for registration
source = KeiyoushiSource()


# Additional source instances for different sources
def get_sources():
    """Get all available Keiyoushi-based sources."""
    # For now, we just expose one source that defaults to Mangadex
    # In the future, this could query the JVM service for available sources
    return [source]


# Register the source
sources = get_sources()