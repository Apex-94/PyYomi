"""
Auto-generated PyYomi source port for Genz Toons.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/suryascans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class GenzToons(KeyoappScraper):
    name = "Genz Toons"
    language = "en"
    version = "1.0.31"
    base_urls = ["https://genzupdates.com"]
    upstream_slug = "suryascans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/suryascans"
    theme_name = "keyoapp"


source = GenzToons()
