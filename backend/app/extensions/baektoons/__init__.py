"""
Auto-generated PyYomi source port for Baek Toons.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/baektoons
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class BaekToons(MangaThemesiaScraper):
    name = "Baek Toons"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://baektoons.com"]
    upstream_slug = "baektoons"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/baektoons"
    theme_name = "mangathemesia"


source = BaekToons()
