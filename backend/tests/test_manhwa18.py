from __future__ import annotations

import unittest
from unittest.mock import AsyncMock

from app.extensions.base import Filter
from app.extensions.manhwa18 import Manhwa18Scraper


class Manhwa18ScraperTests(unittest.IsolatedAsyncioTestCase):
    async def test_search_returns_absolute_urls(self) -> None:
        scraper = Manhwa18Scraper()
        scraper._get_json = AsyncMock(
            return_value=[
                {
                    "name": "Sample Series",
                    "slug": "sample-series",
                    "url_avatar": "https://cdn.example/cover.jpg",
                }
            ]
        )

        cards = await scraper.search("sample")

        self.assertEqual(cards[0].url, "https://manhwa18.com/manga/sample-series")
        self.assertEqual(cards[0].thumbnail_url, "https://cdn.example/cover.jpg")

    async def test_details_parses_status_and_source_url(self) -> None:
        scraper = Manhwa18Scraper()
        scraper._get_json = AsyncMock(
            return_value={
                "product": {
                    "name": "Sample Series",
                    "desc": "<p>Summary</p>",
                    "is_end": 1,
                    "url_avatar": "https://cdn.example/cover.jpg",
                    "types": [{"name": "Action"}],
                    "nation": {"name": "Korea"},
                    "category_id": 2,
                }
            }
        )

        details = await scraper.details("https://manhwa18.com/manga/sample-series")

        self.assertEqual(details.status, "completed")
        self.assertEqual(details.source_url, "https://manhwa18.com/manga/sample-series")
        self.assertEqual(details.genres, ["Action", "Korea", "Sub"])

    async def test_search_without_query_uses_filtered_browse(self) -> None:
        scraper = Manhwa18Scraper()
        scraper._get_json = AsyncMock(
            return_value={
                "products": {
                    "data": [
                        {
                            "name": "Filtered Series",
                            "slug": "filtered-series",
                            "url_avatar": "",
                        }
                    ]
                }
            }
        )

        cards = await scraper.search("", filters=[Filter(id="sort", name="Sort", value="new-updated")])

        self.assertEqual(cards[0].title, "Filtered Series")
        called_url = scraper._get_json.await_args.args[0]
        self.assertIn("arrange=new-updated", called_url)
