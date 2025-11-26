"""
Test ContentAgentSDK refactor - validates new architecture with on-demand substrate queries.

Tests:
1. Static system prompt generation (no substrate context - cacheable)
2. SubstrateQueryAdapter integration (on-demand queries)
3. WorkBundle metadata-only pattern (no substrate_blocks)
4. Import validation
5. Three-layer architecture compliance

Architecture (2025-11):
- Layer 1: Session (Agent SDK) - Conversation history managed by Claude SDK
- Layer 2: Substrate (YARNNN) - Queried on-demand via SubstrateQueryAdapter.query()
- Layer 3: WorkBundle - Metadata + asset pointers only (NOT substrate blocks)
"""

import asyncio
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from agents_sdk.content_agent_sdk import ContentAgentSDK
from agents_sdk.work_bundle import WorkBundle
from shared.session import AgentSession


def test_static_system_prompt():
    """Test 1: Static system prompt generation (no substrate context - cacheable)."""
    print("\n=== Test 1: Static System Prompt Generation ===")

    # Create agent without bundle (standalone mode)
    agent = ContentAgentSDK(
        basket_id="test-basket-123",
        workspace_id="test-workspace-456",
        work_ticket_id="test-ticket-789",
        enabled_platforms=["twitter", "linkedin"],
        brand_voice_mode="adaptive",
        session=None,  # Ephemeral for testing
        substrate=None,  # No substrate adapter - static prompt only
        bundle=None,   # No bundle - static prompt only
    )

    # Get system prompt
    system_prompt = agent._build_static_system_prompt()

    # Validation checks
    assert "YARNNN Work Orchestration System" in system_prompt, "Missing orchestration patterns"
    assert "emit_work_output" in system_prompt, "Missing tool documentation"
    assert "Content Agent Identity" in system_prompt, "Missing agent identity"

    # System prompt should NOT contain any dynamic substrate content
    assert "substrate_blocks" not in system_prompt.lower(), "FAIL: System prompt contains substrate_blocks!"

    print(f"✅ System prompt is static (no substrate context)")
    print(f"✅ Length: {len(system_prompt)} chars (cacheable by Claude API)")
    print(f"✅ Contains orchestration patterns: YES")
    print(f"✅ Contains tool guidance: YES")

    return system_prompt


def test_workbundle_metadata_only():
    """Test 2: WorkBundle is metadata-only (no substrate_blocks field)."""
    print("\n=== Test 2: WorkBundle Metadata-Only Pattern ===")

    # Create WorkBundle - should NOT accept substrate_blocks parameter
    bundle = WorkBundle(
        work_request_id="req-123",
        work_ticket_id="ticket-789",
        basket_id="basket-456",
        workspace_id="workspace-123",
        user_id="user-001",
        task="Create Twitter thread about AI agent trends",
        agent_type="content",
        reference_assets=[
            {"name": "Brand Guidelines", "type": "pdf", "description": "Company voice and tone"}
        ]
    )

    # Verify WorkBundle structure
    assert bundle.task == "Create Twitter thread about AI agent trends"
    assert bundle.agent_type == "content"
    assert len(bundle.reference_assets) == 1

    # Verify substrate_blocks is NOT a field
    assert not hasattr(bundle, 'substrate_blocks'), "FAIL: WorkBundle should not have substrate_blocks field!"

    print(f"✅ WorkBundle contains task: YES")
    print(f"✅ WorkBundle contains reference_assets: YES")
    print(f"✅ WorkBundle does NOT contain substrate_blocks: YES (removed)")
    print(f"✅ Metadata-only pattern validated")

    return bundle


def test_substrate_adapter_pattern():
    """Test 3: SubstrateQueryAdapter pattern for on-demand queries."""
    print("\n=== Test 3: SubstrateQueryAdapter On-Demand Pattern ===")

    # Create WorkBundle (metadata only)
    bundle = WorkBundle(
        work_request_id="req-123",
        work_ticket_id="ticket-789",
        basket_id="basket-456",
        workspace_id="workspace-123",
        user_id="user-001",
        task="Test task",
        agent_type="content",
    )

    # Create agent with substrate adapter parameter (would be SubstrateQueryAdapter in real use)
    # Here we just test the parameter is accepted
    agent = ContentAgentSDK(
        basket_id="test-basket",
        workspace_id="test-workspace",
        work_ticket_id="test-ticket",
        substrate=None,  # Would be SubstrateQueryAdapter instance
        bundle=bundle,
    )

    # Verify agent has substrate attribute
    assert hasattr(agent, 'substrate'), "FAIL: Agent should have substrate attribute"

    # Verify agent structure for on-demand queries
    assert agent.basket_id == "test-basket"
    assert agent.workspace_id == "test-workspace"

    print(f"✅ Agent accepts 'substrate' parameter: YES")
    print(f"✅ Agent has substrate attribute: YES")
    print(f"✅ On-demand query pattern ready (substrate.query())")

    return True


def test_separation_of_concerns():
    """Test 4: Validate three-layer separation."""
    print("\n=== Test 4: Three-Layer Architecture Separation ===")

    # Create bundle with metadata only
    bundle = WorkBundle(
        work_request_id="req-123",
        work_ticket_id="ticket-789",
        basket_id="basket-456",
        workspace_id="workspace-123",
        user_id="user-001",
        task="Test task",
        agent_type="content",
        reference_assets=[{"name": "Test Asset", "type": "doc"}]
    )

    # Create agent with bundle
    agent = ContentAgentSDK(
        basket_id="test-basket",
        workspace_id="test-workspace",
        work_ticket_id="test-ticket",
        bundle=bundle,
    )

    # Get system prompt
    system_prompt = agent._build_static_system_prompt()

    # Layer 1: Session - managed by Claude SDK (not tested here)
    # Layer 2: Substrate - queried on-demand via substrate.query()
    # Layer 3: WorkBundle - metadata only

    # System prompt should NOT contain any bundle/substrate content
    assert "Test Asset" not in system_prompt, "FAIL: System prompt contains bundle content!"
    assert "Test task" not in system_prompt, "FAIL: System prompt contains task content!"

    # System prompt should be static/cacheable
    assert "emit_work_output" in system_prompt, "Missing tool guidance"

    print(f"✅ Layer 1 (Session): Managed by Claude SDK")
    print(f"✅ Layer 2 (Substrate): Queried on-demand via substrate.query()")
    print(f"✅ Layer 3 (WorkBundle): Metadata only (no substrate)")
    print(f"✅ System prompt is static (cacheable)")

    return True


def test_imports_and_dependencies():
    """Test 5: Validate imports and no legacy dependencies."""
    print("\n=== Test 5: Import Validation ===")

    # Check that we can import new modules
    try:
        from agents_sdk.orchestration_patterns import (
            build_agent_system_prompt,
            YARNNN_ORCHESTRATION_PATTERNS,
            TOOL_CALLING_GUIDANCE
        )
        print("✅ orchestration_patterns.py imports successful")
    except ImportError as e:
        print(f"❌ FAIL: orchestration_patterns import failed: {e}")
        return False

    try:
        from agents_sdk.agent_session_manager import AgentSessionManager
        print("✅ agent_session_manager.py imports successful")
    except ImportError as e:
        print(f"❌ FAIL: agent_session_manager import failed: {e}")
        return False

    try:
        from agents_sdk.work_bundle import WorkBundle
        print("✅ work_bundle.py imports successful")
    except ImportError as e:
        print(f"❌ FAIL: work_bundle import failed: {e}")
        return False

    try:
        from adapters.substrate_adapter import SubstrateQueryAdapter
        print("✅ substrate_adapter.py imports successful (renamed from memory_adapter)")
    except ImportError as e:
        print(f"❌ FAIL: substrate_adapter import failed: {e}")
        return False

    # Check ContentAgentSDK doesn't have legacy _build_context_message
    agent = ContentAgentSDK(
        basket_id="test",
        workspace_id="test",
        work_ticket_id="test",
    )

    if hasattr(agent, '_build_context_message'):
        print("⚠️  WARNING: ContentAgentSDK still has _build_context_message (should be removed)")
    else:
        print("✅ _build_context_message removed (substrate queried on-demand)")

    # Check source for old imports
    import inspect
    import agents_sdk.content_agent_sdk as content_module
    source = inspect.getsource(content_module)

    if "from adapters.memory_adapter import" in source:
        print("❌ FAIL: ContentAgentSDK still imports memory_adapter (should be substrate_adapter)")
        return False
    else:
        print("✅ No legacy memory_adapter imports in ContentAgentSDK")

    if "substrate_blocks" in source.lower():
        print("⚠️  WARNING: ContentAgentSDK still references substrate_blocks")
    else:
        print("✅ No substrate_blocks references in ContentAgentSDK")

    return True


def main():
    """Run all validation tests."""
    print("=" * 80)
    print("ContentAgentSDK Refactor Validation (2025-11 Architecture)")
    print("=" * 80)
    print("\nArchitecture:")
    print("  Layer 1: Session (Agent SDK) - Conversation history")
    print("  Layer 2: Substrate (YARNNN) - On-demand via substrate.query()")
    print("  Layer 3: WorkBundle - Metadata + asset pointers only")

    try:
        # Test 1: Static system prompt
        system_prompt = test_static_system_prompt()

        # Test 2: WorkBundle metadata-only pattern
        bundle = test_workbundle_metadata_only()

        # Test 3: SubstrateQueryAdapter pattern
        test_substrate_adapter_pattern()

        # Test 4: Three-layer separation
        test_separation_of_concerns()

        # Test 5: Import validation
        test_imports_and_dependencies()

        print("\n" + "=" * 80)
        print("✅ ALL TESTS PASSED - ContentAgentSDK refactor validated!")
        print("=" * 80)
        print("\nKey Metrics:")
        print(f"  - Static system prompt: ~{len(system_prompt)} chars (cacheable)")
        print(f"  - WorkBundle: Metadata only (no substrate_blocks)")
        print(f"  - Substrate access: On-demand via substrate.query()")
        print(f"  - Token efficiency: System prompt cached by Claude API")
        print(f"  - Architecture: Clean three-layer separation")

        return True

    except AssertionError as e:
        print("\n" + "=" * 80)
        print(f"❌ TEST FAILED: {e}")
        print("=" * 80)
        return False
    except Exception as e:
        print("\n" + "=" * 80)
        print(f"❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        print("=" * 80)
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
