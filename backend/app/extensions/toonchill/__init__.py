"""
Auto-generated PyYomi source port for ToonChill.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/toonchill
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class ToonChill(MadaraScraper):
    name = "ToonChill"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://toonchill.com"]
    upstream_slug = "toonchill"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/toonchill"
    theme_name = "madara"


source = ToonChill()
