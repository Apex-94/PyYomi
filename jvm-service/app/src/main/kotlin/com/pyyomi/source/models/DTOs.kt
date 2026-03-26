package com.pyyomi.source.models

import kotlinx.serialization.Serializable

/**
 * Request to search manga on a source
 */
@Serializable
data class SearchRequest(
    val source_id: String,
    val query: String = "",
    val page: Int = 1,
    val filters: List<FilterDto> = emptyList()
)

/**
 * Filter definition for source queries
 */
@Serializable
data class FilterDto(
    val id: String,
    val type: String,
    val value: String? = null,
    val values: List<String>? = null,
    val options: List<SelectOptionDto>? = null
)

@Serializable
data class SelectOptionDto(
    val value: String,
    val label: String
)

/**
 * Response for manga list (search/popular/latest)
 */
@Serializable
data class MangaListResponse(
    val source_id: String,
    val items: List<MangaCardDto>,
    val has_next_page: Boolean = false
)

/**
 * A manga card in lists
 */
@Serializable
data class MangaCardDto(
    val id: String,
    val title: String,
    val thumbnail: String? = null,
    val url: String
)

/**
 * Response for manga details
 */
@Serializable
data class MangaDetailsDto(
    val id: String,
    val title: String,
    val description: String,
    val author: String? = null,
    val artist: String? = null,
    val status: String,
    val genres: List<String>,
    val thumbnail: String? = null,
    val url: String
)

/**
 * Response for chapter list
 */
@Serializable
data class ChapterListResponse(
    val manga_id: String,
    val chapters: List<ChapterDto>
)

/**
 * A chapter in the list
 */
@Serializable
data class ChapterDto(
    val id: String,
    val title: String,
    val number: Double? = null,
    val url: String,
    val released_at: String? = null
)

/**
 * Response for page list
 */
@Serializable
data class PageListResponse(
    val chapter_id: String,
    val pages: List<String>
)

/**
 * Source metadata
 */
@Serializable
data class SourceInfoDto(
    val id: String,
    val name: String,
    val lang: String,
    val base_url: String
)

/**
 * Health check response
 */
@Serializable
data class HealthResponse(
    val status: String,
    val version: String,
    val sources_loaded: Int
)

/**
 * Error response
 */
@Serializable
data class ErrorResponse(
    val error: String,
    val message: String
)