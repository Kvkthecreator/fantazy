"""
Background job worker for Clearinghouse.

Polls the processing_jobs table and executes jobs asynchronously.

Usage:
    python -m src.worker.main

Environment variables:
    DATABASE_URL - PostgreSQL connection string
    OPENAI_API_KEY - For embedding generation
    WORKER_POLL_INTERVAL - Seconds between polls (default: 10)
    WORKER_MAX_CONCURRENT - Max parallel jobs (default: 3)
"""
import asyncio
import logging
import os
import signal
import sys
import json
from datetime import datetime, timezone
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from .config import POLL_INTERVAL_SECONDS, MAX_CONCURRENT_JOBS, MAX_RETRIES
from .handlers import dispatch_job

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger("worker")

# Graceful shutdown flag
shutdown_event = asyncio.Event()


async def get_worker_db():
    """Get database connection for worker (separate from API)."""
    from databases import Database

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is required")

    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    db = Database(
        database_url,
        min_size=1,
        max_size=MAX_CONCURRENT_JOBS + 1,
        command_timeout=120,
        statement_cache_size=0,
    )

    await db.connect()
    return db


async def claim_job(db) -> Optional[dict]:
    """
    Atomically claim a queued job using SELECT FOR UPDATE SKIP LOCKED.

    Returns the claimed job or None if no jobs available.
    """
    # Use a transaction to atomically claim the job
    async with db.transaction():
        # Find and lock the next available job
        row = await db.fetch_one("""
            SELECT id, job_type, rights_entity_id, asset_id, status,
                   priority, config, retry_count, max_retries, created_by
            FROM processing_jobs
            WHERE status = 'queued'
            ORDER BY priority DESC, created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
        """)

        if not row:
            return None

        job_id = row["id"]

        # Update status to processing
        await db.execute("""
            UPDATE processing_jobs
            SET status = 'processing',
                started_at = now(),
                updated_at = now()
            WHERE id = :job_id
        """, {"job_id": str(job_id)})

        # Update entity status if applicable
        if row["rights_entity_id"]:
            await db.execute("""
                UPDATE rights_entities
                SET embedding_status = 'processing',
                    updated_at = now()
                WHERE id = :entity_id
                  AND embedding_status != 'processing'
            """, {"entity_id": str(row["rights_entity_id"])})

        # Update asset status if applicable
        if row["asset_id"]:
            await db.execute("""
                UPDATE reference_assets
                SET processing_status = 'processing',
                    updated_at = now()
                WHERE id = :asset_id
                  AND processing_status != 'processing'
            """, {"asset_id": str(row["asset_id"])})

        return dict(row)


async def complete_job(db, job_id: str, result: dict):
    """Mark a job as completed with its result."""
    await db.execute("""
        UPDATE processing_jobs
        SET status = 'completed',
            result = :result,
            completed_at = now(),
            updated_at = now()
        WHERE id = :job_id
    """, {
        "job_id": job_id,
        "result": json.dumps(result)
    })


async def fail_job(db, job: dict, error: str):
    """
    Mark a job as failed. If retries remain, re-queue it.
    """
    job_id = str(job["id"])
    retry_count = job.get("retry_count", 0) + 1
    max_retries = job.get("max_retries", MAX_RETRIES)

    if retry_count < max_retries:
        # Re-queue with incremented retry count
        await db.execute("""
            UPDATE processing_jobs
            SET status = 'queued',
                retry_count = :retry_count,
                error_message = :error,
                started_at = NULL,
                updated_at = now()
            WHERE id = :job_id
        """, {
            "job_id": job_id,
            "retry_count": retry_count,
            "error": error
        })
        log.warning(f"Job {job_id} failed (retry {retry_count}/{max_retries}): {error}")
    else:
        # Max retries exceeded, mark as failed permanently
        await db.execute("""
            UPDATE processing_jobs
            SET status = 'failed',
                retry_count = :retry_count,
                error_message = :error,
                completed_at = now(),
                updated_at = now()
            WHERE id = :job_id
        """, {
            "job_id": job_id,
            "retry_count": retry_count,
            "error": error
        })

        # Update entity status if applicable
        if job.get("rights_entity_id"):
            await db.execute("""
                UPDATE rights_entities
                SET embedding_status = 'failed',
                    processing_error = :error,
                    updated_at = now()
                WHERE id = :entity_id
            """, {
                "entity_id": str(job["rights_entity_id"]),
                "error": error
            })

        # Update asset status if applicable
        if job.get("asset_id"):
            await db.execute("""
                UPDATE reference_assets
                SET processing_status = 'failed',
                    processing_error = :error,
                    updated_at = now()
                WHERE id = :asset_id
            """, {
                "asset_id": str(job["asset_id"]),
                "error": error
            })

        log.error(f"Job {job_id} failed permanently after {retry_count} retries: {error}")


async def process_job(db, job: dict):
    """Process a single job."""
    job_id = str(job["id"])
    job_type = job["job_type"]

    log.info(f"Processing job {job_id} (type: {job_type})")

    try:
        result = await dispatch_job(job, db)
        await complete_job(db, job_id, result)
        log.info(f"Job {job_id} completed: {result.get('status', 'success')}")

    except Exception as e:
        error_msg = str(e)
        log.exception(f"Job {job_id} error: {error_msg}")
        await fail_job(db, job, error_msg)


async def worker_loop(db):
    """Main worker loop - polls for jobs and processes them."""
    log.info(f"Worker started (poll={POLL_INTERVAL_SECONDS}s, max_concurrent={MAX_CONCURRENT_JOBS})")

    active_tasks: set = set()

    while not shutdown_event.is_set():
        try:
            # Clean up completed tasks
            done_tasks = {t for t in active_tasks if t.done()}
            for task in done_tasks:
                try:
                    await task  # Retrieve any exceptions
                except Exception as e:
                    log.error(f"Task error: {e}")
            active_tasks -= done_tasks

            # Claim new jobs if we have capacity
            while len(active_tasks) < MAX_CONCURRENT_JOBS:
                job = await claim_job(db)
                if not job:
                    break  # No more jobs available

                # Create task for job processing
                task = asyncio.create_task(process_job(db, job))
                active_tasks.add(task)

            # Wait for poll interval or shutdown
            try:
                await asyncio.wait_for(
                    shutdown_event.wait(),
                    timeout=POLL_INTERVAL_SECONDS
                )
                break  # Shutdown requested
            except asyncio.TimeoutError:
                pass  # Normal polling interval

        except Exception as e:
            log.exception(f"Worker loop error: {e}")
            await asyncio.sleep(5)  # Brief pause before retry

    # Wait for active tasks to complete on shutdown
    if active_tasks:
        log.info(f"Waiting for {len(active_tasks)} active tasks to complete...")
        await asyncio.gather(*active_tasks, return_exceptions=True)

    log.info("Worker stopped")


def handle_shutdown(signum, frame):
    """Handle shutdown signals gracefully."""
    log.info(f"Received signal {signum}, initiating shutdown...")
    shutdown_event.set()


async def main():
    """Entry point for the worker."""
    # Register signal handlers
    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    log.info("Connecting to database...")
    db = await get_worker_db()

    try:
        # Verify database connection
        result = await db.fetch_one("SELECT 1 as ok")
        log.info("Database connection verified")

        # Check for OpenAI API key
        if not os.getenv("OPENAI_API_KEY"):
            log.warning("OPENAI_API_KEY not set - embedding generation will be skipped")

        # Run the worker loop
        await worker_loop(db)

    finally:
        log.info("Closing database connection...")
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
