# Color Variation Fields: name vs step

## Design Decision

The `Color` interface has two fields that serve different purposes:

### `step` (canonical identifier)
- **Purpose**: Band identifier for filtering and logic
- **Type**: `'lighter' | 'light' | 'dark' | 'darker'`
- **Usage**:
  - Filtering variations by band: `variations.filter(v => v.step === 'lighter')`
  - Sorting variations: `variations.sort((a, b) => order.indexOf(a.step) - order.indexOf(b.step))`
  - Matching user selections to generated colors
- **Always present**: Required for all variations in `paletteWithVariationsBase`

### `name` (display label)
- **Purpose**: Human-readable label for UI display
- **Type**: `string`
- **Usage**:
  - Showing in UI: `<span>{variation.name}</span>`
  - CSS class generation: `toSlug(variation.name)` → `"primary-lighter"`
  - Display in color cards and export previews
- **Format**: Can be "lighter", "Lighter", "Primary Lighter", etc.

## Why Both?

**Historical context**: The codebase initially used `name` for both purposes, leading to:
- Inconsistent filtering (checking both `x.step === step || x.name === step`)
- Fragile logic depending on string formatting
- Bugs when `name` format changed

**Current design**: Separation of concerns
- `step` = machine-readable identifier (filtering/logic)
- `name` = human-readable label (display)

## Implementation Rules

1. **Always use `step` for filtering**: `variations.filter(v => v.step === band)`
2. **Always use `name` for display**: `<div>{variation.name}</div>`
3. **Never fallback to `name` in logic**: Remove `v.step || v.name` patterns
4. **Ensure `step` is set**: All variations must have `step` field populated

## Example

```typescript
const variation: Color = {
  name: 'lighter',        // For display in UI
  hex: '#e3f2fd',
  step: 'lighter'         // For filtering/logic
};

// ✓ Correct: Use step for filtering
const lighterColors = variations.filter(v => v.step === 'lighter');

// ✓ Correct: Use name for display
<span>{variation.name}</span>

// ✗ Wrong: Don't use name for filtering
const lighterColors = variations.filter(v => v.name === 'lighter'); // Fragile!

// ✗ Wrong: Don't fallback to name
const id = v.step || v.name; // Should always have step
```
