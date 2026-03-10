"""
Auto-generated PyYomi source port for Hades Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/hadesscans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class HadesScans(MangaThemesiaScraper):
    name = "Hades Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://hadesscans.com"]
    upstream_slug = "hadesscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/hadesscans"
    theme_name = "mangathemesia"


source = HadesScans()
