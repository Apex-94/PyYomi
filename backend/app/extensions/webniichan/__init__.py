"""
Auto-generated PyYomi source port for Web Niichan.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/webniichan
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class WebNiichan(MadaraScraper):
    name = "Web Niichan"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://webniichan.online"]
    upstream_slug = "webniichan"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/webniichan"
    theme_name = "madara"


source = WebNiichan()
