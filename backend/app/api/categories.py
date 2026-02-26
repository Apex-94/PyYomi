from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db.database import get_session
from app.db.models import Category, MangaCategory, Manga

router = APIRouter(tags=["Categories"])
DEFAULT_CATEGORY_NAMES = ["Reading", "Completed", "Plan to Read", "On Hold", "Dropped"]


def _ensure_default_categories(session: Session) -> None:
    existing = session.exec(select(Category)).all()
    existing_lower = {cat.name.strip().lower() for cat in existing}

    created_any = False
    for default_name in DEFAULT_CATEGORY_NAMES:
        if default_name.lower() in existing_lower:
            continue
        session.add(Category(name=default_name))
        created_any = True

    if created_any:
        session.commit()


@router.get("/")
async def get_all_categories(session: Session = Depends(get_session)):
    """Get all categories"""
    _ensure_default_categories(session)
    categories = session.exec(select(Category)).all()
    return {"categories": categories}


@router.post("/")
async def create_category(name: str, session: Session = Depends(get_session)):
    """Create a new category"""
    # Check if category already exists
    existing_category = session.exec(select(Category).where(Category.name == name)).first()
    if existing_category:
        raise HTTPException(status_code=400, detail="Category already exists")
    
    category = Category(name=name)
    session.add(category)
    session.commit()
    session.refresh(category)
    return {"category": category}


@router.put("/{category_id}")
async def update_category(category_id: int, name: str, session: Session = Depends(get_session)):
    """Update an existing category"""
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if name already exists
    existing_category = session.exec(
        select(Category).where(Category.name == name, Category.id != category_id)
    ).first()
    if existing_category:
        raise HTTPException(status_code=400, detail="Category name already exists")
    
    category.name = name
    session.commit()
    session.refresh(category)
    return {"category": category}


@router.delete("/{category_id}")
async def delete_category(category_id: int, session: Session = Depends(get_session)):
    """Delete a category and all its associations"""
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Delete all manga-category associations
    manga_categories = session.exec(
        select(MangaCategory).where(MangaCategory.category_id == category_id)
    ).all()
    for mc in manga_categories:
        session.delete(mc)
    
    session.delete(category)
    session.commit()
    return {"message": "Category deleted successfully"}


@router.get("/{category_id}/manga")
async def get_category_manga(category_id: int, session: Session = Depends(get_session)):
    """Get all manga in a specific category"""
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    manga_categories = session.exec(
        select(MangaCategory).where(MangaCategory.category_id == category_id)
    ).all()
    
    manga_list = []
    for mc in manga_categories:
        manga = session.get(Manga, mc.manga_id)
        if manga:
            manga_list.append(manga)
    
    return {"manga": manga_list}


@router.post("/{category_id}/manga/{manga_id}")
async def add_manga_to_category(category_id: int, manga_id: int, session: Session = Depends(get_session)):
    """Add a manga to a category"""
    # Check if category and manga exist
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    manga = session.get(Manga, manga_id)
    if not manga:
        raise HTTPException(status_code=404, detail="Manga not found")
    
    # Check if association already exists
    existing_association = session.exec(
        select(MangaCategory).where(
            MangaCategory.category_id == category_id,
            MangaCategory.manga_id == manga_id
        )
    ).first()
    
    if existing_association:
        raise HTTPException(status_code=400, detail="Manga already in category")
    
    manga_category = MangaCategory(category_id=category_id, manga_id=manga_id)
    session.add(manga_category)
    session.commit()
    session.refresh(manga_category)
    return {"manga_category": manga_category}


@router.delete("/{category_id}/manga/{manga_id}")
async def remove_manga_from_category(category_id: int, manga_id: int, session: Session = Depends(get_session)):
    """Remove a manga from a category"""
    manga_category = session.exec(
        select(MangaCategory).where(
            MangaCategory.category_id == category_id,
            MangaCategory.manga_id == manga_id
        )
    ).first()
    
    if not manga_category:
        raise HTTPException(status_code=404, detail="Manga not in category")
    
    session.delete(manga_category)
    session.commit()
    return {"message": "Manga removed from category"}
