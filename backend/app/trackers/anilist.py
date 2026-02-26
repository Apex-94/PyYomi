"""AniList tracker implementation using GraphQL."""
import httpx
import os
import urllib.parse
from typing import List, Optional

from .base import (
    BaseTracker,
    OAuthConfig,
    TokenData,
    TrackerManga,
    TrackerEntry,
    TrackerEntryUpdate,
    FuzzyDate,
)


# Hardcoded AniList client ID
DEFAULT_CLIENT_ID = "36426"


class AniListTracker(BaseTracker):
    """AniList OAuth and GraphQL API integration."""
    
    name = "anilist"
    display_name = "AniList"
    
    API_URL = "https://graphql.anilist.co"
    BASE_URL = "https://anilist.co/api/v2/"
    DEFAULT_FRONTEND_ORIGIN = "http://127.0.0.1:3000"

    @property
    def uses_implicit_grant(self) -> bool:
        return self.oauth_flow == "implicit"

    @property
    def supports_refresh_token(self) -> bool:
        return False

    def __init__(self):
        self.client_id = os.environ.get("ANILIST_CLIENT_ID", DEFAULT_CLIENT_ID)
        self.client_secret = os.environ.get("ANILIST_CLIENT_SECRET")
        self.redirect_uri_override = os.environ.get("ANILIST_REDIRECT_URI")
        flow = os.environ.get("ANILIST_OAUTH_FLOW", "implicit").strip().lower()
        # Default to implicit so AniList works without .env secrets.
        self.oauth_flow = flow if flow in {"code", "implicit"} else "implicit"

    @staticmethod
    def _normalize_status(status: Optional[str]) -> Optional[str]:
        if not status:
            return None
        normalized = status.strip().lower()
        mapping = {
            "reading": "CURRENT",
            "current": "CURRENT",
            "planned": "PLANNING",
            "planning": "PLANNING",
            "plan_to_read": "PLANNING",
            "completed": "COMPLETED",
            "on_hold": "PAUSED",
            "paused": "PAUSED",
            "dropped": "DROPPED",
            "repeating": "REPEATING",
            "rereading": "REPEATING",
        }
        return mapping.get(normalized, status.strip().upper())

    @staticmethod
    def _to_fuzzy_date_payload(value: Optional[FuzzyDate]) -> Optional[dict]:
        if value is None:
            return None
        payload = {
            "year": value.year,
            "month": value.month,
            "day": value.day,
        }
        if payload["year"] is None and payload["month"] is None and payload["day"] is None:
            return None
        return payload

    @staticmethod
    def _from_fuzzy_date(value: Optional[dict]) -> Optional[FuzzyDate]:
        if not value:
            return None
        return FuzzyDate(
            year=value.get("year"),
            month=value.get("month"),
            day=value.get("day"),
        )
    
    def resolve_redirect_uri(self, frontend_origin: Optional[str] = None) -> str:
        if self.redirect_uri_override:
            return self.redirect_uri_override
        origin = (frontend_origin or self.DEFAULT_FRONTEND_ORIGIN).rstrip("/")
        return f"{origin}/tracker/callback/anilist"

    def get_oauth_config(self, redirect_uri: Optional[str] = None) -> OAuthConfig:
        return OAuthConfig(
            client_id=self.client_id,
            client_secret=self.client_secret,
            redirect_uri=redirect_uri or self.resolve_redirect_uri(),
            auth_url=f"{self.BASE_URL}oauth/authorize",
            token_url=f"{self.BASE_URL}oauth/token",
            scope=None
        )
    
    async def get_auth_url(self, state: str, redirect_uri: Optional[str] = None) -> str:
        """Generate authorization URL for configured AniList OAuth flow."""
        config = self.get_oauth_config(redirect_uri=redirect_uri)
        if not config.client_id:
            raise ValueError("ANILIST_CLIENT_ID is required")
        # Keep AniList implicit authorization URL minimal to match provider examples.
        if self.uses_implicit_grant:
            params = {
                "client_id": config.client_id,
                "response_type": "token",
            }
            return f"{config.auth_url}?{urllib.parse.urlencode(params)}"

        params = {
            "client_id": config.client_id,
            "response_type": "code",
            "redirect_uri": config.redirect_uri,
            "state": state,
        }
        if not self.uses_implicit_grant and not config.client_secret:
            raise ValueError("ANILIST_CLIENT_SECRET is required when ANILIST_OAUTH_FLOW=code")
        return f"{config.auth_url}?{urllib.parse.urlencode(params)}"
    
    async def exchange_code(
        self,
        code: str,
        code_verifier: Optional[str] = None,
        redirect_uri: Optional[str] = None,
    ) -> TokenData:
        """Exchange authorization code for access token."""
        if self.uses_implicit_grant:
            raise ValueError("AniList implicit flow does not use code exchange")
        config = self.get_oauth_config(redirect_uri=redirect_uri)
        if not config.client_secret:
            raise ValueError("ANILIST_CLIENT_SECRET is required for AniList OAuth code exchange")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                config.token_url,
                json={
                    "grant_type": "authorization_code",
                    "client_id": config.client_id,
                    "client_secret": config.client_secret,
                    "redirect_uri": config.redirect_uri,
                    "code": code
                }
            )
            response.raise_for_status()
            data = response.json()
            return TokenData(
                access_token=data["access_token"],
                refresh_token=data.get("refresh_token"),
                expires_in=data.get("expires_in"),
                token_type=data.get("token_type", "Bearer")
            )
    
    async def refresh_tokens(self, refresh_token: str) -> TokenData:
        """Refresh access token."""
        raise NotImplementedError("AniList does not currently support refresh tokens")
    
    async def get_user_info(self, access_token: str) -> dict:
        """Get user information from AniList."""
        query = """
        query {
            Viewer {
                id
                name
                avatar { medium }
            }
        }
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.API_URL,
                json={"query": query},
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()["data"]["Viewer"]
    
    async def search_manga(self, access_token: str, query: str) -> List[TrackerManga]:
        """Search for manga on AniList."""
        graphql_query = """
        query ($search: String) {
            Page(page: 1, perPage: 10) {
                media(search: $search, type: MANGA) {
                    id
                    title { romaji english }
                    chapters
                    status
                }
            }
        }
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.API_URL,
                json={"query": graphql_query, "variables": {"search": query}},
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            data = response.json()["data"]["Page"]["media"]
            return [
                TrackerManga(
                    id=str(item["id"]),
                    title=item["title"]["romaji"] or item["title"]["english"],
                    chapters=item.get("chapters"),
                    status=item.get("status", "unknown").lower()
                )
                for item in data
            ]
    
    async def update_progress(self, access_token: str, manga_id: str, chapters_read: int) -> bool:
        """Update reading progress on AniList."""
        return await self.update_entry(
            access_token,
            manga_id,
            TrackerEntryUpdate(progress=chapters_read),
        )
    
    async def get_user_list(self, access_token: str) -> List[TrackerManga]:
        """Get user's manga list from AniList."""
        query = """
        query {
            Viewer {
                mediaList(type: MANGA) {
                    mediaId
                    status
                    progress
                    media {
                        title { romaji english }
                        chapters
                        status
                    }
                }
            }
        }
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.API_URL,
                json={"query": query},
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            items = response.json()["data"]["Viewer"]["mediaList"]
            return [
                TrackerManga(
                    id=str(item["mediaId"]),
                    title=item["media"]["title"]["romaji"] or item["media"]["title"]["english"],
                    chapters=item["media"].get("chapters"),
                    status=item["media"].get("status", "unknown").lower(),
                    user_status=item.get("status", "").lower(),
                    user_chapters=item.get("progress")
                )
                for item in items
            ]

    async def get_score_format(self, access_token: str) -> Optional[str]:
        """Return AniList viewer score format (POINT_100/POINT_10/etc)."""
        query = """
        query {
            Viewer {
                mediaListOptions {
                    scoreFormat
                }
            }
        }
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.API_URL,
                json={"query": query},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json().get("data", {}).get("Viewer", {}).get("mediaListOptions", {}).get("scoreFormat")

    async def get_entry(self, access_token: str, manga_id: str) -> Optional[TrackerEntry]:
        """Get detailed AniList list entry for a manga."""
        query = """
        query ($mediaId: Int) {
            Media(id: $mediaId, type: MANGA) {
                chapters
                mediaListEntry {
                    progress
                    status
                    score(format: POINT_100)
                    private
                    startedAt { year month day }
                    completedAt { year month day }
                    updatedAt
                }
            }
        }
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.API_URL,
                json={"query": query, "variables": {"mediaId": int(manga_id)}},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            media = response.json().get("data", {}).get("Media")
            if not media:
                return None
            entry = media.get("mediaListEntry")
            if not entry:
                return None
            return TrackerEntry(
                manga_id=str(manga_id),
                progress=entry.get("progress"),
                status=(entry.get("status") or "").lower() if entry.get("status") else None,
                score=entry.get("score"),
                is_private=entry.get("private"),
                started_at=self._from_fuzzy_date(entry.get("startedAt")),
                completed_at=self._from_fuzzy_date(entry.get("completedAt")),
                media_chapters=media.get("chapters"),
                updated_at=str(entry.get("updatedAt")) if entry.get("updatedAt") is not None else None,
            )

    async def update_entry(self, access_token: str, manga_id: str, update: TrackerEntryUpdate) -> bool:
        """Update AniList entry via SaveMediaListEntry mutation."""
        mutation = """
        mutation (
          $mediaId: Int
          $progress: Int
          $status: MediaListStatus
          $scoreRaw: Int
          $private: Boolean
          $startedAt: FuzzyDateInput
          $completedAt: FuzzyDateInput
        ) {
          SaveMediaListEntry(
            mediaId: $mediaId
            progress: $progress
            status: $status
            scoreRaw: $scoreRaw
            private: $private
            startedAt: $startedAt
            completedAt: $completedAt
          ) {
            id
          }
        }
        """
        variables = {"mediaId": int(manga_id)}
        if update.progress is not None:
            variables["progress"] = int(update.progress)
        normalized_status = self._normalize_status(update.status)
        if normalized_status:
            variables["status"] = normalized_status
        if update.score is not None:
            # AniList scoreRaw is 0..100 regardless of display format.
            variables["scoreRaw"] = max(0, min(100, int(round(float(update.score)))))
        if update.is_private is not None:
            variables["private"] = bool(update.is_private)
        started_payload = self._to_fuzzy_date_payload(update.started_at)
        if started_payload:
            variables["startedAt"] = started_payload
        completed_payload = self._to_fuzzy_date_payload(update.completed_at)
        if completed_payload:
            variables["completedAt"] = completed_payload

        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.API_URL,
                json={"query": mutation, "variables": variables},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if response.status_code != 200:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get("errors", [{}])[0].get("message", "Unknown error")
                raise Exception(f"AniList API error ({response.status_code}): {error_msg}")
            return True
