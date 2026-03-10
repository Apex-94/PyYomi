"""
Auto-generated PyYomi source port for Elf Toon.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/elftoon
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class ElfToon(MangaThemesiaScraper):
    name = "Elf Toon"
    language = "en"
    version = "1.0.2"
    base_urls = ["https://elftoon.com"]
    upstream_slug = "elftoon"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/elftoon"
    theme_name = "mangathemesia"


source = ElfToon()
