"""
Auto-generated PyYomi source port for Arven Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/arvencomics
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class ArvenComics(MadaraScraper):
    name = "Arven Scans"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://arvencomics.com"]
    upstream_slug = "arvencomics"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/arvencomics"
    theme_name = "madara"


source = ArvenComics()
