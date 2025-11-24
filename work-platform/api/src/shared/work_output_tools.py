"""
Work Output Tools - Tool definitions for structured agent outputs.

This module defines the emit_work_output tool that agents use to produce
structured work outputs. The tool schema forces Claude to emit structured
data that can be parsed and stored for user supervision.

Pattern:
1. Agent reasons about task
2. Agent calls emit_work_output tool with structured data
3. Response is parsed to extract WorkOutput objects
4. WorkOutputs are written to substrate-API via BFF
5. User reviews and approves/rejects in supervision UI

This is the critical bridge between Claude's reasoning and the work_outputs table.
"""

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class WorkOutput:
    """
    Structured work output from agent execution.

    This corresponds to a row in the work_outputs table.
    Created by parsing Claude's tool_use response.

    Supports two output modes:
    - Text outputs: body is populated (string), file_id is None
    - File outputs: file_id is populated, body is None (mutually exclusive)
    """
    output_type: str  # finding, recommendation, insight, draft_content, spreadsheet, report_pdf, etc.
    title: str

    # Content (ONE OF - mutually exclusive)
    body: Optional[str] = None  # Text content (or JSON string for legacy compatibility)
    file_id: Optional[str] = None  # Claude Files API identifier (file_011CNha...)

    # File metadata (when file_id is set)
    file_format: Optional[str] = None  # pdf, xlsx, docx, pptx, png, csv
    file_size_bytes: Optional[int] = None
    mime_type: Optional[str] = None
    storage_path: Optional[str] = None  # Supabase Storage path after persistence

    # Provenance
    generation_method: str = "text"  # text, code_execution, skill, manual
    skill_metadata: Optional[Dict[str, Any]] = None  # Skill-specific provenance

    # Legacy fields
    confidence: Optional[float] = None
    source_block_ids: Optional[List[str]] = None  # Provenance
    tool_call_id: Optional[str] = None  # Claude's tool_use id

    def __post_init__(self):
        if self.source_block_ids is None:
            self.source_block_ids = []

        # Validate body XOR file_id
        if self.body is not None and self.file_id is not None:
            raise ValueError("WorkOutput cannot have both body and file_id - they are mutually exclusive")
        if self.body is None and self.file_id is None:
            raise ValueError("WorkOutput must have either body or file_id")

    def is_file_output(self) -> bool:
        """Check if this is a file output (vs text output)"""
        return self.file_id is not None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API serialization."""
        result = {
            "output_type": self.output_type,
            "title": self.title,
            "generation_method": self.generation_method,
        }

        # Content (one of)
        if self.body is not None:
            result["body"] = self.body
        if self.file_id is not None:
            result["file_id"] = self.file_id
            result["file_format"] = self.file_format
            result["file_size_bytes"] = self.file_size_bytes
            result["mime_type"] = self.mime_type
            if self.storage_path:
                result["storage_path"] = self.storage_path
            if self.skill_metadata:
                result["skill_metadata"] = self.skill_metadata

        # Legacy/optional fields
        if self.confidence is not None:
            result["confidence"] = self.confidence
        if self.source_block_ids:
            result["source_context_ids"] = self.source_block_ids
        if self.tool_call_id:
            result["tool_call_id"] = self.tool_call_id

        return result


# Universal tool schema for emitting work outputs
# This is the Claude tool definition that agents include in their tool list
EMIT_WORK_OUTPUT_TOOL = {
    "name": "emit_work_output",
    "description": """Emit a structured work output for user review.

Use this tool to record your findings, recommendations, insights, or draft content.
Each output you emit will be reviewed by the user before any action is taken.

IMPORTANT: You MUST use this tool for EVERY significant finding or output you generate.
Do not just describe your findings in text - emit them as structured outputs.

When to use:
- You discover a new fact or finding (output_type: "finding")
- You want to suggest an action (output_type: "recommendation")
- You identify a pattern or insight (output_type: "insight")
- You draft content for review (output_type: "draft_content")
- You analyze data (output_type: "data_analysis")
- You create a report section (output_type: "report_section")
""",
    "input_schema": {
        "type": "object",
        "properties": {
            "output_type": {
                "type": "string",
                "enum": [
                    "finding",
                    "recommendation",
                    "insight",
                    "draft_content",
                    "report_section",
                    "data_analysis"
                ],
                "description": "Type of work output. Use 'finding' for facts, 'recommendation' for actions, 'insight' for patterns, 'draft_content' for content drafts."
            },
            "title": {
                "type": "string",
                "description": "Concise title for this output (max 200 chars). Should be descriptive and actionable.",
                "maxLength": 200
            },
            "body": {
                "type": "object",
                "description": "Structured content of the output. Must include 'summary' at minimum.",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "Brief summary of the output (1-3 sentences)"
                    },
                    "details": {
                        "type": "string",
                        "description": "Detailed explanation or full content"
                    },
                    "evidence": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of evidence or sources supporting this output"
                    },
                    "recommendations": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Actionable next steps or suggestions"
                    },
                    "data": {
                        "type": "object",
                        "description": "Structured data (for data_analysis outputs)"
                    },
                    "platform": {
                        "type": "string",
                        "description": "Target platform (for draft_content outputs)"
                    },
                    "draft_text": {
                        "type": "string",
                        "description": "The actual draft content (for draft_content outputs)"
                    }
                },
                "required": ["summary"]
            },
            "confidence": {
                "type": "number",
                "minimum": 0,
                "maximum": 1,
                "description": "Confidence score (0.0 to 1.0). Use 0.9+ for verified facts, 0.7-0.9 for likely facts, 0.5-0.7 for uncertain, below 0.5 for speculative."
            },
            "source_block_ids": {
                "type": "array",
                "items": {"type": "string"},
                "description": "IDs of context blocks used to generate this output (for provenance tracking)"
            }
        },
        "required": ["output_type", "title", "body", "confidence"]
    }
}


def parse_work_outputs_from_response(response: Any) -> List[WorkOutput]:
    """
    Parse Claude response to extract structured work outputs.

    This function examines Claude's response for tool_use blocks that
    call the emit_work_output tool. Each valid tool call becomes a WorkOutput.

    Args:
        response: Claude API response (anthropic.types.Message)

    Returns:
        List of WorkOutput objects

    Example:
        response = await client.messages.create(
            model="claude-sonnet-4-5",
            tools=[EMIT_WORK_OUTPUT_TOOL],
            messages=[...]
        )
        outputs = parse_work_outputs_from_response(response)
        # outputs is List[WorkOutput]
    """
    outputs = []

    # Handle dict response (from raw JSON)
    if isinstance(response, dict):
        content_blocks = response.get("content", [])
    # Handle Message object (from Anthropic SDK)
    elif hasattr(response, "content"):
        content_blocks = response.content
    else:
        logger.warning(f"Unexpected response type: {type(response)}")
        return outputs

    for block in content_blocks:
        # Handle both dict and object representations
        if isinstance(block, dict):
            block_type = block.get("type")
            tool_name = block.get("name")
            tool_input = block.get("input", {})
            tool_id = block.get("id")
        else:
            block_type = getattr(block, "type", None)
            tool_name = getattr(block, "name", None)
            tool_input = getattr(block, "input", {})
            tool_id = getattr(block, "id", None)

        # Only process emit_work_output tool calls
        if block_type == "tool_use" and tool_name == "emit_work_output":
            try:
                # Handle body: convert Dict to JSON string for new TEXT column
                body_input = tool_input.get("body")
                if isinstance(body_input, dict):
                    import json
                    body_str = json.dumps(body_input)
                else:
                    body_str = body_input

                output = WorkOutput(
                    output_type=tool_input.get("output_type", "insight"),
                    title=tool_input.get("title", "Untitled Output"),
                    body=body_str if body_str else None,
                    file_id=tool_input.get("file_id"),
                    file_format=tool_input.get("file_format"),
                    file_size_bytes=tool_input.get("file_size_bytes"),
                    mime_type=tool_input.get("mime_type"),
                    generation_method=tool_input.get("generation_method", "text"),
                    skill_metadata=tool_input.get("skill_metadata"),
                    confidence=tool_input.get("confidence", 0.5),
                    source_block_ids=tool_input.get("source_block_ids", []),
                    tool_call_id=tool_id
                )
                outputs.append(output)
                logger.debug(f"Parsed work output: {output.title} ({output.output_type}, {'file' if output.is_file_output() else 'text'})")
            except Exception as e:
                logger.error(f"Failed to parse work output from tool call: {e}")
                continue

    logger.info(f"Parsed {len(outputs)} work outputs from Claude response")
    return outputs


def validate_work_output(output: WorkOutput) -> List[str]:
    """
    Validate work output structure and content.

    Returns list of validation errors (empty if valid).
    """
    errors = []

    # Required fields
    if not output.output_type:
        errors.append("output_type is required")

    if not output.title or len(output.title.strip()) == 0:
        errors.append("title is required and cannot be empty")

    if len(output.title) > 200:
        errors.append("title must be 200 characters or less")

    # Content validation (body XOR file_id)
    if output.body is None and output.file_id is None:
        errors.append("must have either body or file_id")
    elif output.body is not None and output.file_id is not None:
        errors.append("cannot have both body and file_id (mutually exclusive)")

    # Body validation (for text outputs)
    if output.body is not None:
        # Body is now TEXT (not JSONB), can be plain text or JSON string
        pass  # Less strict validation for backward compatibility

    # File validation (for file outputs)
    if output.file_id is not None:
        if not output.file_format:
            errors.append("file_format is required when file_id is set")
        if not output.generation_method in ["code_execution", "skill", "manual"]:
            errors.append("file outputs must have generation_method of code_execution, skill, or manual")

    # Confidence validation (optional)
    if output.confidence is not None and not (0 <= output.confidence <= 1):
        errors.append("confidence must be between 0 and 1")

    # Type-specific validation
    valid_types = ["finding", "recommendation", "insight", "draft_content", "report_section", "data_analysis",
                   "spreadsheet", "report_pdf", "presentation", "document"]
    if output.output_type not in valid_types:
        errors.append(f"output_type must be one of: {valid_types}")

    return errors


def create_tool_result(tool_use_id: str, success: bool = True, error: str = None) -> dict:
    """
    Create a tool result to send back to Claude.

    When using tools in multi-turn conversations, Claude expects a tool result
    for each tool call. This helper creates the proper format.

    Args:
        tool_use_id: The id from Claude's tool_use block
        success: Whether the tool call succeeded
        error: Error message if not successful

    Returns:
        Tool result dictionary for Claude API
    """
    if success:
        return {
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": "Work output recorded successfully. Continue with your analysis."
        }
    else:
        return {
            "type": "tool_result",
            "tool_use_id": tool_use_id,
            "content": f"Failed to record work output: {error}",
            "is_error": True
        }
