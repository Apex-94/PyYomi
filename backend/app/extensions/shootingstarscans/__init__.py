"""
Auto-generated PyYomi source port for Shooting Star Scans.
Upstream reference: H:/repo/PyYomi/.tmp/extensions-source/src/en/shootingstarscans
"""

from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class ShootingStarScans(MadaraScraper):
    name = "Shooting Star Scans"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://shootingstarscans.com"]
    upstream_slug = "shootingstarscans"
    upstream_path = "H:/repo/PyYomi/.tmp/extensions-source/src/en/shootingstarscans"
    theme_name = "madara"


source = ShootingStarScans()
