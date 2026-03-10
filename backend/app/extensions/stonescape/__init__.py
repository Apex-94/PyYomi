"""
Auto-generated PyYomi source port for StoneScape.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/stonescape
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class StoneScape(MadaraScraper):
    name = "StoneScape"
    language = "en"
    version = "1.0.2"
    base_urls = ["https://stonescape.xyz"]
    upstream_slug = "stonescape"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/stonescape"
    theme_name = "madara"


source = StoneScape()
