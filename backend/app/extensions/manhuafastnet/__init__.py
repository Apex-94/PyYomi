"""
Auto-generated PyYomi source port for ManhuaFast.net (unoriginal).
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuafastnet
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class ManhuaFastNet(MadaraScraper):
    name = "ManhuaFast.net (unoriginal)"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://manhuafast.net"]
    upstream_slug = "manhuafastnet"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuafastnet"
    theme_name = "madara"


source = ManhuaFastNet()
