"""
Auto-generated PyYomi source port for YakshaComics.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/yakshacomics
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class YakshaComics(MadaraScraper):
    name = "YakshaComics"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://yakshacomics.com"]
    upstream_slug = "yakshacomics"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/yakshacomics"
    theme_name = "madara"


source = YakshaComics()
