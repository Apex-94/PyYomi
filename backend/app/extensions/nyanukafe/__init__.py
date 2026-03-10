"""
Auto-generated PyYomi source port for Nyanu Kafe.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/nyanukafe
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class NyanuKafe(KeyoappScraper):
    name = "Nyanu Kafe"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://nyanukafe.com"]
    upstream_slug = "nyanukafe"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/nyanukafe"
    theme_name = "keyoapp"


source = NyanuKafe()
