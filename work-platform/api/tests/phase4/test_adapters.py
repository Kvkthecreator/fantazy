"""
Test adapter layer for Claude Agent SDK integration.

Phase 4: Tests that adapters correctly bridge SDK interfaces → substrate_client.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from uuid import uuid4

# Import adapters
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))

from adapters.substrate_adapter import SubstrateQueryAdapter
from adapters.governance_adapter import SubstrateGovernanceAdapter
from adapters.auth_adapter import AuthAdapter


class TestSubstrateQueryAdapter:
    """Test substrate query adapter bridges SDK → substrate_client."""

    @pytest.fixture
    def mock_substrate_client(self):
        """Mock substrate_client for testing."""
        with patch('adapters.substrate_adapter.get_substrate_client') as mock:
            yield mock.return_value

    def test_initialization(self, mock_substrate_client):
        """Test adapter can be initialized."""
        basket_id = str(uuid4())
        workspace_id = "ws_test_123"
        adapter = SubstrateQueryAdapter(basket_id=basket_id, workspace_id=workspace_id)

        assert adapter.basket_id == basket_id
        assert adapter.workspace_id == workspace_id
        assert adapter.client is not None

    @pytest.mark.asyncio
    async def test_query_calls_substrate_client(self, mock_substrate_client):
        """Test query() calls substrate_client.get_basket_blocks()."""
        basket_id = str(uuid4())
        workspace_id = "ws_test_123"
        adapter = SubstrateQueryAdapter(basket_id=basket_id, workspace_id=workspace_id)

        # Mock substrate client response
        mock_substrate_client.get_basket_blocks.return_value = [
            {
                "id": "block_1",
                "title": "Test Block",
                "body": "Test content",
                "state": "ACCEPTED",
                "semantic_type": "knowledge"
            }
        ]

        # Query
        results = await adapter.query("test query", limit=10)

        # Verify substrate_client was called
        mock_substrate_client.get_basket_blocks.assert_called_once_with(
            basket_id=basket_id,
            states=["ACCEPTED", "LOCKED"],
            limit=10
        )

        # Verify results converted to Context format
        assert len(results) == 1
        # Context object should have content and metadata attributes
        result = results[0]
        assert hasattr(result, 'content')
        assert hasattr(result, 'metadata')
        assert "Test Block" in result.content
        assert result.metadata["id"] == "block_1"

    @pytest.mark.asyncio
    async def test_store_calls_substrate_client(self, mock_substrate_client):
        """Test store() calls substrate_client.create_dump()."""
        basket_id = str(uuid4())
        workspace_id = "ws_test_123"
        adapter = SubstrateQueryAdapter(basket_id=basket_id, workspace_id=workspace_id)

        # Mock substrate client response
        mock_substrate_client.create_dump.return_value = {"id": "dump_123"}

        # Create mock Context
        from adapters.substrate_adapter import Context
        context = Context(
            content="Test content",
            metadata={"type": "test"}
        )

        # Store
        result_id = await adapter.store(context)

        # Verify substrate_client was called
        mock_substrate_client.create_dump.assert_called_once_with(
            basket_id=basket_id,
            content="Test content",
            metadata={"type": "test"}
        )

        assert result_id == "dump_123"

    @pytest.mark.asyncio
    async def test_get_all_calls_query(self, mock_substrate_client):
        """Test get_all() calls query() with large limit."""
        basket_id = str(uuid4())
        workspace_id = "ws_test_123"
        adapter = SubstrateQueryAdapter(basket_id=basket_id, workspace_id=workspace_id)

        # Mock substrate client response
        mock_substrate_client.get_basket_blocks.return_value = []

        # Get all
        await adapter.get_all()

        # Verify substrate_client was called with large limit
        mock_substrate_client.get_basket_blocks.assert_called_once()
        call_args = mock_substrate_client.get_basket_blocks.call_args
        assert call_args[1]["limit"] == 10000


class TestSubstrateGovernanceAdapter:
    """Test governance adapter bridges SDK → substrate_client."""

    @pytest.fixture
    def mock_substrate_client(self):
        """Mock substrate_client for testing."""
        with patch('adapters.governance_adapter.get_substrate_client') as mock:
            yield mock.return_value

    def test_initialization(self, mock_substrate_client):
        """Test adapter can be initialized."""
        basket_id = str(uuid4())
        workspace_id = "ws_test_123"
        user_id = "user_123"
        adapter = SubstrateGovernanceAdapter(basket_id=basket_id, workspace_id=workspace_id, user_id=user_id)

        assert adapter.basket_id == basket_id
        assert adapter.workspace_id == workspace_id
        assert adapter.user_id == user_id
        assert adapter.client is not None

    @pytest.mark.asyncio
    async def test_propose_change_calls_substrate_client(self, mock_substrate_client):
        """Test propose_change() calls substrate_client.initiate_work()."""
        basket_id = str(uuid4())
        workspace_id = "ws_test_123"
        adapter = SubstrateGovernanceAdapter(basket_id=basket_id, workspace_id=workspace_id)

        # Mock substrate client response
        mock_substrate_client.initiate_work.return_value = {"work_id": "work_123"}

        # Propose change
        proposal_id = await adapter.propose_change(
            change_type="add_block",
            data={"title": "New Block", "body": "Content"},
            confidence=0.8
        )

        # Verify substrate_client was called
        mock_substrate_client.initiate_work.assert_called_once()
        call_args = mock_substrate_client.initiate_work.call_args
        assert call_args[1]["basket_id"] == basket_id
        assert call_args[1]["work_mode"] == "governance_proposal"
        assert call_args[1]["payload"]["confidence"] == 0.8

        assert proposal_id == "work_123"

    @pytest.mark.asyncio
    async def test_check_approval_calls_substrate_client(self, mock_substrate_client):
        """Test check_approval() calls substrate_client.get_work_status()."""
        basket_id = str(uuid4())
        workspace_id = "ws_test_123"
        adapter = SubstrateGovernanceAdapter(basket_id=basket_id, workspace_id=workspace_id)

        # Mock substrate client response
        mock_substrate_client.get_work_status.return_value = {"status": "approved"}

        # Check approval
        is_approved = await adapter.check_approval("work_123")

        # Verify substrate_client was called
        mock_substrate_client.get_work_status.assert_called_once_with(work_id="work_123")

        assert is_approved is True

    @pytest.mark.asyncio
    async def test_check_approval_false_for_pending(self, mock_substrate_client):
        """Test check_approval() returns False for pending status."""
        basket_id = str(uuid4())
        workspace_id = "ws_test_123"
        adapter = SubstrateGovernanceAdapter(basket_id=basket_id, workspace_id=workspace_id)

        # Mock substrate client response
        mock_substrate_client.get_work_status.return_value = {"status": "pending"}

        # Check approval
        is_approved = await adapter.check_approval("work_123")

        assert is_approved is False


class TestAuthAdapter:
    """Test auth adapter uses Phase 1-3 infrastructure."""

    @patch('adapters.auth_adapter.decode_jwt')
    def test_get_user_id_extracts_from_token(self, mock_decode):
        """Test get_user_id() extracts user ID from JWT."""
        mock_decode.return_value = {"sub": "user_123"}

        user_id = AuthAdapter.get_user_id("fake_token")

        assert user_id == "user_123"
        mock_decode.assert_called_once_with("fake_token")

    @patch('adapters.auth_adapter.decode_jwt')
    def test_get_workspace_id_extracts_from_token(self, mock_decode):
        """Test get_workspace_id() extracts workspace ID from JWT."""
        mock_decode.return_value = {"workspace_id": "ws_456"}

        workspace_id = AuthAdapter.get_workspace_id("fake_token")

        assert workspace_id == "ws_456"
        mock_decode.assert_called_once_with("fake_token")

    def test_extract_from_header_bearer_format(self):
        """Test extract_from_header() handles Bearer format."""
        token = AuthAdapter.extract_from_header("Bearer abc123")

        assert token == "abc123"

    def test_extract_from_header_direct_token(self):
        """Test extract_from_header() handles direct token."""
        # Token must be >20 characters
        long_token = "abc123def456ghi789jkl012"
        token = AuthAdapter.extract_from_header(long_token)

        assert token == long_token

    def test_extract_from_header_none(self):
        """Test extract_from_header() handles None."""
        token = AuthAdapter.extract_from_header(None)

        assert token is None
