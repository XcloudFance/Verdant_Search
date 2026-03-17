package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/lancelot/verdant-search/database"
	"github.com/lancelot/verdant-search/models"
)

var redisClient *redis.Client

// InitRedis initialises the shared Redis client used by crawler handlers.
func InitRedis(addr string) {
	redisClient = redis.NewClient(&redis.Options{
		Addr: addr,
	})
}

// RegisterCrawler handles POST /api/v1/crawlers/register
func RegisterCrawler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			WorkerID     string   `json:"worker_id" binding:"required"`
			IPAddress    string   `json:"ip_address"`
			Hostname     string   `json:"hostname"`
			Version      string   `json:"version"`
			Capabilities []string `json:"capabilities"`
			Group        string   `json:"group"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		now := time.Now()
		worker := models.CrawlerWorker{
			ID:              req.WorkerID,
			IPAddress:       req.IPAddress,
			Hostname:        req.Hostname,
			Version:         req.Version,
			Capabilities:    req.Capabilities,
			GroupName:       req.Group,
			Status:          "ACTIVE",
			LastHeartbeatAt: &now,
		}

		result := database.GetDB().Save(&worker)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
			return
		}

		// Set initial heartbeat in Redis
		if redisClient != nil {
			key := fmt.Sprintf("crawler:heartbeat:%s", req.WorkerID)
			redisClient.Set(context.Background(), key, now.Unix(), 30*time.Second)
		}

		c.JSON(http.StatusOK, gin.H{
			"registered":             true,
			"heartbeat_interval_sec": 10,
			"job_stream_key":         "crawler:jobs:stream",
		})
	}
}

// CrawlerHeartbeat handles POST /api/v1/crawlers/:worker_id/heartbeat
func CrawlerHeartbeat() gin.HandlerFunc {
	return func(c *gin.Context) {
		workerID := c.Param("worker_id")

		var req struct {
			JobsCompleted int     `json:"jobs_completed"`
			JobsFailed    int     `json:"jobs_failed"`
			PagesPerMin   float64 `json:"pages_per_min"`
		}
		c.ShouldBindJSON(&req)

		now := time.Now()
		updates := map[string]interface{}{
			"status":            "ACTIVE",
			"jobs_completed":    req.JobsCompleted,
			"jobs_failed":       req.JobsFailed,
			"pages_per_min":     req.PagesPerMin,
			"last_heartbeat_at": now,
			"updated_at":        now,
		}
		database.GetDB().Model(&models.CrawlerWorker{}).Where("id = ?", workerID).Updates(updates)

		// Refresh Redis TTL
		if redisClient != nil {
			key := fmt.Sprintf("crawler:heartbeat:%s", workerID)
			redisClient.Set(context.Background(), key, now.Unix(), 30*time.Second)
		}

		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	}
}

// GetCrawlerFleet handles GET /api/v1/crawlers
func GetCrawlerFleet() gin.HandlerFunc {
	return func(c *gin.Context) {
		var workers []models.CrawlerWorker
		database.GetDB().Where("deregistered = false").Find(&workers)

		// Sync status from Redis heartbeat TTL
		if redisClient != nil {
			for i := range workers {
				key := fmt.Sprintf("crawler:heartbeat:%s", workers[i].ID)
				ttl, err := redisClient.TTL(context.Background(), key).Result()
				if err != nil || ttl <= 0 {
					workers[i].Status = "DEAD"
				} else if ttl < 10*time.Second {
					workers[i].Status = "DEGRADED"
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"workers": workers, "count": len(workers)})
	}
}

// DeregisterCrawler handles DELETE /api/v1/crawlers/:worker_id
func DeregisterCrawler() gin.HandlerFunc {
	return func(c *gin.Context) {
		workerID := c.Param("worker_id")
		database.GetDB().Model(&models.CrawlerWorker{}).Where("id = ?", workerID).Update("deregistered", true)
		c.JSON(http.StatusOK, gin.H{"message": "Worker deregistered"})
	}
}

// GetCrawlJobs handles GET /api/v1/crawlers/jobs
func GetCrawlJobs() gin.HandlerFunc {
	return func(c *gin.Context) {
		var jobs []models.CrawlJob
		database.GetDB().Order("created_at DESC").Find(&jobs)
		c.JSON(http.StatusOK, gin.H{"jobs": jobs, "count": len(jobs)})
	}
}

// CreateCrawlJob handles POST /api/v1/crawlers/jobs
func CreateCrawlJob() gin.HandlerFunc {
	return func(c *gin.Context) {
		var job models.CrawlJob
		if err := c.ShouldBindJSON(&job); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		job.Status = "pending"
		database.GetDB().Create(&job)

		// Push to Redis Streams
		if redisClient != nil {
			redisClient.XAdd(context.Background(), &redis.XAddArgs{
				Stream: "crawler:jobs:stream",
				Values: map[string]interface{}{
					"job_id":    job.ID,
					"seed_url":  job.SeedURL,
					"max_depth": job.MaxDepth,
				},
			})
		}

		c.JSON(http.StatusCreated, job)
	}
}

// UpdateCrawlJob handles PATCH /api/v1/crawlers/jobs/:id
func UpdateCrawlJob() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		var updates map[string]interface{}
		c.ShouldBindJSON(&updates)
		database.GetDB().Model(&models.CrawlJob{}).Where("id = ?", id).Updates(updates)
		c.JSON(http.StatusOK, gin.H{"message": "Job updated"})
	}
}

// DeleteCrawlJob handles DELETE /api/v1/crawlers/jobs/:id
func DeleteCrawlJob() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, _ := strconv.Atoi(c.Param("id"))
		database.GetDB().Delete(&models.CrawlJob{}, id)
		c.JSON(http.StatusOK, gin.H{"message": "Job deleted"})
	}
}

// GetCrawlerLogs handles GET /api/v1/crawlers/:worker_id/logs
func GetCrawlerLogs() gin.HandlerFunc {
	return func(c *gin.Context) {
		workerID := c.Param("worker_id")
		limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
		var logs []models.CrawlLog
		database.GetDB().Where("worker_id = ?", workerID).Order("crawled_at DESC").Limit(limit).Find(&logs)
		c.JSON(http.StatusOK, gin.H{"logs": logs, "count": len(logs)})
	}
}

// SubmitCrawlLog handles POST /api/v1/crawlers/:worker_id/logs
func SubmitCrawlLog() gin.HandlerFunc {
	return func(c *gin.Context) {
		workerID := c.Param("worker_id")
		var crawlLog models.CrawlLog
		c.ShouldBindJSON(&crawlLog)
		crawlLog.WorkerID = workerID
		database.GetDB().Create(&crawlLog)
		c.JSON(http.StatusCreated, crawlLog)
	}
}

// GetQueueStats handles GET /api/v1/crawlers/queue/stats
func GetQueueStats() gin.HandlerFunc {
	return func(c *gin.Context) {
		stats := gin.H{
			"pending_jobs":  0,
			"stream_length": 0,
		}

		if redisClient != nil {
			length, _ := redisClient.XLen(context.Background(), "crawler:jobs:stream").Result()
			stats["stream_length"] = length

			var pendingCount int64
			database.GetDB().Model(&models.CrawlJob{}).Where("status = 'pending'").Count(&pendingCount)
			stats["pending_jobs"] = pendingCount
		} else {
			var pendingCount int64
			database.GetDB().Model(&models.CrawlJob{}).Where("status = 'pending'").Count(&pendingCount)
			stats["pending_jobs"] = pendingCount
		}

		c.JSON(http.StatusOK, stats)
	}
}

// GetCrawlerGroups handles GET /api/v1/crawlers/groups
func GetCrawlerGroups() gin.HandlerFunc {
	return func(c *gin.Context) {
		var groups []models.CrawlerGroup
		database.GetDB().Find(&groups)
		c.JSON(http.StatusOK, gin.H{"groups": groups})
	}
}

// CreateCrawlerGroup handles POST /api/v1/crawlers/groups
func CreateCrawlerGroup() gin.HandlerFunc {
	return func(c *gin.Context) {
		var group models.CrawlerGroup
		if err := c.ShouldBindJSON(&group); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		database.GetDB().Create(&group)
		c.JSON(http.StatusCreated, group)
	}
}
