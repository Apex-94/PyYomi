package com.pyyomi.source.service

import com.pyyomi.source.extension.MangaSource
import com.pyyomi.source.extension.MangadexSource
import com.pyyomi.source.models.*

/**
 * Manages all loaded sources.
 * In a full implementation, this would dynamically load extensions.
 * For the prototype, we hardcode Mangadex.
 */
class SourceManager {
    
    private val sources = mutableMapOf<String, MangaSource>()
    
    init {
        // Load the built-in sources
        loadSources()
    }
    
    private fun loadSources() {
        // Register Mangadex
        val mangadex = MangadexSource()
        val sourceId = mangadex.toSourceInfo().id
        sources[sourceId] = mangadex
    }
    
    /**
     * Get all available sources
     */
    fun getAllSources(): List<SourceInfoDto> {
        return sources.values.map { it.toSourceInfo() }
    }
    
    /**
     * Get a source by its ID
     */
    fun getSource(sourceId: String): MangaSource? {
        return sources[sourceId]
    }
    
    /**
     * Get source count
     */
    fun getSourceCount(): Int = sources.size
    
    /**
     * Search manga on a source
     */
    suspend fun search(sourceId: String, query: String, page: Int): MangaListResponse {
        val source = sources[sourceId] 
            ?: return MangaListResponse(sourceId, emptyList(), false)
        
        val items = source.search(query, page)
        // Simple pagination - assume more if we got 20 items
        val hasNext = items.size >= 20
        
        return MangaListResponse(sourceId, items, hasNext)
    }
    
    /**
     * Get popular manga from a source
     */
    suspend fun getPopular(sourceId: String, page: Int): MangaListResponse {
        val source = sources[sourceId] 
            ?: return MangaListResponse(sourceId, emptyList(), false)
        
        val items = source.getPopularManga(page)
        val hasNext = items.size >= 20
        
        return MangaListResponse(sourceId, items, hasNext)
    }
    
    /**
     * Get latest manga from a source
     */
    suspend fun getLatest(sourceId: String, page: Int): MangaListResponse {
        val source = sources[sourceId] 
            ?: return MangaListResponse(sourceId, emptyList(), false)
        
        val items = source.getLatestUpdates(page)
        val hasNext = items.size >= 20
        
        return MangaListResponse(sourceId, items, hasNext)
    }
    
    /**
     * Get manga details
     */
    suspend fun getMangaDetails(sourceId: String, mangaId: String): MangaDetailsDto {
        val source = sources[sourceId] 
            ?: return createErrorDetails(mangaId)
        
        return source.getMangaDetails(mangaId)
    }
    
    /**
     * Get chapter list
     */
    suspend fun getChapters(sourceId: String, mangaId: String): ChapterListResponse {
        val source = sources[sourceId] 
            ?: return ChapterListResponse(mangaId, emptyList())
        
        val chapters = source.getChapterList(mangaId)
        return ChapterListResponse(mangaId, chapters)
    }
    
    /**
     * Get page list
     */
    suspend fun getPages(sourceId: String, chapterId: String): PageListResponse {
        val source = sources[sourceId] 
            ?: return PageListResponse(chapterId, emptyList())
        
        val pages = source.getPageList(chapterId)
        return PageListResponse(chapterId, pages)
    }
    
    private fun createErrorDetails(mangaId: String) = MangaDetailsDto(
        id = mangaId,
        title = "Unknown",
        description = "Source not found",
        author = null,
        artist = null,
        status = "unknown",
        genres = emptyList(),
        thumbnail = null,
        url = "/manga/$mangaId"
    )
}