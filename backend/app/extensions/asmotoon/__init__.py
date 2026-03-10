"""
Auto-generated PyYomi source port for Asmodeus Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/asmotoon
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class Asmotoon(KeyoappScraper):
    name = "Asmodeus Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://asmotoon.com"]
    upstream_slug = "asmotoon"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/asmotoon"
    theme_name = "keyoapp"


source = Asmotoon()
