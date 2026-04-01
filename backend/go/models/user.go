package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	Email             string         `gorm:"size:255;not null;unique" json:"email"`
	Name              string         `gorm:"size:255;not null" json:"name"`
	PasswordHash      string         `gorm:"size:255;not null" json:"-"`
	Avatar            string         `gorm:"size:10" json:"avatar"`
	PreferredLanguage string         `gorm:"size:10;default:en" json:"preferred_language"`
	ResultsPerPage    int            `gorm:"default:10" json:"results_per_page"`
	RerankerEnabled   bool           `gorm:"default:true" json:"reranker_enabled"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name
func (User) TableName() string {
	return "users"
}

// UserResponse represents the user data sent to clients
type UserResponse struct {
	ID                uint      `json:"id"`
	Email             string    `json:"email"`
	Name              string    `json:"name"`
	Avatar            string    `json:"avatar"`
	PreferredLanguage string    `json:"preferred_language"`
	ResultsPerPage    int       `json:"results_per_page"`
	RerankerEnabled   bool      `json:"reranker_enabled"`
	CreatedAt         time.Time `json:"created_at"`
}

// ToResponse converts User to UserResponse
func (u *User) ToResponse() UserResponse {
	lang := u.PreferredLanguage
	if lang == "" {
		lang = "en"
	}
	rpp := u.ResultsPerPage
	if rpp == 0 {
		rpp = 10
	}
	return UserResponse{
		ID:                u.ID,
		Email:             u.Email,
		Name:              u.Name,
		Avatar:            u.Avatar,
		PreferredLanguage: lang,
		ResultsPerPage:    rpp,
		RerankerEnabled:   u.RerankerEnabled,
		CreatedAt:         u.CreatedAt,
	}
}
