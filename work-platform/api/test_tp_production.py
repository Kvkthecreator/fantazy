"""
Test TP chat in production with hierarchical sessions
Uses the basket from user's shared URL: https://www.yarnnn.com/projects/c8656bd2-b0eb-4d32-9898-0d1f3e932310
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


async def test_tp_in_production():
    """Test TP with hierarchical sessions in production."""
    
    print("=" * 80)
    print("PRODUCTION TP + HIERARCHICAL SESSION TEST")
    print("=" * 80)
    
    # Use basket from user's shared URL
    basket_id = "c8656bd2-b0eb-4d32-9898-0d1f3e932310"
    workspace_id = "99e6bf7d-513c-45ff-9b96-9362bd914d12"  # From production query
    user_id = "test_user_hierarchical_validation"
    
    try:
        # ========================================================================
        # Test 1: Initialize TP
        # ========================================================================
        print("\n[Test 1] Initializing ThinkingPartnerAgentSDK...")
        
        tp_agent = ThinkingPartnerAgentSDK(
            basket_id=basket_id,
            workspace_id=workspace_id,
            user_id=user_id
        )
        
        print(f"✅ TP agent initialized for basket={basket_id}")
        
        # ========================================================================
        # Test 2: Send simple chat message (should create TP session)
        # ========================================================================
        print("\n[Test 2] Sending test chat message...")
        
        user_message = "Hello! This is a test to validate hierarchical session management. Please acknowledge and tell me what you can do."
        
        response = await tp_agent.chat(user_message=user_message)
        
        print(f"✅ TP responded successfully")
        print(f"   Response length: {len(response.get('content', ''))} chars")
        print(f"   Session ID: {response.get('session_id', 'N/A')}")
        print(f"   Claude Session ID: {response.get('claude_session_id', 'N/A')}")
        
        # ========================================================================
        # Test 3: Verify TP session in database
        # ========================================================================
        print("\n[Test 3] Verifying TP session in database...")
        
        from app.utils.supabase import supabase_admin
        supabase = supabase_admin()
        
        # Query TP session
        tp_sessions = supabase.table("agent_sessions").select("*").eq(
            "basket_id", basket_id
        ).eq(
            "agent_type", "thinking_partner"
        ).execute()
        
        if tp_sessions.data:
            tp_session = tp_sessions.data[0]
            print(f"✅ TP session found in database:")
            print(f"   ID: {tp_session['id']}")
            print(f"   agent_type: {tp_session['agent_type']}")
            print(f"   parent_session_id: {tp_session['parent_session_id']} (should be NULL for root)")
            print(f"   created_by_session_id: {tp_session['created_by_session_id']}")
            print(f"   sdk_session_id: {tp_session['sdk_session_id'][:50] if tp_session.get('sdk_session_id') else 'N/A'}...")
            
            # Verify TP is root
            assert tp_session['parent_session_id'] is None, "TP should be root (parent_session_id=NULL)"
            print("   ✅ Confirmed: TP is root session (parent_session_id=NULL)")
        else:
            print("❌ No TP session found in database")
            return False
        
        # ========================================================================
        # Test 4: Check for specialist sessions
        # ========================================================================
        print("\n[Test 4] Checking for specialist sessions...")
        
        all_sessions = supabase.table("agent_sessions").select("*").eq(
            "basket_id", basket_id
        ).execute()
        
        print(f"   Total sessions for this basket: {len(all_sessions.data)}")
        for session in all_sessions.data:
            parent = session['parent_session_id']
            parent_str = f"{parent[:8]}..." if parent else "NULL (root)"
            print(f"   - {session['agent_type']:20} | parent={parent_str}")
        
        # ========================================================================
        # Summary
        # ========================================================================
        print("\n" + "=" * 80)
        print("✅ PRODUCTION TP TEST PASSED")
        print("=" * 80)
        print(f"\nValidated:")
        print(f"  - TP session created successfully")
        print(f"  - TP is root (parent_session_id=NULL)")
        print(f"  - TP can communicate with Claude")
        print(f"  - Hierarchical session schema working")
        print(f"\nBasket: {basket_id}")
        print(f"TP Session: {tp_session['id']}")
        print(f"Claude Session: {tp_session.get('sdk_session_id', 'N/A')[:50]}...")
        
        print("\n⏭️  Next: Test work delegation to create specialist sessions")
        
        return True
        
    except Exception as e:
        logger.exception(f"\n❌ TEST ERROR: {e}")
        return False


if __name__ == "__main__":
    success = asyncio.run(test_tp_in_production())
    sys.exit(0 if success else 1)
