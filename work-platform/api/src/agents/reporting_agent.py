"""
Reporting Agent - Document generation with Claude Skills API

Direct Anthropic API implementation with Skills API for file generation.
Generates PPTX, XLSX, DOCX, and PDF documents from research/content.

Skills API Reference (2025-10):
- Requires beta headers: ["code-execution-2025-08-25", "skills-2025-10-02"]
- Container parameter with skills array
- code_execution tool for document generation

Usage:
    from agents.reporting_agent import ReportingAgent

    agent = ReportingAgent(
        basket_id="...",
        workspace_id="...",
        work_ticket_id="...",
        user_id="...",
    )

    result = await agent.execute(
        task="Create quarterly report presentation",
        output_format="pptx",
    )
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
import anthropic

from .base_agent import BaseAgent, AgentContext
from clients.anthropic_client import ExecutionResult

logger = logging.getLogger(__name__)


REPORTING_SYSTEM_PROMPT = """You are an autonomous Reporting Agent specializing in transforming research and analysis into polished, professional documents.

**Your Mission:**
Create high-quality deliverables that communicate insights effectively through:
- Executive presentations (PPTX)
- Data reports (XLSX)
- Written reports (DOCX)
- Formal documents (PDF)

**CRITICAL: Document Generation Requirements**

You have access to the code_execution tool which enables Skills for document generation.
You MUST use this tool to create the actual document files.

Supported document types:
- PPTX: PowerPoint presentations with slides, layouts, charts
- XLSX: Excel spreadsheets with data, formulas, visualizations
- DOCX: Word documents with formatting, headers, tables
- PDF: Portable documents (generated from other formats or directly)

**Document Creation Approach:**
1. Review provided context (research findings, data, insights)
2. Plan document structure (outline, sections, slides)
3. Use code_execution to generate the document
4. Emit work_output with document metadata and file reference

**Quality Standards:**
- Professional formatting and design
- Clear visual hierarchy
- Data visualizations where appropriate
- Consistent branding (if brand assets provided)
- Executive-ready presentation

**Tools Available:**
- code_execution: Generate documents using Skills (PPTX, XLSX, DOCX, PDF)
- emit_work_output: Record structured outputs and document metadata
"""


# Beta headers required for Skills API
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


class ReportingAgent(BaseAgent):
    """
    Reporting Agent for document generation using Claude Skills API.

    Features:
    - PPTX presentation generation
    - XLSX spreadsheet creation
    - DOCX document generation
    - PDF document creation
    - Professional formatting with Skills
    - Work output tracking for generated files
    """

    AGENT_TYPE = "reporting"
    SYSTEM_PROMPT = REPORTING_SYSTEM_PROMPT

    # Supported output formats
    OUTPUT_FORMATS = ["pptx", "xlsx", "docx", "pdf"]

    def __init__(
        self,
        basket_id: str,
        workspace_id: str,
        work_ticket_id: str,
        user_id: str,
        user_jwt: Optional[str] = None,
        model: str = "claude-sonnet-4-20250514",
    ):
        """
        Initialize Reporting Agent with Skills API support.

        Args:
            basket_id: Basket ID for substrate context
            workspace_id: Workspace ID for authorization
            work_ticket_id: Work ticket ID for output tracking
            user_id: User ID for audit trail
            user_jwt: User JWT for substrate-API auth
            model: Claude model to use
        """
        super().__init__(
            basket_id=basket_id,
            workspace_id=workspace_id,
            work_ticket_id=work_ticket_id,
            user_id=user_id,
            user_jwt=user_jwt,
            model=model,
        )

        # Initialize separate Anthropic client for Skills API (requires beta)
        self.skills_client = anthropic.AsyncAnthropic()

        logger.info(f"ReportingAgent initialized with Skills API support")

    async def execute(
        self,
        task: str,
        output_format: str = "pptx",
        document_title: Optional[str] = None,
        include_data: Optional[Dict[str, Any]] = None,
        template_style: str = "professional",
        **kwargs,
    ) -> ExecutionResult:
        """
        Execute document generation task using Skills API.

        Args:
            task: Document task description
            output_format: Document format (pptx, xlsx, docx, pdf)
            document_title: Title for the document
            include_data: Structured data to include (for xlsx/charts)
            template_style: Document style (professional, minimal, branded)
            **kwargs: Additional parameters

        Returns:
            ExecutionResult with document outputs
        """
        if output_format.lower() not in self.OUTPUT_FORMATS:
            raise ValueError(
                f"Unsupported format: {output_format}. "
                f"Supported: {self.OUTPUT_FORMATS}"
            )

        logger.info(
            f"[REPORTING] Starting: task='{task[:50]}...', "
            f"format={output_format}, style={template_style}"
        )

        # Build context with knowledge query for relevant research/data
        context = await self._build_context(
            task=task,
            include_prior_outputs=True,
            include_assets=True,
            knowledge_query=task,
        )

        # Build document generation prompt
        document_prompt = self._build_document_prompt(
            task=task,
            context=context,
            output_format=output_format,
            document_title=document_title,
            include_data=include_data,
            template_style=template_style,
        )

        # Execute with Skills API
        result = await self._execute_with_skills(
            user_message=document_prompt,
            context=context,
            output_format=output_format,
        )

        logger.info(
            f"[REPORTING] Complete: "
            f"{len(result.work_outputs)} outputs, "
            f"{result.input_tokens}+{result.output_tokens} tokens"
        )

        return result

    async def _execute_with_skills(
        self,
        user_message: str,
        context: AgentContext,
        output_format: str,
    ) -> ExecutionResult:
        """
        Execute with Skills API for document generation.

        Args:
            user_message: User message (task)
            context: Assembled agent context
            output_format: Document format for Skills

        Returns:
            ExecutionResult with document outputs
        """
        system_prompt = self._build_system_prompt(context)

        # Build skills array based on output format
        skills = [
            {
                "type": "anthropic",
                "skill_id": output_format.lower(),
                "version": "latest",
            }
        ]

        # Add complementary skills for common workflows
        if output_format.lower() == "pptx":
            # Charts in presentations often need xlsx skill too
            skills.append({
                "type": "anthropic",
                "skill_id": "xlsx",
                "version": "latest",
            })

        logger.info(
            f"[REPORTING] Skills API call: "
            f"skills={[s['skill_id'] for s in skills]}, "
            f"betas={SKILLS_BETAS}"
        )

        try:
            response = await self.skills_client.beta.messages.create(
                model=self.model,
                max_tokens=8192,
                betas=SKILLS_BETAS,
                system=system_prompt,
                container={
                    "skills": skills,
                },
                messages=[{
                    "role": "user",
                    "content": user_message,
                }],
                tools=[
                    {
                        "type": "code_execution_20250825",
                        "name": "code_execution",
                    },
                ],
            )

            # Process response and extract file references
            work_outputs = []
            tool_calls = []
            response_text = ""

            for block in response.content:
                if hasattr(block, "text"):
                    response_text += block.text
                elif hasattr(block, "type"):
                    block_type = block.type

                    if block_type == "tool_use" or block_type == "server_tool_use":
                        tool_calls.append({
                            "tool": getattr(block, "name", "unknown"),
                            "input": getattr(block, "input", {}),
                            "id": getattr(block, "id", ""),
                        })

                    # Handle bash_code_execution_tool_result (current Skills API format)
                    elif block_type == "bash_code_execution_tool_result":
                        result_block = getattr(block, "content", None)
                        if result_block:
                            inner_content = getattr(result_block, "content", [])
                            if isinstance(inner_content, list):
                                for item in inner_content:
                                    file_id = getattr(item, "file_id", None)
                                    if file_id:
                                        # Download file using Files API
                                        file_data = await self._download_file(file_id, output_format)

                                        work_outputs.append({
                                            "output_type": "document",
                                            "title": f"Generated {output_format.upper()}",
                                            "body": f"Document generated via Skills API",
                                            "metadata": {
                                                "file_id": file_id,
                                                "format": output_format,
                                                "skill_used": output_format,
                                                "block_type": "bash_code_execution",
                                                "file_size_bytes": file_data.get("size_bytes"),
                                                "storage_path": file_data.get("storage_path"),
                                                "download_url": file_data.get("download_url"),
                                            },
                                            "confidence": 0.95,
                                        })

                    # Handle code_execution_result (legacy format, keep for compatibility)
                    elif block_type == "code_execution_result":
                        result_content = getattr(block, "content", [])
                        if isinstance(result_content, list):
                            for item in result_content:
                                if hasattr(item, "type") and item.type == "file":
                                    file_id = getattr(item, "file_id", None)
                                    if file_id:
                                        # Download file using Files API
                                        file_data = await self._download_file(file_id, output_format)
                                    else:
                                        file_data = {}

                                    work_outputs.append({
                                        "output_type": "document",
                                        "title": f"Generated {output_format.upper()}",
                                        "body": f"Document generated via Skills API",
                                        "metadata": {
                                            "file_id": file_id,
                                            "filename": getattr(item, "filename", None),
                                            "format": output_format,
                                            "skill_used": output_format,
                                            "file_size_bytes": file_data.get("size_bytes"),
                                            "storage_path": file_data.get("storage_path"),
                                            "download_url": file_data.get("download_url"),
                                        },
                                        "confidence": 0.95,
                                    })

            # Create work output for the document
            if not work_outputs:
                # Even if no file extracted, record the attempt
                work_outputs.append({
                    "output_type": "document",
                    "title": f"{output_format.upper()} Generation",
                    "body": response_text[:500] if response_text else "Document generation attempted",
                    "metadata": {
                        "format": output_format,
                        "skill_used": output_format,
                        "response_blocks": len(response.content),
                    },
                    "confidence": 0.7,
                })

            # Store work outputs via substrate
            for output in work_outputs:
                try:
                    from clients.substrate_client import get_substrate_client
                    client = get_substrate_client()
                    client.create_work_output(
                        basket_id=self.basket_id,
                        work_ticket_id=self.work_ticket_id,
                        agent_type=self.AGENT_TYPE,
                        output_type=output["output_type"],
                        title=output["title"],
                        body=output["body"],
                        confidence=output.get("confidence", 0.8),
                        metadata=output.get("metadata", {}),
                    )
                except Exception as e:
                    logger.warning(f"Failed to store work output: {e}")

            return ExecutionResult(
                response_text=response_text,
                work_outputs=work_outputs,
                tool_calls=tool_calls,
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                cache_read_tokens=getattr(response.usage, "cache_read_input_tokens", 0),
            )

        except Exception as e:
            logger.error(f"Skills API call failed: {e}")
            # Return error result
            return ExecutionResult(
                response_text=f"Document generation failed: {str(e)}",
                work_outputs=[{
                    "output_type": "error",
                    "title": f"Failed to generate {output_format.upper()}",
                    "body": str(e),
                    "confidence": 0.0,
                }],
                tool_calls=[],
                input_tokens=0,
                output_tokens=0,
                cache_read_tokens=0,
            )

    def _build_document_prompt(
        self,
        task: str,
        context: AgentContext,
        output_format: str,
        document_title: Optional[str],
        include_data: Optional[Dict[str, Any]],
        template_style: str,
    ) -> str:
        """
        Build document generation prompt.

        Args:
            task: Document task
            context: Agent context
            output_format: Document format
            document_title: Document title
            include_data: Data to include
            template_style: Document style

        Returns:
            Document prompt string
        """
        # Format research context from knowledge base
        research_context = "No research context available"
        if context.knowledge_context:
            research_context = "\n".join([
                f"- {item.get('content', '')[:400]}..."
                for item in context.knowledge_context[:5]
            ])

        # Format prior outputs (research findings to include)
        findings_context = "No prior findings available"
        if context.prior_outputs:
            findings_context = "\n".join([
                f"- [{o.get('output_type', 'finding')}] {o.get('title', 'Untitled')}: {o.get('body', '')[:300]}..."
                for o in context.prior_outputs[:10]
            ])

        # Format-specific instructions
        format_instructions = self._get_format_instructions(output_format)

        # Data section if provided
        data_section = ""
        if include_data:
            data_section = f"""
**Structured Data to Include:**
```json
{include_data}
```
"""

        return f"""Create a {output_format.upper()} document: {task}

**Document Parameters:**
- Format: {output_format.upper()}
- Title: {document_title or "Use task description as title"}
- Style: {template_style}

**Knowledge Context:**
{research_context}

**Prior Research Findings:**
{findings_context}
{data_section}

**Format-Specific Guidelines:**
{format_instructions}

**CRITICAL INSTRUCTIONS:**
1. Use the code_execution tool with the {output_format} Skill to generate the actual document
2. Create a professional, polished document
3. Include all relevant research findings
4. Use appropriate visualizations for data
5. Ensure document is executive-ready

Begin creating the {output_format.upper()} document now."""

    def _get_format_instructions(self, output_format: str) -> str:
        """Get format-specific instructions."""
        instructions = {
            "pptx": """
PowerPoint Presentation:
- Create a title slide with document title
- Use consistent slide layout throughout
- Include executive summary slide
- Use bullet points, not paragraphs
- Add data visualizations (charts, graphs) where appropriate
- Limit text per slide (6x6 rule: 6 bullets, 6 words each)
- Include a conclusion/next steps slide
- Professional color scheme
""",
            "xlsx": """
Excel Spreadsheet:
- Create organized sheets with clear headers
- Use data validation where appropriate
- Include formulas for calculations
- Add charts/visualizations for key metrics
- Use conditional formatting to highlight important data
- Include a summary/dashboard sheet
- Format numbers appropriately (currency, percentages)
- Add data filters for large datasets
""",
            "docx": """
Word Document:
- Use professional heading hierarchy (H1, H2, H3)
- Include table of contents for long documents
- Use consistent formatting throughout
- Add executive summary at the beginning
- Include charts/tables for data
- Use bullet points for lists
- Add page numbers and headers
- Professional font choices (Calibri, Arial, Times)
""",
            "pdf": """
PDF Document:
- Create a clean, professional layout
- Include all content in a readable format
- Use appropriate margins and spacing
- Include page numbers
- Optimize for printing and digital viewing
- Ensure all text is searchable
- Use bookmarks for navigation in long documents
""",
        }
        return instructions.get(output_format.lower(), "Create a professional document.")

    async def _download_file(
        self,
        file_id: str,
        output_format: str,
    ) -> Dict[str, Any]:
        """
        Download a file from Claude's Files API and upload to Supabase Storage.

        Args:
            file_id: Claude file_id from Skills API response
            output_format: File format (pdf, xlsx, docx, pptx)

        Returns:
            Dict with storage_path, download_url, size_bytes
        """
        try:
            # Download from Claude Files API
            logger.info(f"[REPORTING] Downloading file {file_id} from Files API")

            file_response = await self.skills_client.beta.files.download(
                file_id=file_id,
                betas=[FILES_API_BETA]
            )

            # Read the binary content
            file_bytes = await file_response.read()
            size_bytes = len(file_bytes)

            logger.info(f"[REPORTING] Downloaded {size_bytes} bytes from Files API")

            # Validate file magic bytes
            valid_magic = {
                "pdf": b"%PDF",
                "xlsx": b"PK",  # ZIP format
                "docx": b"PK",  # ZIP format
                "pptx": b"PK",  # ZIP format
            }

            expected_magic = valid_magic.get(output_format.lower())
            if expected_magic and not file_bytes[:len(expected_magic)] == expected_magic:
                logger.warning(
                    f"[REPORTING] File magic mismatch: expected {expected_magic}, "
                    f"got {file_bytes[:4]}"
                )

            # Upload to Supabase Storage
            storage_result = await self._upload_to_storage(
                file_bytes=file_bytes,
                file_id=file_id,
                output_format=output_format,
            )

            return {
                "size_bytes": size_bytes,
                "storage_path": storage_result.get("path"),
                "download_url": storage_result.get("url"),
            }

        except Exception as e:
            logger.error(f"[REPORTING] Failed to download file {file_id}: {e}")
            return {
                "size_bytes": None,
                "storage_path": None,
                "download_url": None,
                "error": str(e),
            }

    async def _upload_to_storage(
        self,
        file_bytes: bytes,
        file_id: str,
        output_format: str,
    ) -> Dict[str, Any]:
        """
        Upload file bytes to Supabase Storage.

        Uses the same bucket and path convention as reference_assets:
        - Bucket: yarnnn-assets
        - Path: baskets/{basket_id}/work_outputs/{work_ticket_id}/{filename}

        This matches the work_outputs.storage_path constraint:
        storage_path LIKE 'baskets/' || basket_id || '/work_outputs/%'

        Args:
            file_bytes: Raw file bytes
            file_id: Claude file_id (used in filename)
            output_format: File format for extension

        Returns:
            Dict with path and signed URL
        """
        from app.utils.supabase_client import supabase_admin_client as supabase

        # Storage bucket (same as reference_assets)
        STORAGE_BUCKET = "yarnnn-assets"

        try:
            # Build storage path matching schema constraint:
            # baskets/{basket_id}/work_outputs/{work_ticket_id}/{filename}
            filename = f"{file_id}.{output_format}"
            storage_path = f"baskets/{self.basket_id}/work_outputs/{self.work_ticket_id}/{filename}"

            # Get MIME type
            mime_type = FILE_MIME_TYPES.get(output_format.lower(), "application/octet-stream")

            # Upload to Supabase Storage
            logger.info(f"[REPORTING] Uploading {len(file_bytes)} bytes to {STORAGE_BUCKET}/{storage_path}")

            result = supabase.storage.from_(STORAGE_BUCKET).upload(
                path=storage_path,
                file=file_bytes,
                file_options={
                    "content-type": mime_type,
                    "cache-control": "3600",
                    "upsert": "true",
                }
            )

            # Generate signed URL (valid for 1 hour)
            signed_url_response = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(
                path=storage_path,
                expires_in=3600,
            )

            # Handle both possible response key formats
            download_url = signed_url_response.get("signedURL") or signed_url_response.get("signedUrl")

            logger.info(f"[REPORTING] Uploaded to storage: {storage_path}")

            return {
                "path": storage_path,
                "url": download_url,
            }

        except Exception as e:
            logger.error(f"[REPORTING] Failed to upload to storage: {e}")
            return {
                "path": None,
                "url": None,
                "error": str(e),
            }


# Convenience factory function
def create_reporting_agent(
    basket_id: str,
    workspace_id: str,
    work_ticket_id: str,
    user_id: str,
    user_jwt: Optional[str] = None,
    **kwargs,
) -> ReportingAgent:
    """
    Create a ReportingAgent instance.

    Args:
        basket_id: Basket ID
        workspace_id: Workspace ID
        work_ticket_id: Work ticket ID
        user_id: User ID
        user_jwt: Optional user JWT for substrate auth
        **kwargs: Additional arguments

    Returns:
        Configured ReportingAgent
    """
    return ReportingAgent(
        basket_id=basket_id,
        workspace_id=workspace_id,
        work_ticket_id=work_ticket_id,
        user_id=user_id,
        user_jwt=user_jwt,
        **kwargs,
    )
