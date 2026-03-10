"""
Auto-generated PyYomi source port for Setsu Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/setsuscans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class SetsuScans(MadaraScraper):
    name = "Setsu Scans"
    language = "en"
    version = "1.0.2"
    base_urls = ["https://setsuscans.com"]
    upstream_slug = "setsuscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/setsuscans"
    theme_name = "madara"


source = SetsuScans()
