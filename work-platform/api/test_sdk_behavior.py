"""
Test script to understand actual Claude Agent SDK behavior.

This script tests:
1. How to retrieve session_id from SDK client
2. How tool results are returned in messages
3. Message structure from receive_response()
4. How web_search tool should be defined

Run: ANTHROPIC_API_KEY=your_key python test_sdk_behavior.py
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from shared.work_output_tools import EMIT_WORK_OUTPUT_TOOL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_basic_session():
    """Test 1: Basic session and message structure."""
    print("\n" + "="*80)
    print("TEST 1: Basic Session & Message Structure")
    print("="*80)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ANTHROPIC_API_KEY not set")
        return None

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        system_prompt="You are a helpful assistant.",
        max_tokens=100,
    )

    session_info = {}

    try:
        async with ClaudeSDKClient(api_key=api_key, options=options) as client:
            print("\n1. Starting new session...")
            await client.connect()
            await client.query("Say 'Hello' in exactly one word.")

            print("\n2. Receiving messages...")
            message_count = 0
            async for message in client.receive_response():
                message_count += 1
                print(f"\n--- Message {message_count} ---")
                print(f"Type: {type(message).__name__}")

                # Check message structure
                if hasattr(message, 'content'):
                    print(f"✅ Has 'content' attribute")
                    if isinstance(message.content, list):
                        print(f"   content is list with {len(message.content)} blocks")
                        for i, block in enumerate(message.content):
                            print(f"   Block {i}: {type(block).__name__}")
                            if hasattr(block, 'type'):
                                print(f"      type = {block.type}")
                            if hasattr(block, 'text'):
                                print(f"      text = '{block.text}'")

            print("\n3. Checking session_id after client closes...")
            # Try different methods to get session_id
            methods = [
                ('client.session_id', lambda: client.session_id),
                ('client._session_id', lambda: client._session_id),
                ("getattr(client, 'session_id', None)", lambda: getattr(client, 'session_id', None)),
            ]

            for method_name, method_func in methods:
                try:
                    result = method_func()
                    print(f"✅ {method_name} = {result}")
                    session_info['method'] = method_name
                    session_info['session_id'] = result
                    break
                except AttributeError as e:
                    print(f"❌ {method_name}: AttributeError - {e}")
                except Exception as e:
                    print(f"❌ {method_name}: {type(e).__name__} - {e}")

        return session_info

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def test_tool_use():
    """Test 2: Tool use and tool results."""
    print("\n" + "="*80)
    print("TEST 2: Tool Use & Results")
    print("="*80)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ANTHROPIC_API_KEY not set")
        return

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        system_prompt="You are a research assistant. Use emit_work_output to record your findings.",
        tools=[EMIT_WORK_OUTPUT_TOOL],
        max_tokens=500,
    )

    try:
        async with ClaudeSDKClient(api_key=api_key, options=options) as client:
            await client.connect()
            print("\n1. Asking agent to use emit_work_output tool...")
            await client.query("""
Please emit a work output with the following details:
- output_type: "finding"
- title: "Test Finding"
- body: "This is a test work output from the SDK."
- confidence: 0.9

Use the emit_work_output tool to do this.
            """)

            print("\n2. Processing response...")
            found_tool_use = False
            found_tool_result = False

            async for message in client.receive_response():
                if hasattr(message, 'content') and isinstance(message.content, list):
                    for i, block in enumerate(message.content):
                        print(f"\n--- Block {i} ---")
                        print(f"Type: {type(block).__name__}")

                        if hasattr(block, 'type'):
                            print(f"block.type = {block.type}")

                            if block.type == 'tool_use':
                                found_tool_use = True
                                print("✅ TOOL USE DETECTED")
                                if hasattr(block, 'name'):
                                    print(f"   tool name = {block.name}")
                                if hasattr(block, 'input'):
                                    print(f"   tool input = {block.input}")

                            elif block.type == 'tool_result':
                                found_tool_result = True
                                print("✅ TOOL RESULT DETECTED")
                                if hasattr(block, 'content'):
                                    print(f"   result content = {block.content}")
                                if hasattr(block, 'is_error'):
                                    print(f"   is_error = {block.is_error}")

                            elif block.type == 'text':
                                if hasattr(block, 'text'):
                                    print(f"   text = {block.text[:100]}...")

            print("\n3. Summary:")
            print(f"   Tool use detected: {found_tool_use}")
            print(f"   Tool result detected: {found_tool_result}")

            if not found_tool_use:
                print("\n⚠️  Agent did not use the tool. May need to adjust prompt or tool definition.")
            if not found_tool_result:
                print("\n⚠️  No tool results received. SDK may handle tool execution differently.")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


async def test_web_search():
    """Test 3: Web search server tool."""
    print("\n" + "="*80)
    print("TEST 3: Web Search Server Tool")
    print("="*80)

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ANTHROPIC_API_KEY not set")
        return

    # Test the format from our current implementation
    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        system_prompt="You are a research assistant with web search capabilities.",
        tools=[{"type": "web_search_20250305", "name": "web_search"}],
        max_tokens=500,
    )

    try:
        async with ClaudeSDKClient(api_key=api_key, options=options) as client:
            await client.connect()
            print("\n1. Requesting web search...")
            await client.query("Search for 'Claude AI 2024 updates' and give me 2 key points.")

            print("\n2. Processing response...")
            found_search = False
            search_results = []

            async for message in client.receive_response():
                if hasattr(message, 'content') and isinstance(message.content, list):
                    for block in message.content:
                        if hasattr(block, 'type'):
                            if block.type == 'tool_use':
                                tool_name = getattr(block, 'name', '')
                                if 'search' in tool_name.lower():
                                    found_search = True
                                    print(f"✅ Web search tool used: {tool_name}")

                            elif block.type == 'text':
                                if hasattr(block, 'text'):
                                    text = block.text
                                    if text and len(text) > 20:
                                        search_results.append(text[:200])

            print("\n3. Summary:")
            print(f"   Web search used: {found_search}")
            if search_results:
                print(f"   Response received: {len(search_results)} text blocks")
                print(f"   First block preview: {search_results[0]}...")
            else:
                print("   No response text received")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


async def test_session_resumption(session_info):
    """Test 4: Session resumption."""
    print("\n" + "="*80)
    print("TEST 4: Session Resumption")
    print("="*80)

    if not session_info or not session_info.get('session_id'):
        print("⚠️  No session_id from previous test, skipping resumption test")
        return

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ ANTHROPIC_API_KEY not set")
        return

    session_id = session_info['session_id']
    print(f"\n1. Attempting to resume session: {session_id}")

    options = ClaudeAgentOptions(
        model="claude-sonnet-4-5",
        system_prompt="You are a helpful assistant.",
        max_tokens=100,
    )

    try:
        async with ClaudeSDKClient(api_key=api_key, options=options) as client:
            # Try to resume with session_id
            await client.connect(session_id=session_id)
            await client.query("What did I ask you before?")

            print("\n2. Receiving response...")
            response_text = ""
            async for message in client.receive_response():
                if hasattr(message, 'content') and isinstance(message.content, list):
                    for block in message.content:
                        if hasattr(block, 'type') and block.type == 'text':
                            if hasattr(block, 'text'):
                                response_text += block.text

            print(f"\n3. Response: {response_text}")

            if 'hello' in response_text.lower():
                print("✅ Session resumed successfully! Agent remembered previous context.")
            else:
                print("⚠️  Session may not have resumed. Response doesn't reference previous message.")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("CLAUDE AGENT SDK BEHAVIOR TESTS")
    print("Testing SDK patterns for yarnnn-app-fullstack")
    print("="*80)

    # Check API key
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("\n❌ ERROR: ANTHROPIC_API_KEY environment variable not set")
        print("   Set it with: export ANTHROPIC_API_KEY=your_key")
        return

    # Run tests sequentially
    session_info = await test_basic_session()
    await asyncio.sleep(1)

    await test_tool_use()
    await asyncio.sleep(1)

    await test_web_search()
    await asyncio.sleep(1)

    if session_info:
        await test_session_resumption(session_info)

    print("\n" + "="*80)
    print("ALL TESTS COMPLETE")
    print("\nKey Findings:")
    print("1. Check session_id retrieval method above")
    print("2. Verify tool_use and tool_result message structure")
    print("3. Confirm web_search tool format works")
    print("4. Test session resumption behavior")
    print("="*80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
