"""
Auto-generated PyYomi source port for Mist Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/mistscans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class MistScans(KeyoappScraper):
    name = "Mist Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://mistscans.com"]
    upstream_slug = "mistscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/mistscans"
    theme_name = "keyoapp"


source = MistScans()
