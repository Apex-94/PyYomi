"""
Auto-generated PyYomi source port for S2Manga.io.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/jimanga
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class S2MangaIo(MadaraScraper):
    name = "S2Manga.io"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://s2manga.io"]
    upstream_slug = "jimanga"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/jimanga"
    theme_name = "madara"


source = S2MangaIo()
