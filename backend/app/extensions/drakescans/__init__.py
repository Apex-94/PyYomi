"""
Auto-generated PyYomi source port for Drake Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/drakescans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class DrakeScans(MangaThemesiaScraper):
    name = "Drake Scans"
    language = "en"
    version = "1.0.15"
    base_urls = ["https://drakecomic.org"]
    upstream_slug = "drakescans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/drakescans"
    theme_name = "mangathemesia"


source = DrakeScans()
