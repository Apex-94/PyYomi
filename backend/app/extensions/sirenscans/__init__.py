"""
Auto-generated PyYomi source port for Siren Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/sirenscans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class SirenScans(KeyoappScraper):
    name = "Siren Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://sirenscans.com"]
    upstream_slug = "sirenscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/sirenscans"
    theme_name = "keyoapp"


source = SirenScans()
