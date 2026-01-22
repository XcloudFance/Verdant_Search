package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// SearchResult represents a single search result from Python API
type SearchResult struct {
	ID         int     `json:"id"`
	Title      string  `json:"title"`
	URL        string  `json:"url"`
	Snippet    string  `json:"snippet"`
	Score      float64 `json:"score"`
	SourceType string  `json:"source_type"`
}

// SearchResponse represents the search API response from Python
type PythonSearchResponse struct {
	Query      string         `json:"query"`
	Results    []SearchResult `json:"results"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	PageSize   int            `json:"page_size"`
	TotalPages int            `json:"total_pages"`
}

// SearchRequest for Python API
type PythonSearchRequest struct {
	Query    string `json:"query"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

// Search handles search queries by calling Python API
func Search(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Query parameter 'q' is required",
		})
		return
	}

	// 获取分页参数
	page := 1
	pageSize := 10
	
	if pageStr := c.Query("page"); pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	
	if sizeStr := c.Query("page_size"); sizeStr != "" {
		if s, err := strconv.Atoi(sizeStr); err == nil && s > 0 && s <= 100 {
			pageSize = s
		}
	}

	// Call Python search API
	pythonAPIURL := "http://localhost:8001/api/search"
	
	reqBody := PythonSearchRequest{
		Query:    query,
		Page:     page,
		PageSize: pageSize,
	}
	
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to prepare search request",
		})
		return
	}
	
	resp, err := http.Post(pythonAPIURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("Python API error: %v\n", err)
		// Fallback to empty results if Python API is not available
		c.JSON(http.StatusOK, gin.H{
			"query":      query,
			"results":    []SearchResult{},
			"total":      0,
			"page":       page,
			"page_size":  pageSize,
			"total_pages": 0,
			"message":    "Search service temporarily unavailable",
		})
		return
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		fmt.Printf("Python API returned status %d: %s\n", resp.StatusCode, string(body))
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Search failed",
		})
		return
	}
	
	var searchResponse PythonSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&searchResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to parse search results",
		})
		return
	}
	
	// Debug: print parsed response
	fmt.Printf("DEBUG Go: Total=%d, Page=%d, PageSize=%d, TotalPages=%d\n", 
		searchResponse.Total, searchResponse.Page, searchResponse.PageSize, searchResponse.TotalPages)
	
	// Convert to frontend format
	results := make([]map[string]interface{}, len(searchResponse.Results))
	for i, result := range searchResponse.Results {
		results[i] = map[string]interface{}{
			"title":      result.Title,
			"url":        result.URL,
			"displayUrl": extractDisplayURL(result.URL),
			"snippet":    result.Snippet,
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"query":       query,
		"results":     results,
		"total":       searchResponse.Total,
		"page":        searchResponse.Page,
		"page_size":   searchResponse.PageSize,
		"total_pages": searchResponse.TotalPages,
	})
}

// extractDisplayURL extracts display URL from full URL
func extractDisplayURL(url string) string {
	if url == "" {
		return ""
	}
	// Simple extraction - you can make this more sophisticated
	if len(url) > 8 {
		if url[:7] == "http://" {
			return url[7:]
		} else if url[:8] == "https://" {
			return url[8:]
		}
	}
	return url
}
