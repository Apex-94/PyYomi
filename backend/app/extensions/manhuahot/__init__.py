"""
Auto-generated PyYomi source port for ManhuaHot.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuahot
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class ManhuaHot(MadaraScraper):
    name = "ManhuaHot"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://manhuahot.com"]
    upstream_slug = "manhuahot"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuahot"
    theme_name = "madara"


source = ManhuaHot()
