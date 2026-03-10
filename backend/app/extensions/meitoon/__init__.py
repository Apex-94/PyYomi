"""
Auto-generated PyYomi source port for MeiToon.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/meitoon
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class MeiToon(KeyoappScraper):
    name = "MeiToon"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://meitoon.org"]
    upstream_slug = "meitoon"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/meitoon"
    theme_name = "keyoapp"


source = MeiToon()
