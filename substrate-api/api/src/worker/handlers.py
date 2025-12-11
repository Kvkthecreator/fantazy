"""Job handlers for Fantazy background processing."""
import logging
from typing import Dict, Any

log = logging.getLogger("worker")


# Handler dispatch map - add handlers as needed for Fantazy features
HANDLERS: Dict[str, Any] = {
    # Future handlers:
    # "memory_extraction": handle_memory_extraction,
    # "episode_summary": handle_episode_summary,
    # "relationship_update": handle_relationship_update,
}


async def dispatch_job(job: Dict[str, Any], db) -> Dict[str, Any]:
    """Dispatch a job to the appropriate handler."""
    job_type = job["job_type"]

    handler = HANDLERS.get(job_type)
    if not handler:
        log.warning(f"No handler registered for job type: {job_type}")
        return {"status": "skipped", "reason": f"no_handler_for_{job_type}"}

    return await handler(job, db)
