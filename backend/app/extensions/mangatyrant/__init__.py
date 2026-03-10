"""
Auto-generated PyYomi source port for MangaTyrant.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/mangatyrant
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class MangaTyrant(MadaraScraper):
    name = "MangaTyrant"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://mangatyrant.com"]
    upstream_slug = "mangatyrant"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/mangatyrant"
    theme_name = "madara"


source = MangaTyrant()
