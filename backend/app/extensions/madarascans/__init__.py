"""
Auto-generated PyYomi source port for Madara Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/madarascans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class MadaraScans(MangaThemesiaScraper):
    name = "Madara Scans"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://madarascans.com"]
    upstream_slug = "madarascans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/madarascans"
    theme_name = "mangathemesia"


source = MadaraScans()
