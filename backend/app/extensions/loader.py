"""
Dynamic extension loader for manga scrapers.

The loader discovers and registers all scraper instances found in the
`app.extensions` package. Scrapers are expected to expose a module-level
`source` variable referencing an object that implements the `BaseScraper`
interface defined in `base.py`. Errors during loading are recorded for
introspection via the `list_errors` API.
"""

from __future__ import annotations

import importlib
import pkgutil
import traceback
from typing import Dict, List

from app.extensions.base import BaseScraper


class ExtensionRegistry:
    """
    Registry for loaded scraper instances.

    Instances are keyed by a combination of name and language (lowercased)
    to uniquely identify sources that may exist in multiple languages.
    """

    def __init__(self) -> None:
        self._sources: Dict[str, BaseScraper] = {}
        self._errors: Dict[str, str] = {}
        self._active_source_key: Optional[str] = None

    def list_sources(self) -> List[dict]:
        """
        Return metadata about all loaded sources.

        Each entry contains an identifier, name, language and version.
        """
        return [
            {
                "id": key,
                "name": scraper.name,
                "language": scraper.language,
                "version": getattr(scraper, "version", "1.0.0"),
                "is_active": key == self._active_source_key,
            }
            for key, scraper in self._sources.items()
        ]

    def get(self, key: str) -> BaseScraper:
        """Retrieve a scraper by its key."""
        return self._sources[key]

    def set_active_source(self, key: str):
        """Set the globally active source by its key."""
        if key not in self._sources:
            raise ValueError(f"Source {key} not found")
        self._active_source_key = key

    def get_active_source_key(self) -> Optional[str]:
        """Return the key of the currently active source."""
        return self._active_source_key

    def get_active_source(self) -> BaseScraper:
        """Retrieve the active scraper instance."""
        if not self._active_source_key:
            # Fallback to first available if none set
            if self._sources:
                self._active_source_key = next(iter(self._sources))
            else:
                raise RuntimeError("No sources available")
        return self._sources[self._active_source_key]

    def list_errors(self) -> Dict[str, str]:
        """Return a mapping of module names to error messages."""
        return dict(self._errors)

    def load_all(self) -> None:
        """
        Discover and load all scrapers under the `app.extensions` package.

        Modules named `base` or `loader` are skipped. For each module,
        either a single `source` or a list of `sources` variables are read.
        Any objects not implementing `BaseScraper` are ignored. Errors are
        captured and stored for later introspection.
        """
        self._sources.clear()
        self._errors.clear()
        # Reset active source key, will be re-validated or defaulted below
        old_active = self._active_source_key
        self._active_source_key = None

        package_name = "app.extensions"
        package = importlib.import_module(package_name)
        for module_info in pkgutil.iter_modules(package.__path__):
            name = module_info.name
            if name in ("base", "loader", "__pycache__", "cloudflare"):
                continue
            full_name = f"{package_name}.{name}"
            try:
                module = importlib.import_module(full_name)
                candidates = []
                if hasattr(module, "source"):
                    candidates.append(module.source)
                if hasattr(module, "sources"):
                    candidates.extend(module.sources)
                for candidate in candidates:
                    if isinstance(candidate, BaseScraper):
                        key = f"{candidate.name.lower()}:{candidate.language.lower()}"
                        self._sources[key] = candidate
            except Exception as exc:
                self._errors[name] = f"{exc}\n{traceback.format_exc()}"
        
        # Restore active source if still available, or pick a default
        if old_active in self._sources:
            self._active_source_key = old_active
        elif self._sources:
            # Prefer mangakatana if available by default
            if "mangakatana:en" in self._sources:
                self._active_source_key = "mangakatana:en"
            else:
                self._active_source_key = next(iter(self._sources.keys()))


registry = ExtensionRegistry()


def initialize_extensions():
    """Initialize and load all extensions into the registry."""
    registry.load_all()
