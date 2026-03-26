package com.pyyomi.source.extension

import com.pyyomi.source.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Jsoup
import org.jsoup.parser.Parser
import java.util.concurrent.TimeUnit

/**
 * Mangadex source implementation.
 * 
 * This is a simplified implementation for the prototype.
 * In production, this would reuse the actual Mangadex extension from Keiyoushi.
 * 
 * API docs: https://api.mangadex.org/docs
 */
class MangadexSource : MangaSource {
    
    override val id: Long = 5L
    override val name: String = "Mangadex"
    override val baseUrl: String = "https://mangadex.org"
    override val lang: String = "en"
    override val version: String = "2.0.0"
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    
    private val apiBase = "https://api.mangadex.org"
    
    override suspend fun search(query: String, page: Int): List<MangaCardDto> = withContext(Dispatchers.IO) {
        try {
            val offset = (page - 1) * 20
            val url = "$apiBase/manga?limit=20&offset=$offset&title=$query&includes[]=cover_art&availableTranslatedLanguage[]=en"
            
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "PyYomi/1.0")
                .build()
            
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                
                val body = response.body?.string() ?: return@withContext emptyList()
                parseMangaList(body)
            }
        } catch (e: Exception) {
            println("Mangadex search error: ${e.message}")
            emptyList()
        }
    }
    
    override suspend fun getPopularManga(page: Int): List<MangaCardDto> = withContext(Dispatchers.IO) {
        try {
            val offset = (page - 1) * 20
            val url = "$apiBase/manga?limit=20&offset=$offset&includes[]=cover_art&order[followedCount]=desc&availableTranslatedLanguage[]=en"
            
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "PyYomi/1.0")
                .build()
            
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                
                val body = response.body?.string() ?: return@withContext emptyList()
                parseMangaList(body)
            }
        } catch (e: Exception) {
            println("Mangadex popular error: ${e.message}")
            emptyList()
        }
    }
    
    override suspend fun getLatestUpdates(page: Int): List<MangaCardDto> = withContext(Dispatchers.IO) {
        try {
            val offset = (page - 1) * 20
            // Get recently updated manga with at least one chapter
            val url = "$apiBase/manga?limit=20&offset=$offset&includes[]=cover_art&order[latestUploadedChapter]=desc&availableTranslatedLanguage[]=en&hasChapters=true"
            
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "PyYomi/1.0")
                .build()
            
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                
                val body = response.body?.string() ?: return@withContext emptyList()
                parseMangaList(body)
            }
        } catch (e: Exception) {
            println("Mangadex latest error: ${e.message}")
            emptyList()
        }
    }
    
    override suspend fun getMangaDetails(mangaId: String): MangaDetailsDto = withContext(Dispatchers.IO) {
        try {
            val url = "$apiBase/manga/$mangaId?includes[]=cover_art&includes[]=author&includes[]=artist&includes[]=tag"
            
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "PyYomi/1.0")
                .build()
            
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    return@withContext createErrorDetails(mangaId)
                }
                
                val body = response.body?.string() ?: return@withContext createErrorDetails(mangaId)
                parseMangaDetails(body, mangaId)
            }
        } catch (e: Exception) {
            println("Mangadex details error: ${e.message}")
            createErrorDetails(mangaId)
        }
    }
    
    override suspend fun getChapterList(mangaId: String): List<ChapterDto> = withContext(Dispatchers.IO) {
        try {
            val url = "$apiBase/manga/$mangaId/feed?limit=100&includes[]=scanlation_group&translatedLanguage[]=en"
            
            val request = Request.Builder()
                .url(url)
                .header("User-Agent", "PyYomi/1.0")
                .build()
            
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                
                val body = response.body?.string() ?: return@withContext emptyList()
                parseChapterList(body, mangaId)
            }
        } catch (e: Exception) {
            println("Mangadex chapters error: ${e.message}")
            emptyList()
        }
    }
    
    override suspend fun getPageList(chapterId: String): List<String> = withContext(Dispatchers.IO) {
        try {
            // First get the chapter to find the hash and data
            val chapterUrl = "$apiBase/chapter/$chapterId?includes[]=scanlation_group&includes[]=manga"
            
            val request = Request.Builder()
                .url(chapterUrl)
                .header("User-Agent", "PyYomi/1.0")
                .build()
            
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext emptyList()
                
                val body = response.body?.string() ?: return@withContext emptyList()
                parsePagesFromChapter(body)
            }
        } catch (e: Exception) {
            println("Mangadex pages error: ${e.message}")
            emptyList()
        }
    }
    
    // Helper functions for parsing
    
    private fun parseMangaList(json: String): List<MangaCardDto> {
        val items = mutableListOf<MangaCardDto>()
        try {
            // Simple JSON parsing without full serialization library
            val mangaRegex = """\{[^}]*"id":\s*"([^"]+)"[^}]*"type":\s*"manga"[^}]*\}(?:,|\})""".toRegex()
            val idMatches = mangaRegex.findAll(json)
            
            for (match in idMatches) {
                val id = match.groupValues[1]
                // Try to extract title
                val titleMatch = """"title":\s*\{[^}]*"en":\s*"([^"]+)"""".toRegex().find(json.substring(match.range.first))
                    ?: """"title":\s*"([^"]+)"""".toRegex().find(json.substring(match.range.first))
                val title = titleMatch?.groupValues?.get(1) ?: "Unknown"
                
                // Try to get cover
                val coverMatch = """cover[^"]*"[^"]*fileName":\s*"([^"]+)"""".toRegex().find(json.substring(match.range.first))
                val coverFile = coverMatch?.groupValues?.get(1)
                val cover = if (coverFile != null) {
                    "https://uploads.mangadex.org/covers/$id/$coverFile.256.jpg"
                } else null
                
                items.add(MangaCardDto(
                    id = id,
                    title = title,
                    thumbnail = cover,
                    url = "/manga/$id"
                ))
            }
        } catch (e: Exception) {
            println("Parse error: ${e.message}")
        }
        return items
    }
    
    private fun parseMangaDetails(json: String, mangaId: String): MangaDetailsDto {
        var title = "Unknown"
        var description = ""
        var author: String? = null
        var artist: String? = null
        var status = "unknown"
        val genres = mutableListOf<String>()
        var cover: String? = null
        
        try {
            // Extract title
            """("title":\s*\{[^}]*"en":\s*")([^"]+)"""".toRegex().find(json)?.let {
                title = it.groupValues[2]
            }
            
            // Extract description
            """("description":\s*\{[^}]*"en":\s*")([^"]+)"""".toRegex().find(json)?.let {
                description = it.groupValues[2].replace("\\n", "\n")
            }
            
            // Extract author
            author = """"author":\s*\[[^\]]*"name":\s*"([^"]+)""""".toRegex().find(json)?.groupValues?.get(1)
            
            // Extract artist
            artist = """"artist":\s*\[[^\]]*"name":\s*"([^"]+)""""".toRegex().find(json)?.groupValues?.get(1)
            
            // Extract status
            val statusMatch = """"status":\s*"([^"]+)"""".toRegex().find(json)
            if (statusMatch != null) {
                val rawStatus = statusMatch.groupValues[1]
                status = when (rawStatus) {
                    "ongoing" -> "ongoing"
                    "completed" -> "completed"
                    "hiatus" -> "hiatus"
                    "cancelled" -> "cancelled"
                    else -> "unknown"
                }
            }
            
            // Extract tags/genres
            val tagRegex = """"name":\s*\{[^}]*"en":\s*"([^"]+)"""".toRegex()
            tagRegex.findAll(json).forEach { match ->
                val tag = match.groupValues[1]
                if (tag.isNotBlank()) genres.add(tag)
            }
            
            // Extract cover
            """cover[^"]*"[^"]*fileName":\s*"([^"]+)"""".toRegex().find(json)?.let {
                cover = "https://uploads.mangadex.org/covers/$mangaId/${it.groupValues[1]}.256.jpg"
            }
            
        } catch (e: Exception) {
            println("Details parse error: ${e.message}")
        }
        
        return MangaDetailsDto(
            id = mangaId,
            title = title,
            description = description,
            author = author,
            artist = artist,
            status = status,
            genres = genres,
            thumbnail = cover,
            url = "/manga/$mangaId"
        )
    }
    
    private fun parseChapterList(json: String, mangaId: String): List<ChapterDto> {
        val chapters = mutableListOf<ChapterDto>()
        try {
            // Find all chapter objects
            val chapterRegex = """\{[^}]*"type":\s*"chapter"[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}""".toRegex()
            val chapterMatches = chapterRegex.findAll(json)
            
            for (match in chapterMatches) {
                val chapterJson = match.value
                
                val idMatch = """"id":\s*"([^"]+)"""".toRegex().find(chapterJson)
                val chapterId = idMatch?.groupValues?.get(1) ?: continue
                
                val chapterMatch = """"chapter":\s*"([^"]*)"""".toRegex().find(chapterJson)
                val chapterNum = chapterMatch?.groupValues?.get(1)
                
                val titleMatch = """"title":\s*"([^"]*)"""".toRegex().find(chapterJson)
                val title = titleMatch?.groupValues?.get(1) ?: ""
                
                val pageMatch = """"pages":\s*(\d+)"""".toRegex().find(chapterJson)
                val pages = pageMatch?.groupValues?.get(1)?.toIntOrNull() ?: 0
                
                val chapterTitle = if (chapterNum != null && chapterNum.isNotEmpty()) {
                    if (title.isNotEmpty()) "Ch. $chapterNum - $title" else "Ch. $chapterNum"
                } else title
                
                chapters.add(ChapterDto(
                    id = chapterId,
                    title = chapterTitle,
                    number = chapterNum?.toDoubleOrNull(),
                    url = "/chapter/$chapterId",
                    released_at = null
                ))
            }
        } catch (e: Exception) {
            println("Chapter parse error: ${e.message}")
        }
        
        return chapters.distinctBy { it.id }.reversed()
    }
    
    private fun parsePagesFromChapter(json: String): List<String> {
        val pages = mutableListOf<String>()
        try {
            // Get baseUrl for at-home server
            val baseUrlMatch = """"baseUrl":\s*"([^"]+)"""".toRegex().find(json)
            val baseUrl = baseUrlMatch?.groupValues?.get(1) ?: "https://uploads.mangadex.org"
            
            // Get hash
            val hashMatch = """"hash":\s*"([^"]+)"""".toRegex().find(json)
            val hash = hashMatch?.groupValues?.get(1) ?: return emptyList()
            
            // Get page data
            val dataMatch = """"data":\s*\[([^\]]+)\]""".toRegex().find(json)
            val dataStr = dataMatch?.groupValues?.get(1) ?: return emptyList()
            
            // Parse file names
            val fileRegex = """"([^"]+\.(?:jpg|png|jpeg))"""".toRegex()
            fileRegex.findAll(dataStr).forEach { match ->
                val fileName = match.groupValues[1]
                pages.add("$baseUrl/data/$hash/$fileName")
            }
            
        } catch (e: Exception) {
            println("Pages parse error: ${e.message}")
        }
        
        return pages
    }
    
    private fun createErrorDetails(mangaId: String) = MangaDetailsDto(
        id = mangaId,
        title = "Unknown",
        description = "Failed to load manga details",
        author = null,
        artist = null,
        status = "unknown",
        genres = emptyList(),
        thumbnail = null,
        url = "/manga/$mangaId"
    )
}