from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select, create_engine
from sqlmodel import Session as SQLModelSession

from app.db.database import get_session, database_url
from app.db.models import Chapter, LibraryEntry, Manga, TrackerCredential, TrackerMapping
from app.extensions.loader import registry
from app.services.encryption import encryption_service
from app.trackers import TrackerRegistry

router = APIRouter(tags=["updates"])


def _chapter_number(raw_number: Optional[float], index: int) -> int:
    if raw_number is None:
        return index
    try:
        return int(raw_number)
    except (TypeError, ValueError):
        return index


async def sync_to_trackers_background(manga_id: int, chapter_number: int, db_url: str):
    """Background task to sync chapter progress to all connected trackers."""
    engine = create_engine(db_url)
    with SQLModelSession(engine) as db:
        try:
            mappings = db.exec(
                select(TrackerMapping).where(TrackerMapping.manga_id == manga_id)
            ).all()
            
            if not mappings:
                return
            
            for mapping in mappings:
                # Skip if already synced to this or higher chapter
                if mapping.last_synced_chapter and chapter_number <= mapping.last_synced_chapter:
                    continue
                
                credential = db.exec(
                    select(TrackerCredential).where(TrackerCredential.tracker_name == mapping.tracker_name)
                ).first()
                
                if not credential:
                    continue
                
                tracker = TrackerRegistry.get(mapping.tracker_name)
                if not tracker:
                    continue
                
                try:
                    access_token = encryption_service.decrypt(credential.access_token)
                    success = await tracker.update_progress(access_token, mapping.tracker_manga_id, chapter_number)
                    
                    if success:
                        mapping.last_synced_chapter = chapter_number
                        mapping.last_synced_at = datetime.utcnow()
                        mapping.sync_status = "synced"
                        db.add(mapping)
                        db.commit()
                except Exception:
                    mapping.sync_status = "error"
                    db.add(mapping)
                    db.commit()
        except Exception:
            pass


@router.get("")
async def list_updates(limit: int = 50, db: Session = Depends(get_session)):
    rows = db.exec(select(Chapter).order_by(Chapter.created_at.desc()).limit(limit)).all()
    items = []
    for chapter in rows:
        manga = db.get(Manga, chapter.manga_id)
        if not manga:
            continue
        items.append(
            {
                "id": chapter.id,
                "manga_id": chapter.manga_id,
                "manga_title": manga.title,
                "manga_url": manga.url,
                "source": manga.source,
                "chapter_number": chapter.chapter_number,
                "chapter_title": chapter.title,
                "chapter_url": chapter.url,
                "is_read": chapter.is_read,
                "is_downloaded": chapter.is_downloaded,
                "created_at": chapter.created_at,
            }
        )
    return {"updates": items}


@router.post("/check")
async def check_library_updates(db: Session = Depends(get_session)):
    library_entries = db.exec(select(LibraryEntry)).all()
    total_new = 0
    by_manga: list[dict] = []

    for entry in library_entries:
        manga = db.get(Manga, entry.manga_id)
        if not manga:
            continue
        try:
            scraper = registry.get(manga.source.lower())
        except KeyError:
            continue

        try:
            chapters = await scraper.chapters(manga.url)
        except Exception:
            continue

        new_for_this = 0
        for idx, chapter in enumerate(chapters, start=1):
            existing = db.exec(select(Chapter).where(Chapter.url == chapter.url)).first()
            if existing:
                continue
            chapter_number = _chapter_number(chapter.chapter_number, idx)
            db_chapter = Chapter(
                manga_id=manga.id,
                chapter_number=chapter_number,
                title=chapter.title,
                url=chapter.url,
                is_read=False,
                is_downloaded=False,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(db_chapter)
            new_for_this += 1
            total_new += 1
        if new_for_this:
            by_manga.append(
                {
                    "manga_id": manga.id,
                    "manga_title": manga.title,
                    "new_chapters": new_for_this,
                }
            )
    db.commit()
    return {"ok": True, "new_chapters": total_new, "by_manga": by_manga}


@router.post("/mark-read/{chapter_id}")
async def mark_update_read(chapter_id: int, db: Session = Depends(get_session)):
    chapter = db.get(Chapter, chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    chapter.is_read = True
    chapter.updated_at = datetime.utcnow()
    db.add(chapter)
    db.commit()
    return {"ok": True}


@router.post("/mark-read-by-url")
async def mark_chapter_read_by_url(chapter_url: str, db: Session = Depends(get_session)):
    """Mark a chapter as read by its URL. Creates the chapter record if it doesn't exist."""
    chapter = db.exec(select(Chapter).where(Chapter.url == chapter_url)).first()
    if not chapter:
        raise HTTPException(status_code=400, detail="Chapter not found in database. Please provide manga_id.")
    
    chapter.is_read = True
    chapter.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/mark-read-by-manga")
async def mark_chapter_read_by_manga(
    manga_id: int, 
    chapter_number: int, 
    chapter_url: str,
    chapter_title: str = None,
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_session)
):
    """Mark a chapter as read by manga_id and chapter_number. Creates the chapter record if needed.
    
    Also automatically syncs progress to all connected trackers that have this manga mapped.
    """
    manga = db.get(Manga, manga_id)
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")
    
    chapter = db.exec(
        select(Chapter).where(Chapter.url == chapter_url)
    ).first()
    
    if chapter:
        chapter.is_read = True
        chapter.updated_at = datetime.utcnow()
        if chapter_title and not chapter.title:
            chapter.title = chapter_title
    else:
        chapter = Chapter(
            manga_id=manga_id,
            chapter_number=chapter_number,
            title=chapter_title,
            url=chapter_url,
            is_read=True,
            is_downloaded=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(chapter)
    
    db.commit()
    db.refresh(chapter)
    
    if background_tasks:
        background_tasks.add_task(
            sync_to_trackers_background, 
            manga_id, 
            chapter_number, 
            database_url
        )
    
    return {"ok": True, "chapter_id": chapter.id, "sync_triggered": background_tasks is not None}


@router.post("/mark-unread-by-url")
async def mark_chapter_unread_by_url(chapter_url: str, db: Session = Depends(get_session)):
    """Mark a chapter as unread by its URL."""
    chapter = db.exec(select(Chapter).where(Chapter.url == chapter_url)).first()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    chapter.is_read = False
    chapter.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.get("/read-status")
async def get_chapters_read_status(manga_url: str, db: Session = Depends(get_session)):
    """Get read status for all chapters of a manga by manga URL."""
    manga = db.exec(select(Manga).where(Manga.url == manga_url)).first()
    if not manga:
        return {"manga_id": None, "chapters": []}
    
    chapters = db.exec(
        select(Chapter).where(Chapter.manga_id == manga.id)
    ).all()
    
    return {
        "manga_id": manga.id,
        "chapters": [
            {"id": ch.id, "chapter_number": ch.chapter_number, "url": ch.url, "is_read": ch.is_read}
            for ch in chapters
        ]
    }
