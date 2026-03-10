"""
Manhwa18 scraper backed by the public JSON API.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from html import unescape
from typing import List, Optional
from urllib.parse import quote, urljoin

import httpx

from ..base import (
    BaseScraper,
    Chapter,
    Filter,
    MangaCard,
    MangaDetails,
    MultiSelectFilter,
    SelectFilter,
    SelectOption,
)

logger = logging.getLogger(__name__)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/132.0.0.0 Safari/537.36"
)
BASE_URL = "https://manhwa18.com"
API_URL = "https://cdn3.manhwa18.com/api/v1"

CATEGORIES = {
    1: "Raw",
    2: "Sub",
}

NATIONS = {
    1: "Korea",
    2: "Japan",
}

STATUSES = {
    0: "In-progress",
    1: "Completed",
}

GENRES = [
    {"name": "Action", "id": 1},
    {"name": "Adventure", "id": 2},
    {"name": "Comedy", "id": 3},
    {"name": "Drama", "id": 4},
    {"name": "Fantasy", "id": 5},
    {"name": "Horror", "id": 6},
    {"name": "Isekai", "id": 7},
    {"name": "Martial Arts", "id": 8},
    {"name": "Mystery", "id": 9},
    {"name": "Romance", "id": 10},
    {"name": "Sci-Fi", "id": 11},
    {"name": "Slice of Life", "id": 12},
    {"name": "Sports", "id": 13},
    {"name": "Supernatural", "id": 14},
    {"name": "Thriller", "id": 15},
    {"name": "Historical", "id": 16},
    {"name": "Mecha", "id": 17},
    {"name": "Psychological", "id": 18},
    {"name": "Seinen", "id": 19},
    {"name": "Shoujo", "id": 20},
    {"name": "Shounen", "id": 21},
    {"name": "Josei", "id": 22},
    {"name": "Yaoi", "id": 23},
    {"name": "Yuri", "id": 24},
    {"name": "Ecchi", "id": 25},
    {"name": "Manhwa", "id": 26},
]

SORTS = [
    ("Most View", "most-view"),
    ("Most Favourite", "most-favourite"),
    ("A-Z", "a-z"),
    ("Z-A", "z-a"),
    ("New Updated", "new-updated"),
    ("Old Updated", "old-updated"),
    ("New Created", "new-created"),
    ("Old Created", "old-created"),
]

STATUS_MAP = {1: "completed", 0: "ongoing"}


class Manhwa18Scraper(BaseScraper):
    name = "Manhwa18"
    language = "en"
    version = "1.0.12"
    base_urls = [BASE_URL]

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                headers={
                    "User-Agent": UA,
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer": f"{BASE_URL}/",
                },
                timeout=httpx.Timeout(30.0),
                follow_redirects=True,
                trust_env=False,
            )
        return self._client

    def abs_url(self, value: str) -> str:
        return urljoin(BASE_URL, value)

    async def _get_json(self, url: str) -> Optional[dict | list]:
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as exc:
            logger.warning("Manhwa18 request failed for %s: %s", url, exc)
            return None
        except ValueError as exc:
            logger.warning("Manhwa18 invalid JSON for %s: %s", url, exc)
            return None

    def _card_from_payload(self, manga: dict) -> MangaCard:
        slug = manga.get("slug", "")
        return MangaCard(
            title=manga.get("name", "") or "Untitled",
            url=self.abs_url(f"/manga/{slug}"),
            thumbnail_url=manga.get("url_avatar") or None,
            source=self.name,
        )

    async def get_filters(self) -> List[Filter]:
        return [
            SelectFilter(
                id="category",
                name="Category",
                options=[SelectOption(label=label, value=str(value)) for value, label in CATEGORIES.items()],
            ),
            SelectFilter(
                id="status",
                name="Status",
                options=[SelectOption(label=label, value=str(value)) for value, label in STATUSES.items()],
            ),
            SelectFilter(
                id="sort",
                name="Sort",
                options=[SelectOption(label=label, value=value) for label, value in SORTS],
            ),
            SelectFilter(
                id="nation",
                name="Nation",
                options=[SelectOption(label=label, value=str(value)) for value, label in NATIONS.items()],
            ),
            MultiSelectFilter(
                id="genre",
                name="Genre",
                options=[SelectOption(label=item["name"], value=str(item["id"])) for item in GENRES],
            ),
        ]

    async def search(self, query: str, page: int = 1, filters: List[Filter] = None) -> List[MangaCard]:
        if not query.strip():
            return await self._browse(page, filters)

        data = await self._get_json(f"{API_URL}/get-search-suggest/{quote(query.strip())}")
        if not isinstance(data, list):
            return []
        return [self._card_from_payload(manga) for manga in data]

    async def popular(self, page: int = 1) -> List[MangaCard]:
        return await self._browse(page)

    async def latest(self, page: int = 1) -> List[MangaCard]:
        data = await self._get_json(f"{API_URL}/get-data-products-in-filter?page={page}&arrange=new-updated")
        if not isinstance(data, dict):
            return []
        return [self._card_from_payload(manga) for manga in data.get("products", {}).get("data", [])]

    async def _browse(self, page: int = 1, filters: Optional[List[Filter]] = None) -> List[MangaCard]:
        url = f"{API_URL}/get-data-products?page={page}"
        filter_params = self._build_filter_params(filters or [], page)
        if filter_params:
            url = f"{API_URL}/get-data-products-in-filter?{filter_params}"

        data = await self._get_json(url)
        if not isinstance(data, dict):
            return []
        return [self._card_from_payload(manga) for manga in data.get("products", {}).get("data", [])]

    def _build_filter_params(self, filters: List[Filter], page: int) -> str:
        params: list[str] = [f"page={page}"]

        for item in filters:
            value = getattr(item, "value", None)
            if value in (None, "", []):
                continue
            if item.id == "category":
                params.append(f"category={value}")
            elif item.id == "status":
                params.append(f"is_complete={value}")
            elif item.id == "sort":
                params.append(f"arrange={value}")
            elif item.id == "nation":
                params.append(f"nation={value}")
            elif item.id == "genre":
                if isinstance(value, list):
                    params.extend(f"type[]={genre_id}" for genre_id in value)
                else:
                    params.append(f"type={value}")

        return "&".join(params) if len(params) > 1 else ""

    async def details(self, manga_url: str) -> MangaDetails:
        slug = manga_url.rstrip("/").split("/")[-1]
        data = await self._get_json(f"{API_URL}/get-detail-product/{slug}")
        if not isinstance(data, dict):
            return self._empty_details(manga_url)

        manga = data.get("product", {})
        genres: list[str] = []
        for item in manga.get("types", []) or []:
            name = item.get("name", "")
            if name and name not in genres:
                genres.append(name)

        nation = manga.get("nation", {}).get("name")
        if nation and nation not in genres:
            genres.append(nation)

        category_id = manga.get("category_id")
        if category_id in CATEGORIES and CATEGORIES[category_id] not in genres:
            genres.append(CATEGORIES[category_id])

        description = unescape((manga.get("desc") or "").replace("<p>", "").replace("</p>", "").strip())

        return MangaDetails(
            title=manga.get("name", "") or "Unknown",
            description=description,
            author=None,
            artist=None,
            status=STATUS_MAP.get(manga.get("is_end"), "unknown"),
            genres=genres,
            thumbnail_url=manga.get("url_avatar") or None,
            source_url=self.abs_url(f"/manga/{slug}"),
        )

    def _empty_details(self, manga_url: str) -> MangaDetails:
        return MangaDetails(
            title="Unknown",
            description="",
            author=None,
            artist=None,
            status="unknown",
            genres=[],
            thumbnail_url=None,
            source_url=manga_url,
        )

    async def chapters(self, manga_url: str) -> List[Chapter]:
        slug = manga_url.rstrip("/").split("/")[-1]
        data = await self._get_json(f"{API_URL}/get-detail-product/{slug}")
        if not isinstance(data, dict):
            return []

        episodes = data.get("product", {}).get("episodes", []) or []
        chapters: list[Chapter] = []
        for episode in episodes:
            uploaded_at = self._parse_uploaded_at(episode.get("created_at"))
            chapters.append(
                Chapter(
                    title=episode.get("name", "") or "Chapter",
                    url=self.abs_url(f"/manga/{slug}/{episode.get('slug', '')}"),
                    chapter_number=None,
                    uploaded_at_ts=uploaded_at,
                )
            )

        chapters.reverse()
        return chapters

    def _parse_uploaded_at(self, value: Optional[str]) -> Optional[int]:
        if not value:
            return None
        for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
            try:
                return int(datetime.strptime(value, fmt).replace(tzinfo=timezone.utc).timestamp() * 1000)
            except ValueError:
                continue
        return None

    async def pages(self, chapter_url: str) -> List[str]:
        episode_slug = chapter_url.rstrip("/").split("/")[-1]
        data = await self._get_json(f"{API_URL}/get-episode/{episode_slug}")
        if not isinstance(data, dict):
            return []

        servers = data.get("episode", {}).get("servers", []) or []
        if not servers:
            return []
        return [image for image in servers[0].get("images", []) if image]


source = Manhwa18Scraper()
