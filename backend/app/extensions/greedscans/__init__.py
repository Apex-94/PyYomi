"""
Auto-generated PyYomi source port for greed scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/greedscans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class GreedScans(MangaThemesiaScraper):
    name = "greed scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://greedscans.com"]
    upstream_slug = "greedscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/greedscans"
    theme_name = "mangathemesia"


source = GreedScans()
