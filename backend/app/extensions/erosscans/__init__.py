"""
Auto-generated PyYomi source port for Eros Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/erosscans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class ErosScans(MangaThemesiaScraper):
    name = "Eros Scans"
    language = "en"
    version = "1.0.5"
    base_urls = ["https://erosxsun.xyz"]
    upstream_slug = "erosscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/erosscans"
    theme_name = "mangathemesia"


source = ErosScans()
