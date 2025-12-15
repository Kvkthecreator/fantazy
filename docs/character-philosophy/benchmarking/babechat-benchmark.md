# BabeChat Benchmark Notes (Dec 15 Screens)

## Popular Listing (Screenshot 08)
- Top grid mixes romance, idol/VTuber, fantasy, modern slice-of-life, with heavy anime styling; bright key art and expressive faces dominate thumbnails.
- “B only” / “N” tags surface safety/adult segmentation; some titles emphasize exclusivity (“B only”) and seasonal hooks (“Merry Christmas”).
- Thumbnail patterns: close-up faces, overlaid UI badges, short vertical titles; many feature duo casts or single charismatic lead.
- Genres shown: simulation/dating, school, idol/VTuber sim, fantasy/isekai, thriller/horror-lite, BL/GL, and historical romance.
- Visual hierarchy: rank numbers + red/blue tags + compact metadata (views/likes/comments) drive quick scanning and social proof.

## Creation Flow (Screenshots 01–07)
1) **Profile**: Name (20 chars) + short intro (500 chars) with “Auto” helper. Required fields; minimal friction.
2) **Asset**: Up to 101 emotion images, 5MB max; “Generate AI Image” and “Upload Image”; toggle for “Image Code” and Edit.
3) **Details**: System Template picker (default); large “Character Detailed Settings” textarea (appearance, backstory, occupation) with “Auto” helper; 5000 char limit.
4) **Start Situation**: Initial situation (1000 chars) and first line (500 chars) with “Auto” helper to seed opening beat.
5) **Other Settings**: Orientation (All/Female/Male), Safe Filter (all users vs adult only), Categories grid (simulation, romance, fantasy/SF, drama, BL/GL, horror, action, slice-of-life, sports, other); hashtags requirement hinted.
6) **Lorebook**: Optional keyword-triggered lore entries; empty state encourages adding world/extra content.
7) **Edit & Register**: Visibility (public/private/link-only), “B only” exclusivity toggle, optional details (freeform notes, date/location/height/weight, jobs list).

## UX/Content Takeaways
- Clear gating: Required fields are few; heavier detail is optional or helper-assisted (“Auto”), reducing cold-start friction.
- Multi-surface alignment: Visual assets, narrative intro, and opening script collected before publish, ensuring coherent first impression.
- Safety/compliance surfaced inline: orientation + safety + category tags upfront; visibility and exclusivity toggles at final step.
- Strong discoverability biases: Thumbnails and metadata lean on intimacy, expressiveness, and strong genre signaling.
- Lorebook as lightweight memory scaffold: keyword-triggered inserts suggest a mechanism akin to our memory hooks.

## Ideas to Borrow for Fantazy
- Provide “Auto” scaffolds for name/intro/opening line based on archetype; reduce empty-state paralysis.
- Enforce a minimal “opening scene” (situation + first line) to improve first-session stickiness.
- Separate “Asset pack” step with slot count and size hints; show progress (e.g., 1/20 expressions) to encourage completeness.
- Inline safety/orientation/category tagging during creation to feed discovery and filtering.
- Add optional “exclusivity” / “link-only” visibility for experiments without polluting public catalogs.

## Risks/Watchpoints
- Over-reliance on user-provided detail can lead to inconsistent tone; need templated fills + guardrails.
- Asset volume (101) is high; should set a curated target (e.g., 5–10 expressions + 2 scenes) to maintain quality.
- Safety labeling must be enforced in retrieval and recommendations, not just form-level toggles.
