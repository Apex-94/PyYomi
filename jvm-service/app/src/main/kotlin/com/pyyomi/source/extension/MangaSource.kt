package com.pyyomi.source.extension

import com.pyyomi.source.models.*

/**
 * Base interface for source implementations.
 * This mimics the HttpSource interface from Tachiyomi/Mihon.
 */
interface MangaSource {
    /** Unique source ID */
    val id: Long
    
    /** Human-readable source name */
    val name: String
    
    /** Base URL for the source */
    val baseUrl: String
    
    /** Language code (e.g., "en", "ja") */
    val lang: String
    
    /** Version of the source */
    val version: String
    
    /** 
     * Search for manga
     * @return List of manga cards
     */
    suspend fun search(query: String, page: Int): List<MangaCardDto>
    
    /** 
     * Get popular manga
     * @return List of manga cards
     */
    suspend fun getPopularManga(page: Int): List<MangaCardDto>
    
    /** 
     * Get latest updated manga
     * @return List of manga cards
     */
    suspend fun getLatestUpdates(page: Int): List<MangaCardDto>
    
    /** 
     * Get manga details
     * @param mangaId The manga ID from the manga card
     * @return Manga details
     */
    suspend fun getMangaDetails(mangaId: String): MangaDetailsDto
    
    /** 
     * Get chapter list for a manga
     * @param mangaId The manga ID
     * @return List of chapters
     */
    suspend fun getChapterList(mangaId: String): List<ChapterDto>
    
    /** 
     * Get page list for a chapter
     * @param chapterId The chapter ID
     * @return List of page URLs
     */
    suspend fun getPageList(chapterId: String): List<String>
    
    /** 
     * Get source info for listing
     */
    fun toSourceInfo(): SourceInfoDto = SourceInfoDto(
        id = "${name.lowercase()}-$lang",
        name = name,
        lang = lang,
        base_url = baseUrl
    )
}