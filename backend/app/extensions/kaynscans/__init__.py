"""
Auto-generated PyYomi source port for Kayn Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/kaynscans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class KaynScans(KeyoappScraper):
    name = "Kayn Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://kaynscan.com"]
    upstream_slug = "kaynscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/kaynscans"
    theme_name = "keyoapp"


source = KaynScans()
