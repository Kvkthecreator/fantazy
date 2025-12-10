import os
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

try:
    from databases import Database
    USING_DATABASES_LIBRARY = True
    print("✅ Using 'databases' library for database connections")
except ImportError as e:
    print(f"⚠️  'databases' package not available: {e}")
    print("🔄 Falling back to asyncpg direct connection...")
    
    try:
        # Fall back to asyncpg-based implementation
        from .deps_fallback import get_db as get_db_fallback, db_transaction as db_transaction_fallback, close_db as close_db_fallback
        
        # Re-export fallback functions
        get_db = get_db_fallback
        db_transaction = db_transaction_fallback  
        close_db = close_db_fallback
        
        USING_DATABASES_LIBRARY = False
        print("✅ Using asyncpg fallback for database connections")
        
        # Exit early since we're using the fallback
        import sys
        sys.modules[__name__].get_db = get_db_fallback
        sys.modules[__name__].db_transaction = db_transaction_fallback
        sys.modules[__name__].close_db = close_db_fallback
        
    except ImportError as fallback_error:
        print(f"❌ CRITICAL: Both 'databases' and 'asyncpg' packages failed to import")
        print(f"   databases error: {e}")
        print(f"   asyncpg error: {fallback_error}")
        print("🔧 Fix: Install at least one database package:")
        print("   Option 1: pip install 'databases[postgresql]>=0.7.0' asyncpg>=0.29.0")
        print("   Option 2: pip install asyncpg>=0.29.0")
        raise ImportError(
            "No database packages available. Install 'databases[postgresql]' or 'asyncpg'"
        ) from fallback_error

if USING_DATABASES_LIBRARY:
    # Global database instance for databases library
    _db: Database | None = None
    _connection_lock = asyncio.Lock()

    async def get_db() -> Database:
        """
        Get the global database connection with proper idempotency handling.
        Thread-safe and ensures single connection per application lifecycle.
        """
        global _db
        
        # Double-check locking pattern for async
        if _db is not None:
            return _db
        
        async with _connection_lock:
            # Re-check after acquiring lock
            if _db is not None:
                return _db
            
            database_url = os.getenv("DATABASE_URL")
            if not database_url:
                raise ValueError("DATABASE_URL environment variable is required")

            # Handle Render.com DATABASE_URL format which might need adjustment for databases library
            if database_url.startswith("postgres://"):
                database_url = database_url.replace("postgres://", "postgresql://", 1)

            # Configure connection with longer timeout for cross-region connections
            # Disable prepared statement caching for pgbouncer/Supavisor compatibility
            # Supabase uses connection pooling in transaction mode which doesn't support prepared statements
            _db = Database(
                database_url,
                min_size=1,
                max_size=5,
                # Increase command timeout for cross-region latency
                command_timeout=60,
                # Critical: Disable statement cache for pgbouncer compatibility
                statement_cache_size=0,
            )

            # Connect with extended timeout
            try:
                await asyncio.wait_for(_db.connect(), timeout=30.0)
            except asyncio.TimeoutError:
                print("⚠️  Database connection timed out after 30s, retrying...")
                await asyncio.wait_for(_db.connect(), timeout=60.0)
            return _db

    @asynccontextmanager
    async def db_transaction() -> AsyncIterator[Database]:
        """
        Context manager for database transactions.
        Usage: 
            async with db_transaction() as db:
                # Your database operations
                pass
        """
        db = await get_db()
        async with db.transaction():
            yield db

    async def close_db():
        """Close the database connection - call during app shutdown."""
        global _db
        if _db is not None:
            await _db.disconnect()
            _db = None
