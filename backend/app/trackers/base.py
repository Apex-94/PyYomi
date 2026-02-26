"""Base tracker interface"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, List, Tuple, Union


@dataclass
class OAuthConfig:
    """OAuth configuration for a tracker"""
    client_id: str
    client_secret: Optional[str]
    redirect_uri: str
    auth_url: str
    token_url: str
    scope: Optional[str] = None


@dataclass
class TrackerManga:
    """Manga entry from a tracker"""
    id: str
    title: str
    chapters: Optional[int]
    status: str
    user_status: Optional[str] = None  # 'reading', 'completed', 'on_hold', etc.
    user_chapters: Optional[int] = None  # Chapters read by user


@dataclass
class TokenData:
    """OAuth token data"""
    access_token: str
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None
    token_type: str = "Bearer"


class BaseTracker(ABC):
    """Abstract base class for tracker integrations"""
    
    name: str = ""
    display_name: str = ""
    
    @property
    def uses_implicit_grant(self) -> bool:
        """Whether this tracker uses implicit grant flow (token in URL fragment)"""
        return False
    
    @property
    def uses_pkce(self) -> bool:
        """Whether this tracker uses PKCE for OAuth"""
        return False

    @property
    def supports_refresh_token(self) -> bool:
        """Whether this tracker supports refreshing an expired access token"""
        return True
    
    @abstractmethod
    def get_oauth_config(self, redirect_uri: Optional[str] = None) -> OAuthConfig:
        """Return OAuth configuration"""
    
    @abstractmethod
    async def get_auth_url(
        self,
        state: str,
        redirect_uri: Optional[str] = None,
    ) -> Union[str, Tuple[str, str]]:
        """Generate authorization URL"""
    
    @abstractmethod
    async def exchange_code(
        self,
        code: str,
        code_verifier: Optional[str] = None,
        redirect_uri: Optional[str] = None,
    ) -> TokenData:
        """Exchange authorization code for tokens"""
    
    @abstractmethod
    async def refresh_tokens(self, refresh_token: str) -> TokenData:
        """Refresh access token"""
    
    @abstractmethod
    async def get_user_info(self, access_token: str) -> dict:
        """Get user information from tracker"""
    
    @abstractmethod
    async def search_manga(self, access_token: str, query: str) -> List[TrackerManga]:
        """Search for manga on tracker"""
    
    @abstractmethod
    async def update_progress(self, access_token: str, manga_id: str, chapters_read: int) -> bool:
        """Update reading progress on tracker"""
    
    @abstractmethod
    async def get_user_list(self, access_token: str) -> List[TrackerManga]:
        """Get user's manga list from tracker"""
