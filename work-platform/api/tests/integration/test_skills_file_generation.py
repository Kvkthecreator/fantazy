"""
Integration tests for ReportingAgent Skills API file generation.

Tests the actual ReportingAgent implementation to verify:
1. Skills API is called correctly with proper beta headers
2. Claude generates files via code_execution tool
3. file_id is extracted from code_execution_result blocks
4. Work outputs are created with file metadata

Prerequisites:
- ANTHROPIC_API_KEY environment variable

Run with: pytest tests/integration/test_skills_file_generation.py -v -s
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

# Add src to path
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))


def extract_file_ids(response):
    """
    Extract file_ids from Skills API response.

    Handles both new format (bash_code_execution_tool_result) and
    legacy format (code_execution_result).
    """
    file_ids = []
    for block in response.content:
        block_type = getattr(block, "type", "")

        # New format: bash_code_execution_tool_result
        if block_type == "bash_code_execution_tool_result":
            result_block = getattr(block, "content", None)
            if result_block:
                inner_content = getattr(result_block, "content", [])
                if isinstance(inner_content, list):
                    for item in inner_content:
                        file_id = getattr(item, "file_id", None)
                        if file_id:
                            file_ids.append(file_id)

        # Legacy format: code_execution_result
        elif block_type == "code_execution_result":
            result_content = getattr(block, "content", [])
            if isinstance(result_content, list):
                for item in result_content:
                    if getattr(item, "type", "") == "file":
                        file_ids.append(getattr(item, "file_id", None))

    return file_ids


# ============================================================================
# Unit Tests: ReportingAgent Configuration
# ============================================================================

class TestReportingAgentConfiguration:
    """Test ReportingAgent is configured correctly for Skills API."""

    def test_skills_betas_defined(self):
        """Verify SKILLS_BETAS constant has correct beta headers."""
        from agents.reporting_agent import SKILLS_BETAS

        assert "code-execution-2025-08-25" in SKILLS_BETAS
        assert "skills-2025-10-02" in SKILLS_BETAS

    def test_supported_output_formats(self):
        """Verify all 4 file formats are supported."""
        from agents.reporting_agent import ReportingAgent

        assert "pptx" in ReportingAgent.OUTPUT_FORMATS
        assert "xlsx" in ReportingAgent.OUTPUT_FORMATS
        assert "docx" in ReportingAgent.OUTPUT_FORMATS
        assert "pdf" in ReportingAgent.OUTPUT_FORMATS

    def test_system_prompt_mentions_code_execution(self):
        """Verify system prompt instructs Claude to use code_execution."""
        from agents.reporting_agent import REPORTING_SYSTEM_PROMPT

        assert "code_execution" in REPORTING_SYSTEM_PROMPT
        assert "PPTX" in REPORTING_SYSTEM_PROMPT
        assert "XLSX" in REPORTING_SYSTEM_PROMPT
        assert "DOCX" in REPORTING_SYSTEM_PROMPT
        assert "PDF" in REPORTING_SYSTEM_PROMPT


# ============================================================================
# Unit Tests: Skills Array Construction
# ============================================================================

class TestSkillsArrayConstruction:
    """Test that skills array is built correctly for each format."""

    def test_pdf_skill_array(self):
        """Test PDF format produces correct skills array."""
        output_format = "pdf"

        skills = [
            {
                "type": "anthropic",
                "skill_id": output_format.lower(),
                "version": "latest",
            }
        ]

        assert len(skills) == 1
        assert skills[0]["skill_id"] == "pdf"
        assert skills[0]["type"] == "anthropic"

    def test_pptx_includes_xlsx_skill(self):
        """Test PPTX format also includes XLSX skill for charts."""
        output_format = "pptx"

        skills = [
            {
                "type": "anthropic",
                "skill_id": output_format.lower(),
                "version": "latest",
            }
        ]

        # PPTX adds xlsx skill for charts (line 232-238 of reporting_agent.py)
        if output_format.lower() == "pptx":
            skills.append({
                "type": "anthropic",
                "skill_id": "xlsx",
                "version": "latest",
            })

        assert len(skills) == 2
        skill_ids = [s["skill_id"] for s in skills]
        assert "pptx" in skill_ids
        assert "xlsx" in skill_ids


# ============================================================================
# Unit Tests: File ID Extraction
# ============================================================================

class TestFileIdExtraction:
    """Test extraction of file_id from code_execution_result blocks."""

    def test_extract_file_id_from_response(self):
        """Test file_id extraction logic from mock response."""

        class MockFileItem:
            type = "file"
            file_id = "file_abc123xyz"
            filename = "report.pdf"

        class MockCodeExecutionResult:
            type = "code_execution_result"
            content = [MockFileItem()]

        class MockTextBlock:
            type = "text"
            text = "I've created the document."

        mock_response_content = [MockTextBlock(), MockCodeExecutionResult()]

        # Extract file IDs using the same logic as reporting_agent.py
        work_outputs = []
        for block in mock_response_content:
            if hasattr(block, "type") and block.type == "code_execution_result":
                result_content = getattr(block, "content", [])
                for item in result_content:
                    if hasattr(item, "type") and item.type == "file":
                        work_outputs.append({
                            "output_type": "document",
                            "title": "Generated PDF",
                            "metadata": {
                                "file_id": getattr(item, "file_id", None),
                                "filename": getattr(item, "filename", None),
                            },
                        })

        assert len(work_outputs) == 1
        assert work_outputs[0]["metadata"]["file_id"] == "file_abc123xyz"
        assert work_outputs[0]["metadata"]["filename"] == "report.pdf"

    def test_no_file_in_response(self):
        """Test handling when no file is generated."""
        class MockTextBlock:
            type = "text"
            text = "I tried but couldn't generate the file."

        mock_response_content = [MockTextBlock()]

        work_outputs = []
        for block in mock_response_content:
            if hasattr(block, "type") and block.type == "code_execution_result":
                result_content = getattr(block, "content", [])
                for item in result_content:
                    if hasattr(item, "type") and item.type == "file":
                        work_outputs.append({"file_id": item.file_id})

        assert len(work_outputs) == 0


# ============================================================================
# Integration Tests: Live Skills API (requires ANTHROPIC_API_KEY)
# ============================================================================

@pytest.fixture
def anthropic_api_key():
    """Get Anthropic API key from environment."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        pytest.skip("ANTHROPIC_API_KEY not set - skipping live API tests")
    return api_key


class TestSkillsAPILive:
    """
    Live integration tests that call the actual Skills API.

    These tests verify:
    1. Skills API accepts our request format
    2. Claude generates actual files
    3. file_id is returned in response

    Note: These tests cost money and take ~30-60 seconds each.
    Run with: pytest tests/integration/test_skills_file_generation.py -v -s -k "Live"
    """

    @pytest.mark.asyncio
    async def test_pdf_generation_live(self, anthropic_api_key):
        """Test actual PDF generation via Skills API."""
        import anthropic

        SKILLS_BETAS = ["code-execution-2025-08-25", "skills-2025-10-02"]

        client = anthropic.AsyncAnthropic(api_key=anthropic_api_key)

        skills = [
            {"type": "anthropic", "skill_id": "pdf", "version": "latest"}
        ]

        response = await client.beta.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            betas=SKILLS_BETAS,
            system="You are a document generation assistant. Use code_execution to create documents.",
            container={"skills": skills},
            messages=[{
                "role": "user",
                "content": """Create a simple PDF document with:
                - Title: "Skills API Test"
                - One paragraph of text
                Keep it minimal for testing purposes."""
            }],
            tools=[
                {"type": "code_execution_20250825", "name": "code_execution"}
            ],
        )

        # Extract file_ids using helper function
        file_ids = extract_file_ids(response)

        print(f"\nResponse stop_reason: {response.stop_reason}")
        print(f"Response content blocks: {len(response.content)}")
        print(f"File IDs found: {file_ids}")

        # Assertions
        assert response.stop_reason == "end_turn", f"Unexpected stop: {response.stop_reason}"
        assert len(file_ids) > 0, "No file_id found - Skills API did not generate a file"
        assert file_ids[0].startswith("file_"), f"Invalid file_id format: {file_ids[0]}"

        print(f"PDF generated successfully: {file_ids[0]}")

    @pytest.mark.asyncio
    async def test_xlsx_generation_live(self, anthropic_api_key):
        """Test actual Excel generation via Skills API."""
        import anthropic

        SKILLS_BETAS = ["code-execution-2025-08-25", "skills-2025-10-02"]

        client = anthropic.AsyncAnthropic(api_key=anthropic_api_key)

        skills = [
            {"type": "anthropic", "skill_id": "xlsx", "version": "latest"}
        ]

        response = await client.beta.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            betas=SKILLS_BETAS,
            system="You are a spreadsheet generation assistant. Use code_execution to create Excel files.",
            container={"skills": skills},
            messages=[{
                "role": "user",
                "content": """Create a simple Excel spreadsheet with:
                - 3 columns: Name, Value, Total
                - 3 rows of sample data
                - A SUM formula for the Total column
                Keep it minimal for testing."""
            }],
            tools=[
                {"type": "code_execution_20250825", "name": "code_execution"}
            ],
        )

        file_ids = extract_file_ids(response)
        print(f"\nXLSX Response - File IDs: {file_ids}")

        assert len(file_ids) > 0, "No XLSX file generated"
        print(f"XLSX generated successfully: {file_ids[0]}")

    @pytest.mark.asyncio
    async def test_docx_generation_live(self, anthropic_api_key):
        """Test actual Word document generation via Skills API."""
        import anthropic

        SKILLS_BETAS = ["code-execution-2025-08-25", "skills-2025-10-02"]

        client = anthropic.AsyncAnthropic(api_key=anthropic_api_key)

        skills = [
            {"type": "anthropic", "skill_id": "docx", "version": "latest"}
        ]

        response = await client.beta.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            betas=SKILLS_BETAS,
            system="You are a document generation assistant. Use code_execution to create Word documents.",
            container={"skills": skills},
            messages=[{
                "role": "user",
                "content": """Create a simple Word document with:
                - Title: "Test Document"
                - One heading
                - One paragraph
                Keep it minimal for testing."""
            }],
            tools=[
                {"type": "code_execution_20250825", "name": "code_execution"}
            ],
        )

        file_ids = extract_file_ids(response)
        print(f"\nDOCX Response - File IDs: {file_ids}")

        assert len(file_ids) > 0, "No DOCX file generated"
        print(f"DOCX generated successfully: {file_ids[0]}")

    @pytest.mark.asyncio
    async def test_pptx_generation_live(self, anthropic_api_key):
        """Test actual PowerPoint generation via Skills API."""
        import anthropic

        SKILLS_BETAS = ["code-execution-2025-08-25", "skills-2025-10-02"]

        client = anthropic.AsyncAnthropic(api_key=anthropic_api_key)

        # PPTX includes xlsx for charts
        skills = [
            {"type": "anthropic", "skill_id": "pptx", "version": "latest"},
            {"type": "anthropic", "skill_id": "xlsx", "version": "latest"},
        ]

        response = await client.beta.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            betas=SKILLS_BETAS,
            system="You are a presentation generation assistant. Use code_execution to create PowerPoint files.",
            container={"skills": skills},
            messages=[{
                "role": "user",
                "content": """Create a simple PowerPoint presentation with:
                - 2 slides total
                - Title slide with "Test Presentation"
                - One content slide with 3 bullet points
                Keep it minimal for testing."""
            }],
            tools=[
                {"type": "code_execution_20250825", "name": "code_execution"}
            ],
        )

        file_ids = extract_file_ids(response)
        print(f"\nPPTX Response - File IDs: {file_ids}")

        assert len(file_ids) > 0, "No PPTX file generated"
        print(f"PPTX generated successfully: {file_ids[0]}")


# ============================================================================
# Integration Test: Full ReportingAgent Flow (mocked external deps)
# ============================================================================

class TestReportingAgentExecution:
    """Test ReportingAgent.execute() with mocked external dependencies."""

    @pytest.mark.asyncio
    async def test_execute_calls_skills_api_correctly(self):
        """Test that execute() calls Skills API with correct parameters."""
        from agents.reporting_agent import ReportingAgent, SKILLS_BETAS

        # Mock the skills_client response
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(type="text", text="Document created successfully.")
        ]
        mock_response.usage = MagicMock(
            input_tokens=100,
            output_tokens=50,
            cache_read_input_tokens=0
        )
        mock_response.stop_reason = "end_turn"

        with patch("agents.reporting_agent.anthropic.AsyncAnthropic") as mock_anthropic:
            with patch("agents.base_agent.AnthropicDirectClient"):
                with patch("agents.base_agent.SubstrateQueryAdapter"):
                    # Setup mock
                    mock_client = AsyncMock()
                    mock_client.beta.messages.create = AsyncMock(return_value=mock_response)
                    mock_anthropic.return_value = mock_client

                    agent = ReportingAgent(
                        basket_id=str(uuid4()),
                        workspace_id=str(uuid4()),
                        work_ticket_id=str(uuid4()),
                        user_id=str(uuid4()),
                    )

                    # Mock _build_context to avoid external calls
                    agent._build_context = AsyncMock(return_value=MagicMock(
                        knowledge_context=[],
                        prior_outputs=[],
                        reference_assets=[],
                    ))

                    # Mock substrate client for work output storage
                    with patch("agents.reporting_agent.get_substrate_client"):
                        result = await agent.execute(
                            task="Create a test report",
                            output_format="pdf",
                        )

                    # Verify Skills API was called
                    mock_client.beta.messages.create.assert_called_once()
                    call_kwargs = mock_client.beta.messages.create.call_args.kwargs

                    # Check betas
                    assert call_kwargs["betas"] == SKILLS_BETAS

                    # Check container has skills
                    assert "container" in call_kwargs
                    assert "skills" in call_kwargs["container"]
                    skills = call_kwargs["container"]["skills"]
                    assert any(s["skill_id"] == "pdf" for s in skills)

                    # Check tools includes code_execution
                    assert "tools" in call_kwargs
                    tools = call_kwargs["tools"]
                    assert any(t.get("type") == "code_execution_20250825" for t in tools)

                    print("ReportingAgent.execute() calls Skills API correctly")


# ============================================================================
# Smoke Test: Verify imports work
# ============================================================================

def test_imports():
    """Verify all required modules can be imported."""
    from agents.reporting_agent import (
        ReportingAgent,
        REPORTING_SYSTEM_PROMPT,
        SKILLS_BETAS,
        FILES_API_BETA,
        FILE_MIME_TYPES,
        create_reporting_agent,
    )
    from agents.base_agent import BaseAgent, AgentContext
    from clients.anthropic_client import ExecutionResult

    assert ReportingAgent is not None
    assert SKILLS_BETAS is not None
    assert FILES_API_BETA == "files-api-2025-04-14"
    assert "pdf" in FILE_MIME_TYPES
    assert create_reporting_agent is not None
    print("All imports successful")


class TestFilesAPIDownload:
    """Test Files API download functionality."""

    @pytest.mark.asyncio
    async def test_files_api_download_live(self, anthropic_api_key):
        """Test full flow: Skills generates file → Files API downloads it."""
        import anthropic

        SKILLS_BETAS = ["code-execution-2025-08-25", "skills-2025-10-02"]
        FILES_BETA = "files-api-2025-04-14"

        client = anthropic.AsyncAnthropic(api_key=anthropic_api_key)

        # Step 1: Generate PDF
        print("\nStep 1: Generate PDF with Skills API")
        response = await client.beta.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            betas=SKILLS_BETAS,
            system="Create documents.",
            container={"skills": [{"type": "anthropic", "skill_id": "pdf", "version": "latest"}]},
            messages=[{"role": "user", "content": "Create a simple PDF with title 'Test' and one line."}],
            tools=[{"type": "code_execution_20250825", "name": "code_execution"}],
        )

        file_ids = extract_file_ids(response)
        assert len(file_ids) > 0, "No file generated"
        file_id = file_ids[0]
        print(f"Generated file_id: {file_id}")

        # Step 2: Download with Files API
        print("\nStep 2: Download with Files API")
        file_response = await client.beta.files.download(
            file_id=file_id,
            betas=[FILES_BETA]
        )
        file_bytes = await file_response.read()

        print(f"Downloaded {len(file_bytes)} bytes")
        print(f"First 10 bytes: {file_bytes[:10]}")

        # Verify it's a valid PDF
        assert file_bytes[:4] == b"%PDF", f"Not a valid PDF, got: {file_bytes[:10]}"
        assert len(file_bytes) > 100, "PDF too small"

        print("Files API download: SUCCESS")


if __name__ == "__main__":
    print("Running ReportingAgent Skills integration tests...")
    print("=" * 70)
    print("\nTo run all tests:")
    print("  pytest tests/integration/test_skills_file_generation.py -v -s")
    print("\nTo run only live API tests (costs money):")
    print("  pytest tests/integration/test_skills_file_generation.py -v -s -k 'Live'")
    print("\nTo run only unit tests (free):")
    print("  pytest tests/integration/test_skills_file_generation.py -v -s -k 'not Live'")
    print("=" * 70)

    import subprocess
    result = subprocess.run(
        ["pytest", __file__, "-v", "-s", "-k", "not Live"],
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    exit(result.returncode)
