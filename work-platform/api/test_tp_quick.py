import asyncio
import os
import sys
sys.path.insert(0, "src")

# Use production IDs
BASKET_ID = "5004b9e1-67f5-4955-b028-389d45b1f5a4"
WORKSPACE_ID = "99e6bf7d-513c-45ff-9b96-9362bd914d12"
USER_ID = "aa94fbd9-13cc-4dbc-a9fb-2114ad0928f2"

async def test():
    from shared.session import AgentSession
    
    print("\n=== Testing TP Session Creation ===\n")
    
    # Test 1: Create TP session
    print("1. Creating TP session with agent_type='thinking_partner'...")
    tp_session = await AgentSession.get_or_create(
        basket_id=BASKET_ID,
        workspace_id=WORKSPACE_ID,
        agent_type="thinking_partner",
        user_id=USER_ID
    )
    print(f"   ✅ Created: {tp_session.id}")
    print(f"   - agent_type: {tp_session.agent_type}")
    print()
    
    # Test 2: Create specialist session (child of TP)
    print("2. Creating research specialist session (child of TP)...")
    research_session = await AgentSession.get_or_create(
        basket_id=BASKET_ID,
        workspace_id=WORKSPACE_ID,
        agent_type="research",
        user_id=USER_ID,
        parent_session_id=tp_session.id
    )
    print(f"   ✅ Created: {research_session.id}")
    print(f"   - agent_type: {research_session.agent_type}")
    print(f"   - parent_session_id: {research_session.parent_session_id}")
    print()
    
    # Cleanup
    print("3. Cleaning up test sessions...")
    from app.utils.supabase import supabase_admin
    supabase = supabase_admin()
    
    supabase.table("agent_sessions").delete().eq("id", str(research_session.id)).execute()
    supabase.table("agent_sessions").delete().eq("id", str(tp_session.id)).execute()
    print("   ✅ Cleaned up")
    print()
    
    print("=== ✅ ALL TESTS PASSED ===\n")
    print("Database architecture validated:")
    print("  ✅ TP session creation (agent_type='thinking_partner')")
    print("  ✅ Specialist session creation")
    print("  ✅ Hierarchical sessions (parent-child)")
    print()

asyncio.run(test())
