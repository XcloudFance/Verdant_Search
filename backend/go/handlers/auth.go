package handlers

import (
	"bytes"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/lancelot/verdant-search/database"
	"github.com/lancelot/verdant-search/models"
	"github.com/lancelot/verdant-search/utils"
	"golang.org/x/crypto/bcrypt"
)

// ── Auth0 JWKS verifier (in-memory 1-hour cache) ──────────────────────────────

var (
	jwksKeys      map[string]*rsa.PublicKey
	jwksMu        sync.RWMutex
	jwksFetchedAt time.Time
)

type jwksDoc struct {
	Keys []struct {
		Kid string `json:"kid"`
		N   string `json:"n"`
		E   string `json:"e"`
	} `json:"keys"`
}

func fetchJWKS(domain string) (map[string]*rsa.PublicKey, error) {
	jwksMu.RLock()
	if jwksKeys != nil && time.Since(jwksFetchedAt) < time.Hour {
		defer jwksMu.RUnlock()
		return jwksKeys, nil
	}
	jwksMu.RUnlock()

	resp, err := http.Get("https://" + domain + "/.well-known/jwks.json")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	defer resp.Body.Close()

	var doc jwksDoc
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, fmt.Errorf("failed to parse JWKS: %w", err)
	}

	keys := make(map[string]*rsa.PublicKey, len(doc.Keys))
	for _, k := range doc.Keys {
		nBytes, err1 := base64.RawURLEncoding.DecodeString(k.N)
		eBytes, err2 := base64.RawURLEncoding.DecodeString(k.E)
		if err1 != nil || err2 != nil {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{
			N: new(big.Int).SetBytes(nBytes),
			E: int(new(big.Int).SetBytes(eBytes).Int64()),
		}
	}

	jwksMu.Lock()
	jwksKeys = keys
	jwksFetchedAt = time.Now()
	jwksMu.Unlock()

	return keys, nil
}

type auth0Claims struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Sub   string `json:"sub"`
	jwt.RegisteredClaims
}

func verifyAuth0IDToken(idToken, domain string) (*auth0Claims, error) {
	keys, err := fetchJWKS(domain)
	if err != nil {
		return nil, err
	}

	token, err := jwt.ParseWithClaims(idToken, &auth0Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		kid, _ := t.Header["kid"].(string)
		key, ok := keys[kid]
		if !ok {
			// kid not cached — force a refresh once
			keys, err = fetchJWKS(domain)
			if err != nil {
				return nil, err
			}
			key, ok = keys[kid]
			if !ok {
				return nil, fmt.Errorf("no public key found for kid %q", kid)
			}
		}
		return key, nil
	})

	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid ID token: %w", err)
	}
	return token.Claims.(*auth0Claims), nil
}

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

// SSOLogin verifies an Auth0 ID token via JWKS, upserts the user, and returns
// a Verdant JWT — no external dependency, pure standard-library JWKS parsing.
func SSOLogin(jwtSecret, auth0Domain string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			IDToken string `json:"id_token" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "id_token is required"})
			return
		}

		// ── Verify ID token signature with Auth0 public keys ───────────────
		claims, err := verifyAuth0IDToken(req.IDToken, auth0Domain)
		if err != nil {
			fmt.Printf("[SSO] token verification failed: %v\n", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid SSO token"})
			return
		}
		if claims.Email == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Email not present in token"})
			return
		}

		// ── Upsert user ────────────────────────────────────────────────────
		var user models.User
		if err := database.GetDB().Where("email = ?", claims.Email).First(&user).Error; err != nil {
			name := claims.Name
			if name == "" {
				name = claims.Email
			}
			dummyHash, _ := bcrypt.GenerateFromPassword([]byte("sso:"+claims.Sub), bcrypt.MinCost)
			user = models.User{
				Email:        claims.Email,
				Name:         name,
				Avatar:       string([]rune(name)[0]),
				PasswordHash: string(dummyHash),
			}
			if err := database.GetDB().Create(&user).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
				return
			}
		}

		// ── Issue Verdant JWT ──────────────────────────────────────────────
		token, err := utils.GenerateToken(user.ID, user.Email, jwtSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, AuthResponse{Token: token, User: user.ToResponse()})
	}
}
