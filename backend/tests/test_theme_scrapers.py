from __future__ import annotations

import unittest
from unittest.mock import AsyncMock

from bs4 import BeautifulSoup
import httpx

from app.extensions._themes.madtheme import MadThemeScraper
from app.extensions.arcanescans import Arcanescans
from app.extensions.manhuaplus import ManhuaPlus
from app.extensions.mistscans import MistScans


DETAILS_HTML = """
<html>
  <div class="post-title"><h1>Sample Series</h1></div>
  <div class="summary_image"><img src="/cover.jpg"/></div>
  <div class="author-content"><a>Author Name</a></div>
  <div class="artist-content"><a>Artist Name</a></div>
  <div class="post-status"><div class="summary-content">Completed</div></div>
  <div class="genres-content"><a>Action</a><a>Fantasy</a></div>
  <div class="description-summary"><div class="summary__content"><p>First paragraph.</p><p>Second paragraph.</p></div></div>
</html>
"""

CHAPTERS_HTML = """
<html>
  <ul>
    <li class="wp-manga-chapter">
      <a href="/series/chapter-2">Chapter 2</a>
      <span class="chapter-release-date">January 02, 2026</span>
    </li>
    <li class="wp-manga-chapter">
      <a href="/series/chapter-1">Chapter 1</a>
      <span class="chapter-release-date">January 01, 2026</span>
    </li>
  </ul>
</html>
"""

PAGES_HTML = """
<html>
  <div class="reading-content">
    <div class="page-break"><img data-src="/page-1.jpg"/></div>
    <div class="page-break"><img src="/page-2.jpg"/></div>
  </div>
</html>
"""

CARDS_HTML = """
<html>
  <div class="page-item-detail">
    <div class="post-title"><h3><a href="/series/sample">Sample Series</a></h3></div>
    <div class="item-thumb"><img src="/thumb.jpg"/></div>
  </div>
</html>
"""


class SampleMadThemeSite(MadThemeScraper):
    name = "Sample MadTheme"
    base_urls = ["https://madtheme.example"]


class ThemeScraperRepresentativeTests(unittest.IsolatedAsyncioTestCase):
    async def test_madara_source_parses_core_flows(self) -> None:
        scraper = ManhuaPlus()
        scraper._request_soup = AsyncMock(
            side_effect=[
                BeautifulSoup(CARDS_HTML, "lxml"),
                BeautifulSoup(DETAILS_HTML, "lxml"),
                BeautifulSoup(CHAPTERS_HTML, "lxml"),
                BeautifulSoup(PAGES_HTML, "lxml"),
            ]
        )

        cards = await scraper.popular()
        details = await scraper.details("https://manhuaplus.com/series/sample")
        chapters = await scraper.chapters("https://manhuaplus.com/series/sample")
        pages = await scraper.pages("https://manhuaplus.com/series/chapter-1")

        self.assertEqual(cards[0].title, "Sample Series")
        self.assertEqual(details.status, "completed")
        self.assertEqual(chapters[0].title, "Chapter 1")
        self.assertEqual(len(pages), 2)

    async def test_mangathemesia_source_parses_cards(self) -> None:
        scraper = Arcanescans()
        scraper._request_soup = AsyncMock(return_value=BeautifulSoup(CARDS_HTML, "lxml"))

        cards = await scraper.popular()

        self.assertEqual(cards[0].url, "https://arcanescans.com/series/sample")

    async def test_keyoapp_source_parses_details(self) -> None:
        scraper = MistScans()
        scraper._request_soup = AsyncMock(return_value=BeautifulSoup(DETAILS_HTML, "lxml"))

        details = await scraper.details("https://mistscans.com/series/sample")

        self.assertEqual(details.author, "Author Name")
        self.assertEqual(details.genres, ["Action", "Fantasy"])

    async def test_madtheme_source_parses_pages(self) -> None:
        scraper = SampleMadThemeSite()
        scraper._request_soup = AsyncMock(return_value=BeautifulSoup(PAGES_HTML, "lxml"))

        pages = await scraper.pages("https://madtheme.example/series/chapter-1")

        self.assertEqual(
            pages,
            [
                "https://madtheme.example/page-1.jpg",
                "https://madtheme.example/page-2.jpg",
            ],
        )

    async def test_madara_source_handles_upstream_browse_error(self) -> None:
        scraper = ManhuaPlus()
        request = httpx.Request("GET", "https://manhuaplus.com/manga/?m_orderby=latest")
        response = httpx.Response(403, request=request)
        scraper._request_soup = AsyncMock(side_effect=httpx.HTTPStatusError("Forbidden", request=request, response=response))

        cards = await scraper.latest()

        self.assertEqual(cards, [])

    async def test_madara_source_handles_upstream_details_error(self) -> None:
        scraper = ManhuaPlus()
        request = httpx.Request("GET", "https://manhuaplus.com/series/sample")
        response = httpx.Response(403, request=request)
        scraper._request_soup = AsyncMock(side_effect=httpx.HTTPStatusError("Forbidden", request=request, response=response))

        details = await scraper.details("https://manhuaplus.com/series/sample")

        self.assertEqual(details.title, "Unknown")
        self.assertEqual(details.status, "unknown")

    async def test_madara_source_handles_upstream_pages_error(self) -> None:
        scraper = ManhuaPlus()
        request = httpx.Request("GET", "https://manhuaplus.com/series/chapter-1")
        response = httpx.Response(403, request=request)
        scraper._request_soup = AsyncMock(side_effect=httpx.HTTPStatusError("Forbidden", request=request, response=response))

        pages = await scraper.pages("https://manhuaplus.com/series/chapter-1")

        self.assertEqual(pages, [])
