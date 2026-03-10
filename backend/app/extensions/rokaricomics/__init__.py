"""
Auto-generated PyYomi source port for RokariComics.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/rokaricomics
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class RokariComics(MangaThemesiaScraper):
    name = "RokariComics"
    language = "en"
    version = "1.0.2"
    base_urls = ["https://rokaricomics.com"]
    upstream_slug = "rokaricomics"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/rokaricomics"
    theme_name = "mangathemesia"


source = RokariComics()
