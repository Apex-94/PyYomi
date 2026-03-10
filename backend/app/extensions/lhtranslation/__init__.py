"""
Auto-generated PyYomi source port for LHTranslation.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/lhtranslation
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class LHTranslation(MadaraScraper):
    name = "LHTranslation"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://lhtranslation.net"]
    upstream_slug = "lhtranslation"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/lhtranslation"
    theme_name = "madara"


source = LHTranslation()
