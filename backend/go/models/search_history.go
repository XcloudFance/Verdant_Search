package models

import (
	"time"
)

// SearchHistory represents a user's search query
type SearchHistory struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	Query     string    `gorm:"not null" json:"query"`
	Timestamp time.Time `gorm:"not null" json:"timestamp"`
	CreatedAt time.Time `json:"created_at"`
}
