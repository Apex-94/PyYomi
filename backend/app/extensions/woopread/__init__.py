"""
Auto-generated PyYomi source port for WoopRead.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/woopread
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class WoopRead(MadaraScraper):
    name = "WoopRead"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://woopread.com"]
    upstream_slug = "woopread"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/woopread"
    theme_name = "madara"


source = WoopRead()
