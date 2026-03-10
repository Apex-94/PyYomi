"""
Auto-generated PyYomi source port for FlameScans.lol.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/plutoscans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class FlameScanslol(MadaraScraper):
    name = "FlameScans.lol"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://flamescans.lol"]
    upstream_slug = "plutoscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/plutoscans"
    theme_name = "madara"


source = FlameScanslol()
