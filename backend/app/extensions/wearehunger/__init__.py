"""
Auto-generated PyYomi source port for Wearehunger.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/wearehunger
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class Wearehunger(MadaraScraper):
    name = "Wearehunger"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://www.wearehunger.site"]
    upstream_slug = "wearehunger"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/wearehunger"
    theme_name = "madara"


source = Wearehunger()
