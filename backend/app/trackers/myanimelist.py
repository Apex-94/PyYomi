"""MyAnimeList tracker implementation using PKCE OAuth."""
import httpx
import secrets
import os
import urllib.parse
from typing import List, Optional, Tuple

from .base import BaseTracker, OAuthConfig, TokenData, TrackerManga


DEFAULT_CLIENT_ID = "320f59f4c58c4d5d8a9a659b18c15d81"


class MyAnimeListTracker(BaseTracker):
    """MyAnimeList OAuth and API integration using PKCE."""
    
    name = "mal"
    display_name = "MyAnimeList"
    
    BASE_URL = "https://api.myanimelist.net/v2"
    BASE_OAUTH_URL = "https://myanimelist.net/v1/oauth2"
    DEFAULT_FRONTEND_ORIGIN = "http://127.0.0.1:3000"
    
    @property
    def uses_pkce(self) -> bool:
        return True
    
    def __init__(self):
        self.client_id = os.environ.get("MAL_CLIENT_ID", DEFAULT_CLIENT_ID)
        self.redirect_uri_override = os.environ.get("MAL_REDIRECT_URI")
    
    def resolve_redirect_uri(self, frontend_origin: Optional[str] = None) -> str:
        if self.redirect_uri_override:
            return self.redirect_uri_override
        origin = (frontend_origin or self.DEFAULT_FRONTEND_ORIGIN).rstrip("/")
        return f"{origin}/tracker/callback/mal"

    def get_oauth_config(self, redirect_uri: Optional[str] = None) -> OAuthConfig:
        return OAuthConfig(
            client_id=self.client_id,
            client_secret=None,
            redirect_uri=redirect_uri or self.resolve_redirect_uri(),
            auth_url=f"{self.BASE_OAUTH_URL}/authorize",
            token_url=f"{self.BASE_OAUTH_URL}/token",
            scope="read write"
        )
    
    async def get_auth_url(
        self,
        state: str,
        redirect_uri: Optional[str] = None,
    ) -> Tuple[str, str]:
        """Generate authorization URL with PKCE plain method.
        
        Returns: (auth_url, code_verifier) - code_verifier must be stored for callback
        """
        config = self.get_oauth_config(redirect_uri=redirect_uri)
        # MAL requires a PKCE verifier length between 43 and 128 chars.
        code_verifier = secrets.token_urlsafe(64)
        params = {
            "response_type": "code",
            "client_id": config.client_id,
            "redirect_uri": config.redirect_uri,
            "code_challenge": code_verifier,
            "code_challenge_method": "plain",
            "state": state
        }
        url = f"{config.auth_url}?{urllib.parse.urlencode(params)}"
        return url, code_verifier
    
    async def exchange_code(
        self,
        code: str,
        code_verifier: Optional[str] = None,
        redirect_uri: Optional[str] = None,
    ) -> TokenData:
        """Exchange authorization code for tokens using PKCE."""
        config = self.get_oauth_config(redirect_uri=redirect_uri)
        async with httpx.AsyncClient() as client:
            response = await client.post(
                config.token_url,
                data={
                    "client_id": config.client_id,
                    "code": code,
                    "code_verifier": code_verifier,
                    "grant_type": "authorization_code",
                    "redirect_uri": config.redirect_uri
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
        """Refresh access token using PKCE."""
        config = self.get_oauth_config()
        async with httpx.AsyncClient() as client:
            response = await client.post(
                config.token_url,
                data={
                    "client_id": config.client_id,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token
                }
            )
            response.raise_for_status()
            data = response.json()
            return TokenData(
                access_token=data["access_token"],
                refresh_token=data.get("refresh_token"),
                expires_in=data.get("expires_in")
            )
    
    async def get_user_info(self, access_token: str) -> dict:
        """Get user information from MyAnimeList"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/users/@me",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()
    
    async def search_manga(self, access_token: str, query: str) -> List[TrackerManga]:
        """Search for manga on MyAnimeList"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/manga",
                params={"q": query, "limit": 10},
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            data = response.json()
            return [
                TrackerManga(
                    id=str(item["node"]["id"]),
                    title=item["node"]["title"],
                    chapters=item["node"].get("num_chapters"),
                    status=item["node"].get("status", "unknown")
                )
                for item in data.get("data", [])
            ]
    
    async def update_progress(self, access_token: str, manga_id: str, chapters_read: int) -> bool:
        """Update reading progress on MyAnimeList"""
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"{self.BASE_URL}/manga/{manga_id}/my_list_status",
                headers={"Authorization": f"Bearer {access_token}"},
                data={"num_chapters_read": chapters_read}
            )
            return response.status_code == 200
    
    async def get_user_list(self, access_token: str) -> List[TrackerManga]:
        """Get user's manga list from MyAnimeList"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/users/@me/mangalist",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"fields": "list_status,num_chapters"}
            )
            response.raise_for_status()
            data = response.json()
            return [
                TrackerManga(
                    id=str(item["node"]["id"]),
                    title=item["node"]["title"],
                    chapters=item["node"].get("num_chapters"),
                    status=item["node"].get("status", "unknown"),
                    user_status=item.get("list_status", {}).get("status"),
                    user_chapters=item.get("list_status", {}).get("num_chapters_read")
                )
                for item in data.get("data", [])
            ]
