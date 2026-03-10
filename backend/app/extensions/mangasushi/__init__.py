"""
Auto-generated PyYomi source port for Mangasushi.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/mangasushi
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class Mangasushi(MadaraScraper):
    name = "Mangasushi"
    language = "en"
    version = "1.0.3"
    base_urls = ["https://mangasushi.org"]
    upstream_slug = "mangasushi"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/mangasushi"
    theme_name = "madara"


source = Mangasushi()
