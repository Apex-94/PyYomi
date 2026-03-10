"""
Auto-generated PyYomi source port for Webdex Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/webdexscans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class WebdexScans(MadaraScraper):
    name = "Webdex Scans"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://webdexscans.com"]
    upstream_slug = "webdexscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/webdexscans"
    theme_name = "madara"


source = WebdexScans()
