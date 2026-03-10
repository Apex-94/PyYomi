from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List

SUPPORTED_THEMES = {
    "madara": ("app.extensions._themes.madara", "MadaraScraper"),
    "mangathemesia": ("app.extensions._themes.mangathemesia", "MangaThemesiaScraper"),
    "keyoapp": ("app.extensions._themes.keyoapp", "KeyoappScraper"),
    "madtheme": ("app.extensions._themes.madtheme", "MadThemeScraper"),
}

REQUIRED_FIELDS = {
    "extName": r"extName\s*=\s*['\"]([^'\"]+)['\"]",
}


@dataclass
class SourceMeta:
    slug: str
    name: str
    base_url: str
    theme: str | None
    lang: str
    class_name: str
    version_code: int
    nsfw: bool
    upstream_path: str

    @property
    def version(self) -> str:
        return f"1.0.{self.version_code}"


def _extract(pattern: str, content: str) -> str | None:
    match = re.search(pattern, content)
    return match.group(1) if match else None


def parse_gradle_module(path: Path) -> SourceMeta:
    content = path.read_text(encoding="utf-8")
    missing = [field for field, pattern in REQUIRED_FIELDS.items() if not _extract(pattern, content)]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    slug = path.parent.name
    lang = path.parent.parent.name
    name = _extract(REQUIRED_FIELDS["extName"], content) or slug
    base_url = _extract(r"baseUrl\s*=\s*['\"]([^'\"]+)['\"]", content) or ""
    theme = _extract(r"themePkg\s*=\s*['\"]([^'\"]+)['\"]", content)
    class_name = (_extract(r"extClass\s*=\s*['\"]\.([^'\"]+)['\"]", content) or slug.title()).replace("-", "")
    version_value = _extract(r"extVersionCode\s*=\s*(\d+)", content) or _extract(r"overrideVersionCode\s*=\s*(\d+)", content) or "1"
    nsfw = bool(re.search(r"isNsfw\s*=\s*true", content))

    return SourceMeta(
        slug=slug,
        name=name,
        base_url=base_url,
        theme=theme,
        lang=lang,
        class_name=re.sub(r"[^0-9A-Za-z_]", "", class_name) or f"{slug.title()}Source",
        version_code=int(version_value),
        nsfw=nsfw,
        upstream_path=path.parent.as_posix(),
    )


def discover_sources(source_root: Path) -> List[SourceMeta]:
    return sorted(
        (parse_gradle_module(path) for path in source_root.glob("*/build.gradle")),
        key=lambda item: item.slug,
    )


def _is_generated_extension_dir(directory: Path) -> bool:
    manifest = directory / "manifest.json"
    if not manifest.exists():
        return False
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return False
    return bool(data.get("generated"))


def render_extension_module(meta: SourceMeta) -> str:
    module_path, class_name = SUPPORTED_THEMES[meta.theme or ""]
    return (
        '"""\n'
        f"Auto-generated PyYomi source port for {meta.name}.\n"
        f"Upstream reference: {meta.upstream_path}\n"
        '"""\n\n'
        "from __future__ import annotations\n\n"
        f"from {module_path} import {class_name}\n\n\n"
        f"class {meta.class_name}({class_name}):\n"
        f'    name = "{meta.name}"\n'
        f'    language = "{meta.lang}"\n'
        f'    version = "{meta.version}"\n'
        f'    base_urls = ["{meta.base_url}"]\n'
        f'    upstream_slug = "{meta.slug}"\n'
        f'    upstream_path = "{meta.upstream_path}"\n'
        f'    theme_name = "{meta.theme}"\n\n\n'
        f"source = {meta.class_name}()\n"
    )


def render_manifest(meta: SourceMeta) -> Dict[str, object]:
    return {
        "name": meta.name,
        "language": meta.lang,
        "version": meta.version,
        "base_urls": [meta.base_url],
        "generated": True,
        "upstream_slug": meta.slug,
        "upstream_path": meta.upstream_path,
        "theme": meta.theme,
        "nsfw": meta.nsfw,
    }


def generate_extensions(source_root: Path, output_root: Path) -> Dict[str, List[SourceMeta]]:
    result: Dict[str, List[SourceMeta]] = {
        "generated": [],
        "nsfw": [],
        "custom": [],
        "unsupported_theme": [],
        "existing": [],
        "invalid": [],
    }
    output_root.mkdir(parents=True, exist_ok=True)

    for gradle_path in sorted(source_root.glob("*/build.gradle")):
        try:
            meta = parse_gradle_module(gradle_path)
        except ValueError:
            result["invalid"].append(
                SourceMeta(
                    slug=gradle_path.parent.name,
                    name=gradle_path.parent.name,
                    base_url="",
                    theme=None,
                    lang=gradle_path.parent.parent.name,
                    class_name=f"{gradle_path.parent.name.title()}Source",
                    version_code=1,
                    nsfw=False,
                    upstream_path=gradle_path.parent.as_posix(),
                )
            )
            continue
        if meta.lang != "en":
            continue
        if meta.nsfw:
            result["nsfw"].append(meta)
            continue
        if not meta.theme:
            result["custom"].append(meta)
            continue
        if meta.theme not in SUPPORTED_THEMES:
            result["unsupported_theme"].append(meta)
            continue
        if not meta.base_url:
            result["invalid"].append(meta)
            continue

        target_dir = output_root / meta.slug
        if target_dir.exists() and not _is_generated_extension_dir(target_dir):
            result["existing"].append(meta)
            continue

        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / "__init__.py").write_text(render_extension_module(meta), encoding="utf-8")
        (target_dir / "manifest.json").write_text(
            json.dumps(render_manifest(meta), indent=2) + "\n",
            encoding="utf-8",
        )
        result["generated"].append(meta)

    return result


def render_status_markdown(result: Dict[str, List[SourceMeta]]) -> str:
    lines = [
        "# English Extension Port Status",
        "",
        "Generated from `.tmp/extensions-source/src/en`.",
        "",
        f"- Generated non-NSFW supported-theme sources: {len(result['generated'])}",
        f"- Deferred NSFW sources: {len(result['nsfw'])}",
        f"- Deferred custom sources: {len(result['custom'])}",
        f"- Deferred unsupported-theme sources: {len(result['unsupported_theme'])}",
        f"- Existing handwritten collisions skipped: {len(result['existing'])}",
        f"- Invalid upstream modules skipped: {len(result['invalid'])}",
        "",
    ]

    sections = [
        ("Generated English non-NSFW sources", "generated"),
        ("Deferred English NSFW sources", "nsfw"),
        ("Deferred English custom sources", "custom"),
        ("Deferred unsupported-theme English sources", "unsupported_theme"),
        ("Existing handwritten collisions", "existing"),
        ("Invalid upstream English sources", "invalid"),
    ]

    for title, key in sections:
        lines.append(f"## {title}")
        lines.append("")
        if not result[key]:
            lines.append("- None")
            lines.append("")
            continue
        for meta in result[key]:
            theme = meta.theme or "custom"
            lines.append(f"- `{meta.slug}`: {meta.name} ({theme})")
        lines.append("")

    return "\n".join(lines)


def write_status_doc(result: Dict[str, List[SourceMeta]], docs_path: Path) -> None:
    docs_path.write_text(render_status_markdown(result), encoding="utf-8")


def main() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    source_root = repo_root / ".tmp" / "extensions-source" / "src" / "en"
    output_root = repo_root / "backend" / "app" / "extensions"
    docs_path = repo_root / "docs" / "extensions-port-status.md"
    result = generate_extensions(source_root, output_root)
    write_status_doc(result, docs_path)
    summary = {key: len(value) for key, value in result.items()}
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
