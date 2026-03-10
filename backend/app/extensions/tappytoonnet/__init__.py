"""
Auto-generated PyYomi source port for TappyToon.Net.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/tappytoonnet
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class Tappytoonnet(MadaraScraper):
    name = "TappyToon.Net"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://tappytoon.net"]
    upstream_slug = "tappytoonnet"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/tappytoonnet"
    theme_name = "madara"


source = Tappytoonnet()
