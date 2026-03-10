"""
Auto-generated PyYomi source port for Rackus.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/pmscans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class Rackus(MangaThemesiaScraper):
    name = "Rackus"
    language = "en"
    version = "1.0.7"
    base_urls = ["https://rackusreads.com"]
    upstream_slug = "pmscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/pmscans"
    theme_name = "mangathemesia"


source = Rackus()
