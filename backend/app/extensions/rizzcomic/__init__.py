"""
Auto-generated PyYomi source port for Rizz Comic.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/rizzcomic
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class RizzComic(MangaThemesiaScraper):
    name = "Rizz Comic"
    language = "en"
    version = "1.0.12"
    base_urls = ["https://rizzfables.com"]
    upstream_slug = "rizzcomic"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/rizzcomic"
    theme_name = "mangathemesia"


source = RizzComic()
