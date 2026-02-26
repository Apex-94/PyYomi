"""
FastAPI router namespaces.

This package exposes individual routers for different API domains. To add
additional endpoints, create new modules in this directory and import
their routers in the application factory.
"""

from .manga import router as manga_router
from .sources import router as sources_router
from .proxy import router as proxy_router
from .reader import router as reader_router
from .library import router as library_router
from .categories import router as categories_router
from .history import router as history_router
from .downloads import router as downloads_router
from .updates import router as updates_router
from .settings import router as settings_router
from .backup import router as backup_router
from .anilist_meta import router as anilist_meta_router
