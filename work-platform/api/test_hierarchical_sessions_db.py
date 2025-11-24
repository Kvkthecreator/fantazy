"""
Test Hierarchical Session Database Schema

Validates database schema for hierarchical sessions WITHOUT requiring SDK imports.
Tests the AgentSession model and database operations.

Safe to run locally (doesn't require Python 3.10+ or official Claude SDK).
"""

import asyncio
import logging
import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from shared.session import AgentSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_hierarchical_sessions_db():
    """Test hierarchical session database schema and operations."""

    logger.info("=" * 80)
    logger.info("HIERARCHICAL SESSION DATABASE SCHEMA TEST")
    logger.info("=" * 80)

    # Test configuration
    test_basket_id = "test_basket_hierarchical_db_001"
    test_workspace_id = "test_workspace_001"
    test_user_id = "test_user_001"

    try:
        # ========================================================================
        # Test 1: AgentSession Model Has New Fields
        # ========================================================================
        logger.info("\n[Test 1] Verifying AgentSession model has hierarchical fields...")

        session = AgentSession(
            workspace_id=test_workspace_id,
            basket_id=test_basket_id,
            agent_type="thinking_partner",
            parent_session_id=None,
            created_by_session_id=None
        )

        assert hasattr(session, 'parent_session_id'), "Missing parent_session_id field"
        assert hasattr(session, 'created_by_session_id'), "Missing created_by_session_id field"

        logger.info("✅ AgentSession model has hierarchical fields:")
        logger.info(f"   - parent_session_id: {session.parent_session_id}")
        logger.info(f"   - created_by_session_id: {session.created_by_session_id}")

        # ========================================================================
        # Test 2: TP Session Creation (Root)
        # ========================================================================
        logger.info("\n[Test 2] Creating TP session (root)...")

        tp_session = await AgentSession.get_or_create(
            basket_id=test_basket_id,
            workspace_id=test_workspace_id,
            agent_type="thinking_partner",
            user_id=test_user_id
        )

        assert tp_session.id is not None, "TP session ID should exist"
        assert tp_session.agent_type == "thinking_partner", "TP agent_type mismatch"
        assert tp_session.basket_id == test_basket_id, "TP basket_id mismatch"
        # parent_session_id and created_by_session_id should be None for TP (root)
        assert tp_session.parent_session_id is None, "TP should have parent_session_id=None (root)"

        logger.info(f"✅ TP session created: {tp_session.id}")
        logger.info(f"   - agent_type: {tp_session.agent_type}")
        logger.info(f"   - basket_id: {tp_session.basket_id}")
        logger.info(f"   - parent_session_id: {tp_session.parent_session_id} (root)")
        logger.info(f"   - created_by_session_id: {tp_session.created_by_session_id}")

        # ========================================================================
        # Test 3: Specialist Session Creation with Parent Link
        # ========================================================================
        logger.info("\n[Test 3] Creating specialist session with parent link...")

        # Create research session
        research_session = await AgentSession.get_or_create(
            basket_id=test_basket_id,
            workspace_id=test_workspace_id,
            agent_type="research",
            user_id=test_user_id
        )

        assert research_session.id is not None, "Research session ID should exist"
        assert research_session.agent_type == "research", "Research agent_type mismatch"

        # Manually link to TP (simulating what TP._get_or_create_specialist_session does)
        research_session.parent_session_id = tp_session.id
        research_session.created_by_session_id = tp_session.id
        await research_session.save()

        logger.info(f"✅ Research session created: {research_session.id}")
        logger.info(f"   - agent_type: {research_session.agent_type}")
        logger.info(f"   - parent_session_id: {research_session.parent_session_id} (linked to TP)")
        logger.info(f"   - created_by_session_id: {research_session.created_by_session_id}")

        # ========================================================================
        # Test 4: Verify Hierarchy in Database
        # ========================================================================
        logger.info("\n[Test 4] Verifying hierarchy in database...")

        from app.utils.supabase import supabase_admin
        supabase = supabase_admin()

        # Query sessions for this basket
        result = supabase.table("agent_sessions").select("*").eq(
            "basket_id", test_basket_id
        ).execute()

        sessions_by_type = {s['agent_type']: s for s in result.data}

        assert "thinking_partner" in sessions_by_type, "TP session not found in DB"
        assert "research" in sessions_by_type, "Research session not found in DB"

        tp_db = sessions_by_type["thinking_partner"]
        research_db = sessions_by_type["research"]

        # Verify TP is root
        assert tp_db['parent_session_id'] is None, "TP parent_session_id should be NULL in DB"

        # Verify research is child of TP
        assert research_db['parent_session_id'] == tp_db['id'], "Research parent_session_id mismatch in DB"
        assert research_db['created_by_session_id'] == tp_db['id'], "Research created_by_session_id mismatch in DB"

        logger.info("✅ Hierarchy verified in database:")
        logger.info(f"   - TP (root): {tp_db['id']}")
        logger.info(f"     * parent_session_id: {tp_db['parent_session_id']} (NULL)")
        logger.info(f"     * created_by_session_id: {tp_db.get('created_by_session_id')}")
        logger.info(f"   - Research (child): {research_db['id']}")
        logger.info(f"     * parent_session_id: {research_db['parent_session_id']} (→ TP)")
        logger.info(f"     * created_by_session_id: {research_db['created_by_session_id']} (→ TP)")

        # ========================================================================
        # Test 5: to_dict() Includes New Fields
        # ========================================================================
        logger.info("\n[Test 5] Verifying to_dict() includes hierarchical fields...")

        tp_dict = tp_session.to_dict()
        research_dict = research_session.to_dict()

        assert 'parent_session_id' in tp_dict, "to_dict() missing parent_session_id"
        assert 'created_by_session_id' in tp_dict, "to_dict() missing created_by_session_id"

        assert tp_dict['parent_session_id'] is None, "TP parent should be None in dict"
        assert research_dict['parent_session_id'] == tp_session.id, "Research parent mismatch in dict"

        logger.info("✅ to_dict() includes hierarchical fields:")
        logger.info(f"   - TP: parent={tp_dict['parent_session_id']}, created_by={tp_dict['created_by_session_id']}")
        logger.info(f"   - Research: parent={research_dict['parent_session_id']}, created_by={research_dict['created_by_session_id']}")

        # ========================================================================
        # Summary
        # ========================================================================
        logger.info("\n" + "=" * 80)
        logger.info("ALL DATABASE TESTS PASSED ✅")
        logger.info("=" * 80)
        logger.info(f"\nDatabase Schema Validated:")
        logger.info(f"  - agent_sessions.parent_session_id column exists")
        logger.info(f"  - agent_sessions.created_by_session_id column exists")
        logger.info(f"  - AgentSession model supports hierarchical fields")
        logger.info(f"  - AgentSession.to_dict() includes hierarchical fields")
        logger.info(f"  - Database operations work correctly")
        logger.info(f"\nHierarchy Test:")
        logger.info(f"  - TP session (root): {tp_session.id}")
        logger.info(f"  - Research session (child): {research_session.id} → parent: {research_session.parent_session_id}")
        logger.info(f"\n✅ Hierarchical session database schema VALIDATED")

        return True

    except AssertionError as e:
        logger.error(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        logger.exception(f"\n❌ TEST ERROR: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(test_hierarchical_sessions_db())
    sys.exit(0 if success else 1)
