"""
Auto-generated PyYomi source port for Manhuanext.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuanext
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class Manhuanext(MadaraScraper):
    name = "Manhuanext"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://manhuanext.com"]
    upstream_slug = "manhuanext"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuanext"
    theme_name = "madara"


source = Manhuanext()
