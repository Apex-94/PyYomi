"""
Auto-generated PyYomi source port for Art Lapsa.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/artlapsa
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class ArtLapsa(KeyoappScraper):
    name = "Art Lapsa"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://artlapsa.com"]
    upstream_slug = "artlapsa"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/artlapsa"
    theme_name = "keyoapp"


source = ArtLapsa()
