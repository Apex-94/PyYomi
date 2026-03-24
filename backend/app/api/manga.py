"""
API routes for interacting with manga sources via the extension system.

All operations are delegated to scraper implementations loaded at runtime
from the `app.extensions` package. A source is selected by its key
(`name:language`) or defaults to `mangahere:en` if unspecified.
"""

import asyncio
import json
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.extensions.loader import registry
from app.extensions.base import Filter
from app.services.global_search import global_search_sessions

router = APIRouter()


class GlobalSearchSessionCreateRequest(BaseModel):
    q: str
    page: int = 1


def _pick_source(source_key: str | None):
    """
    Retrieve a loaded source by its key.

    If no key is provided, the globally active source is used. This function
    is resilient to missing language suffixes (e.g., "mangahere" will match
    "mangahere:en"). If the requested source is not available, a 404 error
    is raised.
    """
    # Use provided key or global active key or fallback
    query_key = (source_key or registry.get_active_source_key() or "mangahere:en").lower()
    
    # 1. Direct match (e.g., "mangakatana:en")
    if query_key in registry._sources:
        return registry.get(query_key)
        
    # 2. Try adding :en if no colon present (e.g., "mangakatana" -> "mangakatana:en")
    if ":" not in query_key:
        en_key = f"{query_key}:en"
        if en_key in registry._sources:
            return registry.get(en_key)
            
    # 3. Match by name only (take first available language, e.g., "mangakatana")
    prefix = f"{query_key}:"
    for k in registry._sources:
        if k.startswith(prefix):
            return registry.get(k)
            
    raise HTTPException(status_code=404, detail=f"Source {query_key} not found")


@router.get("/search")
async def search(
    q: str = Query(..., description="Search query string"),
    page: int = Query(1, ge=1, description="Result page number"),
    source: str | None = Query(
        None, description="Identifier of the source to query (name:lang)"
    ),
    filters: str | None = Query(None, description="JSON encoded filter values"),
):
    """
    Search for manga titles across a specific source.

    Returns a list of manga cards containing the title, URL, thumbnail and
    source identifier. If the query yields no results an empty list is
    returned.
    """
    scraper = _pick_source(source)
    
    parsed_filters = None
    if filters:
        try:
            filter_data = json.loads(filters)
            parsed_filters = [Filter(id=f['id'], name=f.get('name', ''), value=f.get('value')) for f in filter_data]
        except Exception:
            # Fallback to no filters if parsing fails
            parsed_filters = None

    results = await scraper.search(q, page, filters=parsed_filters)
    return {"results": [c.__dict__ for c in results], "page": page}


@router.get("/search/global")
async def global_search(
    q: str = Query(..., description="Search query string"),
    page: int = Query(1, ge=1, description="Result page number"),
):
    """
    Search for manga titles across all loaded sources.

    This skips source-specific filters because filter definitions differ per
    source. Individual source failures are ignored so one broken scraper does
    not fail the entire global search.
    """
    query = q.strip()
    if not query:
        return {"results": [], "page": page}

    source_items = list(registry._sources.items())

    async def search_source(source_key: str, scraper):
        try:
            cards = await scraper.search(query, page, filters=None)
        except Exception:
            return []

        normalized = []
        for card in cards:
            payload = card.__dict__.copy()
            payload["source"] = payload.get("source") or source_key
            normalized.append(payload)
        return normalized

    results_by_source = await asyncio.gather(
        *(search_source(source_key, scraper) for source_key, scraper in source_items)
    )

    seen: set[tuple[str, str]] = set()
    merged = []
    for source_results in results_by_source:
        for item in source_results:
            key = (item.get("source", ""), item.get("url", ""))
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)

    return {"results": merged, "page": page}


@router.post("/search/global/sessions")
async def create_global_search_session(request: GlobalSearchSessionCreateRequest):
    query = request.q.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Search query is required")

    snapshot = await global_search_sessions.create_session(
        query,
        request.page,
        list(registry._sources.items()),
    )
    return snapshot


@router.get("/search/global/sessions/{session_id}")
async def get_global_search_session(session_id: str):
    try:
        return await global_search_sessions.get_snapshot(session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Global search session {session_id} not found") from exc


@router.get("/filters")
async def get_filters(
    source: str | None = Query(
        None, description="Identifier of the source to query (name:lang)"
    ),
):
    """
    Return a list of supported filters for a specific source.
    """
    scraper = _pick_source(source)
    filters = await scraper.get_filters()
    # Handle both dataclasses and potentially Pydantic models
    result = []
    for f in filters:
        d = f.__dict__.copy()
        if hasattr(f, 'type'):
             d['type'] = f.type
        result.append(d)
    return {"filters": result}


@router.get("/popular")
async def popular(
    page: int = Query(1, ge=1, description="Result page number"),
    source: str | None = Query(
        None, description="Identifier of the source to query (name:lang)"
    ),
):
    """
    Return a list of popular manga from a specific source.

    Some sites might not support popularity rankings; in that case the list
    may be empty or fallback to an alternative list.
    """
    scraper = _pick_source(source)
    results = await scraper.popular(page)
    return {"results": [c.__dict__ for c in results], "page": page}


@router.get("/latest")
async def latest(
    page: int = Query(1, ge=1, description="Result page number"),
    source: str | None = Query(
        None, description="Identifier of the source to query (name:lang)"
    ),
):
    """
    Return the most recently updated manga from a source.

    Many sites expose a feed of latest updates which this endpoint
    surfaces via the extension system.
    """
    scraper = _pick_source(source)
    results = await scraper.latest(page)
    return {"results": [c.__dict__ for c in results], "page": page}


@router.get("/details")
async def details(
    url: str = Query(..., description="Absolute URL of the manga to fetch"),
    source: str | None = Query(
        None, description="Identifier of the source to query (name:lang)"
    ),
):
    """
    Fetch metadata for a single manga from the underlying source.

    The URL must point at a manga detail page on the source website.
    """
    scraper = _pick_source(source)
    detail = await scraper.details(url)
    return detail.__dict__


@router.get("/chapters")
async def chapters(
    url: str = Query(
        ..., description="Absolute URL of the manga to fetch chapters for"
    ),
    source: str | None = Query(
        None, description="Identifier of the source to query (name:lang)"
    ),
):
    """
    Retrieve the chapter list for a manga.

    Chapters are returned in ascending order. Each entry contains a title,
    absolute URL and optional chapter number.
    """
    scraper = _pick_source(source)
    chapters = await scraper.chapters(url)
    return {"chapters": [c.__dict__ for c in chapters]}


@router.get("/pages")
async def pages(
    chapter_url: str = Query(
        ..., description="Absolute URL of the chapter to fetch pages for"
    ),
    source: str | None = Query(
        None, description="Identifier of the source to query (name:lang)"
    ),
):
    """
    Retrieve the list of image URLs for a specific chapter.

    Pages are returned as a list of strings representing absolute image URLs.
    """
    scraper = _pick_source(source)
    pages = await scraper.pages(chapter_url)
    return {"pages": pages}
@router.get("/resolve")
async def resolve(
    url: str = Query(..., description="Absolute URL of the page/image to resolve"),
    source: str | None = Query(
        None, description="Identifier of the source to query (name:lang)"
    ),
):
    """
    Resolve a lazy-loaded page URL to its actual image source.

    If the URL is already an image, it is returned as-is. If it is an HTML page,
    the scraper will attempt to extract the main image.
    """
    scraper = _pick_source(source)
    image_url = await scraper.resolve_image(url)
    return {"url": image_url}
