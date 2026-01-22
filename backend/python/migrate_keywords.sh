#!/bin/bash

# Script to migrate existing search keywords to RediSearch index
# This populates the new suggestion service with historical data

echo "Migrating search keywords to RediSearch..."

cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run migration script
python3 << 'EOF'
import redis
from suggestion_service import get_suggestion_service

# Connect to Redis
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# Get suggestion service
suggestion_service = get_suggestion_service()

# Get all keywords from the old sorted set
keywords = r.zrange('search:keywords', 0, -1, withscores=True)

print(f"Found {len(keywords)} keywords to migrate")

# Migrate each keyword
migrated = 0
for keyword, count in keywords:
    try:
        suggestion_service.add_keyword(keyword, increment=int(count))
        migrated += 1
        if migrated % 100 == 0:
            print(f"Migrated {migrated} keywords...")
    except Exception as e:
        print(f"Failed to migrate '{keyword}': {e}")

print(f"\nMigration complete! Migrated {migrated}/{len(keywords)} keywords")
print("\nTop 10 keywords:")
top_keywords = suggestion_service.get_top_keywords(limit=10)
for i, kw in enumerate(top_keywords, 1):
    print(f"  {i}. {kw['keyword']} (count: {kw['count']})")

EOF

echo "Migration script completed!"
