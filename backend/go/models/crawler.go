package models

import (
	"time"

	"github.com/lib/pq"
)

// CrawlerWorker represents a registered crawler worker
type CrawlerWorker struct {
	ID              string         `json:"id" gorm:"primaryKey;type:varchar(36)"`
	Name            string         `json:"name" gorm:"type:varchar(255)"`
	IPAddress       string         `json:"ip_address" gorm:"type:varchar(50)"`
	Hostname        string         `json:"hostname" gorm:"type:varchar(255)"`
	Version         string         `json:"version" gorm:"type:varchar(50)"`
	Capabilities    pq.StringArray `json:"capabilities" gorm:"type:text[]"`
	GroupName       string         `json:"group" gorm:"type:varchar(100)"`
	Status          string         `json:"status" gorm:"type:varchar(20);default:IDLE"` // ACTIVE, DEGRADED, DEAD, IDLE
	JobsCompleted   int            `json:"jobs_completed" gorm:"default:0"`
	JobsFailed      int            `json:"jobs_failed" gorm:"default:0"`
	PagesPerMin     float64        `json:"pages_per_min" gorm:"default:0"`
	LastHeartbeatAt *time.Time     `json:"last_heartbeat_at"`
	RegisteredAt    time.Time      `json:"registered_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
	Deregistered    bool           `json:"deregistered" gorm:"default:false"`
}

func (CrawlerWorker) TableName() string { return "crawler_workers" }

// CrawlJob represents a crawl job
type CrawlJob struct {
	ID             uint           `json:"id" gorm:"primaryKey;autoIncrement"`
	SeedURL        string         `json:"seed_url" gorm:"type:text;not null"`
	MaxDepth       int            `json:"max_depth" gorm:"default:3"`
	MaxPages       int            `json:"max_pages" gorm:"default:1000"`
	AllowedDomains pq.StringArray `json:"allowed_domains" gorm:"type:text[]"`
	ContentTypes   pq.StringArray `json:"content_types" gorm:"type:text[]"`
	JSRendering    bool           `json:"js_rendering" gorm:"default:false"`
	CrawlFrequency string         `json:"crawl_frequency" gorm:"type:varchar(100)"` // "once", "daily", cron expr
	Status         string         `json:"status" gorm:"type:varchar(20);default:pending"` // pending, running, paused, completed, failed
	GroupName      string         `json:"group_name" gorm:"type:varchar(100)"`
	PagesProcessed int            `json:"pages_processed" gorm:"default:0"`
	CreatedAt      time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

func (CrawlJob) TableName() string { return "crawl_jobs" }

// CrawlLog represents a single page crawl event
type CrawlLog struct {
	ID          uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	WorkerID    string    `json:"worker_id" gorm:"type:varchar(36)"`
	JobID       *uint     `json:"job_id"`
	URL         string    `json:"url" gorm:"type:text"`
	StatusCode  int       `json:"status_code"`
	LatencyMs   int       `json:"latency_ms"`
	ContentType string    `json:"content_type" gorm:"type:varchar(100)"`
	WordCount   int       `json:"word_count"`
	ImageCount  int       `json:"image_count"`
	Depth       int       `json:"depth"`
	ErrorMsg    string    `json:"error_msg" gorm:"type:text"`
	CrawledAt   time.Time `json:"crawled_at" gorm:"autoCreateTime"`
}

func (CrawlLog) TableName() string { return "crawl_logs" }

// CrawlerGroup represents a named group of crawlers
type CrawlerGroup struct {
	ID          uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Name        string    `json:"name" gorm:"type:varchar(100);uniqueIndex"`
	Description string    `json:"description" gorm:"type:text"`
	RateLimit   float64   `json:"rate_limit" gorm:"default:1.0"` // requests/sec
	Paused      bool      `json:"paused" gorm:"default:false"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
}

func (CrawlerGroup) TableName() string { return "crawler_groups" }
