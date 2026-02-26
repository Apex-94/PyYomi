"""
Backup API endpoints for exporting and importing user data.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Response, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy import func

from app.db.database import get_session
from app.db.models import (
    Manga,
    Chapter,
    LibraryEntry,
    History,
    Category,
    MangaCategory,
    ReadingProgress,
    TrackerMapping,
)


# Request/Response models for restore endpoint
class RestoreRequest(BaseModel):
    """Request body for backup restore."""
    version: int
    exported_at: str
    app: str
    data: Dict[str, Any]


class ImportStats(BaseModel):
    """Statistics for a single entity type during import."""
    imported: int = 0
    updated: int = 0
    skipped: int = 0


class RestoreStats(BaseModel):
    """Overall statistics for restore operation."""
    manga: ImportStats = ImportStats()
    chapters: ImportStats = ImportStats()
    library_entries: ImportStats = ImportStats()
    history: ImportStats = ImportStats()
    categories: ImportStats = ImportStats()
    manga_categories: ImportStats = ImportStats()
    reading_progress: ImportStats = ImportStats()
    tracker_mappings: ImportStats = ImportStats()

router = APIRouter()


def datetime_to_iso(dt: Optional[datetime]) -> Optional[str]:
    """Convert datetime to ISO format string."""
    if dt is None:
        return None
    # Ensure UTC timezone
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def parse_iso_to_datetime(iso_str: Optional[str]) -> Optional[datetime]:
    """Parse ISO format string to datetime."""
    if iso_str is None:
        return None
    # Handle both 'Z' suffix and '+00:00' format
    iso_str = iso_str.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(iso_str)
    except ValueError:
        return None


@router.get("/backup/export")
async def export_backup(
    session: Session = Depends(get_session)
) -> JSONResponse:
    """
    Export all user data from the SQLite database as JSON.
    
    Returns a downloadable backup file containing:
    - manga: All manga entries in the library
    - chapters: All chapters for manga in library
    - library_entries: All library entries
    - history: All reading history
    - categories: All categories
    - manga_categories: All manga-category mappings
    - reading_progress: All reading progress
    - tracker_mappings: All tracker mappings (excluding sensitive tokens)
    """
    
    # Build the backup data structure
    backup_data: Dict[str, Any] = {
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "app": "PyYomi",
        "data": {
            "manga": [],
            "chapters": [],
            "library_entries": [],
            "history": [],
            "categories": [],
            "manga_categories": [],
            "reading_progress": [],
            "tracker_mappings": [],
        }
    }
    
    # Get all manga URLs in the library for filtering
    library_manga_urls = set()
    
    # 1. Export manga entries that are in the library
    manga_statement = (
        select(Manga)
        .join(LibraryEntry, LibraryEntry.manga_id == Manga.id)
    )
    manga_results = session.exec(manga_statement).all()
    
    manga_id_to_url: Dict[int, str] = {}
    
    for manga in manga_results:
        manga_id_to_url[manga.id] = manga.url
        library_manga_urls.add(manga.url)
        
        backup_data["data"]["manga"].append({
            "url": manga.url,
            "source": manga.source,
            "title": manga.title,
            "thumbnail_url": manga.thumbnail_url,
            "description": manga.description,
            "author": manga.author,
            "artist": manga.artist,
            "genres": manga.genres,
            "status": manga.status,
            "last_read_chapter": manga.last_read_chapter,
            "last_read_at": datetime_to_iso(manga.last_read_at),
        })
    
    # 2. Export chapters for manga in library
    if manga_id_to_url:
        chapter_statement = (
            select(Chapter)
            .where(Chapter.manga_id.in_(manga_id_to_url.keys()))
        )
        chapter_results = session.exec(chapter_statement).all()
        
        for chapter in chapter_results:
            manga_url = manga_id_to_url.get(chapter.manga_id)
            if manga_url:
                backup_data["data"]["chapters"].append({
                    "manga_url": manga_url,
                    "url": chapter.url,
                    "chapter_number": chapter.chapter_number,
                    "title": chapter.title,
                    "read": chapter.is_read,
                    "downloaded": chapter.is_downloaded,
                    "last_page_read": 0,  # This field is not in the Chapter model
                })
    
    # 3. Export library entries
    library_statement = (
        select(LibraryEntry)
    )
    library_results = session.exec(library_statement).all()
    
    for entry in library_results:
        manga_url = manga_id_to_url.get(entry.manga_id)
        if manga_url:
            backup_data["data"]["library_entries"].append({
                "manga_url": manga_url,
                "added_at": datetime_to_iso(entry.added_at),
            })
    
    # 4. Export history
    history_statement = select(History)
    history_results = session.exec(history_statement).all()
    
    for history_entry in history_results:
        manga_url = manga_id_to_url.get(history_entry.manga_id)
        if manga_url:
            backup_data["data"]["history"].append({
                "manga_url": manga_url,
                "chapter_number": history_entry.chapter_number,
                "read_at": datetime_to_iso(history_entry.read_at),
            })
    
    # 5. Export categories
    category_statement = select(Category)
    category_results = session.exec(category_statement).all()
    
    category_id_to_name: Dict[int, str] = {}
    
    for category in category_results:
        category_id_to_name[category.id] = category.name
        backup_data["data"]["categories"].append({
            "name": category.name,
            "created_at": datetime_to_iso(category.created_at),
        })
    
    # 6. Export manga_categories mappings
    if category_id_to_name and manga_id_to_url:
        manga_category_statement = select(MangaCategory)
        manga_category_results = session.exec(manga_category_statement).all()
        
        for mc in manga_category_results:
            manga_url = manga_id_to_url.get(mc.manga_id)
            category_name = category_id_to_name.get(mc.category_id)
            
            if manga_url and category_name:
                backup_data["data"]["manga_categories"].append({
                    "manga_url": manga_url,
                    "category_name": category_name,
                })
    
    # 7. Export reading progress
    reading_progress_statement = select(ReadingProgress)
    reading_progress_results = session.exec(reading_progress_statement).all()
    
    for progress in reading_progress_results:
        manga_url = manga_id_to_url.get(progress.manga_id)
        if manga_url:
            backup_data["data"]["reading_progress"].append({
                "manga_url": manga_url,
                "chapter_number": progress.chapter_number,
                "page_number": progress.page_number,
                "updated_at": datetime_to_iso(progress.updated_at),
            })
    
    # 8. Export tracker mappings (excluding sensitive tokens!)
    tracker_mapping_statement = select(TrackerMapping)
    tracker_mapping_results = session.exec(tracker_mapping_statement).all()
    
    for mapping in tracker_mapping_results:
        manga_url = manga_id_to_url.get(mapping.manga_id)
        if manga_url:
            backup_data["data"]["tracker_mappings"].append({
                "manga_url": manga_url,
                "tracker_name": mapping.tracker_name,
                "tracker_manga_id": mapping.tracker_manga_id,
                "tracker_url": mapping.tracker_url,
                "last_synced_chapter": mapping.last_synced_chapter,
                "last_synced_at": datetime_to_iso(mapping.last_synced_at),
                "sync_status": mapping.sync_status,
            })
    
    # Generate filename with timestamp
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"pyyomi_backup_{timestamp}.json"
    
    # Return as downloadable JSON file
    return JSONResponse(
        content=backup_data,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.post("/backup/restore")
async def restore_backup(
    request: RestoreRequest,
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    Restore data from a JSON backup file.
    
    Uses merge/skip conflict resolution:
    - Manga: If manga with same URL exists, SKIP
    - Chapters: If chapter with same URL exists, SKIP
    - Library Entries: If manga already in library, SKIP
    - History: If same (manga_url + chapter_number) exists, SKIP
    - Categories: If category with same name exists, SKIP
    - MangaCategories: If mapping already exists, SKIP
    - ReadingProgress: If same (manga_url + chapter_number) exists, update if new updated_at is more recent
    - TrackerMappings: If same (manga_url + tracker_name) exists, update if new last_synced_at is more recent
    
    Import order (for foreign key relationships):
    1. Categories (no dependencies)
    2. Manga (no dependencies)
    3. Library Entries, Chapters, History, Reading Progress, Manga Categories (depend on manga)
    4. Tracker Mappings (depend on manga)
    """
    
    # Validate backup version
    if request.version != 1:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported backup version: {request.version}. Only version 1 is supported."
        )
    
    stats = RestoreStats()
    
    try:
        data = request.data
        
        # ==========================================
        # PHASE 1: Import Categories (no dependencies)
        # ==========================================
        category_name_to_id: Dict[str, int] = {}
        
        # Build map of existing categories
        existing_categories = session.exec(select(Category)).all()
        for cat in existing_categories:
            category_name_to_id[cat.name] = cat.id
        
        for cat_data in data.get("categories", []):
            name = cat_data.get("name")
            if not name:
                continue
            
            if name in category_name_to_id:
                # Category exists, SKIP
                stats.categories.skipped += 1
            else:
                # Create new category
                new_category = Category(
                    name=name,
                    created_at=parse_iso_to_datetime(cat_data.get("created_at")) or datetime.utcnow()
                )
                session.add(new_category)
                session.flush()  # Get the ID
                category_name_to_id[name] = new_category.id
                stats.categories.imported += 1
        
        # ==========================================
        # PHASE 2: Import Manga (no dependencies)
        # ==========================================
        manga_url_to_id: Dict[str, int] = {}
        
        # Build map of existing manga
        existing_manga = session.exec(select(Manga)).all()
        for manga in existing_manga:
            manga_url_to_id[manga.url] = manga.id
        
        for manga_data in data.get("manga", []):
            url = manga_data.get("url")
            if not url:
                continue
            
            if url in manga_url_to_id:
                # Manga exists, SKIP
                stats.manga.skipped += 1
            else:
                # Create new manga
                new_manga = Manga(
                    url=url,
                    source=manga_data.get("source", ""),
                    title=manga_data.get("title", ""),
                    thumbnail_url=manga_data.get("thumbnail_url"),
                    description=manga_data.get("description"),
                    author=manga_data.get("author"),
                    artist=manga_data.get("artist"),
                    genres=manga_data.get("genres"),
                    status=manga_data.get("status"),
                    last_read_chapter=manga_data.get("last_read_chapter", 0),
                    last_read_at=parse_iso_to_datetime(manga_data.get("last_read_at")),
                )
                session.add(new_manga)
                session.flush()  # Get the ID
                manga_url_to_id[url] = new_manga.id
                stats.manga.imported += 1
        
        # ==========================================
        # PHASE 3: Import dependent entities
        # ==========================================
        
        # 3a. Import Library Entries
        existing_library = session.exec(select(LibraryEntry)).all()
        library_manga_ids = {entry.manga_id for entry in existing_library}
        
        for entry_data in data.get("library_entries", []):
            manga_url = entry_data.get("manga_url")
            if not manga_url:
                continue
            
            manga_id = manga_url_to_id.get(manga_url)
            if not manga_id:
                # Manga doesn't exist, skip this entry
                stats.library_entries.skipped += 1
                continue
            
            if manga_id in library_manga_ids:
                # Already in library, SKIP
                stats.library_entries.skipped += 1
            else:
                # Add to library
                new_entry = LibraryEntry(
                    manga_id=manga_id,
                    added_at=parse_iso_to_datetime(entry_data.get("added_at")) or datetime.utcnow()
                )
                session.add(new_entry)
                library_manga_ids.add(manga_id)
                stats.library_entries.imported += 1
        
        # 3b. Import Chapters
        existing_chapters = session.exec(select(Chapter)).all()
        chapter_urls = {chapter.url for chapter in existing_chapters}
        
        for chapter_data in data.get("chapters", []):
            manga_url = chapter_data.get("manga_url")
            chapter_url = chapter_data.get("url")
            if not manga_url or not chapter_url:
                continue
            
            manga_id = manga_url_to_id.get(manga_url)
            if not manga_id:
                # Manga doesn't exist, skip this chapter
                stats.chapters.skipped += 1
                continue
            
            if chapter_url in chapter_urls:
                # Chapter exists, SKIP
                stats.chapters.skipped += 1
            else:
                # Create new chapter
                new_chapter = Chapter(
                    manga_id=manga_id,
                    url=chapter_url,
                    chapter_number=chapter_data.get("chapter_number", 0),
                    title=chapter_data.get("title"),
                    is_read=chapter_data.get("read", False),
                    is_downloaded=chapter_data.get("downloaded", False),
                )
                session.add(new_chapter)
                chapter_urls.add(chapter_url)
                stats.chapters.imported += 1
        
        # 3c. Import History
        # Build set of existing history entries (manga_id, chapter_number)
        existing_history = session.exec(select(History)).all()
        history_keys = {(h.manga_id, h.chapter_number) for h in existing_history}
        
        for history_data in data.get("history", []):
            manga_url = history_data.get("manga_url")
            chapter_number = history_data.get("chapter_number")
            if not manga_url or chapter_number is None:
                continue
            
            manga_id = manga_url_to_id.get(manga_url)
            if not manga_id:
                stats.history.skipped += 1
                continue
            
            key = (manga_id, chapter_number)
            if key in history_keys:
                # History entry exists, SKIP
                stats.history.skipped += 1
            else:
                # Create new history entry
                new_history = History(
                    manga_id=manga_id,
                    chapter_number=chapter_number,
                    read_at=parse_iso_to_datetime(history_data.get("read_at")) or datetime.utcnow()
                )
                session.add(new_history)
                history_keys.add(key)
                stats.history.imported += 1
        
        # 3d. Import Reading Progress
        # Build map of existing reading progress (manga_id, chapter_number) -> (updated_at, id)
        existing_progress = session.exec(select(ReadingProgress)).all()
        progress_map: Dict[tuple, tuple] = {}  # (manga_id, chapter_number) -> (updated_at, id)
        for progress in existing_progress:
            key = (progress.manga_id, progress.chapter_number)
            progress_map[key] = (progress.updated_at, progress.id)
        
        for progress_data in data.get("reading_progress", []):
            manga_url = progress_data.get("manga_url")
            chapter_number = progress_data.get("chapter_number")
            if not manga_url or chapter_number is None:
                continue
            
            manga_id = manga_url_to_id.get(manga_url)
            if not manga_id:
                stats.reading_progress.skipped += 1
                continue
            
            key = (manga_id, chapter_number)
            new_updated_at = parse_iso_to_datetime(progress_data.get("updated_at")) or datetime.utcnow()
            
            if key in progress_map:
                # Progress exists, check if we should update
                existing_updated_at, existing_id = progress_map[key]
                if new_updated_at > existing_updated_at:
                    # Update existing progress
                    existing_progress = session.get(ReadingProgress, existing_id)
                    if existing_progress:
                        existing_progress.page_number = progress_data.get("page_number", 0)
                        existing_progress.updated_at = new_updated_at
                        stats.reading_progress.updated += 1
                else:
                    stats.reading_progress.skipped += 1
            else:
                # Create new progress
                new_progress = ReadingProgress(
                    manga_id=manga_id,
                    chapter_number=chapter_number,
                    page_number=progress_data.get("page_number", 0),
                    updated_at=new_updated_at
                )
                session.add(new_progress)
                progress_map[key] = (new_updated_at, None)  # ID not needed for new entries
                stats.reading_progress.imported += 1
        
        # 3e. Import Manga Categories
        # Build set of existing manga_category mappings
        existing_manga_categories = session.exec(select(MangaCategory)).all()
        manga_category_keys = {(mc.manga_id, mc.category_id) for mc in existing_manga_categories}
        
        for mc_data in data.get("manga_categories", []):
            manga_url = mc_data.get("manga_url")
            category_name = mc_data.get("category_name")
            if not manga_url or not category_name:
                continue
            
            manga_id = manga_url_to_id.get(manga_url)
            category_id = category_name_to_id.get(category_name)
            
            if not manga_id or not category_id:
                stats.manga_categories.skipped += 1
                continue
            
            key = (manga_id, category_id)
            if key in manga_category_keys:
                # Mapping exists, SKIP
                stats.manga_categories.skipped += 1
            else:
                # Create new mapping
                new_mc = MangaCategory(
                    manga_id=manga_id,
                    category_id=category_id
                )
                session.add(new_mc)
                manga_category_keys.add(key)
                stats.manga_categories.imported += 1
        
        # ==========================================
        # PHASE 4: Import Tracker Mappings
        # ==========================================
        # Build map of existing tracker mappings (manga_id, tracker_name) -> (last_synced_at, id)
        existing_mappings = session.exec(select(TrackerMapping)).all()
        tracker_map: Dict[tuple, tuple] = {}  # (manga_id, tracker_name) -> (last_synced_at, id)
        for mapping in existing_mappings:
            key = (mapping.manga_id, mapping.tracker_name)
            tracker_map[key] = (mapping.last_synced_at, mapping.id)
        
        for mapping_data in data.get("tracker_mappings", []):
            manga_url = mapping_data.get("manga_url")
            tracker_name = mapping_data.get("tracker_name")
            if not manga_url or not tracker_name:
                continue
            
            manga_id = manga_url_to_id.get(manga_url)
            if not manga_id:
                stats.tracker_mappings.skipped += 1
                continue
            
            key = (manga_id, tracker_name)
            new_synced_at = parse_iso_to_datetime(mapping_data.get("last_synced_at"))
            
            if key in tracker_map:
                # Mapping exists, check if we should update
                existing_synced_at, existing_id = tracker_map[key]
                # Update if new last_synced_at is more recent (and both exist)
                if new_synced_at and existing_synced_at:
                    if new_synced_at > existing_synced_at:
                        existing_mapping = session.get(TrackerMapping, existing_id)
                        if existing_mapping:
                            existing_mapping.tracker_manga_id = mapping_data.get("tracker_manga_id", "")
                            existing_mapping.tracker_url = mapping_data.get("tracker_url")
                            existing_mapping.last_synced_chapter = mapping_data.get("last_synced_chapter")
                            existing_mapping.last_synced_at = new_synced_at
                            existing_mapping.sync_status = mapping_data.get("sync_status", "pending")
                            stats.tracker_mappings.updated += 1
                    else:
                        stats.tracker_mappings.skipped += 1
                else:
                    # One or both sync times are None, skip
                    stats.tracker_mappings.skipped += 1
            else:
                # Create new mapping
                new_mapping = TrackerMapping(
                    manga_id=manga_id,
                    tracker_name=tracker_name,
                    tracker_manga_id=mapping_data.get("tracker_manga_id", ""),
                    tracker_url=mapping_data.get("tracker_url"),
                    last_synced_chapter=mapping_data.get("last_synced_chapter"),
                    last_synced_at=new_synced_at,
                    sync_status=mapping_data.get("sync_status", "pending")
                )
                session.add(new_mapping)
                tracker_map[key] = (new_synced_at, None)
                stats.tracker_mappings.imported += 1
        
        # Commit all changes
        session.commit()
        
        return {
            "success": True,
            "message": "Backup restored successfully",
            "stats": stats.model_dump()
        }
        
    except Exception as e:
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Error restoring backup: {str(e)}"
        )
