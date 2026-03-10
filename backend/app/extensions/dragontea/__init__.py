"""
Auto-generated PyYomi source port for DragonTea.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/dragontea
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class DragonTea(MadaraScraper):
    name = "DragonTea"
    language = "en"
    version = "1.0.4"
    base_urls = ["https://dragontea.ink"]
    upstream_slug = "dragontea"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/dragontea"
    theme_name = "madara"


source = DragonTea()
