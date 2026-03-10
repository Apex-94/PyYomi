"""
Auto-generated PyYomi source port for TCB Scans (Unoriginal).
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/tcbscansunoriginal
"""

from __future__ import annotations

from app.extensions._themes.mangathemesia import MangaThemesiaScraper


class TCBScansUnoriginal(MangaThemesiaScraper):
    name = "TCB Scans (Unoriginal)"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://tcbscanonepiecechapters.com"]
    upstream_slug = "tcbscansunoriginal"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/tcbscansunoriginal"
    theme_name = "mangathemesia"


source = TCBScansUnoriginal()
