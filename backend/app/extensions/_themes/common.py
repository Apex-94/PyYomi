from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Iterable, List, Optional
from urllib.parse import urlencode, urljoin

import httpx
from bs4 import BeautifulSoup, Tag

from app.extensions.base import BaseScraper, Chapter, Filter, MangaCard, MangaDetails, SelectFilter, SelectOption

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/132.0.0.0 Safari/537.36"
)

STATUS_MAP = {
    "ongoing": "ongoing",
    "on-going": "ongoing",
    "updating": "ongoing",
    "completed": "completed",
    "complete": "completed",
    "hiatus": "hiatus",
    "on hold": "hiatus",
    "cancelled": "cancelled",
    "canceled": "cancelled",
}


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def first_text(node: Tag | BeautifulSoup, selectors: Iterable[str]) -> str:
    for selector in selectors:
        element = node.select_one(selector)
        if element:
            text = clean_text(element.get_text(" ", strip=True))
            if text:
                return text
    return ""


def image_from_node(node: Tag | None, base_url: str) -> Optional[str]:
    if not node:
        return None
    for attr in ("data-src", "data-lazy-src", "data-cfsrc", "src"):
        value = clean_text(node.get(attr))
        if value:
            return urljoin(base_url, value)
    srcset = clean_text(node.get("srcset"))
    if srcset:
        parts = [part.strip().split(" ")[0] for part in srcset.split(",")]
        for value in reversed(parts):
            if value:
                return urljoin(base_url, value)
    return None


def parse_status(text: str) -> str:
    lowered = clean_text(text).lower()
    for key, value in STATUS_MAP.items():
        if key in lowered:
            return value
    return "unknown"


def parse_chapter_number(title: str) -> Optional[float]:
    match = re.search(r"(?i)\bch(?:apter)?\.?\s*(\d+(?:\.\d+)?)", title)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    match = re.search(r"(?i)\bepisode\.?\s*(\d+(?:\.\d+)?)", title)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None


def parse_date(value: str | None, date_formats: Iterable[str]) -> Optional[int]:
    if not value:
        return None

    raw = clean_text(value)
    lowered = raw.lower()
    now = datetime.now(timezone.utc)

    if lowered in {"today", "just now"}:
        return int(now.timestamp() * 1000)
    if lowered == "yesterday":
        return int((now - timedelta(days=1)).timestamp() * 1000)

    relative_match = re.search(r"(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago", lowered)
    if relative_match:
        count = int(relative_match.group(1))
        unit = relative_match.group(2)
        if unit == "minute":
            dt = now - timedelta(minutes=count)
        elif unit == "hour":
            dt = now - timedelta(hours=count)
        elif unit == "day":
            dt = now - timedelta(days=count)
        elif unit == "week":
            dt = now - timedelta(weeks=count)
        elif unit == "month":
            dt = now - timedelta(days=count * 30)
        else:
            dt = now - timedelta(days=count * 365)
        return int(dt.timestamp() * 1000)

    normalized = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", raw, flags=re.IGNORECASE)
    for fmt in date_formats:
        try:
            dt = datetime.strptime(normalized, fmt)
            return int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000)
        except ValueError:
            continue

    try:
        return int(datetime.fromisoformat(normalized.replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return None


class BaseThemeScraper(BaseScraper):
    language = "en"
    version = "1.0.0"
    base_urls: List[str] = []
    request_timeout = 30.0
    sort_options = [
        SelectOption(value="latest", label="Latest"),
        SelectOption(value="views", label="Popular"),
        SelectOption(value="new", label="New"),
    ]

    def __init__(self) -> None:
        headers = {
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        }
        self.client = httpx.AsyncClient(
            headers=headers,
            timeout=httpx.Timeout(self.request_timeout),
            follow_redirects=True,
        )

    async def get_filters(self) -> List[Filter]:
        return [
            SelectFilter(
                id="sort",
                name="Sort",
                options=list(self.sort_options),
            ),
        ]

    async def _request_text(
        self,
        url: str,
        *,
        method: str = "GET",
        data: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> str:
        response = await self.client.request(method, url, data=data, headers=headers)
        response.raise_for_status()
        return response.text

    async def _request_soup(
        self,
        url: str,
        *,
        method: str = "GET",
        data: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> BeautifulSoup:
        return BeautifulSoup(
            await self._request_text(url, method=method, data=data, headers=headers),
            "lxml",
        )

    def abs_url(self, value: str) -> str:
        return urljoin(self.base_urls[0], value)

    def _build_url(self, path: str = "", **params: str | int | None) -> str:
        base = self.base_urls[0].rstrip("/") + "/"
        url = urljoin(base, path.lstrip("/"))
        query = {key: value for key, value in params.items() if value not in (None, "", False)}
        if not query:
            return url
        return f"{url}?{urlencode(query, doseq=True)}"
