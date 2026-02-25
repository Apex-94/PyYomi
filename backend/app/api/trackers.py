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

from ..db.database import get_session
from ..db.models import TrackerCredential, TrackerMapping, SyncQueue
from ..services.encryption import encryption_service
from ..trackers import TrackerRegistry

router = APIRouter(prefix="/trackers", tags=["trackers"])

# In-memory store for OAuth states and PKCE verifiers (use Redis in production)
oauth_states: dict = {}

# Secret key for signing state tokens (in production, use proper secret management)
STATE_SECRET = os.environ.get("STATE_SECRET", secrets.token_hex(32))


# =============================================================================
# Helper Functions
# =============================================================================

def encode_state(tracker_name: str, random_state: str) -> str:
    """Encode tracker name and random state into a single state parameter with signature"""
    data = {"tracker": tracker_name, "random": random_state}
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


def validate_state(state: str, tracker_name: str) -> Optional[str]:
    """Validate OAuth state and return code_verifier if present.
    
    Returns None if state is invalid, raises HTTPException if tracker mismatch.
    """
    stored_state = oauth_states.pop(state, None)
    
    if stored_state:
        if stored_state.get("tracker") != tracker_name:
            raise HTTPException(status_code=400, detail="State tracker mismatch")
        return stored_state.get("code_verifier")
    
    # State not in memory (server restart or multi-worker) - decode from state
    decoded = decode_state(state)
    if not decoded:
        raise HTTPException(status_code=400, detail="Invalid state - cannot decode")
    if decoded.get("tracker") != tracker_name:
        raise HTTPException(status_code=400, detail="State tracker mismatch")
    return None  # PKCE verifier lost if not in memory


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


# =============================================================================
# Request Models
# =============================================================================

class SyncRequest(BaseModel):
    """Request model for syncing progress"""
    manga_id: int
    chapter_number: int


class ImplicitGrantRequest(BaseModel):
    """Request model for implicit grant callback (AniList)"""
    access_token: str
    state: str
    expires_in: int = 31536000  # Default 1 year


# =============================================================================
# Tracker Status & Connection Endpoints
# =============================================================================

@router.get("/")
async def list_trackers():
    """List all available trackers"""
    from ..trackers.myanimelist import DEFAULT_CLIENT_ID as MAL_DEFAULT_ID
    
    # Check if client ID is configured (either via env var or default)
    def is_oauth_configured(tracker_name: str, default_id: str = None) -> bool:
        env_id = os.environ.get(f"{tracker_name.upper()}_CLIENT_ID")
        return bool(env_id or default_id)
    
    default_ids = {
        "mal": MAL_DEFAULT_ID,
    }
    
    trackers = [
        {
            "name": name,
            "display_name": tracker.display_name,
            "oauth_configured": is_oauth_configured(name, default_ids.get(name))
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
    get_tracker_or_404(tracker_name)
    credential = get_credential(session, tracker_name)
    
    return {
        "connected": credential is not None,
        "username": credential.username if credential else None,
        "user_id": credential.user_id if credential else None
    }


@router.get("/{tracker_name}/connect")
async def connect_tracker(tracker_name: str):
    """Initiate OAuth flow for a tracker"""
    tracker = get_tracker_or_404(tracker_name)
    
    random_state = secrets.token_urlsafe(32)
    state = encode_state(tracker_name, random_state)
    
    auth_url_result = await tracker.get_auth_url(state)
    
    if isinstance(auth_url_result, tuple):
        auth_url, code_verifier = auth_url_result
        oauth_states[state] = {"tracker": tracker_name, "random": random_state, "code_verifier": code_verifier}
    else:
        auth_url = auth_url_result
        oauth_states[state] = {"tracker": tracker_name, "random": random_state}
    
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
    
    # Check if already connected (handles React StrictMode double-call)
    existing_credential = get_credential(session, tracker_name)
    if existing_credential:
        return {"success": True, "username": existing_credential.username, "already_connected": True}
    
    code_verifier = validate_state(state, tracker_name)
    
    try:
        token_data = await tracker.exchange_code(code, code_verifier)
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
    
    # Check if already connected (handles React StrictMode double-call)
    existing_credential = get_credential(session, tracker_name)
    if existing_credential:
        return {"success": True, "username": existing_credential.username, "already_connected": True}
    
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
    
    access_token = encryption_service.decrypt(credential.access_token)
    results = await tracker.search_manga(access_token, query)
    
    return {"results": results}


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
    
    access_token = encryption_service.decrypt(credential.access_token)
    success = await tracker.update_progress(access_token, mapping.tracker_manga_id, request.chapter_number)
    
    if success:
        mapping.last_synced_chapter = request.chapter_number
        mapping.last_synced_at = datetime.utcnow()
        mapping.sync_status = "synced"
        session.commit()
    
    return {"success": success}


@router.get("/{tracker_name}/user-list")
async def get_user_list(
    tracker_name: str,
    session: Session = Depends(get_session)
):
    """Get user's manga list from tracker"""
    tracker = get_tracker_or_404(tracker_name)
    credential = get_credential_or_401(session, tracker_name)
    
    access_token = encryption_service.decrypt(credential.access_token)
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
    queue_item = SyncQueue(
        manga_id=request.manga_id,
        chapter_number=request.chapter_number,
        tracker_name=tracker_name,
        operation="update_progress"
    )
    session.add(queue_item)
    session.commit()
    session.refresh(queue_item)
    
    return {"queue_item": queue_item}
