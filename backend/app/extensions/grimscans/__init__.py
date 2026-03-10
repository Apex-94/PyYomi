"""
Auto-generated PyYomi source port for Grim Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/grimscans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class GrimScans(KeyoappScraper):
    name = "Grim Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://grimscans.com"]
    upstream_slug = "grimscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/grimscans"
    theme_name = "keyoapp"


source = GrimScans()
