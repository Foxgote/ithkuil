# Ithkuil-Style Keyboard Font Spec (Pragmatic)

## Goal
Create a **typable**, game-friendly Ithkuil-style font system that is visually consistent, without requiring perfect linguistic/script accuracy.

This is a **component composition** design, not a "one glyph per whole word" design.

## Architecture
1. Use a font with finite glyph inventory (base shapes + marks + common ligatures).
2. Type with a custom keyboard layout (or IME-style transliteration).
3. Let OpenType rules compose many outputs automatically.
4. Keep SVG renderer as a "gold master" for occasional validation.

## Why this works
- Full word space is astronomically large.
- Component space is finite and manageable.
- OpenType can compose a large visible variety from a few hundred glyphs.

## Glyph Inventory (Phase 1)
Target: ship quickly with a clean "Ithkuil-like" typing feel.

1. Base consonant core glyphs
- One glyph per core shape.

2. Core modifiers
- Extension marks
- Primary/secondary/quaternary mark sets
- Essential diacritics

3. Structural symbols
- Register-like markers
- Separators / break forms
- Placeholder glyphs for unsupported cases

4. Convenience ligatures (high value)
- Most common base+mark combinations as precomposed ligatures.
- Start with 100-300 ligatures.

## Glyph Inventory (Phase 2)
Target: better aesthetic coverage.

1. Expanded ligatures
- 500-1500 total ligatures for frequent combinations.

2. Positional variants
- Initial/medial/final alternates if desired.

3. Handwritten style set
- Alternative stylistic set (`ss01`) for rough calligraphic look.

## Encoding Strategy
Use Unicode Private Use Area (PUA) for custom symbols.

Suggested blocks:
- `U+E000-E0FF`: base cores
- `U+E100-E1FF`: extensions/diacritics
- `U+E200-E2FF`: structural/register/break
- `U+E300-E7FF`: ligatures and stylistic alternates

Keep a single source-of-truth mapping file:
- `font/mapping.json`

Each entry should include:
- `name`
- `codepoint`
- `category`
- `input_sequence` (what user types)

## Keyboard/IME Strategy
Two practical input options:

1. Dead-key layout
- Keypress for base.
- Next key adds diacritic/extension.
- Fast for power users.

2. Transliteration IME (recommended start)
- User types ASCII sequences (`k`, `k;`, `k'`, etc.).
- Translator emits PUA sequence.
- Easier onboarding.

Recommended: ship IME first, native OS layout second.

## OpenType Features
Use these features:

1. `liga` / `dlig`
- Replace typed multi-glyph sequences with curated fused forms.

2. `calt`
- Contextual shape tweaks for cleaner joins.

3. `mark` / `mkmk`
- Diacritic attachment and stacking anchors.

4. `ss01`, `ss02`
- Style sets (formal vs handwritten).

## Minimal `.fea` Skeleton
```fea
languagesystem DFLT dflt;

feature liga {
  sub uniE010 uniE120 by uniE320; # base + mark -> fused form
} liga;

feature calt {
  sub uniE010' uniE011 by uniE410; # contextual alternate
} calt;

feature ss01 {
  sub uniE010 by uniE510; # handwritten variant
} ss01;
```

## Build Stack
Practical stack:
- Draw/edit glyphs: Glyphs / FontLab / FontForge
- Programmatic build: `fonttools` + `ufoLib2` + `afdko` (optional)
- QA: HarfBuzz (`hb-shape`) + browser tests

## Data Pipeline (Recommended)
1. Export shape primitives from your existing script system:
- Create one SVG per component.

2. Normalize:
- Same baseline, ascender, descender, sidebearings.

3. Import into font source:
- Build glyph set + anchors.

4. Compile:
- Generate OTF/TTF + WOFF2.

5. Test:
- Render typed sample corpus and compare snapshots.

## Quality Gates
1. Typing latency:
- Must feel instant.

2. Collision checks:
- No major diacritic overlap in common sequences.

3. Readability:
- Top 500 generated forms clearly distinguishable.

4. Stability:
- Mapping table is versioned and backward compatible.

## Scope Guardrails
- Do not attempt full linguistic validity in v1.
- Prioritize visual coherence and typability.
- Keep unsupported combos rendering via fallback placeholder glyphs.

## First Implementation Milestone
Ship a playable build with:
1. 200-400 glyphs total.
2. IME transliteration for typing.
3. 100 curated ligatures.
4. One alternate style set (`ss01`).

This gives strong in-game usability fast, then you can expand coverage incrementally.
