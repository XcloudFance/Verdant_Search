package middleware

import (
	"os"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SetupCORS configures CORS middleware for Gin.
// Set ALLOWED_ORIGINS env var to restrict origins in production
// (comma-separated). Defaults to "*" (allow all).
func SetupCORS() gin.HandlerFunc {
	config := cors.DefaultConfig()

	originsEnv := os.Getenv("ALLOWED_ORIGINS")
	if originsEnv == "" || originsEnv == "*" {
		config.AllowAllOrigins = true
		config.AllowCredentials = false // incompatible with AllowAllOrigins
	} else {
		config.AllowOrigins = strings.Split(originsEnv, ",")
		config.AllowCredentials = true
	}

	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	config.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}

	return cors.New(config)
}
