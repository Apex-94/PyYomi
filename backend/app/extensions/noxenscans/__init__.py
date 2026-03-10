"""
Auto-generated PyYomi source port for Noxen Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/noxenscans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class NoxenScans(MangaThemesiaScraper):
    name = "Noxen Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://noxenscan.com"]
    upstream_slug = "noxenscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/noxenscans"
    theme_name = "mangathemesia"


source = NoxenScans()
