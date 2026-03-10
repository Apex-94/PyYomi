"""
Auto-generated PyYomi source port for SectScans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/sectscans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class SectScans(MadaraScraper):
    name = "SectScans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://sectscans.com"]
    upstream_slug = "sectscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/sectscans"
    theme_name = "madara"


source = SectScans()
