"""Processing jobs management endpoints.

Note: This module requires the processing_jobs table which is not yet
implemented in the schema. All endpoints return 501 Not Implemented
until the schema is extended with background job support.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

router = APIRouter()


# =============================================================================
# Pydantic Models
# =============================================================================

class JobCreate(BaseModel):
    """Create a processing job."""
    job_type: str
    rights_entity_id: Optional[UUID] = None
    asset_id: Optional[UUID] = None
    priority: int = 0
    config: dict = {}


VALID_JOB_TYPES = [
    'embedding_generation', 'asset_analysis', 'metadata_extraction',
    'fingerprint_generation', 'batch_import'
]


# =============================================================================
# Job Routes - All return 501 Not Implemented
# =============================================================================

@router.get("/jobs")
async def list_jobs(
    request: Request,
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    limit: int = Query(50, le=200),
    offset: int = 0
):
    """
    List processing jobs.

    Note: This endpoint requires the processing_jobs table which is not yet
    implemented. Background job processing will be available in a future release.
    """
    raise HTTPException(
        status_code=501,
        detail="Processing jobs are not yet implemented. Requires processing_jobs schema."
    )


@router.get("/jobs/{job_id}")
async def get_job(request: Request, job_id: UUID):
    """
    Get job details.

    Note: This endpoint requires the processing_jobs table which is not yet
    implemented. Background job processing will be available in a future release.
    """
    raise HTTPException(
        status_code=501,
        detail="Processing jobs are not yet implemented. Requires processing_jobs schema."
    )


@router.post("/jobs")
async def create_job(request: Request, payload: JobCreate):
    """
    Create a new processing job.

    Note: This endpoint requires the processing_jobs table which is not yet
    implemented. Background job processing will be available in a future release.
    """
    raise HTTPException(
        status_code=501,
        detail="Processing jobs are not yet implemented. Requires processing_jobs schema."
    )


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(request: Request, job_id: UUID):
    """
    Cancel a queued or processing job.

    Note: This endpoint requires the processing_jobs table which is not yet
    implemented. Background job processing will be available in a future release.
    """
    raise HTTPException(
        status_code=501,
        detail="Processing jobs are not yet implemented. Requires processing_jobs schema."
    )


@router.post("/jobs/{job_id}/retry")
async def retry_job(request: Request, job_id: UUID):
    """
    Retry a failed job.

    Note: This endpoint requires the processing_jobs table which is not yet
    implemented. Background job processing will be available in a future release.
    """
    raise HTTPException(
        status_code=501,
        detail="Processing jobs are not yet implemented. Requires processing_jobs schema."
    )
