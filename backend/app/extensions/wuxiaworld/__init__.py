"""
Auto-generated PyYomi source port for WuxiaWorld.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/wuxiaworld
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class WuxiaWorld(MadaraScraper):
    name = "WuxiaWorld"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://wuxiaworld.site"]
    upstream_slug = "wuxiaworld"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/wuxiaworld"
    theme_name = "madara"


source = WuxiaWorld()
