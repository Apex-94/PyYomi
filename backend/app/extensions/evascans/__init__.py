"""
Auto-generated PyYomi source port for Eva Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/evascans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class EvaScans(MangaThemesiaScraper):
    name = "Eva Scans"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://evascans.org"]
    upstream_slug = "evascans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/evascans"
    theme_name = "mangathemesia"


source = EvaScans()
