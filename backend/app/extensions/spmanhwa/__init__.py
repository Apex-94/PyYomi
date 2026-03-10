"""
Auto-generated PyYomi source port for Spmanhwa.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/spmanhwa
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class Spmanhwa(MadaraScraper):
    name = "Spmanhwa"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://spmanhwa.online"]
    upstream_slug = "spmanhwa"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/spmanhwa"
    theme_name = "madara"


source = Spmanhwa()
