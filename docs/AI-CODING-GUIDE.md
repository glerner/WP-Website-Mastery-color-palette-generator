# AI Coding Guide: How to Get Professional Code from AI Models

## For Beginning AI Programmers

This guide explains how to work with AI coding assistants (Claude, GPT, etc.) to produce professional-quality code instead of accumulating technical debt.

---

## The Core Problem: The Consistency Death Spiral

### What Happens When You Don't Guide AI Properly

1. **You start with messy code** (happens to everyone)
2. **You ask AI to "add a feature"**
3. **AI reads your messy code and mimics the patterns** (to "fit in")
4. **AI adds its own inconsistencies**
5. **Code gets messier**
6. **Repeat → Death Spiral**

### Real Example from This Project

**Bad variable naming that accumulated:**
```typescript
// Different meanings for 'step':
const step = 0.005;  // Line 46: Y increment
band: 'lighter' | 'light'  // Should be called 'step' everywhere else

// Overloaded 'y':
for (let y = minY; ...)  // Loop counter
filter((y, i) => ...)    // Y luminance value
return { y: actualY }    // Return property

// Ambiguous 'index':
map((targetY, index) => ({ index }))  // Position in what array?
```

**How it happened:**
- Session 1: Someone used `step` for increment
- Session 2: AI saw `step` was "available" and used it differently
- Session 3: AI saw both patterns and got confused
- Session 4: More confusion, more conflicts

**The fix required:**
- Audit all variable names
- Rename for clarity: `luminanceIncrement`, `luminanceValue`, `luminanceTarget`, `ribbonIndex`
- Document naming standards
- Prevent future conflicts

---

## The Solution: Structured AI Prompting

### ❌ What NOT to Do

```
"Add a feature to generate lighter colors"
"Fix the bug where colors don't show up"
"Make it work with dark mode"
```

**Why this fails:**
- No quality standards specified
- No consistency checks
- AI just patches around problems
- Technical debt accumulates

### ✅ What TO Do: The 4-Step Process

## STEP 1: Code Audit First

**Prompt Template:**
```
Before implementing [feature], audit the code:

1. Read [filename] completely
2. List every variable name and its purpose
3. Flag naming conflicts (same name, different meanings)
4. Flag inconsistent patterns (camelCase vs snake_case)
5. Check for type safety issues (any types, excessive optional chaining)
6. Identify functions doing multiple things

Report findings before making ANY changes.
```

**Example for this project:**
```
Audit helpers/generateRibbons.ts:
- List all variables named 'step', 'y', 'index' and their purposes
- Check if 'step' conflicts with the 'step' field used in Color interface
- Flag any variable shadowing (same name in nested scopes)
```

## STEP 2: Establish Standards

**Prompt Template:**
```
Use these naming conventions:

VARIABLES:
- Loop counters: i, j, k OR descriptive (colorIndex, bandIndex)
- Never reuse names for different purposes
- No variable shadowing (same name in parent and child scope)
- Descriptive over short (luminanceIncrement > step, when 'step' means something else)
- Full words over abbreviations (luminanceValue > yValue, when not obvious)

FUNCTIONS:
- Single responsibility (one function = one job)
- Max 50 lines per function
- Pure functions when possible (no side effects)

TYPES:
- No 'any' types without explicit justification
- Use strict TypeScript
- Interface over type for objects
```

**Project-Specific Standards (This Codebase):**
```
LUMINANCE VALUES:
- luminanceValue: Loop iteration variable for luminance
- luminanceTarget: Target luminance being tested
- luminanceIncrement: Luminance sampling step size (0.005)
- actualLuminance: Computed luminance from RGB
- minY, maxY: Y range boundaries (keep Y for constants from config.ts)

INDICES:
- i, j, k: Generic loop counters (when purpose is obvious)
- ribbonIndex: Position in ribbon array (0-14)
- colorIndex: Position in color array
- bandIndex: Position in band array
- Never just 'index' without context

BAND IDENTIFIERS:
- 'step' field: For filtering/logic ('lighter' | 'light' | 'dark' | 'darker')
- 'name' field: For display/UI ("Lighter", "Primary Lighter")
- Never use 'name' for filtering logic
- Never use 'step' for numeric increments

COLOR PROPERTIES:
- hex: Always #RRGGBB format
- rgb: Always { r, g, b } object
- hsl: Always { h, s, l } object
- y: WCAG relative luminance [0..1]
```

## STEP 3: Refactor Before Adding Features

**Prompt Template:**
```
If you found problems in STEP 1, fix them BEFORE adding features.

DO NOT work around bad code.
DO NOT add patches.
DO refactor and clean up first.

For each problem found:
1. Propose the fix
2. Show before/after code
3. Explain why it's better
4. Wait for approval
5. Then implement
```

**Example:**
```
Found: Variable 'step' used for both Y increment and band identifier

Fix:
- Rename numeric increment: step → yIncrement
- Keep 'step' field for band identifier (used throughout codebase)
- Update all references
- Add comment: // Y sampling granularity

Why: Eliminates naming conflict, makes code self-documenting
```

## STEP 4: Implement with Quality Checks

**Prompt Template:**
```
Now implement [feature] following:

1. List all new variables and their purposes
2. Confirm no naming conflicts with existing code
3. Write the implementation
4. Add TypeScript types (no 'any')
5. Add comments for complex logic
6. Suggest unit tests

After implementation:
- Run type checker
- Check for unused variables
- Verify naming consistency
```

---

## Common AI Coding Mistakes and How to Prevent Them

### Mistake 1: Variable Shadowing

**Bad:**
```typescript
function process(colors: Color[]) {
  const index = 0;
  colors.forEach((color, index) => {  // ❌ Shadows outer 'index'
    console.log(index);  // Which index?
  });
}
```

**Good:**
```typescript
function process(colors: Color[]) {
  const startIndex = 0;
  colors.forEach((color, colorIndex) => {  // ✅ Clear, distinct
    console.log(colorIndex);
  });
}
```

**Prevention Prompt:**
```
Check for variable shadowing. Never reuse a variable name in a nested scope.
Use descriptive names: colorIndex, bandIndex, ribbonIndex.
```

### Mistake 2: Reusing Names for Different Purposes

**Bad:**
```typescript
const step = 'lighter';  // Band identifier
const step = 0.005;      // ❌ Numeric increment - CONFLICT!
```

**Good:**
```typescript
const band = 'lighter';              // ✅ Band identifier
const luminanceIncrement = 0.005;    // ✅ Numeric increment
```

**Prevention Prompt:**
```
Before using a variable name, search the file for existing uses.
If 'step' already means "band identifier", don't use it for "increment".
Choose a different, descriptive name.
```

### Mistake 3: Ambiguous Short Names

**Bad:**
```typescript
const data = fetchData();
const result = process(data);
const output = transform(result);
// What is each of these?
```

**Good:**
```typescript
const userPalette = fetchPaletteFromAPI();
const validatedColors = validateColorContrast(userPalette);
const cssVariables = transformToCSSFormat(validatedColors);
// Clear purpose for each
```

**Prevention Prompt:**
```
Use descriptive names that explain WHAT the variable contains.
Avoid: data, result, output, temp, val, x, y (unless mathematically appropriate)
Prefer: userPalette, validatedColors, cssVariables, luminanceValue
Use full words over abbreviations when not domain-standard (luminance > y)
```

### Mistake 4: Inconsistent Naming Patterns

**Bad:**
```typescript
const textOnLight = '#000000';
const text_on_dark = '#FFFFFF';
const TextOnAccent = '#FFFFFF';
// Three different styles!
```

**Good:**
```typescript
const textOnLight = '#000000';
const textOnDark = '#FFFFFF';
const textOnAccent = '#FFFFFF';
// Consistent camelCase
```

**Prevention Prompt:**
```
Use consistent naming:
- camelCase for variables and functions
- PascalCase for types, interfaces, classes, components
- SCREAMING_SNAKE_CASE for constants
- Never mix styles within the same category
```

### Mistake 5: Using 'any' Type

**Bad:**
```typescript
function processColor(color: any) {  // ❌ No type safety
  return color.hex;  // What if color doesn't have hex?
}
```

**Good:**
```typescript
interface Color {
  hex: string;
  name: string;
  step?: 'lighter' | 'light' | 'dark' | 'darker';
}

function processColor(color: Color): string {  // ✅ Type safe
  return color.hex;
}
```

**Prevention Prompt:**
```
Never use 'any' type without explicit justification.
Define proper interfaces for all data structures.
Use TypeScript's strict mode.
```

---

## Project-Specific Prompting Guide

### When Working on Color Generation

**Always specify:**
```
When working with colors in this project:

1. Use the Color interface from helpers/types.tsx
2. 'step' field is for filtering logic (band identifier)
3. 'name' field is for display only
4. Luminance variables must be prefixed: yValue, yTarget, yMin, yMax
5. Never use just 'y' or 'index' - add context
6. Check helpers/config.ts for constants (don't hardcode values)
```

### When Working with Ribbons

**Always specify:**
```
When working with ribbons (color variations):

1. Use RibbonColor interface from helpers/generateRibbons.ts
2. Each ribbon has: hex, y (luminance), index (position)
3. Bands are: 'lighter', 'light', 'dark', 'darker'
4. Never confuse band names with numeric indices
5. Check existing generateRibbonForBand logic before duplicating
```

### When Working with React Components

**Always specify:**
```
When working with React components:

1. Use functional components with hooks
2. Props interfaces must be defined
3. Use useMemo for expensive calculations
4. Use useCallback for event handlers passed to children
5. No inline object/array creation in render (causes re-renders)
6. Check existing components for patterns before creating new ones
```

---

## The Complete Workflow

### Starting a New Feature

```
I need to add [feature description].

STEP 1 - AUDIT:
Before writing code, audit these files:
- [list relevant files]

Check for:
- Variable naming conflicts
- Existing similar functionality
- Patterns I should follow
- Patterns I should avoid

STEP 2 - PLAN:
Based on the audit:
1. List all new variables/functions you'll create
2. Show their types
3. Explain their purposes
4. Confirm no conflicts with existing code

STEP 3 - REVIEW:
Wait for my approval of the plan.

STEP 4 - IMPLEMENT:
Only after approval, write the code following:
- Project naming conventions (see docs/AI-CODING-GUIDE.md)
- TypeScript strict mode
- Single responsibility principle
- Max 50 lines per function

STEP 5 - VERIFY:
After implementation:
- List all changes made
- Confirm type safety
- Suggest tests
```

### Fixing a Bug

```
There's a bug: [description]

STEP 1 - DIAGNOSE:
1. Read the relevant code
2. Identify the root cause (not just symptoms)
3. Check if this is a symptom of a larger problem

STEP 2 - ASSESS:
Is this:
- A simple typo → Fix it
- A logic error → Fix the logic
- A symptom of bad architecture → Propose refactoring

STEP 3 - FIX:
- Fix the root cause, not the symptom
- Don't add workarounds
- If the code is messy, clean it up while fixing

STEP 4 - PREVENT:
- What naming/structure would have prevented this?
- Should we add types, tests, or documentation?
- Propose improvements
```

### Refactoring Existing Code

```
I want to refactor [file/function].

STEP 1 - ANALYZE:
1. What does this code do?
2. What are the problems? (naming, structure, duplication, etc.)
3. What are the dependencies?

STEP 2 - PROPOSE:
1. New structure/organization
2. New naming conventions
3. Extracted functions/utilities
4. Type improvements

STEP 3 - MIGRATE:
1. Show before/after for each change
2. Explain why it's better
3. List all files that need updates
4. Ensure backwards compatibility (or list breaking changes)

STEP 4 - VERIFY:
- All references updated
- Types still valid
- No functionality lost
- Code is clearer
```

---

## Quality Checklist

Before accepting AI-generated code, verify:

### Naming
- [ ] No variable shadowing
- [ ] No name reuse for different purposes
- [ ] Descriptive names (not x, data, temp, result)
- [ ] Consistent style (camelCase for variables)
- [ ] Project conventions followed (yValue, ribbonIndex, etc.)

### Types
- [ ] No 'any' types (or justified)
- [ ] Interfaces defined for objects
- [ ] Function parameters typed
- [ ] Return types specified

### Structure
- [ ] Functions under 50 lines
- [ ] Single responsibility per function
- [ ] No duplicate logic
- [ ] Clear separation of concerns

### Documentation
- [ ] Complex logic has comments
- [ ] Function purposes documented
- [ ] Non-obvious decisions explained

### Testing
- [ ] Edge cases considered
- [ ] Error handling present
- [ ] Unit tests suggested/written

---

## Red Flags: When to Stop and Refactor

Stop accepting patches and demand refactoring when you see:

1. **Same variable name, different meanings**
   - Example: `step` for both increment and band identifier

2. **Functions over 100 lines**
   - Should be split into smaller functions

3. **Deeply nested conditionals** (3+ levels)
   - Extract to separate functions with clear names

4. **Duplicate code blocks**
   - Extract to shared utility function

5. **Type 'any' everywhere**
   - Define proper interfaces

6. **Comments explaining what code does** (not why)
   - Code should be self-documenting; rename variables/functions

7. **Magic numbers/strings**
   - Extract to named constants

8. **Try-catch wrapping everything**
   - Handle errors at appropriate level, not everywhere

---

## Example: Good vs Bad AI Interaction

### ❌ Bad Interaction

**You:**
> Add a function to generate lighter colors

**AI:**
```typescript
function generateColors(color: any) {
  const step = 0.005;
  const colors = [];
  for (let y = 0.3; y < 0.95; y += step) {
    const c = solve(color, y);
    colors.push(c);
  }
  return colors;
}
```

**Problems:**
- Uses 'any' type
- Reuses 'step' (conflicts with band identifier)
- Uses 'y' as loop variable (ambiguous)
- Magic numbers (0.3, 0.95)
- No documentation
- No error handling

### ✅ Good Interaction

**You:**
> I need to add a function to generate lighter color variations.
>
> STEP 1 - AUDIT:
> Check helpers/generateRibbons.ts for:
> - Existing color generation logic
> - Variable naming patterns
> - Constants used
>
> Report findings before implementing.

**AI:**
> Audit findings:
> - Existing function: generateRibbonForBand() does similar work
> - Uses yIncrement (0.005) for sampling
> - Uses LIGHT_MIN_Y_BASE (0.30) and LIGHTER_MAX_Y (0.95) constants
> - Variables: yValue (loop), yTarget (filter), actualY (result)
> - Returns RibbonColor[] interface
>
> Recommendation: Extend existing function rather than duplicate logic.

**You:**
> Good catch. Extend the existing function to support a new parameter.
> Follow existing naming conventions.

**AI:**
```typescript
/**
 * Generate lighter color variations with AAA contrast
 * @param baseHex - Base color in #RRGGBB format
 * @param textOnLight - Text color for contrast checking
 * @param targetCount - Number of variations to generate (default: 15)
 * @returns Array of lighter color variations
 */
function generateLighterVariations(
  baseHex: string,
  textOnLight: string,
  targetCount: number = TINT_TARGET_COUNT
): RibbonColor[] {
  const baseRgb = hexToRgb(baseHex);
  const textRgb = hexToRgb(textOnLight);
  const yIncrement = 0.005;
  const candidates: number[] = [];

  // Sample Y values from LIGHT_MIN_Y_BASE to LIGHTER_MAX_Y
  for (let yValue = LIGHT_MIN_Y_BASE; yValue <= LIGHTER_MAX_Y; yValue += yIncrement) {
    const rgb = solveHslLightnessForY(baseRgb, yValue);
    const contrast = getContrastRatio(rgb, textRgb);

    if (contrast >= AAA_MIN && contrast <= MAX_CONTRAST_TINTS) {
      candidates.push(yValue);
    }
  }

  // Select evenly distributed colors
  return selectEvenlyDistributed(candidates, targetCount, baseRgb);
}
```

**Why this is better:**
- Proper types (no 'any')
- Follows naming conventions (luminanceValue, luminanceIncrement)
- Uses project constants
- Documented with JSDoc
- Reuses existing utilities
- Clear, self-documenting code

---

## Summary: The Golden Rules

1. **Audit before implementing** - Understand existing code first
2. **Establish standards** - Define naming/structure conventions
3. **Refactor before adding** - Clean up bad code, don't work around it
4. **Be specific in prompts** - Don't just ask for features, demand quality
5. **Review AI output critically** - Check naming, types, structure
6. **Document decisions** - Why you chose this approach
7. **Prevent future problems** - Add standards to prevent recurrence

---

## Resources

- **This Project's Standards**: See docs/color-variation-fields.md
- **Variable Naming**: See docs/generateRibbons-variable-naming.md
- **TypeScript**: Enable strict mode in tsconfig.json
- **Code Review**: Use the checklist above before accepting AI code

---

## When to Rewrite vs Refactor

**Refactor when:**
- Core logic is sound
- Problems are localized
- Can fix incrementally
- Team understands the code

**Rewrite when:**
- Fundamental architecture problems
- Naming/structure chaos throughout
- Faster to start fresh than untangle
- Need proper testing/types from scratch

**For this project:** Consider rewrite with:
- Proper class structure
- Model-Service-View-Controller separation
- Unit tests for each function
- Strict TypeScript from the start
- Documented naming conventions
- Code review process

---

*Last updated: December 2024*
*For questions or improvements, see project maintainer*
