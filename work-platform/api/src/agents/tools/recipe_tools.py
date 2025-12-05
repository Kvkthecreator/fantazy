"""
Recipe Tools for Thinking Partner Agent

These tools allow TP to list available work recipes and trigger their execution.
Recipe execution flows through the unified /api/work/queue endpoint.

See:
- /docs/architecture/ADR_UNIFIED_WORK_ORCHESTRATION.md
- /docs/implementation/THINKING_PARTNER_IMPLEMENTATION_PLAN.md
"""

import logging
import os
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)

# Work Platform URL for internal API calls
WORK_PLATFORM_URL = os.getenv("WORK_PLATFORM_URL", "http://localhost:3000")

# Tool definitions for Anthropic API
RECIPE_TOOLS = [
    {
        "name": "list_recipes",
        "description": """List available work recipes that can be triggered.

Work recipes are predefined workflows like research, content generation, or reporting.
Each recipe has required context and produces specific outputs.

Returns recipe slug, name, description, required context, and output types.""",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "description": "Optional: filter by category (research, content, reporting)"
                }
            }
        }
    },
    {
        "name": "trigger_recipe",
        "description": """Queue a work recipe for execution. Creates a work_ticket.

The recipe will run asynchronously and produce work_outputs for review.
You can check the status later or the user will see outputs in their supervision queue.

Example: trigger_recipe(recipe_slug="deep_research", parameters={"topic": "AI agents"})""",
        "input_schema": {
            "type": "object",
            "properties": {
                "recipe_slug": {
                    "type": "string",
                    "description": "The recipe identifier (e.g., 'deep_research', 'blog_post', 'competitor_analysis')"
                },
                "parameters": {
                    "type": "object",
                    "description": "Recipe-specific parameters"
                },
                "priority": {
                    "type": "integer",
                    "description": "Priority 1-10, higher is more urgent. Default: 5",
                    "default": 5
                }
            },
            "required": ["recipe_slug"]
        }
    }
]

# Available recipes (could be loaded from DB in future)
AVAILABLE_RECIPES = [
    {
        "slug": "deep_research",
        "name": "Deep Research",
        "description": "Comprehensive research on a topic with web search and synthesis",
        "category": "research",
        "context_required": ["problem", "customer"],
        "context_optional": ["competitor", "vision"],
        "parameters": {
            "topic": {"type": "string", "required": True, "description": "Research topic"},
            "depth": {"type": "string", "enum": ["quick", "standard", "deep"], "default": "standard"},
            "scope": {"type": "string", "enum": ["general", "competitor", "market", "technical"], "default": "general"},
        },
        "outputs": ["finding", "insight", "recommendation"],
    },
    {
        "slug": "competitor_analysis",
        "name": "Competitor Analysis",
        "description": "Analyze a specific competitor's strengths, weaknesses, and positioning",
        "category": "research",
        "context_required": ["problem", "customer"],
        "context_optional": ["competitor", "brand"],
        "parameters": {
            "competitor_name": {"type": "string", "required": True, "description": "Name of competitor to analyze"},
            "focus_areas": {"type": "array", "items": {"type": "string"}, "description": "Specific areas to focus on"},
        },
        "outputs": ["finding", "insight", "competitor"],
    },
    {
        "slug": "trend_digest",
        "name": "Trend Digest",
        "description": "Generate a digest of current trends in the user's market",
        "category": "research",
        "context_required": ["problem", "customer"],
        "context_optional": ["competitor", "vision"],
        "parameters": {
            "timeframe": {"type": "string", "enum": ["week", "month", "quarter"], "default": "week"},
        },
        "outputs": ["trend_digest"],
    },
    {
        "slug": "blog_post",
        "name": "Blog Post",
        "description": "Generate a blog post draft based on context and topic",
        "category": "content",
        "context_required": ["brand", "customer"],
        "context_optional": ["problem", "vision"],
        "parameters": {
            "topic": {"type": "string", "required": True, "description": "Blog post topic"},
            "tone": {"type": "string", "enum": ["professional", "casual", "technical"], "default": "professional"},
            "length": {"type": "string", "enum": ["short", "medium", "long"], "default": "medium"},
        },
        "outputs": ["draft"],
    },
    {
        "slug": "social_post",
        "name": "Social Media Post",
        "description": "Generate social media content for various platforms",
        "category": "content",
        "context_required": ["brand"],
        "context_optional": ["customer", "problem"],
        "parameters": {
            "platform": {"type": "string", "enum": ["linkedin", "twitter", "facebook"], "required": True},
            "topic": {"type": "string", "required": True},
        },
        "outputs": ["draft"],
    },
]


async def execute_recipe_tool(
    tool_name: str,
    tool_input: Dict[str, Any],
    context: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Execute a recipe tool and return the result.

    Args:
        tool_name: Name of the tool to execute
        tool_input: Tool input parameters
        context: Execution context with basket_id, user_id, etc.

    Returns:
        Tool result dict
    """
    basket_id = context.get("basket_id")
    user_id = context.get("user_id")
    session_id = context.get("session_id")
    workspace_id = context.get("workspace_id")

    if not basket_id:
        return {"error": "No basket_id in context"}

    if tool_name == "list_recipes":
        return await list_recipes(
            category=tool_input.get("category"),
        )
    elif tool_name == "trigger_recipe":
        return await trigger_recipe(
            basket_id=basket_id,
            workspace_id=workspace_id,
            user_id=user_id,
            session_id=session_id,
            recipe_slug=tool_input.get("recipe_slug"),
            parameters=tool_input.get("parameters", {}),
            priority=tool_input.get("priority", 5),
        )
    else:
        return {"error": f"Unknown recipe tool: {tool_name}"}


async def list_recipes(
    category: Optional[str] = None,
) -> Dict[str, Any]:
    """
    List available work recipes.

    Args:
        category: Optional filter by category

    Returns:
        List of available recipes
    """
    recipes = AVAILABLE_RECIPES

    if category:
        recipes = [r for r in recipes if r["category"] == category]

    # Format for agent consumption
    formatted = []
    for recipe in recipes:
        formatted.append({
            "slug": recipe["slug"],
            "name": recipe["name"],
            "description": recipe["description"],
            "category": recipe["category"],
            "context_required": recipe["context_required"],
            "parameters": list(recipe["parameters"].keys()),
            "outputs": recipe["outputs"],
        })

    return {
        "recipes": formatted,
        "count": len(formatted),
        "categories": list(set(r["category"] for r in recipes)),
    }


async def trigger_recipe(
    basket_id: str,
    workspace_id: Optional[str],
    user_id: str,
    session_id: Optional[str],
    recipe_slug: str,
    parameters: Dict[str, Any],
    priority: int = 5,
    schedule_id: Optional[str] = None,
    mode: str = "one_shot",
    cycle_number: int = 1,
) -> Dict[str, Any]:
    """
    Trigger a work recipe via the unified /api/work/queue endpoint.

    This creates both a work_request (audit trail) and work_ticket (execution).
    The queue processor will pick up pending tickets and execute them.

    Args:
        basket_id: Basket UUID
        workspace_id: Workspace UUID
        user_id: User UUID
        session_id: TP session ID
        recipe_slug: Recipe to trigger
        parameters: Recipe parameters
        priority: Ticket priority (1-10)
        schedule_id: Optional FK to project_schedules for recurring work
        mode: 'one_shot' (default) or 'continuous' for scheduled work
        cycle_number: For continuous mode, which execution cycle this is

    Returns:
        Result with work_request_id and work_ticket_id
    """
    try:
        # Build request payload for unified queue endpoint
        queue_payload = {
            "basket_id": basket_id,
            "recipe_slug": recipe_slug,
            "parameters": parameters,
            "priority": min(max(priority, 1), 10),
            "source": "schedule" if schedule_id else "thinking_partner",
            "tp_session_id": session_id,
            "user_id": user_id,  # Required for service calls
            "workspace_id": workspace_id,
        }

        # Add schedule info if provided
        if schedule_id:
            queue_payload["schedule_id"] = schedule_id
            queue_payload["scheduling_intent"] = {
                "mode": "recurring" if mode == "continuous" else "one_shot",
            }

        # Call unified queue endpoint
        # Note: Using internal service auth (Bearer token from env)
        service_secret = os.getenv("SUBSTRATE_SERVICE_SECRET", "")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{WORK_PLATFORM_URL}/api/work/queue",
                json=queue_payload,
                headers={
                    "Authorization": f"Bearer {service_secret}",
                    "Content-Type": "application/json",
                },
            )

        if response.status_code == 200:
            result = response.json()
            logger.info(
                f"[trigger_recipe] Queued {recipe_slug}: "
                f"work_request={result.get('work_request_id')}, "
                f"work_ticket={result.get('work_ticket_id')}"
            )

            # Find recipe for display info
            recipe = next((r for r in AVAILABLE_RECIPES if r["slug"] == recipe_slug), None)
            recipe_name = recipe["name"] if recipe else recipe_slug

            return {
                "success": True,
                "work_request_id": result.get("work_request_id"),
                "work_ticket_id": result.get("work_ticket_id"),
                "recipe": {
                    "slug": recipe_slug,
                    "name": recipe_name,
                },
                "status": "queued",
                "mode": mode,
                "cycle_number": cycle_number if mode == "continuous" else None,
                "schedule_id": schedule_id,
                "message": result.get("message", f"Started {recipe_name}. The results will appear in your supervision queue when complete."),
                "expected_outputs": recipe["outputs"] if recipe else [],
            }

        elif response.status_code == 400:
            # Validation error (missing context, invalid params)
            error_data = response.json()
            return {
                "error": error_data.get("detail", "Validation failed"),
                "recipe": recipe_slug,
                "missing_context": error_data.get("missing_context"),
                "suggestion": "Use write_context to add the missing context items." if error_data.get("missing_context") else None,
            }

        elif response.status_code == 404:
            # Recipe not found
            return {
                "error": f"Recipe not found: {recipe_slug}",
                "available_recipes": [r["slug"] for r in AVAILABLE_RECIPES],
            }

        else:
            # Other error
            logger.error(f"[trigger_recipe] Queue endpoint error: {response.status_code} - {response.text}")
            return {
                "error": f"Failed to queue recipe: {response.status_code}",
                "details": response.text[:200] if response.text else None,
            }

    except httpx.TimeoutException:
        logger.error(f"[trigger_recipe] Timeout calling queue endpoint")
        return {"error": "Request timed out. Please try again."}

    except Exception as e:
        logger.error(f"[trigger_recipe] Error: {e}")
        return {"error": f"Failed to trigger recipe: {str(e)}"}


# Note: Context validation is now handled by the /api/work/queue endpoint
# The _check_context_requirements function has been removed to avoid dual approaches
