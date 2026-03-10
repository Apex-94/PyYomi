"""
Auto-generated PyYomi source port for Philia Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/philiascans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class PhiliaScans(MadaraScraper):
    name = "Philia Scans"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://philiascans.org"]
    upstream_slug = "philiascans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/philiascans"
    theme_name = "madara"


source = PhiliaScans()
