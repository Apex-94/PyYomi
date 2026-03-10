"""
Auto-generated PyYomi source port for Necro Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/necroscans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class NecroScans(KeyoappScraper):
    name = "Necro Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://necroscans.com"]
    upstream_slug = "necroscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/necroscans"
    theme_name = "keyoapp"


source = NecroScans()
