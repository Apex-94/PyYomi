"""
Auto-generated PyYomi source port for ManhuaUS.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuaus
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class ManhuaUS(MadaraScraper):
    name = "ManhuaUS"
    language = "en"
    version = "1.0.5"
    base_urls = ["https://manhuaus.com"]
    upstream_slug = "manhuaus"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/manhuaus"
    theme_name = "madara"


source = ManhuaUS()
