"""
Auto-generated PyYomi source port for Manhua Plus.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuaplus
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class ManhuaPlus(MadaraScraper):
    name = "Manhua Plus"
    language = "en"
    version = "1.0.7"
    base_urls = ["https://manhuaplus.com"]
    upstream_slug = "manhuaplus"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuaplus"
    theme_name = "madara"


source = ManhuaPlus()
