"""
Auto-generated PyYomi source port for RD Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/rdscans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class RDScans(MadaraScraper):
    name = "RD Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://rdscans.com"]
    upstream_slug = "rdscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/rdscans"
    theme_name = "madara"


source = RDScans()
