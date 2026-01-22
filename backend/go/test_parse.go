package main

import (
	"encoding/json"
	"fmt"
)

type PythonSearchResponse struct {
	Query      string         `json:"query"`
	Results    []interface{}  `json:"results"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	PageSize   int            `json:"page_size"`
	TotalPages int            `json:"total_pages"`
}

func main() {
	jsonStr := `{"query":"test","results":[],"total":100,"page":1,"page_size":3,"total_pages":34}`
	
	var resp PythonSearchResponse
	err := json.Unmarshal([]byte(jsonStr), &resp)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	
	fmt.Printf("Query: %s\n", resp.Query)
	fmt.Printf("Total: %d\n", resp.Total)
	fmt.Printf("Page: %d\n", resp.Page)
	fmt.Printf("PageSize: %d\n", resp.PageSize)
	fmt.Printf("TotalPages: %d\n", resp.TotalPages)
}
