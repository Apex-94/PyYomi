import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine

# Database file path - use data directory for desktop app
DATA_DIR = os.getenv("DATA_DIR", "./data")
DB_PATH = Path(DATA_DIR) / "pyyomi.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Database URL for background tasks
database_url = f"sqlite:///{DB_PATH}"

# Create engine
engine = create_engine(database_url, connect_args={"check_same_thread": False})


def get_session() -> Generator[Session, None, None]:
    """Request-scoped DB session that is always closed by FastAPI."""
    with Session(engine) as session:
        yield session


def init_db():
    """Initialize the database and create all tables."""
    SQLModel.metadata.create_all(bind=engine)
    _ensure_download_columns()


def _ensure_download_columns():
    """Add newly introduced download columns for existing databases."""
    inspector = inspect(engine)
    if "download" not in inspector.get_table_names():
        return

    existing = {col["name"] for col in inspector.get_columns("download")}
    new_columns = {
        "chapter_url": "TEXT",
        "chapter_title": "TEXT",
        "source": "TEXT",
        "error": "TEXT",
        "total_pages": "INTEGER NOT NULL DEFAULT 0",
        "downloaded_pages": "INTEGER NOT NULL DEFAULT 0",
    }

    with engine.begin() as conn:
        for name, col_type in new_columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE download ADD COLUMN {name} {col_type}"))
