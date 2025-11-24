#!/usr/bin/env python3
"""
Quick test script to execute research agent with Claude API.
Runs locally to test the agent logic without needing to deploy.
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
    # Skip SubstrateMemoryAdapter to avoid infra dependencies
    # from adapters.memory_adapter import SubstrateMemoryAdapter

    # Configuration from our database
    agent_config = {
        "research": {
            "topics": [
                "AI knowledge management tools market 2024",
                "Autonomous agent adoption trends",
                "Human-AI collaboration patterns"
            ],
            "competitors": [
                {"name": "Notion AI", "focus": "AI-enhanced note-taking and workspace", "priority": "high"},
                {"name": "Mem.ai", "focus": "AI-native knowledge management", "priority": "high"},
                {"name": "Roam Research", "focus": "Networked thought and backlinking", "priority": "medium"}
            ],
            "data_sources": {
                "high_reliability": ["techcrunch.com", "anthropic.com", "openai.com"],
                "medium_reliability": ["venturebeat.com", "theverge.com"],
                "monitor_only": ["news.ycombinator.com", "reddit.com/r/artificial"]
            },
            "output_preferences": {
                "finding_type": "insight",
                "include_actionable_recommendations": True,
                "max_findings_per_run": 5,
                "min_confidence_to_include": 0.6
            }
        }
    }

    print("=" * 60)
    print("RESEARCH AGENT TEST - Claude API Integration")
    print("=" * 60)

    # Create memory adapter (will try to connect to substrate-api)
    # For local test, we'll mock the memory adapter's config injection
    basket_id = "5004b9e1-67f5-4955-b028-389d45b1f5a4"
    workspace_id = "99e6bf7d-513c-45ff-9b96-9362bd914d12"

    print(f"\n📦 Basket ID: {basket_id}")
    print(f"🏢 Workspace ID: {workspace_id}")

    # Mock the memory adapter to return our config
    # This simulates what SubstrateMemoryAdapter does
    class MockMemoryAdapter:
        def __init__(self, config):
            self._config = config

        async def query(self, query, limit=10):
            # Return context with injected config
            # Context is imported at top of main()

            # First context item contains agent config (as SubstrateMemoryAdapter does)
            metadata_context = Context(
                content="[AGENT EXECUTION CONTEXT]",
                metadata={"agent_config": self._config}
            )

            # Add a sample substrate block for context
            sample_block = Context(
                content="YARNNN is building an AI-native knowledge management platform focused on autonomous agents that help users organize and synthesize information. Key differentiator is human-AI collaboration with governance controls.",
                metadata={
                    "block_id": "sample-block-1",
                    "semantic_type": "knowledge",
                    "state": "ACCEPTED"
                }
            )

            return [metadata_context, sample_block]

        async def store(self, context):
            return "stored-context-id"

    # Create agent
    print("\n🤖 Creating ResearchAgent...")
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

    # Define task
    task = "Research AI knowledge management tools competitive landscape focusing on Notion AI and Mem.ai positioning"

    print(f"\n📝 Task: {task}")
    print("\n🔄 Executing agent with Claude API...")
    print("   (This will make a real API call to Claude)")

    # Execute
    try:
        result = await agent.execute(
            task=task,
            context={"task": task}
        )

        print("\n✅ Agent execution completed!")

        # SDK returns dict, not dataclass
        if isinstance(result, dict):
            print(f"\n📊 Result Type: Dictionary (SDK output)")

            # Display raw result
            print(f"\n{'=' * 60}")
            print("RAW RESULT")
            print(f"{'=' * 60}")
            print(json.dumps(result, indent=2, default=str))

            # Extract key information
            if "findings" in result:
                findings = result["findings"]
                print(f"\n📊 Findings: {len(findings)} generated")
                for i, finding in enumerate(findings):
                    print(f"\n--- Finding #{i+1} ---")
                    print(f"Content: {finding.get('content', finding.get('insight', 'N/A'))}")
                    print(f"Confidence: {finding.get('confidence', 'N/A')}")
                    if finding.get('sources'):
                        print(f"Sources: {', '.join(finding['sources'])}")
            elif "analysis" in result:
                print(f"\n📊 Analysis Result:")
                print(result["analysis"])
            else:
                print(f"\n📊 Keys in result: {list(result.keys())}")
        else:
            # Original dataclass handling
            print(f"\n📊 Results: {len(result.findings)} findings generated")
            for i, finding in enumerate(result.findings):
                print(f"\n{'=' * 60}")
                print(f"FINDING #{i+1}")
                print(f"{'=' * 60}")
                print(f"Content: {finding.content}")
                print(f"Confidence: {finding.confidence:.0%}")

        print("\n✅ Internalized SDK working correctly!")

    except Exception as e:
        print(f"\n❌ Execution failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
