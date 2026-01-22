package handlers

import (
	"bytes"
	"fmt"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lancelot/verdant-search/database"
	"github.com/lancelot/verdant-search/models"
	"github.com/lancelot/verdant-search/utils"
	"golang.org/x/crypto/bcrypt"
)

// RegisterRequest represents registration payload
type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginRequest represents login payload
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// AuthResponse represents authentication response
type AuthResponse struct {
	Token string              `json:"token"`
	User  models.UserResponse `json:"user"`
}

// Register handles user registration
func Register(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Debug: Log raw request body
		bodyBytes, _ := c.GetRawData()
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		fmt.Printf("Register - Raw body: %s\n", string(bodyBytes))

		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fmt.Printf("Register - Bind error: %v\n", err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Invalid request body: %v", err),
			})
			return
		}
		fmt.Printf("Register - Parsed: name=%s, email=%s\n", req.Name, req.Email)

		// Check if user already exists
		var existingUser models.User
		if err := database.GetDB().Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{
				"error": "Email already registered",
			})
			return
		}

		// Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to process password",
			})
			return
		}

		// Create user
		user := models.User{
			Name:         req.Name,
			Email:        req.Email,
			PasswordHash: string(hashedPassword),
			Avatar:       string(req.Name[0]), // First letter of name
		}

		if err := database.GetDB().Create(&user).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to create user",
			})
			return
		}

		// Generate JWT token
		token, err := utils.GenerateToken(user.ID, user.Email, jwtSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to generate token",
			})
			return
		}

		c.JSON(http.StatusCreated, AuthResponse{
			Token: token,
			User:  user.ToResponse(),
		})
	}
}

// Login handles user authentication
func Login(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Debug: Log raw request body
		bodyBytes, _ := c.GetRawData()
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		fmt.Printf("Login - Raw body: %s\n", string(bodyBytes))

		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			fmt.Printf("Login - Bind error: %v\n", err)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("Invalid request body: %v", err),
			})
			return
		}
		fmt.Printf("Login - Parsed: email=%s\n", req.Email)

		// Find user by email
		var user models.User
		if err := database.GetDB().Where("email = ?", req.Email).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid credentials",
			})
			return
		}

		// Verify password
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid credentials",
			})
			return
		}

		// Generate JWT token
		token, err := utils.GenerateToken(user.ID, user.Email, jwtSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to generate token",
			})
			return
		}

		c.JSON(http.StatusOK, AuthResponse{
			Token: token,
			User:  user.ToResponse(),
		})
	}
}
