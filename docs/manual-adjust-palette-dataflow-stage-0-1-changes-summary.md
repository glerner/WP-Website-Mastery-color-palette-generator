# Stage 0 & Stage 1 Changes Summary

## Stage 0: Baseline & Mapping ✅

**Goal:** Map current implementation to spec and identify gaps.

**Deliverable:** Created `docs/stage-0-baseline-mapping.md` with complete analysis of:
- Current data structures vs spec requirements
- Invariants status (I1, I2, I3)
- Triggers status (T1, T2)
- Target Y Resolution implementation gaps
- Reselection effect gaps
- Adjust tab click behavior gaps

**Key Findings:**
- `selections` was missing `lighterY` and `lightY` fields
- `exactSelections` already matches spec perfectly
- No reselection effect exists for [T1] (manual base color edits)
- Text token effect [T2] exists but doesn't follow Target Y Resolution rules
- Tint clicks don't store Y values (because fields didn't exist)
- Helper `isValidSwatchPick` already exists and is used

**Commit Message:**
```
chore: document current Adjust/palette dataflow vs new spec

- Created stage-0-baseline-mapping.md with complete analysis
- Identified gaps in selections type, reselection logic, and click handlers
- No behavior changes, docs only
```

---

## Stage 1: Data Model Prep for Invariants & Target Y ✅

**Goal:** Prepare data structures to support Target Y Resolution and reselection.

**Changes Made:**

### 1. Extended `selections` type in `pages/generator.tsx` (lines 166-175)
**Before:**
```typescript
Partial<Record<ColorType | SemanticColorType, {
  lighterIndex?: number;
  lightIndex?: number;
  darkerY?: number;
  darkY?: number
}>>
```

**After:**
```typescript
Partial<Record<ColorType | SemanticColorType, {
  lighterIndex?: number;
  lightIndex?: number;
  lighterY?: number;  // Target Y for lighter band (tints)
  lightY?: number;    // Target Y for light band (tints)
  darkerY?: number;
  darkY?: number
}>>
```

**Rationale:** Enables storing target Y for tint bands, which is required for:
- Target Y Resolution (spec priority rule #3)
- Reselection after manual base color or text token changes

### 2. Updated `LuminanceTestStrips` prop type in `components/LuminanceTestStrips.tsx` (lines 608-615)
**Change:** Updated `selections` prop type to match the extended type from generator.tsx.

**Rationale:** Type consistency across component boundary.

### 3. Added inline documentation to `exactSelections` in `pages/generator.tsx` (lines 176-178)
**Added:**
```typescript
// Exact picks captured from Adjust (used to override Palette/Export)
// Type matches spec: Partial<Record<ColorType|SemanticColorType, { lighter?: SwatchPick; light?: SwatchPick; dark?: SwatchPick; darker?: SwatchPick }>>
// Invariant [I1]: After initialization, every color key and band should have an exact selection
```

**Rationale:** Documents that type already matches spec and notes the invariant we need to maintain.

### 4. Verified existing helpers
- `isValidSwatchPick(p: any): p is SwatchPick` already exists (line 36)
- Used in localStorage hydration and click handlers
- No new helper needed

---

## Behavior Impact

**None.** These are type-only changes with inline documentation. No runtime behavior is altered.

- `lighterY` and `lightY` fields are optional and currently unused
- Existing code continues to work exactly as before
- No new logic introduced

---

## Next Steps (Stage 2+)

With data model ready, we can now:

1. **Stage 2:** Add initialization logic to ensure [I1] (always-selected invariant)
2. **Stage 3:** Implement reselection architecture (useEffect + helpers)
3. **Stage 4:** Wire full reselection for [T1] and [T2]
4. **Stage 5:** Update tint click handlers to populate `lighterY`/`lightY`
5. **Stage 6:** Add error handling and persistence

---

## Commit Message for Stage 1

```
refactor: prepare selections and exactSelections for new Adjust dataflow

Stage 1 of manual-adjust-palette-dataflow.md implementation plan.

Changes:
- Extended selections type to include lighterY and lightY fields for tints
- Updated LuminanceTestStrips prop type to match
- Added inline documentation confirming exactSelections matches spec
- Verified isValidSwatchPick helper already exists

No behavior changes. Type-only prep for reselection logic.

Refs: docs/manual-adjust-palette-dataflow.md Stage 1
```

---

## Files Modified

- `pages/generator.tsx`: Extended `selections` type, added `exactSelections` docs
- `components/LuminanceTestStrips.tsx`: Updated `selections` prop type
- `docs/stage-0-baseline-mapping.md`: Created (Stage 0)
- `docs/stage-0-1-changes-summary.md`: Created (this file)
