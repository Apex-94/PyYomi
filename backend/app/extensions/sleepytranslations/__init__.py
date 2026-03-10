"""
Auto-generated PyYomi source port for Sleepy Translations.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/sleepytranslations
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class SleepyTranslations(MadaraScraper):
    name = "Sleepy Translations"
    language = "en"
    version = "1.0.1"
    base_urls = ["https://sleepytranslations.com"]
    upstream_slug = "sleepytranslations"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/sleepytranslations"
    theme_name = "madara"


source = SleepyTranslations()
