from __future__ import annotations

import json
import shutil
import unittest
import uuid
from pathlib import Path

from app.extensions._generator import generate_extensions, parse_gradle_module

ARTIFACT_ROOT = Path(__file__).resolve().parents[2] / ".test-artifacts"
ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)


class ParseGradleModuleTests(unittest.TestCase):
    def _make_temp_dir(self) -> Path:
        temp_dir = ARTIFACT_ROOT / f"tmp-{uuid.uuid4().hex}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(temp_dir, ignore_errors=True))
        return temp_dir

    def _write_gradle(self, content: str, slug: str = "example") -> Path:
        temp_dir = self._make_temp_dir()
        module_dir = temp_dir / "en" / slug
        module_dir.mkdir(parents=True, exist_ok=True)
        path = module_dir / "build.gradle"
        path.write_text(content, encoding="utf-8")
        return path

    def test_parse_supported_theme_source(self) -> None:
        path = self._write_gradle(
            """
            ext {
                extName = 'Manhua Plus'
                extClass = '.ManhuaPlus'
                themePkg = 'madara'
                baseUrl = 'https://manhuaplus.com'
                overrideVersionCode = 7
                isNsfw = false
            }
            """,
            slug="manhuaplus",
        )

        meta = parse_gradle_module(path)

        self.assertEqual(meta.slug, "manhuaplus")
        self.assertEqual(meta.name, "Manhua Plus")
        self.assertEqual(meta.theme, "madara")
        self.assertEqual(meta.base_url, "https://manhuaplus.com")
        self.assertFalse(meta.nsfw)
        self.assertEqual(meta.version_code, 7)

    def test_parse_custom_source_without_base_url(self) -> None:
        path = self._write_gradle(
            """
            ext {
                extName = 'MangaKatana'
                extClass = '.MangaKatana'
                extVersionCode = 3
                isNsfw = false
            }
            """,
            slug="mangakatana",
        )

        meta = parse_gradle_module(path)

        self.assertEqual(meta.theme, None)
        self.assertEqual(meta.base_url, "")
        self.assertFalse(meta.nsfw)

    def test_parse_nsfw_source(self) -> None:
        path = self._write_gradle(
            """
            ext {
                extName = 'MangaTX'
                extClass = '.MangaTX'
                themePkg = 'mangathemesia'
                baseUrl = 'https://mangatx.cc'
                overrideVersionCode = 0
                isNsfw = true
            }
            """,
            slug="mangatx",
        )

        meta = parse_gradle_module(path)

        self.assertTrue(meta.nsfw)
        self.assertEqual(meta.theme, "mangathemesia")

    def test_parse_invalid_source_missing_name(self) -> None:
        path = self._write_gradle(
            """
            ext {
                extClass = '.Broken'
                baseUrl = 'https://broken.test'
            }
            """,
            slug="broken",
        )

        with self.assertRaisesRegex(ValueError, "extName"):
            parse_gradle_module(path)


class GenerateExtensionsTests(unittest.TestCase):
    def test_generate_extensions_skips_nsfw_and_tracks_pending(self) -> None:
        temp_dir = ARTIFACT_ROOT / f"tmp-{uuid.uuid4().hex}"
        temp_dir.mkdir(parents=True, exist_ok=True)
        self.addCleanup(lambda: shutil.rmtree(temp_dir, ignore_errors=True))
        source_root = temp_dir / "src" / "en"
        output_root = temp_dir / "output"

        modules = {
            "safe": """
                ext {
                    extName = 'Safe Source'
                    extClass = '.SafeSource'
                    themePkg = 'madara'
                    baseUrl = 'https://safe.example'
                    overrideVersionCode = 2
                    isNsfw = false
                }
            """,
            "adult": """
                ext {
                    extName = 'Adult Source'
                    extClass = '.AdultSource'
                    themePkg = 'madara'
                    baseUrl = 'https://adult.example'
                    overrideVersionCode = 1
                    isNsfw = true
                }
            """,
            "customsource": """
                ext {
                    extName = 'Custom Source'
                    extClass = '.CustomSource'
                    extVersionCode = 4
                    isNsfw = false
                }
            """,
            "unsupported": """
                ext {
                    extName = 'Unsupported'
                    extClass = '.Unsupported'
                    themePkg = 'iken'
                    baseUrl = 'https://unsupported.example'
                    overrideVersionCode = 1
                    isNsfw = false
                }
            """,
        }

        for slug, content in modules.items():
            module_dir = source_root / slug
            module_dir.mkdir(parents=True, exist_ok=True)
            (module_dir / "build.gradle").write_text(content, encoding="utf-8")

        result = generate_extensions(source_root, output_root)

        self.assertEqual([meta.slug for meta in result["generated"]], ["safe"])
        self.assertEqual([meta.slug for meta in result["nsfw"]], ["adult"])
        self.assertEqual([meta.slug for meta in result["custom"]], ["customsource"])
        self.assertEqual([meta.slug for meta in result["unsupported_theme"]], ["unsupported"])

        module_path = output_root / "safe" / "__init__.py"
        manifest_path = output_root / "safe" / "manifest.json"
        self.assertTrue(module_path.exists())
        self.assertTrue(manifest_path.exists())
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertTrue(manifest["generated"])
        self.assertEqual(manifest["theme"], "madara")
