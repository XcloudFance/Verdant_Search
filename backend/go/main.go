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

	// Initialise Redis client for crawler fleet management
	handlers.InitRedis(cfg.RedisAddr)

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
			auth.POST("/register", handlers.Register(cfg.JWTSecret, cfg.JWTExpiryHours))
			auth.POST("/login", handlers.Login(cfg.JWTSecret, cfg.JWTExpiryHours))
			auth.POST("/sso", handlers.SSOLogin(cfg.JWTSecret, cfg.Auth0Domain, cfg.JWTExpiryHours))
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

		// Protected user profile & preferences
		user := api.Group("/user")
		user.Use(middleware.JWTMiddleware(cfg.JWTSecret))
		{
			user.GET("/profile", handlers.GetProfile)
			user.PUT("/preferences", handlers.UpdatePreferences)
		}

		// Crawler fleet management routes
		crawlers := api.Group("/v1/crawlers")
		{
			crawlers.POST("/register", handlers.RegisterCrawler())
			crawlers.GET("", handlers.GetCrawlerFleet())
			crawlers.DELETE("/:worker_id", handlers.DeregisterCrawler())
			crawlers.POST("/:worker_id/heartbeat", handlers.CrawlerHeartbeat())
			crawlers.GET("/:worker_id/logs", handlers.GetCrawlerLogs())
			crawlers.POST("/:worker_id/logs", handlers.SubmitCrawlLog())

			// Jobs
			crawlers.GET("/jobs", handlers.GetCrawlJobs())
			crawlers.POST("/jobs", handlers.CreateCrawlJob())
			crawlers.PATCH("/jobs/:id", handlers.UpdateCrawlJob())
			crawlers.DELETE("/jobs/:id", handlers.DeleteCrawlJob())

			// Queue
			crawlers.GET("/queue/stats", handlers.GetQueueStats())

			// Groups
			crawlers.GET("/groups", handlers.GetCrawlerGroups())
			crawlers.POST("/groups", handlers.CreateCrawlerGroup())
		}
	}

	// Start server
	log.Printf("Server starting on port %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
