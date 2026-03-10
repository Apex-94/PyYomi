"""
Auto-generated PyYomi source port for Manga Kiss.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/mangakiss
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class MangaKiss(MadaraScraper):
    name = "Manga Kiss"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://mangakiss.org"]
    upstream_slug = "mangakiss"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/mangakiss"
    theme_name = "madara"


source = MangaKiss()
