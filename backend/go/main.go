package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/lancelot/verdant-search/config"
	"github.com/lancelot/verdant-search/database"
	"github.com/lancelot/verdant-search/handlers"
	"github.com/lancelot/verdant-search/middleware"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	// Connect to database
	if err := database.Connect(cfg); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Set Gin to release mode in production
	// gin.SetMode(gin.ReleaseMode)

	// Initialize Gin router
	r := gin.Default()

	// Middleware
	r.Use(middleware.SetupCORS())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "verdant-search-api",
		})
	})

	// API routes
	api := r.Group("/api")
	{
		// Auth routes (public)
		auth := api.Group("/auth")
		{
			auth.POST("/register", handlers.Register(cfg.JWTSecret))
			auth.POST("/login", handlers.Login(cfg.JWTSecret))
		}

		// Search route (public)
		api.GET("/search", handlers.Search)

		// Protected routes (history)
		history := api.Group("/history")
		history.Use(middleware.JWTMiddleware(cfg.JWTSecret))
		{
			history.GET("", handlers.GetHistory)
			history.POST("", handlers.AddToHistory)
			history.DELETE("/:id", handlers.DeleteHistory)
			history.DELETE("", handlers.ClearHistory)
		}
	}

	// Start server
	log.Printf("Server starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
