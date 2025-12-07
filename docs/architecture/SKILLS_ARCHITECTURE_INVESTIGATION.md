# Skills Architecture - Implementation Guide

**Date**: 2025-12-07 (Updated)
**Status**: VERIFIED WORKING
**Context**: Claude Skills API for document generation (PDF, XLSX, DOCX, PPTX)

---

## Executive Summary

**CONFIRMED WORKING**: Claude's Skills API generates real files (PDF, XLSX, DOCX, PPTX) via the Anthropic API with proper beta headers. Files are downloaded via a separate Files API endpoint.

**Key Discovery**: The Skills API returns `file_id` references, not raw file bytes. You must use the Files API (`files-api-2025-04-14` beta) to download the actual file content.

**Implementation**: See `ReportingAgent` in `work-platform/api/src/agents/reporting_agent.py`

---

## 1. API Architecture

### 1.1 Required Beta Headers

| Beta Header | Purpose | Required For |
|-------------|---------|--------------|
| `code-execution-2025-08-25` | Enables code execution in container | Skills execution |
| `skills-2025-10-02` | Enables Skills API | Skill invocation |
| `files-api-2025-04-14` | Enables Files API | File download |

### 1.2 Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SKILLS FILE GENERATION FLOW                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. SKILLS API CALL                                                      │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │ client.beta.messages.create(                                  │    │
│     │     betas=["code-execution-2025-08-25", "skills-2025-10-02"], │    │
│     │     container={"skills": [{"type": "anthropic",               │    │
│     │                            "skill_id": "pdf",                 │    │
│     │                            "version": "latest"}]},            │    │
│     │     tools=[{"type": "code_execution_20250825",                │    │
│     │             "name": "code_execution"}],                       │    │
│     │ )                                                             │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                              ▼                                           │
│  2. CLAUDE EXECUTES CODE IN CONTAINER                                    │
│     - Reads skill instructions from /skills/{skill_id}/SKILL.md          │
│     - Runs Python/Node scripts to generate file                          │
│     - File saved to container filesystem                                 │
│                              ▼                                           │
│  3. RESPONSE CONTAINS file_id                                            │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │ response.content = [                                          │    │
│     │   TextBlock(type="text", ...),                                │    │
│     │   BetaBashCodeExecutionToolResultBlock(                       │    │
│     │     type="bash_code_execution_tool_result",                   │    │
│     │     content=BetaBashCodeExecutionResultBlock(                 │    │
│     │       content=[                                               │    │
│     │         BetaBashCodeExecutionOutputBlock(                     │    │
│     │           file_id="file_011CVrmSNAuFpgG3RAtWzYEF",  ◄──────── │    │
│     │           type="bash_code_execution_output"                   │    │
│     │         )                                                     │    │
│     │       ]                                                       │    │
│     │     )                                                         │    │
│     │   )                                                           │    │
│     │ ]                                                             │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                              ▼                                           │
│  4. FILES API DOWNLOAD                                                   │
│     ┌──────────────────────────────────────────────────────────────┐    │
│     │ file_response = client.beta.files.download(                   │    │
│     │     file_id="file_011CVrmSNAuFpgG3RAtWzYEF",                  │    │
│     │     betas=["files-api-2025-04-14"]                            │    │
│     │ )                                                             │    │
│     │ file_bytes = await file_response.read()  # Raw PDF/XLSX/etc  │    │
│     └──────────────────────────────────────────────────────────────┘    │
│                              ▼                                           │
│  5. STORE IN SUPABASE STORAGE                                            │
│     - Upload to: generated-files/work_outputs/{basket_id}/{file_id}.pdf  │
│     - Generate signed URL for user download                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Response Block Types

The Skills API returns different block types than the standard Messages API:

| Block Type | When Returned | Contains |
|------------|--------------|----------|
| `text` | Always | Claude's text response |
| `server_tool_use` | When Claude uses a tool | Tool name, input |
| `bash_code_execution_tool_result` | After bash execution | `file_id` for generated files |
| `text_editor_code_execution_tool_result` | After file editing | File modification results |

**Critical**: Extract `file_id` from nested structure:
```python
block.content.content[].file_id  # NOT block.content[].file_id
```

---

## 2. Implementation

### 2.1 ReportingAgent Configuration

```python
# work-platform/api/src/agents/reporting_agent.py

# Beta headers for Skills API
SKILLS_BETAS = ["code-execution-2025-08-25", "skills-2025-10-02"]

# Beta header for Files API (downloading generated files)
FILES_API_BETA = "files-api-2025-04-14"

# MIME types for generated files
FILE_MIME_TYPES = {
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
```

### 2.2 Skills API Call

```python
response = await client.beta.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=8192,
    betas=SKILLS_BETAS,
    system="Create requested documents.",
    container={
        "skills": [
            {"type": "anthropic", "skill_id": "pdf", "version": "latest"}
        ]
    },
    messages=[{
        "role": "user",
        "content": "Create a PDF report about AI capabilities."
    }],
    tools=[
        {"type": "code_execution_20250825", "name": "code_execution"}
    ],
)
```

### 2.3 File ID Extraction

```python
def extract_file_ids(response):
    """Extract file_ids from Skills API response."""
    file_ids = []
    for block in response.content:
        block_type = getattr(block, "type", "")

        # Current format: bash_code_execution_tool_result
        if block_type == "bash_code_execution_tool_result":
            result_block = getattr(block, "content", None)
            if result_block:
                inner_content = getattr(result_block, "content", [])
                if isinstance(inner_content, list):
                    for item in inner_content:
                        file_id = getattr(item, "file_id", None)
                        if file_id:
                            file_ids.append(file_id)

    return file_ids
```

### 2.4 File Download

```python
async def download_file(client, file_id: str) -> bytes:
    """Download file bytes from Claude Files API."""
    file_response = await client.beta.files.download(
        file_id=file_id,
        betas=["files-api-2025-04-14"]
    )
    return await file_response.read()
```

### 2.5 Storage Upload

Uses the same `yarnnn-assets` bucket and path convention as `reference_assets`:

```python
async def upload_to_storage(file_bytes: bytes, file_id: str, format: str):
    """Upload to Supabase Storage and return signed URL."""
    from app.utils.supabase_client import supabase_admin_client as supabase

    # Bucket: yarnnn-assets (shared with reference_assets)
    STORAGE_BUCKET = "yarnnn-assets"

    # Path matches work_outputs.storage_path constraint:
    # baskets/{basket_id}/work_outputs/{work_ticket_id}/{filename}
    storage_path = f"baskets/{basket_id}/work_outputs/{work_ticket_id}/{file_id}.{format}"
    mime_type = FILE_MIME_TYPES.get(format)

    supabase.storage.from_(STORAGE_BUCKET).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": mime_type, "cache-control": "3600", "upsert": "true"}
    )

    signed_url = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(
        path=storage_path,
        expires_in=3600,  # 1 hour
    )

    return signed_url
```

---

## 3. Available Skills

### 3.1 Anthropic Pre-built Skills

| Skill ID | Description | Output Format |
|----------|-------------|---------------|
| `pdf` | PDF generation using reportlab/pypdf | `.pdf` |
| `xlsx` | Excel with openpyxl, formulas, charts | `.xlsx` |
| `docx` | Word documents with python-docx | `.docx` |
| `pptx` | PowerPoint via html2pptx workflow | `.pptx` |

### 3.2 Skill Documentation Location

When Skills API runs, Claude has access to skill instructions at:
```
/skills/{skill_id}/SKILL.md
```

These are provided by Anthropic's container environment, not your codebase.

### 3.3 Local Skill Documentation (Optional)

For reference, we maintain copies in `.claude/skills/`:
```
work-platform/api/.claude/skills/
├── pdf/SKILL.md
├── xlsx/SKILL.md
├── docx/SKILL.md
└── pptx/SKILL.md
```

---

## 4. Testing

### 4.1 Unit Tests (No API Calls)

```bash
cd work-platform/api
pytest tests/integration/test_skills_file_generation.py -v -k "not Live"
```

Tests:
- `SKILLS_BETAS` contains correct beta headers
- `FILES_API_BETA` is defined
- All 4 output formats supported
- File ID extraction logic

### 4.2 Live API Tests (Costs Money)

```bash
# Generate all file types
pytest tests/integration/test_skills_file_generation.py -v -s -k "Live"

# Full flow: Skills → Files API → Download
pytest tests/integration/test_skills_file_generation.py -v -s -k "test_files_api_download_live"
```

### 4.3 Quick Manual Test

```python
import asyncio
import anthropic

async def test():
    client = anthropic.AsyncAnthropic()

    # Generate PDF
    response = await client.beta.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        betas=["code-execution-2025-08-25", "skills-2025-10-02"],
        container={"skills": [{"type": "anthropic", "skill_id": "pdf", "version": "latest"}]},
        messages=[{"role": "user", "content": "Create a simple PDF with title 'Test'."}],
        tools=[{"type": "code_execution_20250825", "name": "code_execution"}],
    )

    # Extract file_id
    for block in response.content:
        if getattr(block, "type", "") == "bash_code_execution_tool_result":
            result = getattr(block, "content", None)
            if result:
                for item in getattr(result, "content", []):
                    file_id = getattr(item, "file_id", None)
                    if file_id:
                        print(f"Generated: {file_id}")

                        # Download
                        file_bytes = await (await client.beta.files.download(
                            file_id=file_id,
                            betas=["files-api-2025-04-14"]
                        )).read()

                        print(f"Downloaded {len(file_bytes)} bytes")
                        print(f"Valid PDF: {file_bytes[:4] == b'%PDF'}")

asyncio.run(test())
```

---

## 5. File Validation

### 5.1 Magic Bytes

| Format | Magic Bytes | Notes |
|--------|-------------|-------|
| PDF | `%PDF` (0x25504446) | ASCII header |
| XLSX | `PK` (0x504B) | ZIP format |
| DOCX | `PK` (0x504B) | ZIP format |
| PPTX | `PK` (0x504B) | ZIP format |

### 5.2 Validation Code

```python
VALID_MAGIC = {
    "pdf": b"%PDF",
    "xlsx": b"PK",
    "docx": b"PK",
    "pptx": b"PK",
}

def validate_file(file_bytes: bytes, format: str) -> bool:
    expected = VALID_MAGIC.get(format.lower())
    return file_bytes[:len(expected)] == expected if expected else True
```

---

## 6. Work Output Schema

When ReportingAgent generates a file, the work_output includes:

```json
{
  "output_type": "document",
  "title": "Generated PDF",
  "body": null,
  "file_id": "file_011CVrmSNAuFpgG3RAtWzYEF",
  "file_format": "pdf",
  "file_size_bytes": 1626,
  "mime_type": "application/pdf",
  "storage_path": "baskets/{basket_id}/work_outputs/{work_ticket_id}/file_011CVrmSNAuFpgG3RAtWzYEF.pdf",
  "generation_method": "skill",
  "skill_metadata": {
    "skill_id": "pdf",
    "block_type": "bash_code_execution"
  },
  "confidence": 0.95
}
```

**Note**: Per the `work_outputs_content_type` constraint, `body` and `file_id` are mutually exclusive - file outputs have `body=NULL` and `file_id` set.

---

## 7. Supabase Storage Setup

### 7.1 Existing Bucket

Uses the existing `yarnnn-assets` bucket (shared with `reference_assets`).

### 7.2 Storage Path Convention

Per the `work_outputs_storage_path_format` constraint:
```sql
storage_path LIKE 'baskets/' || basket_id::TEXT || '/work_outputs/%'
```

Path format: `baskets/{basket_id}/work_outputs/{work_ticket_id}/{filename}`

### 7.3 Existing Bucket Policies

The `yarnnn-assets` bucket already has policies for workspace access. Work outputs inherit these policies since they follow the `baskets/{basket_id}/...` path convention.

---

## 8. Error Handling

### 8.1 Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `No file_id found` | Wrong block type extraction | Check for `bash_code_execution_tool_result` |
| `Files API 404` | File expired or invalid ID | Files are ephemeral, download immediately |
| `Magic bytes mismatch` | Corrupted or wrong format | Retry generation |
| `Storage upload failed` | Bucket doesn't exist | Create `generated-files` bucket |

### 8.2 Retry Strategy

```python
async def generate_with_retry(task, format, max_retries=2):
    for attempt in range(max_retries + 1):
        try:
            result = await agent.execute(task=task, output_format=format)
            if result.work_outputs and result.work_outputs[0].get("metadata", {}).get("download_url"):
                return result
        except Exception as e:
            if attempt == max_retries:
                raise
            await asyncio.sleep(2 ** attempt)
```

---

## 9. Key Learnings

### 9.1 What Works

1. **Skills API generates real files** - PDF, XLSX, DOCX, PPTX all work
2. **Files API downloads actual bytes** - Not base64, raw binary
3. **File IDs are ephemeral** - Download immediately after generation
4. **Supabase Storage works** - For persistent storage and signed URLs

### 9.2 What Doesn't Work

1. **Direct file URLs from Skills API** - Only `file_id` references returned
2. **Legacy `code_execution_result` blocks** - Now uses `bash_code_execution_tool_result`
3. **Single beta header** - Need both Skills AND Files API betas

### 9.3 Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Use Skills API directly | Simpler than Agent SDK for file generation |
| Separate Files API call | Required - Skills doesn't return bytes |
| Store in Supabase | Persistent storage with signed URLs |
| AsyncAnthropic client | Non-blocking for production use |

---

## 10. References

- **Skills API**: Uses container-based code execution
- **Files API**: Beta endpoint for file download
- **Anthropic Python SDK**: `anthropic>=0.40.0` required for beta APIs
- **Test File**: `work-platform/api/tests/integration/test_skills_file_generation.py`
- **Implementation**: `work-platform/api/src/agents/reporting_agent.py`
