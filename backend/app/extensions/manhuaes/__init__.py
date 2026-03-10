"""
Auto-generated PyYomi source port for Manhua ES.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuaes
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class ManhuaES(MadaraScraper):
    name = "Manhua ES"
    language = "en"
    version = "1.0.6"
    base_urls = ["https://manhuaes.com"]
    upstream_slug = "manhuaes"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuaes"
    theme_name = "madara"


source = ManhuaES()
