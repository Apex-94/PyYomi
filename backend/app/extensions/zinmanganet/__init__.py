"""
Auto-generated PyYomi source port for Zinmanga.net.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/zinmanganet
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class ZinmangaNet(MadaraScraper):
    name = "Zinmanga.net"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://zinmanga.net"]
    upstream_slug = "zinmanganet"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/zinmanganet"
    theme_name = "madara"


source = ZinmangaNet()
