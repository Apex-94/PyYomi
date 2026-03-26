package com.pyyomi.source.routing

import com.pyyomi.source.models.*
import com.pyyomi.source.service.SourceManager
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

/**
 * Source API routes
 */
fun Routing.sourceRoutes(sourceManager: SourceManager) {
    
    // Health check
    get("/health") {
        call.respond(HealthResponse(
            status = "ok",
            version = "1.0.0",
            sources_loaded = sourceManager.getSourceCount()
        ))
    }
    
    // List all sources
    get("/sources") {
        val sources = sourceManager.getAllSources()
        call.respond(sources)
    }
    
    // Search manga
    post("/search") {
        try {
            val request = call.receive<SearchRequest>()
            val response = sourceManager.search(
                sourceId = request.source_id,
                query = request.query,
                page = request.page
            )
            call.respond(response)
        } catch (e: Exception) {
            call.respond(HttpStatusCode.BadRequest, ErrorResponse(
                error = "search_failed",
                message = e.message ?: "Search failed"
            ))
        }
    }
    
    // Get popular manga
    get("/popular/{sourceId}") {
        val sourceId = call.parameters["sourceId"] ?: ""
        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        
        try {
            val response = sourceManager.getPopular(sourceId, page)
            call.respond(response)
        } catch (e: Exception) {
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse(
                error = "popular_failed",
                message = e.message ?: "Failed to get popular manga"
            ))
        }
    }
    
    // Get latest manga
    get("/latest/{sourceId}") {
        val sourceId = call.parameters["sourceId"] ?: ""
        val page = call.request.queryParameters["page"]?.toIntOrNull() ?: 1
        
        try {
            val response = sourceManager.getLatest(sourceId, page)
            call.respond(response)
        } catch (e: Exception) {
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse(
                error = "latest_failed",
                message = e.message ?: "Failed to get latest manga"
            ))
        }
    }
    
    // Get manga details
    get("/manga/{sourceId}/{mangaId}") {
        val sourceId = call.parameters["sourceId"] ?: ""
        val mangaId = call.parameters["mangaId"] ?: ""
        
        try {
            val details = sourceManager.getMangaDetails(sourceId, mangaId)
            call.respond(details)
        } catch (e: Exception) {
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse(
                error = "details_failed",
                message = e.message ?: "Failed to get manga details"
            ))
        }
    }
    
    // Get chapter list
    get("/chapters/{sourceId}/{mangaId}") {
        val sourceId = call.parameters["sourceId"] ?: ""
        val mangaId = call.parameters["mangaId"] ?: ""
        
        try {
            val chapters = sourceManager.getChapters(sourceId, mangaId)
            call.respond(chapters)
        } catch (e: Exception) {
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse(
                error = "chapters_failed",
                message = e.message ?: "Failed to get chapter list"
            ))
        }
    }
    
    // Get page list
    get("/pages/{sourceId}/{chapterId}") {
        val sourceId = call.parameters["sourceId"] ?: ""
        val chapterId = call.parameters["chapterId"] ?: ""
        
        try {
            val pages = sourceManager.getPages(sourceId, chapterId)
            call.respond(pages)
        } catch (e: Exception) {
            call.respond(HttpStatusCode.InternalServerError, ErrorResponse(
                error = "pages_failed",
                message = e.message ?: "Failed to get page list"
            ))
        }
    }
}