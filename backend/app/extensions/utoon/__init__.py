"""
Auto-generated PyYomi source port for Utoon.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/utoon
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class Utoon(MadaraScraper):
    name = "Utoon"
    language = "en"
    version = "1.0.3"
    base_urls = ["https://utoon.net"]
    upstream_slug = "utoon"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/utoon"
    theme_name = "madara"


source = Utoon()
