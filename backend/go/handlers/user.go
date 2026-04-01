package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lancelot/verdant-search/database"
	"github.com/lancelot/verdant-search/models"
)

// GetProfile returns the authenticated user's profile including preferences
func GetProfile(c *gin.Context) {
	userID, _ := c.Get("userID")

	var user models.User
	if err := database.GetDB().First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user.ToResponse())
}

// UpdatePreferences updates the authenticated user's preferences
func UpdatePreferences(c *gin.Context) {
	userID, _ := c.Get("userID")

	var req struct {
		PreferredLanguage *string `json:"preferred_language"`
		ResultsPerPage    *int    `json:"results_per_page"`
		RerankerEnabled   *bool   `json:"reranker_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	updates := map[string]interface{}{}
	if req.PreferredLanguage != nil {
		updates["preferred_language"] = *req.PreferredLanguage
	}
	if req.ResultsPerPage != nil {
		updates["results_per_page"] = *req.ResultsPerPage
	}
	if req.RerankerEnabled != nil {
		updates["reranker_enabled"] = *req.RerankerEnabled
	}

	if len(updates) > 0 {
		if err := database.GetDB().Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update preferences"})
			return
		}
	}

	var user models.User
	database.GetDB().First(&user, userID)
	c.JSON(http.StatusOK, user.ToResponse())
}
