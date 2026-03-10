"""
Auto-generated PyYomi source port for Evil Flowers.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/evilflowers
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class EvilFlowers(MadaraScraper):
    name = "Evil Flowers"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://evilflowers.com"]
    upstream_slug = "evilflowers"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/evilflowers"
    theme_name = "madara"


source = EvilFlowers()
