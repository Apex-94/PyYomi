from __future__ import annotations

from app.extensions._themes.madara import MadaraScraper


class MangaThemesiaScraper(MadaraScraper):
    theme_name = "mangathemesia"

    def archive_url(self, page: int, *, order: str | None = None) -> str:
        path = "manga/"
        params = {}
        if page > 1:
            path = f"{path}page/{page}/"
        if order == "views":
            params["order"] = "popular"
        elif order == "latest":
            params["order"] = "update"
        elif order == "new":
            params["order"] = "new-manga"
        return self._build_url(path, **params)
