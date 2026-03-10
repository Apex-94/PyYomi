"""
Auto-generated PyYomi source port for Nitro Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/nitroscans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class NitroScans(MadaraScraper):
    name = "Nitro Scans"
    language = "en"
    version = "1.0.2"
    base_urls = ["https://nitroscans.net"]
    upstream_slug = "nitroscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/nitroscans"
    theme_name = "madara"


source = NitroScans()
