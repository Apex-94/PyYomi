"""
Auto-generated PyYomi source port for Lagoon Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/lagoonscans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class LagoonScans(MangaThemesiaScraper):
    name = "Lagoon Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://lagoonscans.com"]
    upstream_slug = "lagoonscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/lagoonscans"
    theme_name = "mangathemesia"


source = LagoonScans()
