"""
Auto-generated PyYomi source port for Platinum Crown.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/platinumcrown
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class PlatinumCrown(MadaraScraper):
    name = "Platinum Crown"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://platinumscans.com"]
    upstream_slug = "platinumcrown"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/platinumcrown"
    theme_name = "madara"


source = PlatinumCrown()
