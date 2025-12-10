"""Job handlers for different processing types."""
import logging
import json
from typing import Dict, Any
from uuid import UUID

from ..app.services.embeddings import process_entity_embedding, get_embedding_service

log = logging.getLogger("worker")


async def handle_embedding_generation(job: Dict[str, Any], db) -> Dict[str, Any]:
    """
    Generate text embedding for a rights entity.

    Job config: {} (no special config needed)
    """
    entity_id = job["rights_entity_id"]
    if not entity_id:
        raise ValueError("rights_entity_id is required for embedding_generation")

    user_id = job.get("created_by", "system")

    log.info(f"Generating embedding for entity {entity_id}")

    result = await process_entity_embedding(db, UUID(entity_id), user_id)

    return result


async def handle_batch_import(job: Dict[str, Any], db) -> Dict[str, Any]:
    """
    Process entities from a bulk import by creating embedding jobs for each.

    Job config: { entity_ids: string[] }
    """
    config = job.get("config") or {}
    if isinstance(config, str):
        config = json.loads(config)

    entity_ids = config.get("entity_ids", [])
    if not entity_ids:
        return {"status": "skipped", "reason": "no_entities"}

    log.info(f"Processing batch import with {len(entity_ids)} entities")

    created_jobs = 0
    failed = 0

    for entity_id in entity_ids:
        try:
            # Create embedding generation job for each entity
            await db.execute("""
                INSERT INTO processing_jobs (
                    job_type, rights_entity_id, status, priority, created_by
                )
                VALUES (
                    'embedding_generation', :entity_id, 'queued', 0, :created_by
                )
            """, {
                "entity_id": entity_id,
                "created_by": job.get("created_by", "system:batch_import")
            })

            # Update entity status
            await db.execute("""
                UPDATE rights_entities
                SET embedding_status = 'pending', updated_at = now()
                WHERE id = :entity_id
            """, {"entity_id": entity_id})

            created_jobs += 1
        except Exception as e:
            log.error(f"Failed to create job for entity {entity_id}: {e}")
            failed += 1

    return {
        "status": "success",
        "created_jobs": created_jobs,
        "failed": failed,
        "total": len(entity_ids)
    }


async def handle_asset_analysis(job: Dict[str, Any], db) -> Dict[str, Any]:
    """
    Extract metadata from an uploaded asset.

    Job config: {} (asset_id in job)
    """
    asset_id = job.get("asset_id")
    if not asset_id:
        raise ValueError("asset_id is required for asset_analysis")

    log.info(f"Analyzing asset {asset_id}")

    # Fetch asset info
    asset = await db.fetch_one("""
        SELECT id, mime_type, storage_path, storage_bucket, file_size_bytes
        FROM reference_assets
        WHERE id = :asset_id
    """, {"asset_id": asset_id})

    if not asset:
        raise ValueError(f"Asset {asset_id} not found")

    mime_type = asset["mime_type"] or ""
    extracted_metadata = {}

    # Basic metadata extraction based on MIME type
    # For now, just record what we know from the upload
    # Full extraction (audio duration, image dimensions) would require
    # downloading the file and using specialized libraries

    if mime_type.startswith("audio/"):
        extracted_metadata["media_type"] = "audio"
        # TODO: Download and extract with mutagen/ffprobe

    elif mime_type.startswith("image/"):
        extracted_metadata["media_type"] = "image"
        # TODO: Download and extract with Pillow

    elif mime_type.startswith("video/"):
        extracted_metadata["media_type"] = "video"
        # TODO: Download and extract with ffprobe

    elif mime_type == "application/pdf":
        extracted_metadata["media_type"] = "document"
        extracted_metadata["document_type"] = "pdf"
        # TODO: Download and extract with pymupdf

    else:
        extracted_metadata["media_type"] = "other"

    extracted_metadata["file_size_bytes"] = asset["file_size_bytes"]

    # Update asset with extracted metadata
    await db.execute("""
        UPDATE reference_assets
        SET processing_status = 'ready',
            extracted_metadata = :metadata,
            updated_at = now()
        WHERE id = :asset_id
    """, {
        "asset_id": asset_id,
        "metadata": json.dumps(extracted_metadata)
    })

    return {
        "status": "success",
        "asset_id": asset_id,
        "extracted": extracted_metadata
    }


async def handle_metadata_extraction(job: Dict[str, Any], db) -> Dict[str, Any]:
    """
    Extract text content from assets (OCR, transcription).

    Future implementation for:
    - Audio transcription with Whisper
    - Image OCR with Tesseract
    - PDF text extraction
    """
    asset_id = job.get("asset_id")
    if not asset_id:
        raise ValueError("asset_id is required for metadata_extraction")

    log.info(f"Metadata extraction for asset {asset_id} (not yet implemented)")

    # Placeholder - mark as ready with note
    await db.execute("""
        UPDATE reference_assets
        SET processing_status = 'ready',
            extracted_metadata = jsonb_set(
                COALESCE(extracted_metadata, '{}'::jsonb),
                '{extraction_note}',
                '"text_extraction_not_implemented"'
            ),
            updated_at = now()
        WHERE id = :asset_id
    """, {"asset_id": asset_id})

    return {
        "status": "skipped",
        "reason": "not_implemented",
        "asset_id": asset_id
    }


async def handle_fingerprint_generation(job: Dict[str, Any], db) -> Dict[str, Any]:
    """
    Generate audio fingerprint for music matching.

    Future implementation using Chromaprint/AcoustID.
    """
    asset_id = job.get("asset_id")
    if not asset_id:
        raise ValueError("asset_id is required for fingerprint_generation")

    log.info(f"Fingerprint generation for asset {asset_id} (not yet implemented)")

    return {
        "status": "skipped",
        "reason": "not_implemented",
        "asset_id": asset_id
    }


# Handler dispatch map
HANDLERS = {
    "embedding_generation": handle_embedding_generation,
    "batch_import": handle_batch_import,
    "asset_analysis": handle_asset_analysis,
    "metadata_extraction": handle_metadata_extraction,
    "fingerprint_generation": handle_fingerprint_generation,
}


async def dispatch_job(job: Dict[str, Any], db) -> Dict[str, Any]:
    """Dispatch a job to the appropriate handler."""
    job_type = job["job_type"]

    handler = HANDLERS.get(job_type)
    if not handler:
        raise ValueError(f"Unknown job type: {job_type}")

    return await handler(job, db)
