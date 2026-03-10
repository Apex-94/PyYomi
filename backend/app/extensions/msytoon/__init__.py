"""
Auto-generated PyYomi source port for MSYToon.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/msytoon
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class MSYToon(KeyoappScraper):
    name = "MSYToon"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://msytoon.com"]
    upstream_slug = "msytoon"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/msytoon"
    theme_name = "keyoapp"


source = MSYToon()
