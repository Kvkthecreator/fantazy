"""Context entries module for structured multi-modal context management.

This module implements the Context Entries architecture as defined in:
- ADR: /docs/architecture/ADR_CONTEXT_ENTRIES.md
- Implementation Plan: /docs/implementation/CONTEXT_ENTRIES_IMPLEMENTATION_PLAN.md

Context Entries provide:
- Schema-driven structured fields per anchor role
- Multi-modal content (text + embedded asset references)
- Token-efficient context injection for work recipes
- Completeness tracking and validation
"""

from .routes import router

__all__ = ["router"]
