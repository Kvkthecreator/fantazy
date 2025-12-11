"""
Fallback database connection using asyncpg directly.
Use this if the 'databases' package fails to install on Render.
"""

import os
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator, Dict, Any, List, Optional

try:
    import asyncpg
except ImportError as e:
    print(f"❌ CRITICAL: Failed to import 'asyncpg' package: {e}")
    print("🔧 Fix: Ensure 'asyncpg>=0.29.0' is installed")
    raise ImportError("Missing required asyncpg package. Install with: pip install asyncpg>=0.29.0") from e

# Global connection pool
_pool: Optional[asyncpg.Pool] = None
_connection_lock = asyncio.Lock()

class AsyncpgAdapter:
    """
    Adapter to make asyncpg work like the databases library.
    This provides the same interface but uses asyncpg directly.
    """
    
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
    
    async def fetch_one(self, query: str, values: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Fetch one row as a dictionary."""
        async with self.pool.acquire() as conn:
            if values:
                # Convert named parameters to positional for asyncpg
                query, params = self._convert_named_params(query, values)
                row = await conn.fetchrow(query, *params)
            else:
                row = await conn.fetchrow(query)
            
            return dict(row) if row else None
    
    async def fetch_all(self, query: str, values: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Fetch all rows as dictionaries."""
        async with self.pool.acquire() as conn:
            if values:
                query, params = self._convert_named_params(query, values)
                rows = await conn.fetch(query, *params)
            else:
                rows = await conn.fetch(query)
            
            return [dict(row) for row in rows]
    
    async def execute(self, query: str, values: Dict[str, Any] = None) -> int:
        """Execute a query and return affected row count."""
        async with self.pool.acquire() as conn:
            if values:
                query, params = self._convert_named_params(query, values)
                result = await conn.execute(query, *params)
            else:
                result = await conn.execute(query)
            
            # asyncpg returns "INSERT 0 1" format, extract the number
            if isinstance(result, str):
                parts = result.split()
                return int(parts[-1]) if parts else 0
            return 0
    
    @asynccontextmanager
    async def transaction(self):
        """Transaction context manager."""
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                # Create a temporary adapter for this transaction
                transaction_adapter = AsyncpgTransactionAdapter(conn)
                yield transaction_adapter
    
    def _convert_named_params(self, query: str, values: Dict[str, Any]):
        """Convert :param style to $1, $2 style for asyncpg."""
        import re
        
        # Find all :param patterns
        params = re.findall(r':(\w+)', query)
        param_values = []
        
        # Replace :param with $1, $2, etc.
        new_query = query
        for i, param in enumerate(params, 1):
            new_query = new_query.replace(f':{param}', f'${i}')
            param_values.append(values.get(param))
        
        return new_query, param_values

class AsyncpgTransactionAdapter(AsyncpgAdapter):
    """Adapter for transaction-scoped operations."""
    
    def __init__(self, conn: asyncpg.Connection):
        self.conn = conn
    
    async def fetch_one(self, query: str, values: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Fetch one row using transaction connection."""
        if values:
            query, params = self._convert_named_params(query, values)
            row = await self.conn.fetchrow(query, *params)
        else:
            row = await self.conn.fetchrow(query)
        
        return dict(row) if row else None
    
    async def fetch_all(self, query: str, values: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Fetch all rows using transaction connection."""
        if values:
            query, params = self._convert_named_params(query, values)
            rows = await self.conn.fetch(query, *params)
        else:
            rows = await self.conn.fetch(query)
        
        return [dict(row) for row in rows]
    
    async def execute(self, query: str, values: Dict[str, Any] = None) -> int:
        """Execute query using transaction connection."""
        if values:
            query, params = self._convert_named_params(query, values)
            result = await self.conn.execute(query, *params)
        else:
            result = await self.conn.execute(query)
        
        # Extract row count from result
        if isinstance(result, str):
            parts = result.split()
            return int(parts[-1]) if parts else 0
        return 0

async def get_db() -> AsyncpgAdapter:
    """
    Get the global database connection pool with proper idempotency handling.
    Returns an adapter that provides the same interface as the databases library.
    """
    global _pool
    
    # Double-check locking pattern for async
    if _pool is not None:
        return AsyncpgAdapter(_pool)
    
    async with _connection_lock:
        # Re-check after acquiring lock
        if _pool is not None:
            return AsyncpgAdapter(_pool)
        
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required")

        # Handle Render.com DATABASE_URL format
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)

        # Strip query parameters (like ?pgbouncer=true) for compatibility
        if "?" in database_url:
            database_url = database_url.split("?")[0]
            print("ℹ️  Stripped query parameters from DATABASE_URL for compatibility")

        # Create connection pool
        _pool = await asyncpg.create_pool(
            database_url,
            min_size=1,
            max_size=10,
            command_timeout=60
        )
        
        return AsyncpgAdapter(_pool)

@asynccontextmanager
async def db_transaction() -> AsyncIterator[AsyncpgAdapter]:
    """
    Context manager for database transactions.
    Usage: 
        async with db_transaction() as db:
            # Your database operations
            pass
    """
    db = await get_db()
    async with db.transaction() as tx:
        yield tx

async def close_db():
    """Close the database connection pool - call during app shutdown."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None