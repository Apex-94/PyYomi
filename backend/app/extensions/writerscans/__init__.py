"""
Auto-generated PyYomi source port for Writer Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/writerscans
"""

from __future__ import annotations

from app.extensions._themes.keyoapp import KeyoappScraper


class WriterScans(KeyoappScraper):
    name = "Writer Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://writerscans.com"]
    upstream_slug = "writerscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/writerscans"
    theme_name = "keyoapp"


source = WriterScans()
