#!/usr/bin/env python3
"""
Migration script to add the 'images' column to the documents table.
This is needed for multimodal search functionality.
"""
import asyncio
from sqlalchemy import text
from database import engine
from config import settings

async def migrate():
    """Add images column to documents table if it doesn't exist"""
    
    async with engine.begin() as conn:
        # Check if column already exists
        result = await conn.execute(text("""
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'documents' 
                AND column_name = 'images'
            );
        """))
        
        exists = result.scalar()
        
        if exists:
            print("✓ Column 'images' already exists in documents table")
        else:
            # Add the column
            await conn.execute(text("""
                ALTER TABLE documents 
                ADD COLUMN images JSON;
            """))
            print("✓ Successfully added 'images' column to documents table")
        
        # Show table structure
        result = await conn.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'documents'
            ORDER BY ordinal_position;
        """))
        
        columns = result.fetchall()
        
        print("\nCurrent documents table structure:")
        for col in columns:
            print(f"  - {col[0]}: {col[1]} (nullable: {col[2]})")

if __name__ == "__main__":
    print(f"Connecting to database: {settings.DATABASE_URL.split('@')[1]}")
    asyncio.run(migrate())

