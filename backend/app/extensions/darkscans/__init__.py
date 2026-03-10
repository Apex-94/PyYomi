"""
Auto-generated PyYomi source port for Dark Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/darkscans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class DarkScans(MadaraScraper):
    name = "Dark Scans"
    language = "en"
    version = "1.0.2"
    base_urls = ["https://darkscans.net"]
    upstream_slug = "darkscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/darkscans"
    theme_name = "madara"


source = DarkScans()
