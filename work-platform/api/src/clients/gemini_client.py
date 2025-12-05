"""
Gemini Client - Text + Image Generation

Supports:
- Text generation (chat/completion) via gemini-2.5-flash
- Image generation from text prompts via gemini-2.5-flash-image
- Text + Image combined generation
- Tool calling (function calling)

Models:
- Text: gemini-2.5-flash (fast, high quality)
- Image: gemini-2.5-flash-image (unified text + image output)

SDK: google-genai (Python)

Usage:
    from clients.gemini_client import GeminiClient

    client = GeminiClient()

    # Text only
    text = await client.generate_text("Explain AI in a few words")

    # Image only
    image = await client.generate_image("A professional tech illustration")

    # Text + Image (for social media content)
    result = await client.generate_content_with_image(
        text_prompt="Write a LinkedIn post about AI trends",
        generate_image=True,
        image_prompt="Professional tech illustration for LinkedIn",
    )
"""

from __future__ import annotations

import base64
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Gemini models
# Text generation: gemini-2.5-flash (fast, high quality)
# Image generation: gemini-2.5-flash-image (unified text + image output)
GEMINI_TEXT_MODEL = "gemini-2.5-flash"
GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"


@dataclass
class ImageResult:
    """Result of an image generation request."""
    base64_data: Optional[str] = None
    mime_type: str = "image/png"
    data_url: Optional[str] = None
    model_comment: Optional[str] = None

    def __bool__(self) -> bool:
        return self.base64_data is not None


@dataclass
class GeminiExecutionResult:
    """Result of a Gemini execution (text + optional image)."""
    text: str = ""
    image: Optional[ImageResult] = None
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = GEMINI_TEXT_MODEL


class GeminiClient:
    """
    Gemini API client for text and image generation.

    Key Features:
    - Text generation via generateContent (gemini-2.5-flash)
    - Image generation via generateContent with response_modalities (gemini-2.0-flash-exp-image-generation)
    - Combined text + image generation for content workflows
    - Async-first design
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        text_model: str = GEMINI_TEXT_MODEL,
        image_model: str = GEMINI_IMAGE_MODEL,
    ):
        """
        Initialize Gemini client.

        Args:
            api_key: Gemini API key (from env if None)
            text_model: Gemini model for text generation
            image_model: Gemini model for image generation
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY required")

        self.text_model = text_model
        self.image_model = image_model

        # Initialize Google GenAI client
        try:
            from google import genai
            self.client = genai.Client(api_key=self.api_key)
            logger.info(f"GeminiClient initialized: text={text_model}, image={image_model}")
        except ImportError:
            raise ImportError(
                "google-genai package required. Install with: pip install google-genai"
            )

    async def generate_text(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> str:
        """
        Generate text response.

        Args:
            prompt: User prompt
            system_prompt: Optional system instructions
            temperature: Generation temperature (0.0-1.0)

        Returns:
            Generated text string
        """
        from google.genai import types

        logger.info(f"[GEMINI TEXT] Generating: {prompt[:100]}...")

        try:
            # Build config
            config = types.GenerateContentConfig(
                temperature=temperature,
                system_instruction=system_prompt if system_prompt else None,
            )

            # Generate content
            response = self.client.models.generate_content(
                model=self.text_model,
                contents=prompt,
                config=config,
            )

            # Extract text from response
            if response.candidates and response.candidates[0].content:
                text_parts = []
                for part in response.candidates[0].content.parts:
                    if hasattr(part, 'text') and part.text:
                        text_parts.append(part.text)
                return "\n".join(text_parts)

            return ""

        except Exception as e:
            logger.error(f"[GEMINI TEXT] Generation failed: {e}")
            raise

    async def generate_image(
        self,
        prompt: str,
        aspect_ratio: str = "16:9",
    ) -> ImageResult:
        """
        Generate image from text prompt.

        Uses Gemini's generateContent with response_modalities=["IMAGE", "TEXT"]
        to generate images natively (not via Imagen API).

        Args:
            prompt: Image generation prompt
            aspect_ratio: Aspect ratio ("1:1", "3:4", "4:3", "9:16", "16:9")

        Returns:
            ImageResult with base64 data and metadata
        """
        from google.genai import types

        logger.info(f"[GEMINI IMAGE] Generating: {prompt[:100]}... (aspect={aspect_ratio})")

        try:
            # Configure for image generation
            # Gemini 2.0 Flash uses response_modalities to enable image output
            config = types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            )

            # Generate content with image
            response = self.client.models.generate_content(
                model=self.image_model,
                contents=f"Generate an image: {prompt}. Aspect ratio: {aspect_ratio}.",
                config=config,
            )

            result = ImageResult()

            # Parse response for image and text parts
            if response.candidates and response.candidates[0].content:
                for part in response.candidates[0].content.parts:
                    # Check for inline image data
                    if hasattr(part, 'inline_data') and part.inline_data:
                        result.base64_data = part.inline_data.data
                        result.mime_type = part.inline_data.mime_type or "image/png"
                        result.data_url = f"data:{result.mime_type};base64,{result.base64_data}"
                        logger.info(f"[GEMINI IMAGE] Got image: {result.mime_type}")
                    # Check for text commentary
                    elif hasattr(part, 'text') and part.text:
                        result.model_comment = part.text

            if not result.base64_data:
                logger.warning("[GEMINI IMAGE] No image in response")

            return result

        except Exception as e:
            logger.error(f"[GEMINI IMAGE] Generation failed: {e}")
            raise

    async def generate_content_with_image(
        self,
        text_prompt: str,
        generate_image: bool = False,
        image_prompt: Optional[str] = None,
        aspect_ratio: str = "16:9",
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> GeminiExecutionResult:
        """
        Generate content that may include both text and image.

        For content agent use case: Generate social media post + accompanying image.

        Args:
            text_prompt: Prompt for text content
            generate_image: Whether to generate an image
            image_prompt: Optional specific prompt for image (uses text_prompt if None)
            aspect_ratio: Image aspect ratio
            system_prompt: Optional system instructions for text
            temperature: Generation temperature

        Returns:
            GeminiExecutionResult with text and optional image
        """
        logger.info(
            f"[GEMINI CONTENT] Generating: text={text_prompt[:50]}..., "
            f"image={generate_image}"
        )

        result = GeminiExecutionResult(model=self.text_model)

        # Generate text content
        result.text = await self.generate_text(
            prompt=text_prompt,
            system_prompt=system_prompt,
            temperature=temperature,
        )

        # Optionally generate image
        if generate_image:
            img_prompt = image_prompt or f"Create a professional image for: {text_prompt[:200]}"
            result.image = await self.generate_image(img_prompt, aspect_ratio)

        logger.info(
            f"[GEMINI CONTENT] Complete: text={len(result.text)} chars, "
            f"image={'yes' if result.image and result.image.base64_data else 'no'}"
        )

        return result

    async def generate_social_content(
        self,
        topic: str,
        platform: str = "linkedin",
        tone: str = "professional",
        include_image: bool = True,
        image_style: str = "modern professional",
    ) -> GeminiExecutionResult:
        """
        Generate social media content with optional image.

        Specialized method for social content generation workflows.

        Args:
            topic: Content topic/brief
            platform: Target platform (linkedin, twitter, instagram)
            tone: Content tone (professional, casual, inspiring)
            include_image: Whether to generate accompanying image
            image_style: Visual style for image

        Returns:
            GeminiExecutionResult with text content and optional image
        """
        # Platform-specific prompts
        platform_guidance = {
            "linkedin": "LinkedIn post (1300 chars max, professional, thought leadership)",
            "twitter": "Twitter/X post (280 chars max, punchy, engaging)",
            "instagram": "Instagram caption (engaging, emoji-friendly, hashtag suggestions)",
        }

        system_prompt = f"""You are an expert social media content creator.
Create high-quality {platform} content with a {tone} tone.

Guidelines for {platform}:
{platform_guidance.get(platform, 'Social media post')}

Focus on:
- Strong opening hook
- Clear value proposition
- Call to action
- Platform-native voice
"""

        text_prompt = f"Create a {platform} post about: {topic}"

        # Image prompt based on platform
        image_prompt = None
        aspect_ratio = "16:9"
        if include_image:
            if platform == "instagram":
                aspect_ratio = "1:1"  # Square for Instagram
            elif platform == "twitter":
                aspect_ratio = "16:9"  # Wide for Twitter
            else:
                aspect_ratio = "16:9"  # LinkedIn prefers landscape

            image_prompt = f"{image_style} illustration for {platform} about: {topic}"

        return await self.generate_content_with_image(
            text_prompt=text_prompt,
            generate_image=include_image,
            image_prompt=image_prompt,
            aspect_ratio=aspect_ratio,
            system_prompt=system_prompt,
        )


# Convenience function
def get_gemini_client(**kwargs) -> GeminiClient:
    """Get a GeminiClient instance."""
    return GeminiClient(**kwargs)
