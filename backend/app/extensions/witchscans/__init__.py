"""
Auto-generated PyYomi source port for WitchScans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/witchscans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class WitchScans(MangaThemesiaScraper):
    name = "WitchScans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://witchscans.com"]
    upstream_slug = "witchscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/witchscans"
    theme_name = "mangathemesia"


source = WitchScans()
