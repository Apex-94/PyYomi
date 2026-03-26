"""
JVM Service client for communicating with the PyYomi source service.

This module provides a client to interface with the Kotlin/Ktor JVM service
that executes manga source extensions.
"""

import os
from typing import Optional, List, Dict, Any
import httpx


class JVMServiceClient:
    """
    HTTP client for the JVM source service.
    
    The service runs on localhost:8080 by default and exposes endpoints for:
    - Listing sources
    - Search
    - Getting manga details
    - Getting chapter lists
    - Getting page lists
    """
    
    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize the JVM service client.
        
        Args:
            base_url: Base URL of the JVM service. Defaults to PYYOMI_JVM_SERVICE_URL
                     env var or "http://localhost:8080".
        """
        self.base_url = base_url or os.environ.get("PYYOMI_JVM_SERVICE_URL", "http://localhost:8080")
        self.timeout = httpx.Timeout(30.0, connect=10.0)
        self._client: Optional[httpx.AsyncClient] = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        """Get or create the HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=self.timeout,
                headers={"User-Agent": "PyYomi/1.0"}
            )
        return self._client
    
    async def close(self):
        """Close the HTTP client."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check if the JVM service is healthy.
        
        Returns:
            Dict with status, version, and sources_loaded count.
        """
        response = await self.client.get("/health")
        response.raise_for_status()
        return response.json()
    
    async def list_sources(self) -> List[Dict[str, Any]]:
        """
        List all available sources.
        
        Returns:
            List of source info dicts with id, name, lang, base_url.
        """
        response = await self.client.get("/sources")
        response.raise_for_status()
        return response.json()
    
    async def search(
        self,
        source_id: str,
        query: str,
        page: int = 1,
        filters: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Search for manga on a source.
        
        Args:
            source_id: The source ID (e.g., "mangadex-en")
            query: Search query string
            page: Page number (1-indexed)
            filters: Optional list of filters
            
        Returns:
            Dict with source_id, items (list), and has_next_page.
        """
        response = await self.client.post(
            "/search",
            json={
                "source_id": source_id,
                "query": query,
                "page": page,
                "filters": filters or []
            }
        )
        response.raise_for_status()
        return response.json()
    
    async def get_popular(self, source_id: str, page: int = 1) -> Dict[str, Any]:
        """
        Get popular manga from a source.
        
        Args:
            source_id: The source ID
            page: Page number
            
        Returns:
            Dict with source_id, items, and has_next_page.
        """
        response = await self.client.get(f"/popular/{source_id}", params={"page": page})
        response.raise_for_status()
        return response.json()
    
    async def get_latest(self, source_id: str, page: int = 1) -> Dict[str, Any]:
        """
        Get latest updated manga from a source.
        
        Args:
            source_id: The source ID
            page: Page number
            
        Returns:
            Dict with source_id, items, and has_next_page.
        """
        response = await self.client.get(f"/latest/{source_id}", params={"page": page})
        response.raise_for_status()
        return response.json()
    
    async def get_manga_details(self, source_id: str, manga_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a manga.
        
        Args:
            source_id: The source ID
            manga_id: The manga ID
            
        Returns:
            Dict with manga details (title, description, author, etc.).
        """
        response = await self.client.get(f"/manga/{source_id}/{manga_id}")
        response.raise_for_status()
        return response.json()
    
    async def get_chapters(self, source_id: str, manga_id: str) -> Dict[str, Any]:
        """
        Get chapter list for a manga.
        
        Args:
            source_id: The source ID
            manga_id: The manga ID
            
        Returns:
            Dict with manga_id and chapters list.
        """
        response = await self.client.get(f"/chapters/{source_id}/{manga_id}")
        response.raise_for_status()
        return response.json()
    
    async def get_pages(self, source_id: str, chapter_id: str) -> Dict[str, Any]:
        """
        Get page URLs for a chapter.
        
        Args:
            source_id: The source ID
            chapter_id: The chapter ID
            
        Returns:
            Dict with chapter_id and pages list.
        """
        response = await self.client.get(f"/pages/{source_id}/{chapter_id}")
        response.raise_for_status()
        return response.json()


# Global client instance
_jvm_client: Optional[JVMServiceClient] = None


def get_jvm_client() -> JVMServiceClient:
    """Get the global JVM service client instance."""
    global _jvm_client
    if _jvm_client is None:
        _jvm_client = JVMServiceClient()
    return _jvm_client


async def close_jvm_client():
    """Close the global JVM service client."""
    global _jvm_client
    if _jvm_client is not None:
        await _jvm_client.close()
        _jvm_client = None