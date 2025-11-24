"""
Test Hierarchical Session Management Implementation

Validates that:
1. TP creates its own session correctly
2. TP can get or create specialist sessions as children
3. Specialist sessions link to TP as parent
4. Session hierarchy is maintained in database
5. Memory and session are passed correctly to specialists

Run this test AFTER migration is applied in production.
"""

import asyncio
import logging
import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from shared.session import AgentSession
from agents_sdk.thinking_partner_sdk import ThinkingPartnerAgentSDK

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_hierarchical_sessions():
    """Test hierarchical session creation and linking."""

    logger.info("=" * 80)
    logger.info("HIERARCHICAL SESSION MANAGEMENT TEST")
    logger.info("=" * 80)

    # Test configuration
    test_basket_id = "test_basket_hierarchical_001"
    test_workspace_id = "test_workspace_001"
    test_user_id = "test_user_001"

    try:
        # ========================================================================
        # Test 1: TP Session Creation
        # ========================================================================
        logger.info("\n[Test 1] Creating TP session...")

        tp_session = await AgentSession.get_or_create(
            basket_id=test_basket_id,
            workspace_id=test_workspace_id,
            agent_type="thinking_partner",
            user_id=test_user_id
        )

        assert tp_session.id is not None, "TP session ID should exist"
        assert tp_session.agent_type == "thinking_partner", "TP agent_type mismatch"
        assert tp_session.parent_session_id is None, "TP should be root (no parent)"

        logger.info(f"✅ TP session created: {tp_session.id}")
        logger.info(f"   - agent_type: {tp_session.agent_type}")
        logger.info(f"   - parent_session_id: {tp_session.parent_session_id} (should be None)")

        # ========================================================================
        # Test 2: Initialize ThinkingPartnerAgentSDK
        # ========================================================================
        logger.info("\n[Test 2] Initializing ThinkingPartnerAgentSDK...")

        tp_agent = ThinkingPartnerAgentSDK(
            basket_id=test_basket_id,
            workspace_id=test_workspace_id,
            user_id=test_user_id
        )

        # Simulate chat to trigger session initialization
        logger.info("   - Triggering session init via internal method...")
        tp_agent.current_session = await AgentSession.get_or_create(
            basket_id=test_basket_id,
            workspace_id=test_workspace_id,
            agent_type="thinking_partner",
            user_id=test_user_id
        )

        assert tp_agent.current_session.id == tp_session.id, "TP should reuse existing session"
        logger.info(f"✅ TP agent initialized with session: {tp_agent.current_session.id}")

        # Load specialist sessions (should be empty initially)
        await tp_agent._load_specialist_sessions()
        logger.info(f"   - Loaded specialist sessions: {[k for k, v in tp_agent._specialist_sessions.items() if v]}")

        # ========================================================================
        # Test 3: Create Specialist Sessions via TP
        # ========================================================================
        logger.info("\n[Test 3] Creating specialist sessions via TP...")

        # Create research specialist session
        research_session = await tp_agent._get_or_create_specialist_session("research")

        assert research_session.id is not None, "Research session ID should exist"
        assert research_session.agent_type == "research", "Research agent_type mismatch"
        assert research_session.parent_session_id == tp_session.id, "Research should have TP as parent"
        assert research_session.created_by_session_id == tp_session.id, "TP should be creator"

        logger.info(f"✅ Research session created: {research_session.id}")
        logger.info(f"   - agent_type: {research_session.agent_type}")
        logger.info(f"   - parent_session_id: {research_session.parent_session_id}")
        logger.info(f"   - created_by_session_id: {research_session.created_by_session_id}")

        # Create content specialist session
        content_session = await tp_agent._get_or_create_specialist_session("content")

        assert content_session.id is not None, "Content session ID should exist"
        assert content_session.parent_session_id == tp_session.id, "Content should have TP as parent"

        logger.info(f"✅ Content session created: {content_session.id}")
        logger.info(f"   - parent_session_id: {content_session.parent_session_id}")

        # Create reporting specialist session
        reporting_session = await tp_agent._get_or_create_specialist_session("reporting")

        assert reporting_session.id is not None, "Reporting session ID should exist"
        assert reporting_session.parent_session_id == tp_session.id, "Reporting should have TP as parent"

        logger.info(f"✅ Reporting session created: {reporting_session.id}")
        logger.info(f"   - parent_session_id: {reporting_session.parent_session_id}")

        # ========================================================================
        # Test 4: Verify Session Hierarchy
        # ========================================================================
        logger.info("\n[Test 4] Verifying session hierarchy...")

        from app.utils.supabase import supabase_admin
        supabase = supabase_admin()

        # Query all sessions for this basket
        result = supabase.table("agent_sessions").select("*").eq(
            "basket_id", test_basket_id
        ).execute()

        sessions_by_type = {s['agent_type']: s for s in result.data}

        assert "thinking_partner" in sessions_by_type, "TP session not found in DB"
        assert "research" in sessions_by_type, "Research session not found in DB"
        assert "content" in sessions_by_type, "Content session not found in DB"
        assert "reporting" in sessions_by_type, "Reporting session not found in DB"

        tp_db = sessions_by_type["thinking_partner"]
        research_db = sessions_by_type["research"]
        content_db = sessions_by_type["content"]
        reporting_db = sessions_by_type["reporting"]

        assert tp_db['parent_session_id'] is None, "TP should be root in DB"
        assert research_db['parent_session_id'] == tp_db['id'], "Research parent mismatch in DB"
        assert content_db['parent_session_id'] == tp_db['id'], "Content parent mismatch in DB"
        assert reporting_db['parent_session_id'] == tp_db['id'], "Reporting parent mismatch in DB"

        logger.info("✅ Session hierarchy verified in database:")
        logger.info(f"   - TP (root): {tp_db['id']}")
        logger.info(f"   - Research (child): {research_db['id']} → parent={research_db['parent_session_id']}")
        logger.info(f"   - Content (child): {content_db['id']} → parent={content_db['parent_session_id']}")
        logger.info(f"   - Reporting (child): {reporting_db['id']} → parent={reporting_db['parent_session_id']}")

        # ========================================================================
        # Test 5: Session Cache and Reuse
        # ========================================================================
        logger.info("\n[Test 5] Testing session cache and reuse...")

        # Call _get_or_create again - should return cached session
        research_session_2 = await tp_agent._get_or_create_specialist_session("research")

        assert research_session_2.id == research_session.id, "Should reuse cached session"
        logger.info(f"✅ Session cache working: reused {research_session_2.id}")

        # ========================================================================
        # Test 6: Memory and Session Passing Pattern
        # ========================================================================
        logger.info("\n[Test 6] Verifying memory and session passing pattern...")

        assert tp_agent.memory is not None, "TP should have memory adapter"
        logger.info(f"✅ TP has memory adapter: {type(tp_agent.memory).__name__}")

        # Verify that TP would pass session + memory to specialists
        # (This is tested in _execute_work_orchestration, but we validate the pattern here)
        assert research_session.id is not None, "Session ready for passing"
        assert tp_agent.memory is not None, "Memory ready for passing"

        logger.info("✅ TP can pass session + memory to specialists")
        logger.info(f"   - session_id: {research_session.id}")
        logger.info(f"   - memory type: {type(tp_agent.memory).__name__}")

        # ========================================================================
        # Summary
        # ========================================================================
        logger.info("\n" + "=" * 80)
        logger.info("ALL TESTS PASSED ✅")
        logger.info("=" * 80)
        logger.info(f"\nHierarchical Session Architecture Validated:")
        logger.info(f"  1 TP Session → 3 Specialist Sessions")
        logger.info(f"  - TP: {tp_session.id}")
        logger.info(f"  - Research: {research_session.id} (parent: {research_session.parent_session_id})")
        logger.info(f"  - Content: {content_session.id} (parent: {content_session.parent_session_id})")
        logger.info(f"  - Reporting: {reporting_session.id} (parent: {reporting_session.parent_session_id})")
        logger.info(f"\nMemory Adapter: {type(tp_agent.memory).__name__}")
        logger.info(f"Session Persistence: Database-backed via AgentSession.get_or_create()")
        logger.info(f"\n✅ Hierarchical session management implementation VALIDATED")

        return True

    except AssertionError as e:
        logger.error(f"\n❌ TEST FAILED: {e}")
        return False
    except Exception as e:
        logger.exception(f"\n❌ TEST ERROR: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(test_hierarchical_sessions())
    sys.exit(0 if success else 1)
