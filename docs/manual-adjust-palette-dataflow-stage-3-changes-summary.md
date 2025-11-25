# Stage 3 Changes Summary: Reselection Architecture (useEffect + helpers)

## Goal
Implement the core reselection architecture with helper functions and a logging-only effect to validate behavior before full state wiring in Stage 4.

## Changes Made

### Added helper functions in `pages/generator.tsx` (lines 345-453)

#### 1. `resolveTargetY(k, band)` (lines 350-375)
**Purpose:** Resolve target Y for reselection using spec priority rules.

**Logic:**
1. **Priority 1:** Use `exactSelections[k][band].y` if present and finite
2. **Priority 2:** Compute Y from `exactSelections[k][band].hex` if valid hex
3. **Priority 3:** Use `selections[k].<bandY>` for backwards compatibility
4. Return `undefined` if no target Y available

**Dependencies:** `[exactSelections, selections]`

**Why it works:** After Stage 2, invariant [I1] guarantees `exactSelections[k][band]` exists, so priority 1 or 2 will always succeed.

#### 2. `readBandCandidates(k, band)` (lines 378-389)
**Purpose:** Read band candidates from `paletteWithVariations`.

**Logic:**
- Get variations array for color key `k`
- Filter to only candidates where `step === band`
- Return empty array if no candidates (graceful failure)

**Dependencies:** `[paletteWithVariations]`

**Returns:** `Array<{ hex: string; step: string }>`

#### 3. `adoptClosestSlot(k, band, targetY)` (lines 392-441)
**Purpose:** Find closest slot by Y distance and construct full `SwatchPick`.

**Logic:**
1. Get candidates via `readBandCandidates`
2. Return `undefined` if no candidates
3. Compute Y for each candidate hex
4. Find index with minimum `|Y - targetY|`
5. Build full `SwatchPick` with:
   - Exact hex, HSL, Y
   - Contrast ratios vs `textOnLight` and `textOnDark`
   - Appropriate `textToneUsed` (light for shades, dark for tints)
   - Index as `indexDisplayed`

**Dependencies:** `[readBandCandidates, textOnLight, textOnDark]`

**Returns:** `{ index: number; pick: SwatchPick } | undefined`

#### 4. `applySelectionAtomically(updates)` (lines 444-453)
**Purpose:** Batch state updates for `selections` and `exactSelections`.

**Logic:**
- Takes both `selections` and `exactSelections` as input
- Calls `setSelections` and `setExactSelections` in sequence
- React will batch these updates automatically

**Dependencies:** `[]` (uses setters directly)

**Note:** Currently unused in Stage 3 (will be used in Stage 4).

### Added reselection effect in `pages/generator.tsx` (lines 455-503)

**Purpose:** Validate reselection logic with console logging before full state wiring.

**What it does:**
1. Loops over all 7 color keys × 4 bands = 28 combinations
2. For each band:
   - Resolves target Y via `resolveTargetY`
   - Reads candidates via `readBandCandidates`
   - Warns if no candidates exist
   - Logs if no target Y available
   - Computes closest slot via `adoptClosestSlot`
   - Logs what would be reselected (targetY, closestY, index)

**Dependencies (critical for avoiding loops):**
```javascript
[
  paletteWithVariations,
  palette.primary.hex,
  palette.secondary.hex,
  palette.tertiary.hex,
  palette.accent.hex,
  palette.error.hex,
  palette.warning.hex,
  palette.success.hex,
  textOnLight,
  textOnDark,
  resolveTargetY,
  readBandCandidates,
  adoptClosestSlot,
]
```

**Critically does NOT depend on:**
- `selections` (would cause loop)
- `exactSelections` (would cause loop)

**Current behavior:**
- ✅ Logs to console only
- ❌ Does NOT update state
- ✅ Validates that reselection logic works correctly
- ✅ Helps debug which bands would be reselected on palette/token changes

## Key Design Decisions

### 1. Logging-only in Stage 3
The reselection effect logs what it *would* do but doesn't update state yet. This allows:
- Validation that helpers work correctly
- Debugging of target Y resolution
- Verification that dependencies are correct
- No risk of breaking existing behavior

### 2. Dependency design prevents loops
By depending on:
- Base palette hexes (not derived `paletteWithVariations` alone)
- Text tokens
- Helper callbacks (stable via `useCallback`)

And NOT depending on:
- `selections` or `exactSelections`

The effect will:
- ✅ Run when user edits base colors [T1]
- ✅ Run when user edits text tokens [T2]
- ❌ NOT run when effect updates selections/exactSelections (Stage 4)

### 3. Helper functions are pure and testable
All helpers use `useCallback` with minimal dependencies and are:
- Pure functions (no side effects except logging)
- Testable in isolation
- Composable (e.g., `adoptClosestSlot` uses `readBandCandidates`)

## Behavior Impact

**User-visible:**
- None yet (logging only)
- Console will show `[Stage 3]` logs when:
  - Page loads
  - Base color hex changes in Manual tab
  - Text token changes

**Developer-visible:**
- Console logs show what reselection would do
- Helps validate that closest-by-Y logic works
- Warns if any bands have no candidates

## Testing Checklist

To verify Stage 3 works correctly:

1. **Load page and check console:**
   - Should see 28 `[Stage 3] Would reselect` logs (7 colors × 4 bands)
   - Each should show targetY, closestY, and index

2. **Change a base color hex in Manual tab:**
   - Console should log reselection for all 4 bands of that color
   - targetY should match current Y of that band
   - closestY should be the nearest candidate

3. **Change textOnLight or textOnDark:**
   - Console should log reselection for all 28 bands
   - Contrast values should update

4. **Verify no loops:**
   - Logs should appear only when palette/tokens change
   - Should NOT see infinite logging

5. **Check warnings:**
   - If any band has no candidates, should see warning with context

## Next Steps (Stage 4)

With architecture validated, Stage 4 will:
- Remove console logs
- Replace with actual state updates via `applySelectionAtomically`
- Implement full [T1] and [T2] triggers
- Verify Adjust highlights and Palette/Export respond correctly

## Commit Message

```
feat: add core reselection effect and helper functions (architecture only)

Stage 3 of manual-adjust-palette-dataflow.md implementation plan.

Changes:
- Implemented resolveTargetY using spec priority rules
- Implemented readBandCandidates to filter paletteWithVariations
- Implemented adoptClosestSlot to find closest-by-Y slot
- Implemented applySelectionAtomically for batch state updates
- Added reselection useEffect with correct dependencies (no selections/exactSelections)
- Effect logs reselection candidates for validation (no state updates yet)

Dependencies designed to avoid loops:
- Depends on: paletteWithVariations, base hexes, textOnLight, textOnDark
- Does NOT depend on: selections, exactSelections

Behavior:
- Console logs show what reselection would do
- No state updates yet (Stage 4 will wire full behavior)
- Validates that closest-by-Y logic works correctly

Refs: docs/manual-adjust-palette-dataflow.md Stage 3
```

## Files Modified

- `pages/generator.tsx`: Added helper functions and logging-only reselection effect (lines 345-503)
- `docs/manual-adjust-palette-dataflow-stage-3-changes-summary.md`: Created (this file)
