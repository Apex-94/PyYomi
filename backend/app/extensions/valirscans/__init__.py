"""
Auto-generated PyYomi source port for Valir Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/valirscans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class ValirScans(KeyoappScraper):
    name = "Valir Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://valirscans.com"]
    upstream_slug = "valirscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/valirscans"
    theme_name = "keyoapp"


source = ValirScans()
