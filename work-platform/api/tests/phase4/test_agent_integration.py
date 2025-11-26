"""
End-to-end agent integration tests.

Phase 4: Tests that agents can be created and execute with adapters.
"""

import pytest
from unittest.mock import Mock, patch
from uuid import uuid4
import os

# Set test environment variables
os.environ["ANTHROPIC_API_KEY"] = "test_key"
os.environ["SUBSTRATE_API_URL"] = "http://test-substrate"

# Import agent factory
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../src"))

from agents.factory import load_agent_config


class TestAgentFactory:
    """Test agent factory creates agents with adapters."""

    def test_load_agent_config_research(self):
        """Test loading research agent config."""
        config = load_agent_config("research")

        assert "agent" in config
        assert "research" in config
        assert config["agent"]["id"] is not None

    def test_load_agent_config_content(self):
        """Test loading content agent config."""
        config = load_agent_config("content")

        assert "agent" in config
        assert "content" in config
        assert config["agent"]["id"] is not None

    def test_load_agent_config_reporting(self):
        """Test loading reporting agent config."""
        config = load_agent_config("reporting")

        assert "agent" in config
        assert "reporting" in config
        assert config["agent"]["id"] is not None

    def test_load_agent_config_invalid(self):
        """Test loading invalid config raises error."""
        with pytest.raises(FileNotFoundError):
            load_agent_config("nonexistent")

    @patch('agents.factory.SDK_AVAILABLE', True)
    @patch('agents.factory.SubstrateQueryAdapter')
    @patch('agents.factory.SubstrateGovernanceAdapter')
    @patch('claude_agent_sdk.archetypes.ResearchAgent')
    def test_create_research_agent_with_adapters(
        self,
        mock_agent_class,
        mock_governance,
        mock_substrate,
    ):
        """Test research agent is created with substrate adapters."""
        # Need to reload module to pick up mocked SDK_AVAILABLE
        import importlib
        import agents.factory
        importlib.reload(agents.factory)
        from agents.factory import create_research_agent

        basket_id = str(uuid4())
        workspace_id = "ws_test_123"

        # Create agent
        agent = create_research_agent(basket_id=basket_id, workspace_id=workspace_id, user_id="user_123")

        # Verify adapters were created
        mock_substrate.assert_called_once_with(basket_id=basket_id, workspace_id=workspace_id)
        mock_governance.assert_called_once_with(basket_id=basket_id, workspace_id=workspace_id, user_id="user_123")

        # Verify agent was created with adapters
        mock_agent_class.assert_called_once()
        call_args = mock_agent_class.call_args[1]
        assert call_args["substrate"] is not None
        assert call_args["governance"] is not None
        assert call_args["anthropic_api_key"] == "test_key"

    @patch('agents.factory.SDK_AVAILABLE', True)
    @patch('agents.factory.SubstrateQueryAdapter')
    @patch('agents.factory.SubstrateGovernanceAdapter')
    @patch('agents.factory.ContentCreatorAgent')
    def test_create_content_agent_with_adapters(
        self,
        mock_agent_class,
        mock_governance,
        mock_substrate,
    ):
        """Test content agent is created with substrate adapters."""
        from agents.factory import create_content_agent

        basket_id = str(uuid4())
        workspace_id = "ws_test_123"

        # Create agent
        agent = create_content_agent(basket_id=basket_id, workspace_id=workspace_id, user_id="user_123")

        # Verify adapters were created
        mock_substrate.assert_called_once_with(basket_id=basket_id, workspace_id=workspace_id)
        mock_governance.assert_called_once_with(basket_id=basket_id, workspace_id=workspace_id, user_id="user_123")

        # Verify agent was created with adapters
        mock_agent_class.assert_called_once()

    @patch('agents.factory.SDK_AVAILABLE', True)
    @patch('agents.factory.SubstrateQueryAdapter')
    @patch('agents.factory.SubstrateGovernanceAdapter')
    @patch('agents.factory.ReportingAgent')
    def test_create_reporting_agent_with_adapters(
        self,
        mock_agent_class,
        mock_governance,
        mock_substrate,
    ):
        """Test reporting agent is created with substrate adapters."""
        from agents.factory import create_reporting_agent

        basket_id = str(uuid4())
        workspace_id = "ws_test_123"

        # Create agent
        agent = create_reporting_agent(basket_id=basket_id, workspace_id=workspace_id, user_id="user_123")

        # Verify adapters were created
        mock_substrate.assert_called_once_with(basket_id=basket_id, workspace_id=workspace_id)
        mock_governance.assert_called_once_with(basket_id=basket_id, workspace_id=workspace_id, user_id="user_123")

        # Verify agent was created with adapters
        mock_agent_class.assert_called_once()

    def test_create_agent_without_api_key_raises_error(self):
        """Test creating agent without API key raises error."""
        from agents.factory import create_research_agent

        # Remove API key
        old_key = os.environ.get("ANTHROPIC_API_KEY")
        if "ANTHROPIC_API_KEY" in os.environ:
            del os.environ["ANTHROPIC_API_KEY"]

        try:
            with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
                create_research_agent(basket_id=str(uuid4()), workspace_id="ws_test_123")
        finally:
            # Restore API key
            if old_key:
                os.environ["ANTHROPIC_API_KEY"] = old_key


class TestPhase4Architecture:
    """Test Phase 4 architecture compliance."""

    def test_adapters_use_substrate_client(self):
        """Test adapters import and use substrate_client."""
        from adapters.substrate_adapter import SubstrateQueryAdapter
        from adapters.governance_adapter import SubstrateGovernanceAdapter

        # Both adapters should use get_substrate_client
        # This is verified by checking their __init__ methods
        basket_id = str(uuid4())
        workspace_id = "ws_test_123"

        with patch('adapters.substrate_adapter.get_substrate_client') as mock_sub:
            SubstrateQueryAdapter(basket_id=basket_id, workspace_id=workspace_id)
            mock_sub.assert_called_once()

        with patch('adapters.governance_adapter.get_substrate_client') as mock_gov:
            SubstrateGovernanceAdapter(basket_id=basket_id, workspace_id=workspace_id)
            mock_gov.assert_called_once()

    def test_auth_adapter_uses_infra_jwt(self):
        """Test auth adapter imports from infra.utils.jwt."""
        from adapters.auth_adapter import AuthAdapter

        # AuthAdapter should have methods that use infra/utils/jwt
        assert hasattr(AuthAdapter, 'verify_token')
        assert hasattr(AuthAdapter, 'decode_token')
        assert hasattr(AuthAdapter, 'get_user_id')
        assert hasattr(AuthAdapter, 'get_workspace_id')

    def test_no_direct_db_access_in_adapters(self):
        """Test adapters don't import supabase_client directly."""
        import adapters.substrate_adapter as sub_adapter
        import adapters.governance_adapter as gov_adapter

        # Adapters should NOT import supabase_client
        # They should only use substrate_client (HTTP)
        sub_source = open(sub_adapter.__file__).read()
        gov_source = open(gov_adapter.__file__).read()

        assert "supabase_client" not in sub_source
        assert "supabase_client" not in gov_source
        assert "substrate_client" in sub_source
        assert "substrate_client" in gov_source
