import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.database import get_session
from app.db.models import Setting

router = APIRouter(tags=["settings"])


class SettingUpdate(BaseModel):
    key: str
    value: Any


DEFAULTS = {
    "downloads.max_concurrent": 2,
    "downloads.path": str((Path(os.getenv("DATA_DIR", "./data")) / "downloads").resolve()),
    "updates.interval_minutes": 60,
    "reader.default_mode": "single",
    "reader.reading_direction": "ltr",
    "images.cache.enabled": True,
    "images.cache.max_bytes": 536870912,
    "images.cache.ttl_hours": 720,
    "ui.mode": "mangaide",
}


@router.get("")
async def get_all_settings(db: Session = Depends(get_session)):
    items = db.exec(select(Setting)).all()
    data: dict[str, Any] = {}
    for item in items:
        try:
            data[item.key] = json.loads(item.value)
        except Exception:
            data[item.key] = item.value

    for k, v in DEFAULTS.items():
        data.setdefault(k, v)
    return {"settings": data}


@router.put("")
async def set_setting(payload: SettingUpdate, db: Session = Depends(get_session)):
    existing = db.exec(select(Setting).where(Setting.key == payload.key)).first()
    value_to_store = payload.value

    if payload.key == "downloads.path":
        raw = str(payload.value or "").strip()
        path = Path(raw).expanduser() if raw else (Path(os.getenv("DATA_DIR", "./data")) / "downloads")
        if not path.is_absolute():
            path = path.resolve()
        value_to_store = str(path)

    value = json.dumps(value_to_store)
    if existing:
        existing.value = value
        db.add(existing)
    else:
        db.add(Setting(key=payload.key, value=value))
    db.commit()
    return {"ok": True}
