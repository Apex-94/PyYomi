"""
Auto-generated PyYomi source port for MangaTone.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/mangatone
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class MangaTone(MadaraScraper):
    name = "MangaTone"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://mangatone.com"]
    upstream_slug = "mangatone"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/mangatone"
    theme_name = "madara"


source = MangaTone()
