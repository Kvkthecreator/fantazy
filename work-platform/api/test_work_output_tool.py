#!/usr/bin/env python3
"""
Test script for Work Output Tool-Use Pattern.

Tests that ResearchAgent.deep_dive() correctly:
1. Uses emit_work_output tool definition
2. Claude emits structured outputs via tool_use
3. Outputs are parsed into WorkOutput objects
4. Provenance tracking works (source_block_ids)

This validates the tool-use pattern WITHOUT writing to database.
"""

import asyncio
import json
import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from dotenv import load_dotenv
load_dotenv()

# Check for API key
if not os.environ.get("ANTHROPIC_API_KEY"):
    print("ERROR: ANTHROPIC_API_KEY not set. Please add to .env file.")
    sys.exit(1)


async def main():
    # Import after path setup
    # LEGACY: from yarnnn_agents.archetypes import ResearchAgent
    from shared.interfaces import Context

    # Configuration from database
    agent_config = {
        "research": {
            "topics": [
                "AI knowledge management tools market 2024",
                "Autonomous agent adoption trends",
            ],
            "competitors": [
                {"name": "Notion AI", "focus": "AI-enhanced note-taking", "priority": "high"},
                {"name": "Mem.ai", "focus": "AI-native knowledge management", "priority": "high"},
            ],
            "output_preferences": {
                "finding_type": "insight",
                "include_actionable_recommendations": True,
                "max_findings_per_run": 3,
                "min_confidence_to_include": 0.6
            }
        }
    }

    print("=" * 70)
    print("WORK OUTPUT TOOL-USE TEST - emit_work_output Pattern")
    print("=" * 70)

    basket_id = "5004b9e1-67f5-4955-b028-389d45b1f5a4"
    workspace_id = "99e6bf7d-513c-45ff-9b96-9362bd914d12"

    print(f"\n📦 Basket ID: {basket_id}")
    print(f"🏢 Workspace ID: {workspace_id}")

    # Mock memory adapter that returns config + sample blocks
    class MockMemoryAdapter:
        def __init__(self, config):
            self._config = config

        async def query(self, query, limit=10):
            # Config context (injected by SubstrateMemoryAdapter)
            metadata_context = Context(
                content="[AGENT EXECUTION CONTEXT]",
                metadata={"agent_config": self._config}
            )

            # Sample blocks (provenance sources)
            block1 = Context(
                content="Notion AI launched in 2023 with AI-assisted writing and summarization. Market response has been positive with enterprise adoption growing 45% YoY.",
                metadata={
                    "block_id": "block-uuid-notion-1",
                    "semantic_type": "knowledge",
                    "state": "ACCEPTED"
                }
            )

            block2 = Context(
                content="Mem.ai focuses on automatic knowledge organization using graph-based approach. Key differentiator is zero-effort knowledge capture with AI inference.",
                metadata={
                    "block_id": "block-uuid-mem-2",
                    "semantic_type": "knowledge",
                    "state": "ACCEPTED"
                }
            )

            block3 = Context(
                content="YARNNN differentiates through autonomous agent architecture with human-in-the-loop governance. Focus on proactive knowledge work, not just storage.",
                metadata={
                    "block_id": "block-uuid-yarnnn-3",
                    "semantic_type": "strategy",
                    "state": "ACCEPTED"
                }
            )

            return [metadata_context, block1, block2, block3]

        async def store(self, context):
            return "stored-context-id"

    # Create agent
    print("\n🤖 Creating ResearchAgent with emit_work_output tool...")
    memory_adapter = MockMemoryAdapter(agent_config)
    agent = ResearchAgent(
        agent_id="test-research-agent",
        memory=memory_adapter,
        governance=None,
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY"),
        monitoring_domains=["ai_agents", "knowledge_management"],
        monitoring_frequency="daily",
        signal_threshold=0.7,
        synthesis_mode="insights"
    )

    # Deep dive topic
    topic = "Competitor positioning analysis: Notion AI vs Mem.ai vs YARNNN"

    print(f"\n📝 Deep Dive Topic: {topic}")
    print("\n🔄 Executing deep_dive() with emit_work_output tool...")
    print("   (This will make a real API call to Claude)")
    print("   (Claude should emit structured outputs via tool_use)")

    # Execute deep_dive (uses emit_work_output tool)
    try:
        result = await agent.deep_dive(topic)

        print("\n✅ Deep dive completed!")

        print(f"\n{'=' * 70}")
        print("RESULT STRUCTURE")
        print(f"{'=' * 70}")

        print(f"Topic: {result.get('topic', 'N/A')}")
        print(f"Timestamp: {result.get('timestamp', 'N/A')}")
        print(f"Agent Type: {result.get('agent_type', 'N/A')}")
        print(f"Output Count: {result.get('output_count', 0)}")
        print(f"Source Block IDs: {result.get('source_block_ids', [])}")

        # Check for work_outputs (the key test)
        work_outputs = result.get("work_outputs", [])

        if work_outputs:
            print(f"\n{'=' * 70}")
            print(f"✅ SUCCESS: {len(work_outputs)} STRUCTURED WORK OUTPUTS")
            print(f"{'=' * 70}")

            for i, output in enumerate(work_outputs):
                print(f"\n--- Work Output #{i+1} ---")
                print(f"Output Type: {output.get('output_type', 'N/A')}")
                print(f"Title: {output.get('title', 'N/A')}")
                print(f"Confidence: {output.get('confidence', 'N/A')}")
                print(f"Tool Call ID: {output.get('tool_call_id', 'N/A')}")
                print(f"Source Block IDs: {output.get('source_block_ids', [])}")

                body = output.get("body", {})
                if body:
                    print(f"\nBody Summary: {body.get('summary', 'N/A')}")
                    if body.get('details'):
                        print(f"Details: {body.get('details')[:200]}...")
                    if body.get('evidence'):
                        print(f"Evidence Count: {len(body.get('evidence', []))}")
                    if body.get('recommendations'):
                        print(f"Recommendations: {body.get('recommendations')}")

            print(f"\n{'=' * 70}")
            print("✅ TOOL-USE PATTERN WORKING CORRECTLY!")
            print(f"{'=' * 70}")
            print("\nNext step: These outputs would be written to work_outputs table via BFF")

        else:
            print(f"\n{'=' * 70}")
            print("⚠️  NO STRUCTURED WORK OUTPUTS FOUND")
            print(f"{'=' * 70}")
            print("This means Claude did NOT use the emit_work_output tool.")
            print("Check raw_response for what Claude actually returned:")

            raw = result.get("raw_response", {})
            print(f"\nRaw Response Keys: {list(raw.keys()) if isinstance(raw, dict) else type(raw)}")

            # Show content if available
            if isinstance(raw, dict) and "content" in raw:
                content = raw["content"]
                print(f"\nContent blocks: {len(content)}")
                for i, block in enumerate(content):
                    if isinstance(block, dict):
                        print(f"  Block {i}: type={block.get('type', 'unknown')}")
                        if block.get("type") == "tool_use":
                            print(f"    Tool: {block.get('name', 'unknown')}")
                            print(f"    ID: {block.get('id', 'N/A')}")

        # Show raw for debugging
        print(f"\n{'=' * 70}")
        print("RAW RESULT (for debugging)")
        print(f"{'=' * 70}")
        # Truncate raw_response for readability
        debug_result = {k: v for k, v in result.items() if k != "raw_response"}
        print(json.dumps(debug_result, indent=2, default=str))

    except Exception as e:
        print(f"\n❌ Execution failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
