import asyncio
import json
import re
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.db.database import get_session
from app.db.models import AniListMetadataCache

router = APIRouter(prefix="/anilist", tags=["anilist"])

ANILIST_API_URL = "https://graphql.anilist.co"
HTML_TAG_RE = re.compile(r"<[^>]+>")
CACHE_TTL_HOURS = 24 * 7


class AniListMetaRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)


class AniListBatchMetaRequest(BaseModel):
    titles: list[str] = Field(default_factory=list)


def _clean_text(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = HTML_TAG_RE.sub("", value).replace("&nbsp;", " ").strip()
    return cleaned or None


def _normalize_status(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    mapping = {
        "FINISHED": "Completed",
        "RELEASING": "Ongoing",
        "NOT_YET_RELEASED": "Upcoming",
        "CANCELLED": "Cancelled",
        "HIATUS": "Hiatus",
    }
    return mapping.get(value, value.title())


async def _fetch_single_metadata(client: httpx.AsyncClient, title: str) -> dict:
    query = """
    query ($search: String) {
      Page(page: 1, perPage: 1) {
        media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
          id
          title { romaji english native }
          averageScore
          chapters
          status
          description(asHtml: false)
          coverImage { large }
          staff(perPage: 12) {
            edges {
              role
              node { name { full } }
            }
          }
        }
      }
    }
    """
    response = await client.post(
        ANILIST_API_URL,
        json={"query": query, "variables": {"search": title}},
    )
    response.raise_for_status()
    media = response.json().get("data", {}).get("Page", {}).get("media", [])
    if not media:
        return {"query": title, "found": False}

    item = media[0]
    author = None
    artist = None
    for edge in item.get("staff", {}).get("edges", []):
        role = (edge.get("role") or "").lower()
        name = edge.get("node", {}).get("name", {}).get("full")
        if not name:
            continue
        if not author and ("story" in role or "original creator" in role):
            author = name
        if not artist and "art" in role:
            artist = name
    if not author:
        # fallback first credited staff
        first = item.get("staff", {}).get("edges", [])
        if first:
            author = first[0].get("node", {}).get("name", {}).get("full")

    score = item.get("averageScore")
    rating_10 = round(float(score) / 10.0, 1) if isinstance(score, (int, float)) else None
    display_title = item.get("title", {}).get("english") or item.get("title", {}).get("romaji") or title

    return {
        "query": title,
        "found": True,
        "anilist_id": item.get("id"),
        "title": display_title,
        "status": _normalize_status(item.get("status")),
        "chapters": item.get("chapters"),
        "average_score": score,
        "rating_10": rating_10,
        "author": author,
        "artist": artist,
        "description": _clean_text(item.get("description")),
        "cover_url": item.get("coverImage", {}).get("large"),
    }


def _get_cached(session: Session, title: str) -> Optional[dict]:
    row = session.exec(select(AniListMetadataCache).where(AniListMetadataCache.query == title)).first()
    if not row:
        return None
    if row.updated_at < datetime.utcnow() - timedelta(hours=CACHE_TTL_HOURS):
        return None
    try:
        return json.loads(row.value_json)
    except Exception:
        return None


def _upsert_cache(session: Session, title: str, metadata: dict) -> None:
    row = session.exec(select(AniListMetadataCache).where(AniListMetadataCache.query == title)).first()
    payload = json.dumps(metadata)
    now = datetime.utcnow()
    if row:
        row.value_json = payload
        row.updated_at = now
        session.add(row)
    else:
        session.add(AniListMetadataCache(query=title, value_json=payload, updated_at=now))
    session.commit()


@router.post("/meta")
async def get_anilist_metadata(payload: AniListMetaRequest, session: Session = Depends(get_session)):
    title = payload.title.strip()
    if not title:
        return {"metadata": {"query": payload.title, "found": False}}

    cached = _get_cached(session, title)
    if cached:
        return {"metadata": cached}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            metadata = await _fetch_single_metadata(client, title)
            _upsert_cache(session, title, metadata)
            return {"metadata": metadata}
    except Exception:
        return {"metadata": {"query": title, "found": False}}


@router.post("/meta/batch")
async def get_anilist_metadata_batch(payload: AniListBatchMetaRequest, session: Session = Depends(get_session)):
    titles = [(t or "").strip() for t in payload.titles]
    if not titles:
        return {"items": []}

    results: list[Optional[dict]] = [None] * len(titles)
    missing: list[tuple[int, str]] = []
    for idx, title in enumerate(titles):
        if not title:
            results[idx] = {"query": "", "found": False}
            continue
        cached = _get_cached(session, title)
        if cached is not None:
            results[idx] = cached
        else:
            missing.append((idx, title))

    if not missing:
        return {"items": [item or {"query": "", "found": False} for item in results]}

    semaphore = asyncio.Semaphore(6)

    async def run_one(client: httpx.AsyncClient, title: str):
        if not title:
            return {"query": "", "found": False}
        try:
            async with semaphore:
                return await _fetch_single_metadata(client, title)
        except Exception:
            return {"query": title, "found": False}

    async with httpx.AsyncClient(timeout=8.0) as client:
        fetched = await asyncio.gather(*(run_one(client, title) for _, title in missing))

    for (idx, title), metadata in zip(missing, fetched):
        results[idx] = metadata
        if title and metadata:
            _upsert_cache(session, title, metadata)

    return {"items": [item or {"query": "", "found": False} for item in results]}
