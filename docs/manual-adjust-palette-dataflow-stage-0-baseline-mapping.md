# Stage 0: Baseline Mapping – Current Implementation vs Spec

This document maps the current implementation in `pages/generator.tsx` and `components/LuminanceTestStrips.tsx` to the spec in `manual-adjust-palette-dataflow.md`.

## Data Structures (Current State)

### `selections` (lines 166-168 in generator.tsx)
```typescript
Partial<Record<ColorType | SemanticColorType, {
  lighterIndex?: number;
  lightIndex?: number;
  darkerY?: number;
  darkY?: number
}>>
```

**Status vs Spec:**
- ✅ Has `lighterIndex` and `lightIndex` for tints (index-based)
- ✅ Has `darkerY` and `darkY` for shades (Y-based)
- ❌ **Missing `lighterY` and `lightY`** – spec requires storing target Y for tints to enable reselection

**Purpose:** UI highlight state for Adjust tab ribbons.

### `exactSelections` (lines 170-192 in generator.tsx)
```typescript
Partial<Record<ColorType | SemanticColorType, {
  lighter?: SwatchPick;
  light?: SwatchPick;
  dark?: SwatchPick;
  darker?: SwatchPick
}>>
```

**Status vs Spec:**
- ✅ Matches spec exactly
- ✅ Stores full `SwatchPick` per band (hex, y, hsl, contrasts, indexDisplayed)
- ✅ Initialized from localStorage on mount
- ✅ Persisted to localStorage on change (line 514-516)

**Purpose:** Canonical exact slot data that drives Palette/Export.

### `paletteWithVariations` (lines 287-334 in generator.tsx)
```typescript
PaletteWithVariations
```

**Status vs Spec:**
- ✅ Derived from base `palette` + semantic defaults
- ✅ Generates variations (ribbons) via `generateShades`
- ✅ Overrides band hexes with `exactSelections` (lines 309-324)
- ✅ Memoized on `[palette, exactSelections]`

**Purpose:** Derived palette with all variations, used by Adjust and Palette tabs.

### Text Tokens (lines 283-284 in generator.tsx)
- `textOnLight`: string (default `'#453521'`)
- `textOnDark`: string (default `'#F8F7F7'`)

**Status vs Spec:**
- ✅ Present and used for contrast calculations
- ✅ Hydrated from localStorage (not shown in snippet but implied)

---

## Invariants (Current State vs Spec)

### [I1: Always-selected]
**Spec:** Every color key and band must always have an exact selection in `exactSelections`.

**Current:**
- ⚠️ **Partially satisfied**
  - `exactSelections` is initialized from localStorage (lines 172-192)
  - `syncExactFromSelections` effect (lines 336-386) populates `exactSelections` from `selections` and `paletteWithVariations`
  - However, there's no explicit guarantee that all bands are populated on first render before user interaction
  - If a band is never clicked and has no localStorage entry, it may remain `undefined`

**Gap:** Need explicit initialization step to ensure all bands have an `exactSelections` entry after first Adjust render.

### [I2: Palette driven by exact]
**Spec:** `paletteWithVariations` must reflect exact selections by overriding band hexes.

**Current:**
- ✅ **Satisfied** (lines 309-324)
- `applyExact` function overrides each band's hex from `exactSelections[k][band].hex`

### [I3: No ribbon changes here]
**Spec:** This plan does not alter ribbon target computation logic.

**Current:**
- ✅ **Satisfied**
- Ribbon generation happens in `LuminanceTestStrips.tsx` and is not modified by this plan

---

## Triggers (Current State vs Spec)

### [T1: Manual base color edit]
**Spec:** Any change to `palette.<key>.hex` should trigger reselection.

**Current:**
- ❌ **Not implemented**
- No `useEffect` watches base palette hexes to trigger reselection
- When user edits a base hex in Manual tab, ribbons regenerate (via `paletteWithVariations` memo), but there's no automatic reselection of closest-by-Y

**Gap:** Need reselection effect that depends on base hexes.

### [T2: Text token edit]
**Spec:** Any change to `textOnLight` or `textOnDark` should trigger reselection.

**Current:**
- ⚠️ **Partially implemented** (lines 520-579)
- There IS a `useEffect` that depends on `textOnLight`, `textOnDark`, and `paletteWithVariations`
- However, it only ensures AAA compliance by adjusting to nearest AAA slot
- It does NOT implement the general "closest-by-Y reselection" behavior specified
- It operates on `exactSelections` directly without going through `selections`

**Gap:** Need unified reselection effect that handles both [T1] and [T2] using Target Y Resolution rules.

---

## Target Y Resolution (Current State vs Spec)

**Spec:** Use this priority:
1. `exactSelections[k][b].y` if present
2. Else compute Y from `exactSelections[k][b].hex`
3. Else use `selections[k].<bandY>`

**Current:**
- ❌ **Not implemented**
- No explicit `resolveTargetY` function
- `syncExactFromSelections` (lines 336-386) does compute Y from hex when building picks, but doesn't follow the priority rules for reselection

**Gap:** Need `resolveTargetY` helper as specified.

---

## Reselection Effect (Current State vs Spec)

**Spec:** Single `useEffect` with dependencies on:
- `paletteWithVariations`
- Base hexes: `palette.primary.hex`, etc.
- `textOnLight`, `textOnDark`
- Must NOT depend on `selections` or `exactSelections` (to avoid loops)

**Current:**
- ❌ **Not implemented as specified**
- There are TWO effects that touch this area:
  1. `syncExactFromSelections` effect (lines 386) – depends on `paletteWithVariations`, `selections`, `textOnLight`, `textOnDark`, and `syncExactFromSelections` callback
  2. Text token AAA adjustment effect (lines 520-579) – depends on `textOnLight`, `textOnDark`, `paletteWithVariations`
- Neither implements the full closest-by-Y reselection behavior
- The first effect depends on `selections`, which could cause loops (though currently mitigated by JSON.stringify equality check)

**Gap:** Need new reselection effect with correct dependencies and no `selections`/`exactSelections` dependencies.

---

## Adjust Tab Click Behavior (Current State vs Spec)

### Tint Clicks (LuminanceTestStrips.tsx lines 202-220, 291-309)
**Current:**
- ✅ Calls `onSelect(colorKey, 'lighter'|'light', index)` to update `selections`
- ✅ Calls `onSelectTint(colorKey, kind, pick)` with full `SwatchPick`
- ❌ **Does NOT store `lighterY` or `lightY` in `selections`** (because those fields don't exist yet)

**Gap:** After adding `lighterY`/`lightY` to `selections` type, need to wire tint clicks to store Y.

### Shade Clicks (LuminanceTestStrips.tsx lines 473-491, 549-567)
**Current:**
- ✅ Calls `onSelect(colorKey, 'darker'|'dark', targetY)` – already Y-based
- ✅ Calls `onSelectShade(colorKey, kind, pick)` with full `SwatchPick`
- ✅ Already stores Y in `selections` (darkerY, darkY)

**Status:** Shades already match spec behavior.

---

## Summary of Gaps for Stage 1+

1. **Data Model (Stage 1):**
   - Add `lighterY?: number` and `lightY?: number` to `selections` type

2. **Initialization (Stage 2):**
   - Ensure all `exactSelections[k][b]` are populated on first Adjust render

3. **Reselection Effect (Stage 3-4):**
   - Implement `resolveTargetY`, `readBandCandidates`, `adoptClosestSlot`, `applySelectionAtomically`
   - Add new `useEffect` with correct dependencies (no `selections`/`exactSelections`)
   - Remove or refactor existing `syncExactFromSelections` and text token effects

4. **Click Wiring (Stage 5):**
   - Update tint click handlers to store `lighterY`/`lightY` in `selections`

5. **Error Handling (Stage 6):**
   - Add explicit error when `candidates.length === 0`

---

## Files to Modify

- `pages/generator.tsx`: data model, reselection effect, click handlers
- `components/LuminanceTestStrips.tsx`: tint click handlers (store Y)
- `helpers/types.tsx`: (already correct, no changes needed)
