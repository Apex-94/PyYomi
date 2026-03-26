package com.pyyomi.source

import com.pyyomi.source.routing.sourceRoutes
import com.pyyomi.source.service.SourceManager
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.cors.*
import io.ktor.server.plugins.calllogging.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json

fun main() {
    // Initialize the source manager
    val sourceManager = SourceManager()
    
    println("PyYomi Source Service starting...")
    println("Loaded ${sourceManager.getSourceCount()} sources")
    
    // Start the Ktor server
    embeddedServer(CIO, port = 8080, host = "0.0.0.0") {
        // Install JSON serialization
        install(ContentNegotiation) {
            json(Json {
                prettyPrint = true
                isLenient = true
                ignoreUnknownKeys = true
            })
        }
        
        // Install CORS
        install(CORS) {
            allowMethod(HttpMethod.Get)
            allowMethod(HttpMethod.Post)
            allowMethod(HttpMethod.Options)
            allowHeader(HttpHeaders.ContentType)
            // Allow requests from the Python backend (typically localhost:8000)
            allowHost("localhost", listOf("http", "ws"))
            allowHost("127.0.0.1", listOf("http", "ws"))
        }
        
        // Install call logging
        install(CallLogging) {
            level = io.ktor.server.plugins.logging.LogLevel.INFO
        }
        
        // Install status pages for error handling
        install(StatusPages) {
            exception<Throwable> { call, cause ->
                call.respond(
                    HttpStatusCode.InternalServerError,
                    mapOf("error" to "internal_error", "message" to cause.message)
                )
            }
        }
        
        // Set up routing
        routing {
            // Health check at root
            get("/") {
                call.respondText("PyYomi Source Service - OK", ContentType.Text.Plain)
            }
            
            // Source routes
            sourceRoutes(sourceManager)
        }
    }.start(wait = true)
}