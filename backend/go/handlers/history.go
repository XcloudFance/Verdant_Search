package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lancelot/verdant-search/database"
	"github.com/lancelot/verdant-search/models"
)

// AddToHistoryRequest represents request to add search to history
type AddToHistoryRequest struct {
	Query string `json:"query" binding:"required"`
}

// GetHistory returns all search history for authenticated user
func GetHistory(c *gin.Context) {
	userID, _ := c.Get("userID")

	var history []models.SearchHistory
	if err := database.GetDB().Where("user_id = ?", userID).
		Order("timestamp DESC").
		Limit(50).
		Find(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch history",
		})
		return
	}

	c.JSON(http.StatusOK, history)
}

// AddToHistory adds a search query to user's history
func AddToHistory(c *gin.Context) {
	userID, _ := c.Get("userID")

	var req AddToHistoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// Check if query already exists for this user, remove old one
	database.GetDB().Where("user_id = ? AND query = ?", userID, req.Query).
		Delete(&models.SearchHistory{})

	// Create new history entry
	history := models.SearchHistory{
		UserID:    userID.(uint),
		Query:     req.Query,
		Timestamp: time.Now(),
	}

	if err := database.GetDB().Create(&history).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to add to history",
		})
		return
	}

	c.JSON(http.StatusCreated, history)
}

// DeleteHistory deletes a specific history entry
func DeleteHistory(c *gin.Context) {
	userID, _ := c.Get("userID")
	historyID := c.Param("id")

	result := database.GetDB().Where("id = ? AND user_id = ?", historyID, userID).
		Delete(&models.SearchHistory{})

	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to delete history",
		})
		return
	}

	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "History not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "History deleted successfully",
	})
}

// ClearHistory deletes all history for authenticated user
func ClearHistory(c *gin.Context) {
	userID, _ := c.Get("userID")

	if err := database.GetDB().Where("user_id = ?", userID).
		Delete(&models.SearchHistory{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to clear history",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "History cleared successfully",
	})
}
