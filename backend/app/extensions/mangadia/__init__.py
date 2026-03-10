"""
Auto-generated PyYomi source port for MangaDia.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/mangadia
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class MangaDia(MadaraScraper):
    name = "MangaDia"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://mangadia.com"]
    upstream_slug = "mangadia"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/mangadia"
    theme_name = "madara"


source = MangaDia()
