"""
Auto-generated PyYomi source port for Ryumanga.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/ryumanga
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class Ryumanga(KeyoappScraper):
    name = "Ryumanga"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://ryumanga.org"]
    upstream_slug = "ryumanga"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/ryumanga"
    theme_name = "keyoapp"


source = Ryumanga()
