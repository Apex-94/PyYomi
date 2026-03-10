"""
Auto-generated PyYomi source port for Rizz Comic (unoriginal).
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/rizzcomicunoriginal
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class RizzComicUnoriginal(MangaThemesiaScraper):
    name = "Rizz Comic (unoriginal)"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://rizzcomic.com"]
    upstream_slug = "rizzcomicunoriginal"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/rizzcomicunoriginal"
    theme_name = "mangathemesia"


source = RizzComicUnoriginal()
