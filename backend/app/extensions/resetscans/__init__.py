"""
Auto-generated PyYomi source port for Reset Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/resetscans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class ResetScans(MadaraScraper):
    name = "Reset Scans"
    language = "en"
    version = "1.0.10"
    base_urls = ["https://reset-scans.org"]
    upstream_slug = "resetscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/resetscans"
    theme_name = "madara"


source = ResetScans()
