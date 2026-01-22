package database

import (
	"fmt"
	"log"

	"github.com/lancelot/verdant-search/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// Connect initializes database connection
// Note: Tables are created by init.sql, not by GORM AutoMigrate
func Connect(cfg *config.Config) error {
	var err error
	
	dsn := cfg.GetDSN()
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	log.Println("Database connected successfully")

	// Tables are created by init.sql during PostgreSQL initialization
	// AutoMigrate is commented out to avoid conflicts
	// If you need to sync models, make sure init.sql schema matches
	
	// err = DB.AutoMigrate(&models.User{}, &models.SearchHistory{})
	// if err != nil {
	// 	return fmt.Errorf("failed to migrate database: %w", err)
	// }

	log.Println("Using existing database schema from init.sql")
	return nil
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return DB
}
