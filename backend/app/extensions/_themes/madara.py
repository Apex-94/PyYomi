from __future__ import annotations

from typing import Iterable, List, Optional

import httpx
from bs4 import BeautifulSoup, Tag

from app.extensions.base import Chapter, MangaCard, MangaDetails
from app.extensions._themes.common import (
    BaseThemeScraper,
    clean_text,
    first_text,
    image_from_node,
    parse_chapter_number,
    parse_date,
    parse_status,
)


class MadaraScraper(BaseThemeScraper):
    theme_name = "madara"
    manga_path = "manga"
    page_image_selectors = (
        "div.page-break img",
        "li.blocks-gallery-item img",
        ".reading-content img",
        ".entry-content img",
    )
    list_card_selectors = (
        "div.page-item-detail",
        ".manga__item",
        ".c-tabs-item__content",
        ".postbody",
    )
    title_selectors = (
        "div.post-title h3 a",
        "div.post-title h4 a",
        ".post-title a",
        "h3 a",
        "h4 a",
        "a",
    )
    thumb_selectors = (
        "div.item-thumb img",
        ".tab-thumb img",
        ".thumb img",
        "img",
    )
    details_title_selectors = (
        "div.post-title h1",
        ".summary__content h1",
        "h1",
    )
    details_description_selectors = (
        "div.summary__content p",
        "div.description-summary div.summary__content",
        "div.summary_content div.manga-excerpt",
        ".description-summary",
    )
    details_author_selectors = (
        "div.author-content a",
        "div.manga-authors a",
        ".author-content",
    )
    details_artist_selectors = (
        "div.artist-content a",
        ".artist-content",
    )
    details_status_selectors = (
        "div.summary-content",
        ".post-status .summary-content",
    )
    details_genre_selectors = (
        "div.genres-content a",
        ".genres-content a",
        ".tags-content a",
    )
    details_thumb_selectors = (
        "div.summary_image img",
        ".summary_image img",
        ".summary__thumbnail img",
    )
    chapter_selectors = (
        "li.wp-manga-chapter",
        ".main li.wp-manga-chapter",
        ".listing-chapters_wrap li",
    )
    chapter_link_selectors = ("a",)
    chapter_date_selectors = (
        "span.chapter-release-date",
        ".chapter-release-date",
        ".chapter-time",
    )
    date_formats = (
        "%B %d, %Y",
        "%b %d, %Y",
        "%Y-%m-%d",
        "%d %B %Y",
        "%d-%m-%Y",
    )

    def archive_url(self, page: int, *, order: Optional[str] = None) -> str:
        path = f"{self.manga_path}/"
        if page > 1:
            path = f"{path}page/{page}/"
        params = {}
        if order:
            params["m_orderby"] = order
        return self._build_url(path, **params)

    def search_url(self, query: str, page: int) -> str:
        path = ""
        if page > 1:
            path = f"page/{page}/"
        return self._build_url(path, s=query, post_type="wp-manga")

    def chapter_ajax_url(self, manga_url: str) -> str:
        return manga_url.rstrip("/") + "/ajax/chapters/"

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

    async def search(self, query: str, page: int = 1, filters=None) -> List[MangaCard]:
        if not query.strip():
            return await self.popular(page)
        try:
            return self._parse_cards(await self._request_soup(self.search_url(query.strip(), page)))
        except httpx.HTTPError:
            return []

    async def popular(self, page: int = 1) -> List[MangaCard]:
        try:
            return self._parse_cards(await self._request_soup(self.archive_url(page, order="views")))
        except httpx.HTTPError:
            return []

    async def latest(self, page: int = 1) -> List[MangaCard]:
        try:
            return self._parse_cards(await self._request_soup(self.archive_url(page, order="latest")))
        except httpx.HTTPError:
            return []

    def _parse_cards(self, doc: BeautifulSoup) -> List[MangaCard]:
        cards: List[MangaCard] = []
        seen = set()
        for selector in self.list_card_selectors:
            nodes = doc.select(selector)
            if nodes:
                for node in nodes:
                    card = self._card_from_node(node)
                    if not card or card.url in seen:
                        continue
                    seen.add(card.url)
                    cards.append(card)
                if cards:
                    break
        return cards

    def _card_from_node(self, node: Tag) -> Optional[MangaCard]:
        link = None
        title = ""
        for selector in self.title_selectors:
            link = node.select_one(selector)
            if link and link.get("href"):
                title = clean_text(link.get_text(" ", strip=True))
                if title:
                    break
        if not link or not link.get("href"):
            return None
        thumb = None
        for selector in self.thumb_selectors:
            thumb = image_from_node(node.select_one(selector), self.base_urls[0])
            if thumb:
                break
        return MangaCard(
            title=title or clean_text(link.get("title")) or "Untitled",
            url=self.abs_url(link["href"]),
            thumbnail_url=thumb,
            source=self.name,
        )

    async def details(self, manga_url: str) -> MangaDetails:
        try:
            return self._parse_details(await self._request_soup(manga_url), manga_url)
        except httpx.HTTPError:
            return self._empty_details(manga_url)

    def _parse_details(self, doc: BeautifulSoup, manga_url: str) -> MangaDetails:
        title = first_text(doc, self.details_title_selectors)
        description = ""
        for selector in self.details_description_selectors:
            nodes = doc.select(selector)
            if nodes:
                description = "\n\n".join(
                    clean_text(node.get_text(" ", strip=True))
                    for node in nodes
                    if clean_text(node.get_text(" ", strip=True))
                )
                if description:
                    break
        author = first_text(doc, self.details_author_selectors) or None
        artist = first_text(doc, self.details_artist_selectors) or None
        status = "unknown"
        for selector in self.details_status_selectors:
            nodes = doc.select(selector)
            for node in nodes:
                parsed = parse_status(node.get_text(" ", strip=True))
                if parsed != "unknown":
                    status = parsed
                    break
            if status != "unknown":
                break
        genres: List[str] = []
        for selector in self.details_genre_selectors:
            for node in doc.select(selector):
                text = clean_text(node.get_text(" ", strip=True))
                if text and text not in genres:
                    genres.append(text)
        thumb = None
        for selector in self.details_thumb_selectors:
            thumb = image_from_node(doc.select_one(selector), self.base_urls[0])
            if thumb:
                break
        return MangaDetails(
            title=title or "Unknown",
            description=description,
            author=author,
            artist=artist,
            status=status,
            genres=genres,
            thumbnail_url=thumb,
            source_url=manga_url,
        )

    async def chapters(self, manga_url: str) -> List[Chapter]:
        try:
            doc = await self._request_soup(manga_url)
        except httpx.HTTPError:
            return []
        chapters = self._parse_chapters(doc)
        if chapters:
            return chapters

        headers = {"X-Requested-With": "XMLHttpRequest", "Referer": manga_url}
        try:
            fragment = await self._request_soup(
                self.chapter_ajax_url(manga_url),
                method="POST",
                headers=headers,
            )
            return self._parse_chapters(fragment)
        except Exception:
            return []

    def _parse_chapters(self, doc: BeautifulSoup) -> List[Chapter]:
        items: List[Chapter] = []
        seen = set()
        for selector in self.chapter_selectors:
            nodes = doc.select(selector)
            if not nodes:
                continue
            for node in nodes:
                chapter = self._chapter_from_node(node)
                if not chapter or chapter.url in seen:
                    continue
                seen.add(chapter.url)
                items.append(chapter)
            if items:
                break
        items.reverse()
        return items

    def _chapter_from_node(self, node: Tag) -> Optional[Chapter]:
        link = None
        for selector in self.chapter_link_selectors:
            link = node.select_one(selector)
            if link and link.get("href"):
                break
        if not link or not link.get("href"):
            return None
        title = clean_text(link.get_text(" ", strip=True)) or "Chapter"
        uploaded_at = None
        for selector in self.chapter_date_selectors:
            element = node.select_one(selector)
            if element:
                uploaded_at = parse_date(element.get_text(" ", strip=True), self.date_formats)
                if uploaded_at:
                    break
        return Chapter(
            title=title,
            url=self.abs_url(link["href"]),
            chapter_number=parse_chapter_number(title),
            uploaded_at_ts=uploaded_at,
        )

    async def pages(self, chapter_url: str) -> List[str]:
        try:
            doc = await self._request_soup(chapter_url)
        except httpx.HTTPError:
            return []
        pages: List[str] = []
        seen = set()
        for selector in self.page_image_selectors:
            for node in doc.select(selector):
                image = image_from_node(node if node.name == "img" else node.select_one("img"), self.base_urls[0])
                if image and image not in seen:
                    seen.add(image)
                    pages.append(image)
            if pages:
                break
        return pages
