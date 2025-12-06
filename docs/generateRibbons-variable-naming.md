# generateRibbons.ts Variable Naming Fixes

## Problems Found

### 1. **`step` Collision** ❌
**Before:**
```typescript
// Line 38: Parameter name
band: 'lighter' | 'light' | 'dark' | 'darker'

// Line 46: Numeric increment
const step = 0.005;
```

**Issue**: The word "step" is used for the band identifier throughout the codebase, but inside this function it meant "luminance increment". Confusing!

**Fixed:**
```typescript
const luminanceIncrement = 0.005; // Luminance sampling granularity
```

### 2. **`y` Overloading** ❌
**Before:**
```typescript
for (let y = minY; y <= maxY; y += step) { ... }  // Loop variable
unified = aaaValid.filter((y, i) => { ... });     // Y luminance value
return { hex, y: actualY, index };                // Return property
```

**Issue**: Same variable name used for iteration counter, filter parameter, and return value. Also, `y` is not immediately clear - requires knowing WCAG terminology.

**Fixed:**
```typescript
for (let luminanceValue = minY; luminanceValue <= maxY; luminanceValue += luminanceIncrement) { ... }
unifiedLuminances = aaaValidLuminances.filter((luminanceTarget, idx) => { ... });
return { hex, y: actualLuminance, index: ribbonIndex };
```

**Note**: The return property `y` is kept as-is because it matches the `RibbonColor` interface, but the variable is now `actualLuminance`.

### 3. **`index` Ambiguity** ❌
**Before:**
```typescript
return bandColors.map((targetY, index) => {
  return { hex, y: actualY, index };  // What index is this?
});
```

**Issue**: The `index` in the return value is the position in the `bandColors` array (0-8), not a global ribbon index. Misleading name.

**Fixed:**
```typescript
return bandLuminances.map((targetLuminance, ribbonIndex) => {
  return { hex, y: actualLuminance, index: ribbonIndex };
});
```

## Variable Naming Standards

| Variable | Purpose | Type | Example |
|----------|---------|------|---------|
| `luminanceValue` | Loop iteration variable for luminance | `number` | `0.30`, `0.50` |
| `luminanceTarget` | Target luminance value being tested | `number` | `0.75` |
| `luminanceIncrement` | Luminance sampling step size | `number` | `0.005` |
| `actualLuminance` | Computed luminance from RGB | `number` | `0.749` |
| `ribbonIndex` | Position in ribbon array | `number` | `0-14` |
| `idx` | Generic array index | `number` | `0`, `1`, `2` |
| `band` | Band identifier | `'lighter' \| 'light' \| 'dark' \| 'darker'` | `'lighter'` |
| `minY`, `maxY` | Y range constants (from config) | `number` | `0.30`, `0.95` |

**Note**: Constants from `config.ts` keep the `Y` suffix (e.g., `LIGHT_MIN_Y_BASE`) for consistency with existing code. Local variables use full `luminance` names for clarity.

## Why This Matters

**Before fix:**
- Reading `for (let y = minY...)` - is this luminance or just a counter?
- Seeing `const step = 0.005` - wait, isn't `step` the band name?
- Using `index` - is this the ribbon position or something else?
- What does `y` mean? (requires WCAG knowledge)

**After fix:**
- `luminanceValue` - clearly a luminance value being iterated
- `luminanceIncrement` - clearly the increment amount
- `ribbonIndex` - clearly the position in the ribbon array
- No naming conflicts with the `step` field used elsewhere in the codebase
- Self-documenting: anyone can understand "luminance" without domain knowledge
