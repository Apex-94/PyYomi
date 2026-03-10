"""
Auto-generated PyYomi source port for RitharScans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/ritharscans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class RitharScans(KeyoappScraper):
    name = "RitharScans"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://ritharscans.com"]
    upstream_slug = "ritharscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/ritharscans"
    theme_name = "keyoapp"


source = RitharScans()
