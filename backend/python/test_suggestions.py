#!/usr/bin/env python3
"""
Test script for RediSearch-based keyword suggestion system
Demonstrates fuzzy matching and real-time updates
"""

import requests
import time

API_BASE = "http://localhost:8001/api"

def test_suggestions(query, description=""):
    """Test suggestion API"""
    print(f"\n{'='*60}")
    if description:
        print(f"Test: {description}")
    print(f"Query: '{query}'")
    
    try:
        response = requests.get(f"{API_BASE}/suggestions", params={"q": query})
        if response.ok:
            data = response.json()
            suggestions = data.get("suggestions", [])
            print(f"✓ Found {len(suggestions)} suggestions:")
            for i, s in enumerate(suggestions, 1):
                print(f"  {i}. {s}")
        else:
            print(f"✗ Error: {response.status_code}")
    except Exception as e:
        print(f"✗ Exception: {e}")

def test_search(query):
    """Perform a search to add keyword to history"""
    print(f"\n{'='*60}")
    print(f"Performing search: '{query}'")
    
    try:
        response = requests.post(
            f"http://localhost:8080/api/search",
            json={"query": query, "page": 1, "page_size": 10}
        )
        if response.ok:
            print(f"✓ Search completed (keyword added to history)")
        else:
            print(f"✗ Search failed: {response.status_code}")
    except Exception as e:
        print(f"✗ Exception: {e}")

def main():
    print("="*60)
    print("RediSearch Keyword Suggestion System - Test Suite")
    print("="*60)
    
    # Test 1: Exact prefix match
    test_suggestions("jav", "Exact prefix match")
    
    # Test 2: Fuzzy match (typo)
    test_suggestions("pythn", "Fuzzy match - typo correction")
    
    # Test 3: Another fuzzy match
    test_suggestions("goolge", "Fuzzy match - 'goolge' → 'google'")
    
    # Test 4: Partial match
    test_suggestions("rea", "Partial match")
    
    # Test 5: Add new keyword via search
    print("\n" + "="*60)
    print("Test: Real-time keyword addition")
    print("="*60)
    
    new_keyword = "machine learning tutorial"
    print(f"\nStep 1: Search for '{new_keyword}'")
    test_search(new_keyword)
    
    time.sleep(1)  # Give it a moment to index
    
    print(f"\nStep 2: Check if it appears in suggestions")
    test_suggestions("machine", "Should include new keyword")
    
    # Test 6: Fuzzy match on new keyword
    test_suggestions("machne", "Fuzzy match on new keyword")
    
    # Test 7: Empty query
    test_suggestions("", "Empty query (should return empty)")
    
    # Test 8: No matches
    test_suggestions("zzzzz", "No matches")
    
    print("\n" + "="*60)
    print("Test suite completed!")
    print("="*60)

if __name__ == "__main__":
    main()
