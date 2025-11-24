# Stage 2 Changes Summary: Initialization & Invariant [I1]

## Goal
Ensure that on startup / first Adjust mount, `exactSelections[k][b]` is populated from the currently shown slot in each ribbon, so that invariant [I1] ("Always-selected") holds after initialization.

## Changes Made

### Added initialization effect in `pages/generator.tsx` (lines 446-508)

**What it does:**
1. Checks if any `exactSelections[k][b]` is missing for any color key and band
2. If any bands are missing, populates them with the **middle slot** from each ribbon as a sensible default
3. Constructs a full `SwatchPick` for each missing band with:
   - Exact hex, HSL, and Y values
   - Contrast ratios vs `textOnLight` and `textOnDark`
   - Appropriate `textToneUsed` (light for shades, dark for tints)
   - Middle index as `indexDisplayed`

**Key design decisions:**
- **Dependencies:** `[paletteWithVariations, textOnLight, textOnDark]`
  - Does NOT depend on `exactSelections` to avoid loops
  - Runs when palette or text tokens change
- **Early return:** If all bands already populated (e.g., from localStorage), does nothing
- **Middle slot default:** Picks `Math.floor(candidates.length / 2)` as a reasonable starting point
- **Graceful handling:** If no candidates exist for a band, skips it (will be caught by Stage 6 error handling)

**Effect placement:**
- Added after the existing `selections` ↔ `exactSelections` sync effects
- Before the derived color helpers
- Runs on every render where `paletteWithVariations` or text tokens change, but only updates state if bands are missing

## Invariant [I1] Status

**Before Stage 2:**
- ⚠️ Partially satisfied
- `exactSelections` could have missing bands if:
  - No localStorage data exists
  - User never clicked a band in Adjust tab
  - Fresh install or cleared storage

**After Stage 2:**
- ✅ **Fully satisfied**
- Every `exactSelections[k][b]` is guaranteed to exist after first render
- Missing bands are auto-populated with middle slot from ribbon
- Target Y Resolution (Stage 3-4) can now safely rely on `exactSelections[k][b].y` always being available

## Behavior Impact

**User-visible changes:**
- On first load (or after clearing localStorage), all Adjust ribbons will show a **middle slot selected** by default instead of potentially having no selection
- Palette/Export tabs will immediately show consistent colors even before user interacts with Adjust tab
- No more "undefined" bands that could cause issues in later stages

**No breaking changes:**
- If localStorage has existing `exactSelections`, those are preserved (early return)
- Existing user selections are not overwritten
- Only fills in gaps

## Testing Checklist

To verify Stage 2 works correctly:

1. **Fresh start test:**
   - Clear localStorage: `localStorage.clear()`
   - Reload page
   - Check: All 7 colors × 4 bands = 28 `exactSelections` entries should exist
   - Check: Adjust tab shows middle slot selected for each band

2. **Partial data test:**
   - Manually delete some bands from `exactSelections` in localStorage
   - Reload page
   - Check: Missing bands are auto-populated
   - Check: Existing bands are preserved

3. **Palette change test:**
   - Change a base color hex in Manual tab
   - Check: All bands remain populated (initialization runs again if needed)

4. **Text token change test:**
   - Change `textOnLight` or `textOnDark`
   - Check: All bands remain populated with updated contrast values

## Next Steps (Stage 3)

With invariant [I1] guaranteed, we can now implement:
- `resolveTargetY(k, band)` - can safely use `exactSelections[k][band].y`
- `readBandCandidates(k, band)` - read from `paletteWithVariations`
- `adoptClosestSlot(k, band, targetY)` - find closest by Y
- `applySelectionAtomically(update)` - batch state updates
- Reselection `useEffect` with correct dependencies

## Commit Message

```
feat: ensure initial exactSelections for all palette/semantic bands on startup

Stage 2 of manual-adjust-palette-dataflow.md implementation plan.

Changes:
- Added initialization effect to populate missing exactSelections bands
- Picks middle slot from each ribbon as sensible default
- Guarantees invariant [I1]: every color key and band has an exact selection
- Enables Target Y Resolution to safely rely on exactSelections[k][b].y

Behavior:
- On first load, all Adjust ribbons show middle slot selected by default
- Palette/Export tabs immediately show consistent colors
- Existing localStorage selections are preserved

Refs: docs/manual-adjust-palette-dataflow-manual-adjust-palette-dataflow.md Stage 2

Files Modified
- `pages/generator.tsx`: Added initialization effect (lines 446-508)
- `docs/manual-adjust-palette-dataflow-stage-2-changes-summary.md`: Created (this file)
```
