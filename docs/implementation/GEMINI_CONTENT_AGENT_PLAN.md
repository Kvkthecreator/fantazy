# Gemini Content Agent Implementation Plan

## Overview

Replace the Anthropic-based Content Agent with Google Gemini 2.5 Flash for unified text + image generation capabilities.

**Model**: `gemini-2.5-flash-image`
**SDK**: `@google/genai` (Python: `google-genai`)
**Key Benefit**: Single model for both text generation AND image generation

---

## Phase 1: Gemini Client Setup

### 1.1 Install Dependencies

```bash
# Python (work-platform API)
pip install google-genai

# Add to requirements.txt
google-genai>=0.1.0
```

### 1.2 Create GeminiClient

**File**: `work-platform/api/src/clients/gemini_client.py`

```python
"""
Gemini Client - Text + Image Generation via Gemini 2.5 Flash

Supports:
- Text generation (chat/completion)
- Image generation from text prompts
- Image editing (image + text input)
- Tool calling (function calling)
"""

from google.genai import GoogleGenAI
from typing import Optional, List, Dict, Any
import base64
import os

class GeminiClient:
    def __init__(
        self,
        api_key: str = None,
        model: str = "gemini-2.5-flash-image",
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model
        self.client = GoogleGenAI(api_key=self.api_key)

    async def generate_text(
        self,
        prompt: str,
        system_prompt: str = None,
        temperature: float = 0.7,
    ) -> str:
        """Generate text response."""
        contents = []
        if system_prompt:
            contents.append({"role": "system", "parts": [{"text": system_prompt}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        response = await self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config={"temperature": temperature},
        )

        return response.candidates[0].content.parts[0].text

    async def generate_image(
        self,
        prompt: str,
        aspect_ratio: str = "16:9",  # "1:1", "3:4", "4:3", "9:16", "16:9"
    ) -> Dict[str, Any]:
        """
        Generate image from text prompt.

        Returns:
            {
                "base64": str,  # Raw base64 image data
                "mime_type": str,  # e.g., "image/png"
                "data_url": str,  # Ready for <img src="">
                "model_comment": str | None,  # Optional text reasoning
            }
        """
        response = await self.client.models.generate_content(
            model=self.model,
            contents={"parts": [{"text": prompt}]},
            config={
                "imageConfig": {"aspectRatio": aspect_ratio},
            },
        )

        result = {
            "base64": None,
            "mime_type": None,
            "data_url": None,
            "model_comment": None,
        }

        for part in response.candidates[0].content.parts:
            if hasattr(part, 'inlineData') and part.inlineData:
                result["base64"] = part.inlineData.data
                result["mime_type"] = part.inlineData.mimeType or "image/png"
                result["data_url"] = f"data:{result['mime_type']};base64,{result['base64']}"
            elif hasattr(part, 'text') and part.text:
                result["model_comment"] = part.text

        return result

    async def generate_content_with_image(
        self,
        text_prompt: str,
        generate_image: bool = False,
        image_prompt: str = None,
        aspect_ratio: str = "16:9",
    ) -> Dict[str, Any]:
        """
        Generate content that may include both text and image.

        For content agent use case: Generate article/post + accompanying image.
        """
        result = {
            "text": None,
            "image": None,
        }

        # Generate text content
        text_response = await self.generate_text(text_prompt)
        result["text"] = text_response

        # Optionally generate image
        if generate_image:
            img_prompt = image_prompt or f"Create a professional image for: {text_prompt[:200]}"
            image_result = await self.generate_image(img_prompt, aspect_ratio)
            result["image"] = image_result

        return result
```

### 1.3 Environment Variables

```bash
# .env
GEMINI_API_KEY=your_api_key_here
```

---

## Phase 2: Content Agent Refactor

### 2.1 Current Content Agent Structure

The current content agent uses `AnthropicDirectClient`. We need to:
1. Create `GeminiContentAgent` as alternative
2. Keep `AnthropicDirectClient` for research/other agents
3. Factory pattern for agent selection

### 2.2 New Content Agent

**File**: `work-platform/api/src/agents/gemini_content_agent.py`

```python
"""
Gemini Content Agent - Text + Image Generation

Uses Gemini 2.5 Flash for:
- Article/post generation
- Social media content
- Image generation for content
- Image + text combined outputs
"""

from clients.gemini_client import GeminiClient
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Content recipes that benefit from image generation
IMAGE_ENABLED_RECIPES = [
    "social-media-post",
    "blog-article",
    "product-description",
    "marketing-content",
]

class GeminiContentAgent:
    def __init__(
        self,
        basket_id: str,
        workspace_id: str,
        work_ticket_id: str,
        user_id: str,
        user_jwt: str = None,
    ):
        self.basket_id = basket_id
        self.workspace_id = workspace_id
        self.work_ticket_id = work_ticket_id
        self.user_id = user_id
        self.client = GeminiClient()

        # Substrate client for tool operations (reuse existing)
        from clients.substrate_client import get_substrate_client
        self.substrate = get_substrate_client(jwt=user_jwt)

    async def execute(
        self,
        task: str,
        recipe_slug: str = None,
        include_image: bool = None,
        image_aspect_ratio: str = "16:9",
        output_format: str = "markdown",
    ) -> Dict[str, Any]:
        """
        Execute content generation task.

        Args:
            task: Content generation task description
            recipe_slug: Recipe being executed (determines image inclusion)
            include_image: Override for image generation
            image_aspect_ratio: Aspect ratio for generated images
            output_format: markdown, html, json

        Returns:
            {
                "text_content": str,
                "image": {...} | None,
                "work_outputs": [...],
                "token_usage": {...},
            }
        """
        logger.info(f"[GEMINI CONTENT] Starting: {task[:100]}...")

        # Determine if we should generate an image
        should_generate_image = include_image
        if should_generate_image is None:
            should_generate_image = recipe_slug in IMAGE_ENABLED_RECIPES

        # Build system prompt
        system_prompt = self._build_system_prompt(recipe_slug, output_format)

        # Generate content
        result = await self.client.generate_content_with_image(
            text_prompt=f"{system_prompt}\n\nTask: {task}",
            generate_image=should_generate_image,
            aspect_ratio=image_aspect_ratio,
        )

        # Create work outputs
        work_outputs = []

        # Text output
        if result["text"]:
            work_outputs.append({
                "output_type": "content",
                "title": f"Generated Content",
                "body": {"content": result["text"], "format": output_format},
                "confidence": 0.9,
            })

        # Image output (if generated)
        if result["image"] and result["image"]["base64"]:
            # Store image as asset
            image_asset = await self._store_image_asset(result["image"])

            work_outputs.append({
                "output_type": "image",
                "title": "Generated Image",
                "body": {
                    "asset_id": image_asset["id"],
                    "data_url": result["image"]["data_url"],
                    "model_comment": result["image"]["model_comment"],
                },
                "confidence": 0.85,
            })

        return {
            "text_content": result["text"],
            "image": result["image"],
            "work_outputs": work_outputs,
            "token_usage": {},  # Gemini token tracking TBD
        }

    def _build_system_prompt(self, recipe_slug: str, output_format: str) -> str:
        """Build system prompt based on recipe."""
        base = f"""You are a professional content creator. Generate high-quality {output_format} content.

Guidelines:
- Write in a clear, engaging style
- Use proper formatting ({output_format})
- Be concise but comprehensive
- Match the tone to the content type
"""

        recipe_additions = {
            "social-media-post": "Keep it short, punchy, and shareable. Include relevant hashtag suggestions.",
            "blog-article": "Write a well-structured article with introduction, body sections, and conclusion.",
            "product-description": "Focus on benefits, features, and call-to-action.",
            "marketing-content": "Persuasive copy that drives action.",
        }

        if recipe_slug in recipe_additions:
            base += f"\n\nSpecific guidance: {recipe_additions[recipe_slug]}"

        return base

    async def _store_image_asset(self, image_data: Dict[str, Any]) -> Dict[str, Any]:
        """Store generated image as a reference asset."""
        import base64

        # Decode base64 and upload to storage
        image_bytes = base64.b64decode(image_data["base64"])

        # Use substrate client to create asset
        # This would call the existing asset upload endpoint
        asset = await self.substrate.create_reference_asset(
            basket_id=self.basket_id,
            file_data=image_bytes,
            file_name=f"generated_{self.work_ticket_id}.png",
            mime_type=image_data["mime_type"],
            metadata={
                "source": "gemini_content_agent",
                "work_ticket_id": self.work_ticket_id,
            },
        )

        return asset
```

---

## Phase 3: Tool Integration

### 3.1 Gemini Function Calling

Gemini supports function calling similar to Anthropic/OpenAI. We need to translate our existing tools:

```python
# Tool schema translation: Anthropic -> Gemini
def anthropic_to_gemini_tools(anthropic_tools: List[Dict]) -> List[Dict]:
    """Convert Anthropic tool format to Gemini function declarations."""
    gemini_tools = []

    for tool in anthropic_tools:
        gemini_tool = {
            "functionDeclarations": [{
                "name": tool["name"],
                "description": tool["description"],
                "parameters": tool["input_schema"],  # JSON Schema compatible
            }]
        }
        gemini_tools.append(gemini_tool)

    return gemini_tools
```

### 3.2 Existing Tools to Support

The content agent needs these tools:
- `emit_work_output` - Store generated content
- `web_search` - Research for content (optional)
- `fetch_context` - Load project context

---

## Phase 4: Workflow Integration

### 4.1 Agent Factory

**File**: `work-platform/api/src/agents/__init__.py`

```python
def get_content_agent(
    provider: str = None,
    **kwargs
) -> Union[ContentAgent, GeminiContentAgent]:
    """
    Factory for content agents.

    Args:
        provider: "anthropic" or "gemini" (default from env)
    """
    provider = provider or os.getenv("CONTENT_AGENT_PROVIDER", "gemini")

    if provider == "gemini":
        from agents.gemini_content_agent import GeminiContentAgent
        return GeminiContentAgent(**kwargs)
    else:
        from agents.content_agent import ContentAgent
        return ContentAgent(**kwargs)
```

### 4.2 Recipe Configuration

Add `provider` field to content recipes:

```sql
UPDATE work_recipes
SET parameters_schema = jsonb_set(
    parameters_schema,
    '{provider}',
    '{"type": "string", "enum": ["anthropic", "gemini"], "default": "gemini"}'
)
WHERE agent_type = 'content';
```

---

## Phase 5: Image Storage & Display

### 5.1 Image Asset Storage

Generated images need to be stored in Supabase Storage:

```python
async def store_generated_image(
    supabase_client,
    basket_id: str,
    image_base64: str,
    mime_type: str,
    work_ticket_id: str,
) -> str:
    """Store generated image and return public URL."""
    import base64

    image_bytes = base64.b64decode(image_base64)
    file_path = f"generated/{basket_id}/{work_ticket_id}.png"

    # Upload to Supabase Storage
    result = supabase_client.storage.from_("assets").upload(
        file_path,
        image_bytes,
        {"content-type": mime_type}
    )

    # Get public URL
    public_url = supabase_client.storage.from_("assets").get_public_url(file_path)

    return public_url
```

### 5.2 Work Output Display

Update `OutputCard` component to display generated images:

```tsx
// In TicketTrackingClient.tsx or OutputCard
{output.output_type === 'image' && output.body.data_url && (
  <div className="mt-3">
    <img
      src={output.body.data_url}
      alt={output.title}
      className="rounded-lg max-w-full h-auto"
    />
    {output.body.model_comment && (
      <p className="text-xs text-muted-foreground mt-2">
        {output.body.model_comment}
      </p>
    )}
  </div>
)}
```

---

## Phase 6: Testing & Rollout

### 6.1 Test Cases

1. **Text-only generation**: Blog article without image
2. **Text + Image**: Social media post with generated image
3. **Image-only**: Generate product image from description
4. **Error handling**: Invalid prompts, rate limits, content filtering

### 6.2 Rollout Strategy

1. **Week 1**: Implement GeminiClient + basic text generation
2. **Week 2**: Add image generation + storage
3. **Week 3**: Tool integration + recipe configuration
4. **Week 4**: UI updates + testing
5. **Week 5**: Production rollout (feature flag)

---

## Cost Considerations

| Usage | Free Tier | Paid Tier |
|-------|-----------|-----------|
| Requests | 15 RPM, 1500 RPD | Unlimited |
| Text Input | Free | ~$0.075/1M tokens |
| Text Output | Free | ~$0.30/1M tokens |
| Image Generation | Free | ~$0.02-0.04/image |

**Recommendation**: Start with free tier for development, upgrade for production.

---

## Files to Create/Modify

### New Files
- `work-platform/api/src/clients/gemini_client.py`
- `work-platform/api/src/agents/gemini_content_agent.py`

### Modified Files
- `work-platform/api/requirements.txt` (add google-genai)
- `work-platform/api/src/agents/__init__.py` (factory)
- `work-platform/api/src/app/routes/workflow_content.py` (use factory)
- `work-platform/web/.../OutputCard.tsx` (image display)

---

## Required from User

1. **GEMINI_API_KEY** - Google AI Studio API key
2. **Confirmation** on:
   - Default aspect ratio preference (16:9?)
   - Which recipes should auto-include images?
   - Storage bucket configuration for generated images
