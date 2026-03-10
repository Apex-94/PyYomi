"""
Auto-generated PyYomi source port for Aein Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/aeinscans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class AeinScans(KeyoappScraper):
    name = "Aein Scans"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://aeinscans.com"]
    upstream_slug = "aeinscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/aeinscans"
    theme_name = "keyoapp"


source = AeinScans()
