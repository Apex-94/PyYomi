"""Tracker API routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import secrets
import os
import json
import base64
import hashlib
import hmac
from urllib.parse import urlparse
from cryptography.fernet import InvalidToken

from ..db.database import get_session
from ..db.models import TrackerCredential, TrackerMapping, SyncQueue
from ..services.encryption import encryption_service
from ..trackers import TrackerRegistry
from ..trackers.base import FuzzyDate, TrackerEntryUpdate

router = APIRouter(prefix="/trackers", tags=["trackers"])

# In-memory store for OAuth states and PKCE verifiers (use Redis in production)
oauth_states: dict = {}

# Secret key for signing state tokens (in production, use proper secret management)
STATE_SECRET = os.environ.get("STATE_SECRET", secrets.token_hex(32))
TOKEN_EXPIRY_SKEW_SECONDS = 60
SYNC_MAX_RETRIES = 3
SYNC_PROCESS_BATCH_SIZE = 50


# =============================================================================
# Helper Functions
# =============================================================================

def encode_state(tracker_name: str, random_state: str, redirect_uri: Optional[str] = None) -> str:
    """Encode tracker name and random state into a single state parameter with signature"""
    data = {"tracker": tracker_name, "random": random_state}
    if redirect_uri:
        data["redirect_uri"] = redirect_uri
    payload = base64.urlsafe_b64encode(json.dumps(data).encode()).decode()
    signature = hmac.new(
        STATE_SECRET.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()[:16]
    return f"{payload}.{signature}"


def decode_state(encoded_state: str) -> dict:
    """Decode state parameter to get tracker name and random state"""
    try:
        parts = encoded_state.split(".")
        if len(parts) != 2:
            return {}
        payload, signature = parts
        expected_sig = hmac.new(
            STATE_SECRET.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()[:16]
        if not hmac.compare_digest(signature, expected_sig):
            return {}
        return json.loads(base64.urlsafe_b64decode(payload.encode()).decode())
    except Exception:
        return {}


def get_tracker_or_404(tracker_name: str):
    """Get tracker by name or raise 404"""
    tracker = TrackerRegistry.get(tracker_name)
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracker not found")
    return tracker


def get_credential(session: Session, tracker_name: str) -> Optional[TrackerCredential]:
    """Get credential for a tracker"""
    return session.exec(
        select(TrackerCredential).where(TrackerCredential.tracker_name == tracker_name)
    ).first()


def get_credential_or_401(session: Session, tracker_name: str) -> TrackerCredential:
    """Get credential for a tracker or raise 401"""
    credential = get_credential(session, tracker_name)
    if not credential:
        raise HTTPException(status_code=401, detail="Tracker not connected")
    return credential


def validate_state(state: str, tracker_name: str) -> dict:
    """Validate OAuth state and return state metadata (code_verifier, redirect_uri)."""
    stored_state = oauth_states.pop(state, None)
    
    if stored_state:
        if stored_state.get("tracker") != tracker_name:
            raise HTTPException(status_code=400, detail="State tracker mismatch")
        return {
            "code_verifier": stored_state.get("code_verifier"),
            "redirect_uri": stored_state.get("redirect_uri"),
        }
    
    # State not in memory (server restart or multi-worker) - decode from state
    decoded = decode_state(state)
    if not decoded:
        raise HTTPException(status_code=400, detail="Invalid state - cannot decode")
    if decoded.get("tracker") != tracker_name:
        raise HTTPException(status_code=400, detail="State tracker mismatch")
    return {
        "code_verifier": None,  # PKCE verifier is lost if state wasn't found in memory.
        "redirect_uri": decoded.get("redirect_uri"),
    }


def normalize_frontend_origin(frontend_origin: Optional[str]) -> Optional[str]:
    """Normalize frontend origin passed by client and reject malformed values."""
    if not frontend_origin:
        return None
    parsed = urlparse(frontend_origin)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def upsert_credential(session: Session, credential: TrackerCredential) -> None:
    """Insert or update a tracker credential"""
    existing = get_credential(session, credential.tracker_name)
    if existing:
        credential.id = existing.id
        session.merge(credential)
    else:
        session.add(credential)


def get_mapping(session: Session, manga_id: int, tracker_name: str) -> Optional[TrackerMapping]:
    """Get tracker mapping for a manga"""
    return session.exec(
        select(TrackerMapping).where(
            TrackerMapping.manga_id == manga_id,
            TrackerMapping.tracker_name == tracker_name
        )
    ).first()


def is_token_expired(credential: TrackerCredential) -> bool:
    """Check whether the credential's access token is expired (with small skew)."""
    if not credential.token_expires_at:
        return False
    return credential.token_expires_at <= datetime.utcnow() + timedelta(seconds=TOKEN_EXPIRY_SKEW_SECONDS)


async def get_valid_access_token(
    session: Session,
    tracker,
    credential: TrackerCredential,
) -> str:
    """Return a valid access token, refreshing when supported."""
    try:
        access_token = encryption_service.decrypt(credential.access_token)
    except InvalidToken:
        raise HTTPException(
            status_code=401,
            detail="Stored tracker credentials are invalid. Please disconnect and reconnect the tracker.",
        )
    if not is_token_expired(credential):
        return access_token

    if not tracker.supports_refresh_token or not credential.refresh_token:
        raise HTTPException(status_code=401, detail="Tracker token expired. Please reconnect.")

    try:
        refresh_token = encryption_service.decrypt(credential.refresh_token)
        token_data = await tracker.refresh_tokens(refresh_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Tracker token refresh failed: {str(e)}")

    credential.access_token = encryption_service.encrypt(token_data.access_token)
    if token_data.refresh_token:
        credential.refresh_token = encryption_service.encrypt(token_data.refresh_token)
    credential.token_expires_at = (
        datetime.utcnow() + timedelta(seconds=token_data.expires_in)
        if token_data.expires_in else None
    )
    session.add(credential)
    session.commit()
    return token_data.access_token


def queue_sync_update(
    session: Session,
    tracker_name: str,
    manga_id: int,
    chapter_number: int,
    error_message: Optional[str] = None,
) -> SyncQueue:
    """Queue or update a pending sync update operation."""
    existing = session.exec(
        select(SyncQueue).where(
            SyncQueue.manga_id == manga_id,
            SyncQueue.tracker_name == tracker_name,
            SyncQueue.operation == "update_progress",
            SyncQueue.status == "pending",
        ).order_by(SyncQueue.created_at.desc())
    ).first()

    if existing:
        # Keep a single pending job per manga/tracker and always advance to latest chapter.
        if chapter_number > existing.chapter_number:
            existing.chapter_number = chapter_number
        if error_message:
            existing.error_message = error_message
        session.add(existing)
        return existing

    queue_item = SyncQueue(
        manga_id=manga_id,
        chapter_number=chapter_number,
        tracker_name=tracker_name,
        operation="update_progress",
        status="pending",
        error_message=error_message,
    )
    session.add(queue_item)
    return queue_item


def _derive_anilist_status(chapter_number: int, total_chapters: Optional[int] = None) -> str:
    """Derive AniList status from progress using Mihon-like defaults."""
    if chapter_number <= 0:
        return "planning"
    if total_chapters and total_chapters > 0 and chapter_number >= total_chapters:
        return "completed"
    return "current"


# =============================================================================
# Request Models
# =============================================================================

class FuzzyDateModel(BaseModel):
    """Fuzzy date payload for tracker entry fields."""
    year: Optional[int] = None
    month: Optional[int] = None
    day: Optional[int] = None

    def to_tracker_date(self) -> FuzzyDate:
        return FuzzyDate(year=self.year, month=self.month, day=self.day)


class TrackerEntryUpdateRequest(BaseModel):
    """Request model for explicit tracker entry updates."""
    manga_id: int
    progress: Optional[int] = None
    status: Optional[str] = None
    score: Optional[float] = None
    is_private: Optional[bool] = None
    started_at: Optional[FuzzyDateModel] = None
    completed_at: Optional[FuzzyDateModel] = None
    auto_status: bool = True
    total_chapters: Optional[int] = None


class SyncRequest(BaseModel):
    """Request model for syncing progress"""
    manga_id: int
    chapter_number: int
    status: Optional[str] = None
    score: Optional[float] = None
    is_private: Optional[bool] = None
    started_at: Optional[FuzzyDateModel] = None
    completed_at: Optional[FuzzyDateModel] = None
    auto_status: bool = True
    total_chapters: Optional[int] = None


class ImplicitGrantRequest(BaseModel):
    """Request model for implicit grant callback"""
    access_token: str
    state: Optional[str] = None
    expires_in: int = 31536000  # Default 1 year


# =============================================================================
# Tracker Status & Connection Endpoints
# =============================================================================

@router.get("/")
async def list_trackers():
    """List all available trackers"""
    from ..trackers.anilist import DEFAULT_CLIENT_ID as ANILIST_DEFAULT_ID
    from ..trackers.myanimelist import DEFAULT_CLIENT_ID as MAL_DEFAULT_ID
    
    # Check if credentials are configured for each tracker.
    def is_oauth_configured(tracker_name: str, default_id: str = None) -> bool:
        if tracker_name == "anilist":
            flow = os.environ.get("ANILIST_OAUTH_FLOW", "implicit").strip().lower()
            client_id = os.environ.get("ANILIST_CLIENT_ID") or default_id
            client_secret = os.environ.get("ANILIST_CLIENT_SECRET")
            if flow == "implicit":
                return bool(client_id)
            return bool(client_id and client_secret)
        env_id = os.environ.get(f"{tracker_name.upper()}_CLIENT_ID")
        return bool(env_id or default_id)
    
    default_ids = {
        "anilist": ANILIST_DEFAULT_ID,
        "mal": MAL_DEFAULT_ID,
    }
    
    trackers = [
        {
            "name": name,
            "display_name": tracker.display_name,
            "oauth_configured": is_oauth_configured(name, default_ids.get(name)),
            "oauth_flow": "implicit" if tracker.uses_implicit_grant else "code",
            "supports_refresh_token": tracker.supports_refresh_token,
        }
        for name, tracker in TrackerRegistry.list_all().items()
    ]
    return {"trackers": trackers}


@router.get("/{tracker_name}/status")
async def get_tracker_status(
    tracker_name: str,
    session: Session = Depends(get_session)
):
    """Get connection status for a tracker"""
    tracker = get_tracker_or_404(tracker_name)
    credential = get_credential(session, tracker_name)

    result = {
        "connected": credential is not None,
        "username": credential.username if credential else None,
        "user_id": credential.user_id if credential else None
    }
    if credential:
        try:
            access_token = await get_valid_access_token(session, tracker, credential)
            score_format = await tracker.get_score_format(access_token)
            if score_format:
                result["score_format"] = score_format
        except Exception:
            # Status should still be returned even if optional metadata fetch fails.
            pass
    return result


@router.get("/{tracker_name}/connect")
async def connect_tracker(
    tracker_name: str,
    frontend_origin: Optional[str] = Query(None),
):
    """Initiate OAuth flow for a tracker"""
    tracker = get_tracker_or_404(tracker_name)
    
    random_state = secrets.token_urlsafe(32)
    normalized_origin = normalize_frontend_origin(frontend_origin)
    redirect_uri = (
        tracker.resolve_redirect_uri(normalized_origin)
        if hasattr(tracker, "resolve_redirect_uri")
        else None
    )
    state = encode_state(tracker_name, random_state, redirect_uri)
    
    try:
        auth_url_result = await tracker.get_auth_url(state, redirect_uri=redirect_uri)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if isinstance(auth_url_result, tuple):
        auth_url, code_verifier = auth_url_result
        oauth_states[state] = {
            "tracker": tracker_name,
            "random": random_state,
            "code_verifier": code_verifier,
            "redirect_uri": redirect_uri,
        }
    else:
        auth_url = auth_url_result
        oauth_states[state] = {
            "tracker": tracker_name,
            "random": random_state,
            "redirect_uri": redirect_uri,
        }
    
    return {"auth_url": auth_url, "state": state}


@router.get("/{tracker_name}/callback")
async def oauth_callback(
    tracker_name: str,
    code: str,
    state: str,
    session: Session = Depends(get_session)
):
    """Handle OAuth callback from tracker"""
    tracker = get_tracker_or_404(tracker_name)
    if tracker.uses_implicit_grant:
        raise HTTPException(status_code=400, detail="Tracker uses implicit grant callback")
    
    # Check if already connected (handles React StrictMode double-call)
    existing_credential = get_credential(session, tracker_name)
    if existing_credential:
        return {"success": True, "username": existing_credential.username, "already_connected": True}
    
    state_data = validate_state(state, tracker_name)
    code_verifier = state_data.get("code_verifier")
    redirect_uri = state_data.get("redirect_uri")
    
    try:
        token_data = await tracker.exchange_code(code, code_verifier, redirect_uri)
        user_info = await tracker.get_user_info(token_data.access_token)
        
        credential = TrackerCredential(
            tracker_name=tracker_name,
            user_id=str(user_info.get("id")),
            username=user_info.get("name"),
            access_token=encryption_service.encrypt(token_data.access_token),
            refresh_token=encryption_service.encrypt(token_data.refresh_token) if token_data.refresh_token else None,
            token_expires_at=datetime.utcnow() + timedelta(seconds=token_data.expires_in) if token_data.expires_in else None
        )
        
        upsert_credential(session, credential)
        session.commit()
        
        return {"success": True, "username": user_info.get("name")}
    except Exception as e:
        error_msg = str(e)
        # Check if this is a "code already used" error - tracker might already be connected
        if "invalid_grant" in error_msg.lower() or "invalid" in error_msg.lower() or "400" in error_msg:
            existing = get_credential(session, tracker_name)
            if existing:
                return {"success": True, "username": existing.username, "already_connected": True}
        raise HTTPException(status_code=400, detail=error_msg)


@router.post("/{tracker_name}/callback/implicit")
async def implicit_grant_callback(
    tracker_name: str,
    request: ImplicitGrantRequest,
    session: Session = Depends(get_session)
):
    """Handle implicit grant OAuth callback (for AniList and similar trackers)
    
    This endpoint receives the access token directly from the frontend,
    which extracts it from the URL fragment (#access_token=...).
    """
    tracker = get_tracker_or_404(tracker_name)
    if not tracker.uses_implicit_grant:
        raise HTTPException(status_code=400, detail="Tracker does not use implicit grant callback")
    
    # Check if already connected (handles React StrictMode double-call)
    existing_credential = get_credential(session, tracker_name)
    if existing_credential:
        return {"success": True, "username": existing_credential.username, "already_connected": True}
    
    if request.state:
        validate_state(request.state, tracker_name)
    
    try:
        user_info = await tracker.get_user_info(request.access_token)
        
        credential = TrackerCredential(
            tracker_name=tracker_name,
            user_id=str(user_info.get("id")),
            username=user_info.get("name"),
            access_token=encryption_service.encrypt(request.access_token),
            refresh_token=None,  # Implicit grant doesn't provide refresh tokens
            token_expires_at=datetime.utcnow() + timedelta(seconds=request.expires_in)
        )
        
        upsert_credential(session, credential)
        session.commit()
        
        return {"success": True, "username": user_info.get("name")}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{tracker_name}/disconnect")
async def disconnect_tracker(
    tracker_name: str,
    session: Session = Depends(get_session)
):
    """Disconnect a tracker"""
    credential = get_credential(session, tracker_name)
    if credential:
        session.delete(credential)
        session.commit()
    return {"success": True}


# =============================================================================
# Tracker Operations Endpoints
# =============================================================================

@router.get("/{tracker_name}/search")
async def search_tracker_manga(
    tracker_name: str,
    query: str,
    session: Session = Depends(get_session)
):
    """Search for manga on a connected tracker"""
    tracker = get_tracker_or_404(tracker_name)
    credential = get_credential_or_401(session, tracker_name)
    
    access_token = await get_valid_access_token(session, tracker, credential)
    results = await tracker.search_manga(access_token, query)
    
    return {"results": results}


@router.get("/{tracker_name}/entry")
async def get_tracker_entry(
    tracker_name: str,
    manga_id: int = Query(...),
    session: Session = Depends(get_session),
):
    """Get detailed tracker entry for a mapped manga."""
    tracker = get_tracker_or_404(tracker_name)
    credential = get_credential_or_401(session, tracker_name)
    mapping = get_mapping(session, manga_id, tracker_name)

    if not mapping:
        raise HTTPException(status_code=404, detail="Manga not mapped to tracker")

    access_token = await get_valid_access_token(session, tracker, credential)
    try:
        entry = await tracker.get_entry(access_token, mapping.tracker_manga_id)
    except NotImplementedError:
        raise HTTPException(status_code=400, detail=f"{tracker_name} does not support entry details")

    if entry is None:
        return {"entry": None}
    return {"entry": entry}


@router.put("/{tracker_name}/entry")
async def update_tracker_entry(
    tracker_name: str,
    request: TrackerEntryUpdateRequest,
    session: Session = Depends(get_session),
):
    """Update detailed tracker entry fields for a mapped manga."""
    tracker = get_tracker_or_404(tracker_name)
    credential = get_credential_or_401(session, tracker_name)
    mapping = get_mapping(session, request.manga_id, tracker_name)

    if not mapping:
        raise HTTPException(status_code=404, detail="Manga not mapped to tracker")

    access_token = await get_valid_access_token(session, tracker, credential)
    status_value = request.status
    if request.auto_status and not status_value and tracker_name == "anilist":
        progress = request.progress or 0
        status_value = _derive_anilist_status(progress, request.total_chapters)

    update_payload = TrackerEntryUpdate(
        progress=request.progress,
        status=status_value,
        score=request.score,
        is_private=request.is_private,
        started_at=request.started_at.to_tracker_date() if request.started_at else None,
        completed_at=request.completed_at.to_tracker_date() if request.completed_at else None,
    )
    try:
        success = await tracker.update_entry(access_token, mapping.tracker_manga_id, update_payload)
    except NotImplementedError:
        raise HTTPException(status_code=400, detail=f"{tracker_name} does not support entry updates")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if success and request.progress is not None:
        mapping.last_synced_chapter = request.progress
        mapping.last_synced_at = datetime.utcnow()
        mapping.sync_status = "synced"
        session.add(mapping)
        session.commit()

    return {"success": bool(success)}


@router.post("/{tracker_name}/sync")
async def sync_to_tracker(
    tracker_name: str,
    request: SyncRequest,
    session: Session = Depends(get_session)
):
    """Sync reading progress to tracker"""
    tracker = get_tracker_or_404(tracker_name)
    credential = get_credential_or_401(session, tracker_name)
    mapping = get_mapping(session, request.manga_id, tracker_name)
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Manga not mapped to tracker")
    
    access_token = await get_valid_access_token(session, tracker, credential)

    try:
        if tracker_name == "anilist":
            status_value = request.status
            if request.auto_status and not status_value:
                status_value = _derive_anilist_status(request.chapter_number, request.total_chapters)
            success = await tracker.update_entry(
                access_token,
                mapping.tracker_manga_id,
                TrackerEntryUpdate(
                    progress=request.chapter_number,
                    status=status_value,
                    score=request.score,
                    is_private=request.is_private,
                    started_at=request.started_at.to_tracker_date() if request.started_at else None,
                    completed_at=request.completed_at.to_tracker_date() if request.completed_at else None,
                ),
            )
        else:
            success = await tracker.update_progress(access_token, mapping.tracker_manga_id, request.chapter_number)
    except Exception as e:
        queue_item = queue_sync_update(
            session,
            tracker_name=tracker_name,
            manga_id=request.manga_id,
            chapter_number=request.chapter_number,
            error_message=str(e),
        )
        mapping.sync_status = "pending"
        session.commit()
        session.refresh(queue_item)
        return {
            "success": False,
            "queued": True,
            "queue_item_id": queue_item.id,
            "detail": str(e),
        }

    if success:
        mapping.last_synced_chapter = request.chapter_number
        mapping.last_synced_at = datetime.utcnow()
        mapping.sync_status = "synced"
        session.commit()
        return {"success": True, "queued": False}

    queue_item = queue_sync_update(
        session,
        tracker_name=tracker_name,
        manga_id=request.manga_id,
        chapter_number=request.chapter_number,
        error_message="Tracker rejected update",
    )
    mapping.sync_status = "pending"
    session.commit()
    session.refresh(queue_item)
    return {
        "success": False,
        "queued": True,
        "queue_item_id": queue_item.id,
        "detail": "Tracker rejected update",
    }


@router.get("/{tracker_name}/user-list")
async def get_user_list(
    tracker_name: str,
    session: Session = Depends(get_session)
):
    """Get user's manga list from tracker"""
    tracker = get_tracker_or_404(tracker_name)
    credential = get_credential_or_401(session, tracker_name)
    
    access_token = await get_valid_access_token(session, tracker, credential)
    manga_list = await tracker.get_user_list(access_token)
    
    return {"manga_list": manga_list}


# =============================================================================
# Tracker Mappings Endpoints
# =============================================================================

@router.get("/{tracker_name}/mappings")
async def get_tracker_mappings(
    tracker_name: str,
    session: Session = Depends(get_session)
):
    """Get all manga mappings for a tracker"""
    mappings = session.exec(
        select(TrackerMapping).where(TrackerMapping.tracker_name == tracker_name)
    ).all()
    return {"mappings": mappings}


@router.post("/{tracker_name}/mappings")
async def create_tracker_mapping(
    tracker_name: str,
    manga_id: int = Query(...),
    tracker_manga_id: str = Query(...),
    tracker_url: Optional[str] = Query(None),
    session: Session = Depends(get_session)
):
    """Create a mapping between local manga and tracker manga"""
    existing = get_mapping(session, manga_id, tracker_name)
    
    if existing:
        existing.tracker_manga_id = tracker_manga_id
        existing.tracker_url = tracker_url
        session.commit()
        return {"mapping": existing}
    
    mapping = TrackerMapping(
        manga_id=manga_id,
        tracker_name=tracker_name,
        tracker_manga_id=tracker_manga_id,
        tracker_url=tracker_url
    )
    session.add(mapping)
    session.commit()
    session.refresh(mapping)
    
    return {"mapping": mapping}


@router.delete("/{tracker_name}/mappings")
async def delete_tracker_mapping(
    tracker_name: str,
    manga_id: int = Query(...),
    session: Session = Depends(get_session)
):
    """Delete a mapping between local manga and tracker manga"""
    mapping = get_mapping(session, manga_id, tracker_name)
    
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    session.delete(mapping)
    session.commit()
    
    return {"success": True}


# =============================================================================
# Sync Queue Endpoints
# =============================================================================

@router.get("/{tracker_name}/sync-queue")
async def get_sync_queue(
    tracker_name: str,
    session: Session = Depends(get_session)
):
    """Get pending sync operations for a tracker"""
    queue_items = session.exec(
        select(SyncQueue).where(
            SyncQueue.tracker_name == tracker_name,
            SyncQueue.status == "pending"
        )
    ).all()
    return {"queue": queue_items}


@router.post("/{tracker_name}/sync-queue")
async def add_to_sync_queue(
    tracker_name: str,
    request: SyncRequest,
    session: Session = Depends(get_session)
):
    """Add a sync operation to the queue"""
    queue_item = queue_sync_update(
        session,
        tracker_name=tracker_name,
        manga_id=request.manga_id,
        chapter_number=request.chapter_number,
    )
    session.commit()
    session.refresh(queue_item)
    
    return {"queue_item": queue_item}


@router.post("/{tracker_name}/sync-queue/process")
async def process_sync_queue(
    tracker_name: str,
    session: Session = Depends(get_session)
):
    """Process pending sync operations for a tracker."""
    tracker = get_tracker_or_404(tracker_name)
    credential = get_credential_or_401(session, tracker_name)

    queue_items = session.exec(
        select(SyncQueue).where(
            SyncQueue.tracker_name == tracker_name,
            SyncQueue.status == "pending"
        ).order_by(SyncQueue.created_at).limit(SYNC_PROCESS_BATCH_SIZE)
    ).all()

    processed = 0
    failed = 0

    for item in queue_items:
        item.status = "processing"
        session.add(item)
        session.commit()

        mapping = get_mapping(session, item.manga_id, tracker_name)
        if not mapping:
            item.retry_count += 1
            item.status = "failed"
            item.error_message = "Manga not mapped to tracker"
            item.processed_at = datetime.utcnow()
            failed += 1
            session.add(item)
            session.commit()
            continue

        try:
            access_token = await get_valid_access_token(session, tracker, credential)
            success = await tracker.update_progress(access_token, mapping.tracker_manga_id, item.chapter_number)
            if not success:
                raise Exception("Tracker rejected update")

            item.status = "completed"
            item.error_message = None
            item.processed_at = datetime.utcnow()
            mapping.last_synced_chapter = item.chapter_number
            mapping.last_synced_at = datetime.utcnow()
            mapping.sync_status = "synced"
            processed += 1
        except Exception as e:
            item.retry_count += 1
            item.error_message = str(e)
            item.processed_at = datetime.utcnow()
            if item.retry_count >= SYNC_MAX_RETRIES:
                item.status = "failed"
                mapping.sync_status = "error"
            else:
                item.status = "pending"
                mapping.sync_status = "pending"
            failed += 1

        session.add(item)
        session.add(mapping)
        session.commit()

    remaining = session.exec(
        select(SyncQueue).where(
            SyncQueue.tracker_name == tracker_name,
            SyncQueue.status == "pending"
        )
    ).all()

    return {"processed": processed, "failed": failed, "remaining": len(remaining)}
