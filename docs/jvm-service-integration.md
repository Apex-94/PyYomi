# JVM Service Integration for PyYomi

## Overview

This feature enables PyYomi to use manga sources from the [Keiyoushi/extensions-source](https://github.com/keiyoushi/extensions-source) repository by integrating a JVM service alongside the Python backend.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Electron Frontend                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Python Backend (FastAPI)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Library   │  │  Downloads  │  │  Settings   │  │    API      │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                    │                                    │
│  ┌─────────────────────────────────▼─────────────────────────────────┐  │
│  │                    Extension Loader & Registry                    │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │  │
│  │  │  Python Sources  │  │  KeiyoushiSource │  │  Other Sources │  │  │
│  │  │  (app.extensions)│  │  (Wrapper Class) │  │                │  │  │
│  │  └──────────────────┘  └────────┬─────────┘  └────────────────┘  │  │
│  └──────────────────────────────────┼────────────────────────────────┘  │
└─────────────────────────────────────┼───────────────────────────────────┘
                                      │ HTTP
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    JVM Service (Kotlin/Ktor)                          │
│  Port: 8080                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Ktor HTTP Server                          │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │  /health    /sources   /search   /popular   /latest           │   │
│  │  /manga/{id} /chapters /pages                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────▼────────────────────────────────┐   │
│  │                      SourceManager                               │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │              Loaded Sources (Extensions)                 │   │   │
│  │  │  ┌────────────────┐  ┌────────────────┐  ┌────────────┐  │   │   │
│  │  │  │ MangadexSource │  │ OtherSource... │  │   ...      │  │   │   │
│  │  │  └────────────────┘  └────────────────┘  └────────────┘  │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         External APIs                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐    │
│  │   Mangadex API  │  │  Other Sources  │  │   Keiyoushi Repo    │    │
│  │  mangadex.org   │  │    (various)    │  │  (extension repos)   │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## Why JVM?

The Keiyoushi extensions are written in Kotlin for the Mihon/Tachiyomi ecosystem. Their contributor guide specifies:

- **Language**: Kotlin
- **Core Technologies**: OkHttp, Jsoup
- **Extension Interface**: `HttpSource` or `ParsedHttpSource` base class
- **Factory Pattern**: `SourceFactory` can expose multiple sources from one package

Python cannot directly execute these extensions. The JVM service acts as an execution engine, while Python remains the product backend.

## Components

### 1. JVM Service (`jvm-service/`)

A Kotlin/Ktor application that:
- Loads and manages manga source extensions
- Exposes HTTP endpoints for source operations
- Returns normalized JSON to Python

#### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Kotlin | 1.9.22 |
| Server | Ktor | 2.3.7 |
| HTTP Client | OkHttp | 4.12.0 |
| HTML Parsing | Jsoup | 1.17.2 |
| Serialization | Kotlinx Serialization | 1.6.2 |
| Logging | Logback | 1.4.14 |

#### Project Structure

```
jvm-service/
├── settings.gradle.kts           # Root project configuration
├── gradle/wrapper/               # Gradle wrapper
├── gradlew.bat                   # Windows startup script
└── app/
    ├── build.gradle.kts          # Dependencies
    └── src/main/
        ├── kotlin/com/pyyomi/source/
        │   ├── Main.kt           # Entry point
        │   ├── routing/
        │   │   └── SourceRoutes.kt   # HTTP endpoints
        │   ├── service/
        │   │   └── SourceManager.kt # Extension loader
        │   ├── models/
        │   │   └── DTOs.kt       # Request/Response models
        │   └── extension/
        │       ├── MangaSource.kt    # Source interface
        │       └── MangadexSource.kt # Implementation
        └── resources/
            └── logback.xml        # Logging config
```

#### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service status |
| `/health` | GET | Health check with source count |
| `/sources` | GET | List all available sources |
| `/search` | POST | Search manga |
| `/popular/{sourceId}` | GET | Get popular manga |
| `/latest/{sourceId}` | GET | Get latest updates |
| `/manga/{sourceId}/{mangaId}` | GET | Get manga details |
| `/chapters/{sourceId}/{mangaId}` | GET | Get chapter list |
| `/pages/{sourceId}/{chapterId}` | GET | Get page URLs |

#### Request/Response Format

**Search Request:**
```json
{
  "source_id": "mangadex-en",
  "query": "One Piece",
  "page": 1,
  "filters": []
}
```

**Search Response:**
```json
{
  "source_id": "mangadex-en",
  "items": [
    {
      "id": "abc123",
      "title": "One Piece",
      "thumbnail": "https://example.com/cover.jpg",
      "url": "/manga/abc123"
    }
  ],
  "has_next_page": true
}
```

### 2. Python Backend

#### JVM Client (`backend/app/extensions/jvm_client.py`)

An async HTTP client that:
- Connects to the JVM service
- Provides methods for all source operations
- Handles connection errors gracefully
- Configurable via `PYYOMI_JVM_SERVICE_URL` environment variable

```python
from app.extensions.jvm_client import get_jvm_client

client = get_jvm_client()

# Search
result = await client.search("mangadex-en", "One Piece", page=1)

# Get details
details = await client.get_manga_details("mangadex-en", manga_id)

# Get chapters
chapters = await client.get_chapters("mangadex-en", manga_id)

# Get pages
pages = await client.get_pages("mangadex-en", chapter_id)
```

#### KeiyoushiSource Wrapper (`backend/app/extensions/keiyoushi/`)

A Python scraper that implements `BaseScraper` and delegates to the JVM service:

```python
from app.extensions.base import BaseScraper, MangaCard, MangaDetails, Chapter

class KeiyoushiSource(BaseScraper):
    name = "Keiyoushi"
    language = "en"
    version = "1.0.0"
    
    async def search(self, query: str, page: int = 1, filters: List[Filter] = None) -> List[MangaCard]:
        # Delegates to JVM client
        
    async def details(self, manga_url: str) -> MangaDetails:
        # Delegates to JVM client
        
    async def chapters(self, manga_url: str) -> List[Chapter]:
        # Delegates to JVM client
        
    async def pages(self, chapter_url: str) -> List[str]:
        # Delegates to JVM client
```

#### Database Models (`backend/app/db/models.py`)

New models for extension management:

```python
class ExtensionPackage(SQLModel, table=True):
    """An installed extension package from a repo"""
    id: Optional[int] = Field(default=None, primary_key=True)
    package_id: str = Field(unique=True, index=True)  # e.g., "eu.kanade.tachiyomi.extension.en.mangadex"
    name: str
    version: str
    repo_url: str
    enabled: bool = True
    installed_at: datetime

class RuntimeSource(SQLModel, table=True):
    """A runtime source exposed by an installed package"""
    id: Optional[int] = Field(default=None, primary_key=True)
    source_id: str = Field(unique=True, index=True)  # e.g., "mangadex-en"
    package_id: str = Field(index=True)
    name: str
    lang: str
    base_url: Optional[str] = None
    is_enabled: bool = True
```

The separation supports the `SourceFactory` pattern where one package can expose multiple sources.

## Running the Service

### Prerequisites

- Java 17 or higher
- Python 3.10+
- Gradle (or use the wrapper)

### Start JVM Service

```bash
cd jvm-service
gradle run
```

The service will start on `http://localhost:8080`

### Start Python Backend

```bash
cd backend
python -m uvicorn app.main:app
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PYYOMI_JVM_SERVICE_URL` | `http://localhost:8080` | JVM service URL |
| `PYYOMI_DEFAULT_SOURCE` | `mangadex-en` | Default source for Keiyoushi |

## Extension Discovery Flow

1. **User adds Keiyoushi repo** → Python fetches `index.min.json`
2. **User installs extension** → Python stores package in DB
3. **Frontend requests search** → Python forwards to JVM service
4. **JVM service returns normalized JSON** → Python returns to Electron

This architecture means:
- "Install" = "register this source package and make it routable"
- Not = "execute the APK directly in Python"

## Current Status

### Implemented
- ✅ Kotlin/Ktor JVM service with basic structure
- ✅ Mangadex source implementation (prototype)
- ✅ Python JVM client
- ✅ KeiyoushiSource wrapper (BaseScraper implementation)
- ✅ Extension loader integration
- ✅ Database models for packages/sources

### Todo (Future Work)
- [ ] Run full end-to-end test with JVM service running
- [ ] Add more sources (currently just Mangadex)
- [ ] Implement dynamic extension loading from repo
- [ ] Add filters support in KeiyoushiSource
- [ ] Add authentication support for sources that need it
- [ ] Add caching layer for JVM responses

## Troubleshooting

### Connection Refused

If you see "All connection attempts failed":
1. Ensure JVM service is running: `cd jvm-service && gradle run`
2. Check port 8080 is available
3. Verify `PYYOMI_JVM_SERVICE_URL` is correct

### Source Not Found

If "keiyoushi:en" is not in the source list:
1. Check the extension was loaded: look for errors in startup logs
2. Verify `backend/app/extensions/keiyoushi/__init__.py` exists

### Empty Results

If search/popular/latest return empty:
1. Check the JVM service logs for errors
2. Verify network connectivity to Mangadex API
3. The prototype uses the Mangadex API directly

## References

- [Keiyoushi/extensions-source](https://github.com/keiyoushi/extensions-source)
- [Mihon Extension Documentation](https://mihon.top/guides/extensions/)
- [Ktor Framework](https://ktor.io/)
- [OkHttp](https://square.github.io/okhttp/)
- [Jsoup](https://jsoup.org/)