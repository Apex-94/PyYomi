"""
Auto-generated PyYomi source port for Rage Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/ragescans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class RageScans(MangaThemesiaScraper):
    name = "Rage Scans"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://ragescans.com"]
    upstream_slug = "ragescans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/ragescans"
    theme_name = "mangathemesia"


source = RageScans()
