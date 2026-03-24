# Extension Development Guide

This guide explains how to create extensions for the Manga Reader App. Extensions allow the app to support additional manga sources by implementing a standard interface.

## How Extensions Work

The Manga Reader App uses a plugin architecture where each extension is a separate Python module implementing the `BaseScraper` interface from [`app/extensions/base.py`](../backend/app/extensions/base.py). Extensions are discovered and loaded automatically when the backend starts up.

## Extension Structure

Each extension should be placed in its own directory under `backend/app/extensions/`. Here's the typical structure:

```
backend/app/extensions/
└── myextension/
    ├── __init__.py       # Main extension file with scraper implementation
    └── manifest.json     # Extension metadata (optional but recommended)
```

## Creating an Extension

### Step 1: Create the Extension Directory

Create a new directory for your extension under `backend/app/extensions/`. The directory name will be used as the extension identifier.

### Step 2: Create the Scraper Implementation

Create an `__init__.py` file with your scraper class extending `BaseScraper`.

```python
# backend/app/extensions/myextension/__init__.py
from app.extensions.base import BaseScraper, MangaCard, MangaDetails, Chapter

class MyExtension(BaseScraper):
    """My custom manga source extension."""
    
    name = "MyExtension"
    language = "en"
    version = "1.0.0"
    base_urls = ["https://example.com"]
    
    async def search(self, query: str, page: int = 1):
        # Implement search functionality
        pass
    
    async def popular(self, page: int = 1):
        # Implement popular manga retrieval
        pass
    
    async def latest(self, page: int = 1):
        # Implement latest updates retrieval
        pass
    
    async def details(self, manga_url: str):
        # Implement manga details retrieval
        pass
    
    async def chapters(self, manga_url: str):
        # Implement chapter list retrieval
        pass
    
    async def pages(self, chapter_url: str):
        # Implement page image URL retrieval
        pass

# Export the scraper instance
source = MyExtension()
```

### Step 3: Create a Manifest File (Optional)

Create a `manifest.json` file to provide additional metadata about your extension.

```json
{
  "name": "MyExtension",
  "language": "en",
  "version": "1.0.0",
  "base_urls": ["https://example.com"],
  "description": "A custom manga source extension for Example.com"
}
```

## BaseScraper Interface

All extensions must implement the `BaseScraper` abstract class from [`app/extensions/base.py`](../backend/app/extensions/base.py). Here's a detailed description of the interface:

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | `str` | Human-readable name of the source |
| `language` | `str` | ISO language code of the content (e.g., "en", "ja") |
| `version` | `str` | Semantic version of the scraper implementation |
| `base_urls` | `List[str]` | List of base URLs that the source supports (including mirrors and mobile versions) |

### Required Methods

#### `search(query: str, page: int = 1) -> List[MangaCard]`
Search for manga on the source matching the query.

#### `popular(page: int = 1) -> List[MangaCard]`
Return a list of popular manga from the source.

#### `latest(page: int = 1) -> List[MangaCard]`
Return a list of recently updated manga from the source.

#### `details(manga_url: str) -> MangaDetails`
Fetch detailed metadata for a specific manga.

#### `chapters(manga_url: str) -> List[Chapter]`
Fetch the list of chapters for a specific manga.

#### `pages(chapter_url: str) -> List[str]`
Fetch the list of image URLs for a specific chapter.

### Optional Methods

#### `resolve_image(url: str) -> str`
Resolve a lazy-loaded page URL to its actual image source. The default implementation returns the URL as-is.

## Data Structures

The extension system uses specific data structures to ensure consistency across sources.

### MangaCard
A lightweight representation of a manga used in list views.

```python
@dataclass
class MangaCard:
    title: str
    url: str
    thumbnail_url: Optional[str] = None
    source: str = ""
```

### MangaDetails
Detailed metadata about a manga.

```python
@dataclass
class MangaDetails:
    title: str
    description: str
    author: Optional[str]
    artist: Optional[str]
    status: Status  # "ongoing", "completed", "hiatus", "cancelled", "unknown"
    genres: List[str]
    thumbnail_url: Optional[str]
    source_url: str
```

### Chapter
Represents a single chapter in a manga.

```python
@dataclass
class Chapter:
    title: str
    url: str
    chapter_number: Optional[float] = None
    uploaded_at_ts: Optional[int] = None
```

## Example Extension

See the [MangaHere extension](../backend/app/extensions/mangahere/) for a complete implementation example. This extension supports both desktop and mobile versions of the MangaHere website and demonstrates:

- HTTP client configuration
- HTML parsing with BeautifulSoup
- Fallback strategies for different page layouts
- Image extraction from pages
- Chapter number parsing

## Testing Your Extension

### Loading the Extension

1. Start the backend with `uvicorn app.main:app --reload`
2. The extension should be automatically discovered
3. Check the `/api/v1/sources` endpoint to verify the extension is loaded

### Testing API Endpoints

Use the following endpoints to test your extension:

- Search: `/api/v1/manga/search?q=one+piece&source=myextension:en`
- Popular: `/api/v1/manga/popular?source=myextension:en`
- Latest: `/api/v1/manga/latest?source=myextension:en`
- Details: `/api/v1/manga/details?url=<manga_url>&source=myextension:en`
- Chapters: `/api/v1/manga/chapters?url=<manga_url>&source=myextension:en`
- Pages: `/api/v1/manga/pages?url=<chapter_url>&source=myextension:en`

### Image Proxying

Images are automatically proxied through the backend to avoid CORS issues. The proxy endpoint is:

```
/api/v1/proxy?url=<image_url>&source=myextension:en
```

This ensures that the proxy request includes the appropriate headers (Referer, User-Agent) to avoid being blocked by the source.

## Best Practices

1. **Error Handling**: Implement proper error handling for all methods
2. **Fallback Strategies**: Handle different page layouts and selectors
3. **Rate Limiting**: Be respectful to manga sources and avoid aggressive scraping
4. **User Agents**: Use a realistic user agent to avoid being blocked
5. **Caching**: Implement appropriate caching strategies to reduce API calls
6. **Documentation**: Document your extension's behavior and any special features

## Troubleshooting

### Extension Not Loading
- Check that your extension directory structure is correct
- Verify that your scraper class is properly exported as `source`
- Check the backend logs for error messages

### API Calls Failing
- Check the network tab in your browser's developer tools
- Verify the source endpoint URL and parameters
- Check if the manga source has changed its HTML structure

### Images Not Loading
- Ensure the image URLs are absolute
- Check if the source requires specific Referer or User-Agent headers
- Verify that the proxy endpoint is working correctly

## Publishing Your Extension

1. Create a GitHub repository for your extension
2. Follow the extension structure guidelines
3. Add documentation explaining how to install and use your extension
4. Submit a pull request to the main repository to include your extension in the default list

## License

Extensions should be released under a compatible open source license. The main Manga Reader App project uses the Apache 2.0 License.
