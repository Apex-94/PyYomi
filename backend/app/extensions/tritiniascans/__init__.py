"""
Auto-generated PyYomi source port for TritiniaScans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/tritiniascans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class TritiniaScans(MadaraScraper):
    name = "TritiniaScans"
    language = "en"
    version = "1.0.4"
    base_urls = ["https://tritinia.org"]
    upstream_slug = "tritiniascans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/tritiniascans"
    theme_name = "madara"


source = TritiniaScans()
