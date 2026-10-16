# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Casual Pokémon fans who half-remember a Pokémon ("the ghost in a teapot") and want to rediscover it by describing it, then browse its entry for fun. Secondary audience: recruiters and technical visitors evaluating this as a portfolio piece (RAG + Gemini + game-UI craft).

## Product Purpose
LoreDex is a single-page app that answers "which Pokémon matches this description?" / "what Pokémon fits best?" from a natural-language description of its looks or lore. It embeds the query (Gemini), retrieves lore/look snippets from Pinecone, re-ranks with an LLM, enriches with PokéAPI data, and returns the match with an AI explanation of why it was chosen, plus sprite, types, base stats, abilities, Pokédex entry and its cry. Success: the user recognizes their Pokémon and understands why.

## Positioning
A Pokédex you talk to: describe it instead of looking it up by name or number, and it names the best fit and explains why from lore.

## Operating Context
Next.js 15 (App Router) + React 19, Tailwind 4, framer-motion, howler for cries. Backend `/api/search` (Gemini + Pinecone + PokéAPI). Cries are served from `public/cries`. Sprites come from Pokémon Showdown / PokeAPI.

## Capabilities and Constraints
- Preserve the API contract (`SearchResponse`) and all backend code; the redesign is front-end only.
- Query validation (3–500 chars), 30s timeout, retry, friendly error messages already exist and must keep working.
- Cry plays on result. Browsers need a user gesture for audio, so the boot screen's "press start" interaction is a fine place to unlock it.
- Next/prev Pokémon navigation was never implemented; do not fake it.

## Brand Commitments
Name: LoreDex. Binding visual constraint from the user: it must feel like a Pokémon video game, specifically the Gen 1 handheld Pokédex, with a Pokédex power-on/boot-up animation at load.

## Evidence on Hand
Pixel fonts in `public/` (`Pokemon X and Y.ttf`, `pokemon-ds-font.ttf`). Type icons from itsjavi/pokemon-assets. No testimonials, metrics or usage data exist; do not fabricate any.

## Product Principles
1. The result must read like a Pokédex entry first, an app screen second.
2. Show the reasoning: the AI explanation is the differentiator, not decoration.
3. Every state (boot, search, scanning, result, error) is part of the same device and in the same voice.
4. Fast to first search: no blocking on the intro after the first visit.

## Accessibility & Inclusion
Respect `prefers-reduced-motion` (boot animation collapses to a static power-on). Keyboard operable throughout, visible focus, readable text contrast on the LCD.
