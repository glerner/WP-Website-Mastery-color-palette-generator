# Manual → Adjust → Palette Data Flow Plan

This document specifies the data model, invariants, triggers, and subroutine specifications to guarantee:
- Always-selected ribbon slots
- Closest-by‑Y reselection on input changes
- Exact-slot adoption by Palette/Export
- No changes to ribbon computation

All references point to code in `pages/generator.tsx` and `components/LuminanceTestStrips.tsx`.

---

## Invariants

- **[I1: Always-selected]** For every color key `k ∈ {primary, secondary, tertiary, accent, error, warning, success}` and band `b ∈ {lighter, light, dark, darker}` there is always an exact selection present in `exactSelections[k][b]`, containing the exact slot’s `hex`, `y`, `hsl`, `indexDisplayed`, and contrast metadata.
- **[I2: Palette driven by exact]** `paletteWithVariations` must reflect the exact selections by overriding its band hexes with `exactSelections` (current behavior).
- **[I3: No ribbon changes here]** This plan does not alter ribbon target computation logic in `components/LuminanceTestStrips.tsx`.

---

## Data Structures

- **`exactSelections`** (canonical exact slot data)
  - Type: `Partial<Record<ColorType|SemanticColorType, { lighter?: SwatchPick; light?: SwatchPick; dark?: SwatchPick; darker?: SwatchPick }>>`
  - Purpose: Drives Palette/Export. Stores the exact chosen slot information for each band.

- **`selections`** (UI highlight + tint Y target)
  - Type: `Partial<Record<ColorType|SemanticColorType, { lighterIndex?: number; lightIndex?: number; darkerY?: number; darkY?: number; lighterY?: number; lightY?: number }>>`
  - Purpose:
    - Tints: `lighterIndex` and `lightIndex` highlight the selected slot in Adjust; `lighterY` and `lightY` store the target Y used to reselect on changes.
    - Shades: `darkerY` and `darkY` remain Y-based (already present).

- **`paletteWithVariations`** (derived)
  - Type: `PaletteWithVariations`
  - Derived from `palette` (base hexes) + `exactSelections` overrides.

---

## Triggers (when reselection must occur)

- **[T1: Manual base color edit]** Any change to `palette.<key>.hex`.
- **[T2: Text token edit]** Any change to `textOnLight` or `textOnDark`.

Adjust tab click handlers continue to update selections immediately and do not use the reselection effect.

---

## Target Y Resolution (simple and deterministic)

- **Source of truth for reselection target Y per band:**
  1. Use `exactSelections[k][b].y` if present.
  2. Else compute `y` from `exactSelections[k][b].hex` (still exact and deterministic).
  3. Else (unexpected post-init) use `selections[k].<bandY>`.

By invariant [I1], after initialization step (see Init below), (1) or (2) will always be available. Any absence is a bug to fix—not a case for extra fallbacks.

---

## Initialization (startup)

- On program startup (or first mount), ribbons are generated and a slot is selected for each band.
- Ensure `exactSelections` is populated from the shown slots at first render of Adjust (already happens via click handlers and sync code). If any band is missing, populate it immediately from the ribbon’s currently shown selection.
- After this, [I1] holds and reselection can rely on `exactSelections` for `y`.

---

## Reselection Effect (no loops, no extra checks)

Implement a single `useEffect` in `pages/generator.tsx` that:

- **Dependencies:**
  - `paletteWithVariations`
  - Base palette hexes: `palette.primary.hex`, `palette.secondary.hex`, `palette.tertiary.hex`, `palette.accent.hex`, `palette.error.hex`, `palette.warning.hex`, `palette.success.hex`
  - `textOnLight`, `textOnDark`
- **Must NOT depend on:** `selections`, `exactSelections` (to avoid loops).

- **For each color key `k` and band `b`:**
  1. Resolve `targetY` using the Target Y Resolution rules above.
  2. Read `candidates = paletteWithVariations[k].variations.filter(v => v.step === b)`.
     - If `candidates.length === 0`: throw a clear error: `No candidates for ${k}-${b}; baseHex=${palette[k].hex}, textOnLight=${textOnLight}, textOnDark=${textOnDark}`.
  3. Compute Y for each candidate hex; find `iClosest = argmin |Y_i - targetY|`.
  4. Construct `pick: SwatchPick` from the exact candidate (hex, y, hsl, contrasts, indexDisplayed = iClosest).
  5. Atomically update state (single transaction):
     - `selections[k].lighterIndex/lightIndex = iClosest` (for tints)
     - `selections[k].lighterY/lightY = targetY` (for tints)
     - `exactSelections[k][b] = pick`

No deep-equality checks are required beyond normal React behavior. The effect runs only when its inputs change. If the computed values equal current state, React may still render, which is acceptable; there is no infinite loop because the effect doesn’t depend on `selections` or `exactSelections`.

---

## Adjust Tab Click Behavior (unchanged ribbons)

Inside `components/LuminanceTestStrips.tsx` (no changes to how ribbons are computed):

- **On tint click:**
  - Call existing `onSelectTintIndex(k, 'lighter'|'light', idx)`.
  - Also set `selections[k].lighterY/lightY` to the Y of the clicked slot.
  - Set `exactSelections[k].[band]` to the clicked slot’s `SwatchPick` (exact hex adopted by Palette/Export).

- **On shade click:**
  - Existing behavior already stores Y and exact pick; leave as is.

This keeps the Adjust UI and Palette in lockstep from clicks, while the reselection effect handles Manual/text token edits.

---

## Subroutine Specifications

- **`resolveTargetY(k: Key, band: Band): number`**
  - Input: `k` ∈ `{primary,...,success}`, `band` ∈ `{'lighter','light','dark','darker'}`
  - Output: numeric Y to target for reselection
  - Logic: Prefer `exactSelections[k][band].y`; else Y from `exactSelections[k][band].hex`; else `selections[k].<bandY>`.

- **`readBandCandidates(k: Key, band: Band): Array<{ hex: string }>`**
  - Input: `k`, `band`
  - Output: all `paletteWithVariations[k].variations` where `step === band`
  - Throws exception if empty (with context)

- **`adoptClosestSlot(k: Key, band: Band, targetY: number): { index: number; pick: SwatchPick }`**
  - Input: `k`, `band`, `targetY`
  - Output: closest index and fully-populated `SwatchPick` for that slot

- **`applySelectionAtomically(update: Record<Key, PartialBandUpdate>)`**
  - Input: batched updates for all keys and bands in one transaction
  - Effects:
    - Updates `selections` indices/Y (tints) and keeps shades Y
    - Updates `exactSelections` with the exact `SwatchPick`

- **`persistSelections()`** (optional)
  - Writes `selections` and `exactSelections` to localStorage (same keys as today).

---

## Acceptance Criteria

- **[A1]** Editing any Manual base color immediately reselects the closest-by‑Y slot for all four bands of that color; Adjust highlights update; Palette/Export show the exact selected hex.
- **[A2]** Editing `textOnLight` or `textOnDark` triggers reselect for all affected bands across all colors.
- **[A3]** No changes to ribbon algorithms. If any band list is empty, a clear error is raised with enough context to debug.
- **[A4]** After startup, there is always a valid `exactSelections[k][b]`; reselection logic never needs to invent a fallback.

---

## Implementation Order (no extra checks, focused only on the problem)

1. **Extend `selections`** to include `lighterY` and `lightY` (tints). Shades already use Y.
2. **Add reselection `useEffect`** in `pages/generator.tsx` with the exact dependencies listed; do not depend on `selections` or `exactSelections`.
3. **Wire tint clicks** (already present) to also store `lighterY`/`lightY` and set `exactSelections` to the exact slot.
4. **Throw explicit error** if `candidates.length === 0` for any band.
5. (Optional) **Persist** updated states to localStorage.

---

## Notes

- We are not adding speculative guards or deep-equality gates. Loop avoidance is ensured by dependency design of the effect.
- Any missing data after init is treated as a bug to fix—log and address, not worked around.

---

## Unified Color Catalog (palette, semantic, imported theme.json) — Spec (no code)

This extends the data model to treat all exportable colors uniformly: user palette colors, semantic colors, and colors imported from `theme.json`.

### Goals

- **[G1]** Represent all colors in a single catalog for consistent assignment, validation, and export.
- **[G2]** Allow assigning each imported `theme.json` color to a palette/semantic color (or a custom override) using the same data structure.
- **[G3]** Flag imported colors for contrast compliance against both `text-on-light` and `text-on-dark` until an assignment is made (or an override is AAA-compliant; this is the same as all other colors).
- **[G4]** Define export policy when imported colors are unassigned or fail contrast.

### Data Model Additions

- **`UnifiedColorCatalog`**
  - `palette`: map of palette keys (`primary`, `secondary`, `tertiary`, `accent`) to their bands and exact picks.
    - Bands: `lighter`, `light`, `base`, `dark`, `darker` (all 4 adjusted bands plus base exist in the catalog).
  - `semantic`: map of semantic keys (`error`, `warning` (notice), `success`) with full 4-band computation in the catalog, but only two bands are selected for output (one per scheme: `light` and `dark`).
    - Catalog contains: `lighter`, `light`, `base`, `dark`, `darker` (computed),
    - Output selection: exactly two bands (user's selection for light scheme, user's selection for dark scheme) are chosen and exported.
  - `imported`: array/map of entries detected from `theme.json` (`{ slug: string; label?: string; sourceHex?: string }`). Each entry has:
    - Band model: a single effective band (one hex) that may coincide with a palette band; it does not carry 4-band variations.
    - `assignment?: { type: 'palette'|'semantic'|'custom'; key?: PaletteOrSemanticKey; band?: Band; hexOverride?: string }`
    - `contrastFlags: { OkLight: boolean; OkDark: boolean }` (computed vs current text tokens using the effective hex derived from assignment or override)
    - `status: 'unassigned'|'assigned'|'override'`

### Assignment Rules

- **Palette/Semantic assignment**: the effective hex for an imported entry is the exact pick from the assigned key/band in the catalog (no recomputation).
- **Custom override**: user can set a direct hex; it must pass contrast checks.
- **Unassigned**: entry remains flagged until assigned; effective hex is undefined.

### Contrast Validation

- For any effective hex (`palette/semantic/custom override`), compute contrast vs `text-on-light` and `text-on-dark` and set `contrastFlags.OkLight` / `OkDark` accordingly.
- Display flags in the assignment UI; provide guidance to choose a different band or override.

### UI/UX (new tab)

- **“Assigned Colors” tab** (new tab, the Manual tab is too cluttered already):
  - List imported `theme.json` colors (`slug`, optional `label`, preview swatch).
  - For each row: selector to assign to palette/semantic key + band, or set a custom override hex.
  - Show live contrast flags vs both text tokens; indicate scheme applicability.
  - Provide bulk tools (e.g., assign groups by slug prefix) later if needed.

### Export Policy (to be decided; spec options)

- **Option A (strict)**: Refuse export if any imported entry is `unassigned` or has `contrastFlags.badOnLight || badOnDark`.
- **Option B (warn + allow)**: Show a blocking modal with a checklist; user can override to proceed.
- **Option C (partial)**: Exclude failing entries from export and emit a report; proceed with the rest.

Recommend Option B initially for usability, with a toggle for strictness.

### Triggers and Recalc

- Changes to `text-on-light` / `text-on-dark` → recompute `contrastFlags` for all imported entries (effective hex unchanged unless assignment changes).
- Changes to palette/semantic exact picks (via Adjust reselection or clicks) → recompute effective hex for assigned imported entries and re-validate contrast flags.

### Subroutine Specs (no code)

- **`resolveEffectiveHex(entry): string | undefined`**
  - If `assignment.type === 'palette'|'semantic'` → fetch exact hex from catalog at `key/band`.
  - If `assignment.type === 'custom'` → return `hexOverride`.
  - Else undefined (unassigned).

- **`validateContrast(hex, textOnLight, textOnDark): { badOnLight: boolean; badOnDark: boolean }`**
  - Compute contrast vs both tokens; set flags accordingly.

- **`recomputeImportedFlags()`**
  - For all imported entries, recompute `contrastFlags` from `resolveEffectiveHex` and current tokens.

### Acceptance Criteria (spec-only)

- **[U1]** All colors (palette, semantic, imported) live in a unified catalog used for export.
- **[U2]** Imported entries can be assigned to palette/semantic bands or overridden by a custom hex.
- **[U3]** Contrast flags update immediately when tokens or assignments change.
- **[U4]** Export policy is enforced per selected option (strict/warn/partial).

---

## Implementation Plan & Commit Stages

This section outlines a practical, staged implementation order for the dataflow and unified catalog work above, with natural boundaries for `git commit`.

### Stage 0 – Baseline & Mapping (no behavior changes)

- Map current implementations of `selections`, `exactSelections`, `paletteWithVariations`, text tokens, and Adjust/ribbon logic in `pages/generator.tsx` and `components/LuminanceTestStrips.tsx` to this spec.
- Capture which invariants already hold and where reselection / Target Y logic is currently missing.

**Commit:** docs-only / tiny refactor.

### Stage 1 – Data Model Prep for Invariants & Target Y

- Extend `selections` to include `lighterY` and `lightY` (tints) where needed.
- Ensure `exactSelections` type matches the spec and can store a `SwatchPick` per band.
- Optionally add small helpers for constructing a `SwatchPick` from a ribbon slot without changing behavior.

**Commit:** prepare `selections` / `exactSelections` for new Adjust dataflow (types and model only).

### Stage 2 – Initialization & Invariant [I1]

- Ensure that on startup / first Adjust mount, `exactSelections[k][b]` is populated from the currently shown slot in each ribbon.
- Fill any missing `exactSelections` entries immediately so that [I1] (“Always-selected”) holds after init.

**Commit:** ensure initial `exactSelections` for all palette/semantic bands on startup.

### Stage 3 – Reselection Architecture (useEffect + helpers)

- In `pages/generator.tsx`, define pure helpers:
  - `resolveTargetY(k, band)`
  - `readBandCandidates(k, band)`
  - `adoptClosestSlot(k, band, targetY)`
  - `applySelectionAtomically(update)`
- Add the reselection `useEffect` with the dependencies listed above (`paletteWithVariations`, base hexes, `textOnLight`, `textOnDark`) and no dependency on `selections` or `exactSelections`.
- Initially, it is acceptable to log or partially update state while validating behavior.

**Commit:** add core reselection effect and helper functions (architecture only).

### Stage 4 – Full Reselection Wiring (Manual + Text Tokens)

- Wire the `useEffect` to fully implement [T1] and [T2]:
  - Loop over all color keys and bands.
  - Resolve `targetY`, read candidates, throw explicit error if empty.
  - Choose closest-by-Y slot, construct `SwatchPick`, and update `selections` / `exactSelections` via `applySelectionAtomically`.
- Verify that Adjust highlights and Palette/Export respond correctly when:
  - Editing any `palette.<key>.hex`.
  - Editing `textOnLight` or `textOnDark`.

**Commit:** reselect closest-by-Y Adjust slots on Manual base and text token changes.

### Stage 5 – Adjust Tab Click Behavior Wiring

- In `components/LuminanceTestStrips.tsx`:
  - For tint clicks, keep existing `onSelectTintIndex` calls.
  - Also store `lighterY` / `lightY` in `selections` and update `exactSelections` with the clicked `SwatchPick`.
- Confirm shade clicks already store Y and exact pick as required; adjust only if needed.

**Commit:** sync Adjust tint clicks with `selections` Y and `exactSelections` while preserving ribbon computation.

### Stage 6 – Error Handling & Optional Persistence

- Finalize explicit error throwing when `candidates.length === 0` for any band, including helpful context.
- Implement `persistSelections()` (if desired) to sync `selections` and `exactSelections` to `localStorage`, and decide when to call it.

**Commit:** add explicit Adjust band error handling and optional selections persistence.

### Stage 7 – Unified Color Catalog: Data Model Only

- Introduce `UnifiedColorCatalog` types for `palette`, `semantic`, and `imported` entries.
- Define `assignment`, `contrastFlags`, and `status` fields.
- Stub helpers `resolveEffectiveHex`, `validateContrast`, and `recomputeImportedFlags` as pure functions.

**Commit:** introduce unified color catalog data model and helpers (no UI changes yet).

### Stage 8 – Assigned Colors UI & Export Policy (optional / later)

- Implement the “Assigned Colors” tab UI for imported `theme.json` entries, using the unified catalog.
- Wire live contrast flags and assignment/override controls.
- Implement the chosen export policy option (strict / warn + allow / partial) using the catalog.

**Commit:** add Assigned Colors tab and export policy for imported `theme.json` colors.

### Natural Stopping Points

- After Stage 6: Adjust/manual dataflow is complete and stable.
- After Stage 7: unified catalog data model is in place without UI.
- After Stage 8: full Adjust + catalog + import/export experience is implemented.
