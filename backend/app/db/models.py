from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List

class Manga(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    url: str = Field(unique=True, index=True)
    thumbnail_url: Optional[str] = None
    source: str
    description: Optional[str] = None
    author: Optional[str] = None
    artist: Optional[str] = None
    genres: Optional[str] = None
    status: Optional[str] = None
    last_read_chapter: int = 0
    last_read_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    chapters: List["Chapter"] = Relationship(back_populates="manga")
    library_entries: List["LibraryEntry"] = Relationship(back_populates="manga")


class Chapter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    manga_id: int = Field(foreign_key="manga.id")
    chapter_number: int
    title: Optional[str] = None
    url: str = Field(unique=True, index=True)
    is_read: bool = False
    is_downloaded: bool = False
    downloaded_path: Optional[str] = None
    release_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    manga: Manga = Relationship(back_populates="chapters")


class LibraryEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    manga_id: int = Field(foreign_key="manga.id", unique=True)
    added_at: datetime = Field(default_factory=datetime.utcnow)

    manga: Manga = Relationship(back_populates="library_entries")


class ReadingProgress(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    manga_id: int = Field(foreign_key="manga.id")
    chapter_number: int
    page_number: int = 0
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class History(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    manga_id: int = Field(foreign_key="manga.id")
    chapter_number: int
    read_at: datetime = Field(default_factory=datetime.utcnow)


class Category(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MangaCategory(SQLModel, table=True):
    manga_id: int = Field(foreign_key="manga.id", primary_key=True)
    category_id: int = Field(foreign_key="category.id", primary_key=True)


class Download(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    manga_id: int = Field(foreign_key="manga.id")
    chapter_number: int
    chapter_url: Optional[str] = None
    chapter_title: Optional[str] = None
    source: Optional[str] = None
    status: str = "pending"
    progress: float = 0.0
    file_path: Optional[str] = None
    error: Optional[str] = None
    total_pages: int = 0
    downloaded_pages: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Setting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True)
    value: str


class TrackerCredential(SQLModel, table=True):
    """Stores encrypted OAuth tokens for each linked tracker"""
    id: Optional[int] = Field(default=None, primary_key=True)
    tracker_name: str = Field(index=True)  # 'mal', 'anilist', 'kitsu', 'mangaupdates'
    user_id: Optional[str] = Field(default=None)  # Tracker's user ID
    username: Optional[str] = Field(default=None)  # Tracker's username
    access_token: str  # Encrypted
    refresh_token: Optional[str] = None  # Encrypted
    token_expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class TrackerMapping(SQLModel, table=True):
    """Maps local manga to tracker-specific entries"""
    id: Optional[int] = Field(default=None, primary_key=True)
    manga_id: int = Field(foreign_key="manga.id", index=True)
    tracker_name: str = Field(index=True)
    tracker_manga_id: str  # ID on the tracker
    tracker_url: Optional[str] = None
    last_synced_chapter: Optional[int] = None
    last_synced_at: Optional[datetime] = None
    sync_status: str = "pending"  # 'pending', 'synced', 'error'
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SyncQueue(SQLModel, table=True):
    """Queue for pending sync operations"""
    id: Optional[int] = Field(default=None, primary_key=True)
    manga_id: int = Field(foreign_key="manga.id", index=True)
    chapter_number: int
    tracker_name: str
    operation: str = "update_progress"  # 'update_progress', 'add_to_list', 'remove_from_list'
    status: str = "pending"  # 'pending', 'processing', 'completed', 'failed'
    error_message: Optional[str] = None
    retry_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None


class AniListMetadataCache(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    query: str = Field(index=True, unique=True)
    value_json: str
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ExtensionPackage(SQLModel, table=True):
    """An installed extension package from a repo (e.g., Keiyoushi repo)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    package_id: str = Field(unique=True, index=True)  # e.g., "eu.kanade.tachiyomi.extension.en.mangadex"
    name: str
    version: str
    repo_url: str
    enabled: bool = True
    installed_at: datetime = Field(default_factory=datetime.utcnow)


class RuntimeSource(SQLModel, table=True):
    """A runtime source exposed by an installed package (supports SourceFactory pattern)"""
    id: Optional[int] = Field(default=None, primary_key=True)
    source_id: str = Field(unique=True, index=True)  # e.g., "mangadex-en"
    package_id: str = Field(index=True)  # References ExtensionPackage.package_id
    name: str
    lang: str
    base_url: Optional[str] = None
    is_enabled: bool = True
