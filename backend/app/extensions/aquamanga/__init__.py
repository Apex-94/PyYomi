"""
Auto-generated PyYomi source port for Aqua Manga.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/aquamanga
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class AquaManga(MadaraScraper):
    name = "Aqua Manga"
    language = "en"
    version = "1.0.9"
    base_urls = ["https://aquareader.net"]
    upstream_slug = "aquamanga"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/aquamanga"
    theme_name = "madara"


source = AquaManga()
