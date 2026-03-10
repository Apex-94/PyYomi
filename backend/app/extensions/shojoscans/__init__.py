"""
Auto-generated PyYomi source port for Violet Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/shojoscans
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class VioletScans(MangaThemesiaScraper):
    name = "Violet Scans"
    language = "en"
    version = "1.0.3"
    base_urls = ["https://violetscans.org"]
    upstream_slug = "shojoscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/shojoscans"
    theme_name = "mangathemesia"


source = VioletScans()
