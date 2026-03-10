"""
Auto-generated PyYomi source port for Arya Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/aryascans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class AryaScans(MadaraScraper):
    name = "Arya Scans"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://brainrotcomics.com"]
    upstream_slug = "aryascans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/aryascans"
    theme_name = "madara"


source = AryaScans()
