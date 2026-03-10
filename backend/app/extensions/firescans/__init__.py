"""
Auto-generated PyYomi source port for Firescans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/firescans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class Firescans(MadaraScraper):
    name = "Firescans"
    language = "en"
    version = "1.0.3"
    base_urls = ["https://firescans.xyz"]
    upstream_slug = "firescans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/firescans"
    theme_name = "madara"


source = Firescans()
