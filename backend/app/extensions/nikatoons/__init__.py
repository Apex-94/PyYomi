"""
Auto-generated PyYomi source port for Nika Toons.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/nikatoons
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class NikaToons(MangaThemesiaScraper):
    name = "Nika Toons"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://nikatoons.com"]
    upstream_slug = "nikatoons"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/nikatoons"
    theme_name = "mangathemesia"


source = NikaToons()
