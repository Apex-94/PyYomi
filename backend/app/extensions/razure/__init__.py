"""
Auto-generated PyYomi source port for Razure.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/razure
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class Razure(MangaThemesiaScraper):
    name = "Razure"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://razure.org"]
    upstream_slug = "razure"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/razure"
    theme_name = "mangathemesia"


source = Razure()
