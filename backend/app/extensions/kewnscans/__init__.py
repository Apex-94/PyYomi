"""
Auto-generated PyYomi source port for Kewn Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/kewnscans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class KewnScans(KeyoappScraper):
    name = "Kewn Scans"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://kewnscans.org"]
    upstream_slug = "kewnscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/kewnscans"
    theme_name = "keyoapp"


source = KewnScans()
