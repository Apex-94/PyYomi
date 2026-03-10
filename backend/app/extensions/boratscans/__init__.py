"""
Auto-generated PyYomi source port for Borat Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/boratscans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class BoratScans(MadaraScraper):
    name = "Borat Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://boratscans.com"]
    upstream_slug = "boratscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/boratscans"
    theme_name = "madara"


source = BoratScans()
