"""
Auto-generated PyYomi source port for Arcanescans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/arcanescans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class Arcanescans(MangaThemesiaScraper):
    name = "Arcanescans"
    language = "en"
    version = "1.0.15"
    base_urls = ["https://arcanescans.com"]
    upstream_slug = "arcanescans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/arcanescans"
    theme_name = "mangathemesia"


source = Arcanescans()
