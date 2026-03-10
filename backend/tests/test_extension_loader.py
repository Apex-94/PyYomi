from __future__ import annotations

import unittest

from app.extensions.loader import initialize_extensions, registry


class ExtensionLoaderSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        initialize_extensions()

    def test_loader_ignores_helper_packages(self) -> None:
        self.assertNotIn("_themes", registry.list_errors())

    def test_registry_keys_are_unique(self) -> None:
        source_ids = [item["id"] for item in registry.list_sources()]
        self.assertEqual(len(source_ids), len(set(source_ids)))

    def test_generated_sources_are_loaded(self) -> None:
        loaded_names = {item["name"] for item in registry.list_sources()}
        self.assertIn("Manhua Plus", loaded_names)
        self.assertIn("Mist Scans", loaded_names)
        self.assertEqual(registry.list_errors(), {})
