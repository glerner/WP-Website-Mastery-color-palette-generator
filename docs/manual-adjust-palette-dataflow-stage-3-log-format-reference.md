# Manual Adjust Palette Dataflow - Stage 3 Log Format Reference

## Quick Reference

### Log Format

```
[Stage 3] Reselection validation ▼

  PRIMARY (base: #E60000):
    lighter: target Y=0.751 [exactSelections.y (#F5B8B8)] → picked #F5B8B8 hsl(0.0, 68.2%, 91.4%) Y=0.752 [0/8]
    light: target Y=0.542 [exactSelections.y (#ED7373)] → picked #ED7373 hsl(0.0, 68.7%, 83.7%) Y=0.542 [0/8]
```

### Reading the Logs

| Element | Example | Meaning |
|---------|---------|---------|
| Family header | `PRIMARY (base: #E60000):` | Color family and current base hex |
| Band | `lighter:` | Which band (lighter, light, dark, darker) |
| Target Y | `target Y=0.751` | Desired luminance value |
| Source | `[exactSelections.y (#F5B8B8)]` | Where target Y came from |
| Selected hex | `picked #F5B8B8` | Chosen color hex |
| Selected HSL | `hsl(0.0, 68.2%, 91.4%)` | Chosen color HSL |
| Actual Y | `Y=0.752` | Actual luminance of selected color |
| Index | `[0/8]` | Position (first of 9 candidates) |

## Before vs After Examples

### Before Enhancement

```
[Stage 3] Would reselect success-darker: targetY=0.059, closestY=0.059, index=0
[Stage 3] Would reselect primary-lighter: targetY=0.751, closestY=0.751, index=0
```

**Problems:**
- No base color shown
- No selected color shown
- Hard to find specific colors
- Can't see when base changes

### After Enhancement

```
[Stage 3] Reselection validation ▼

  PRIMARY (base: #E60000):
    lighter: target Y=0.751 [exactSelections.y (#F5B8B8)] → picked #F5B8B8 hsl(0.0, 68.2%, 91.4%) Y=0.752 [0/8]

  SUCCESS (base: #00CC00):
    darker: target Y=0.059 [exactSelections.y (#003300)] → picked #003300 hsl(120.0, 100.0%, 10.0%) Y=0.059 [0/4]
```

**Benefits:**
- ✅ Base color visible
- ✅ Selected color hex and HSL shown
- ✅ Organized by family
- ✅ Easy to see changes
- ✅ Collapsible groups

## Target Y Source Types

### 1. exactSelections.y
```
[exactSelections.y (#F5B8B8)]
```
- Most common case
- Y value stored directly
- Hex shows associated color

### 2. exactSelections.hex
```
[exactSelections.hex (#F5B8B8)]
```
- Y computed from hex
- Not stored directly

### 3. selections.bandY
```
[selections.bandY]
```
- Legacy compatibility
- No hex available

## Real-World Examples

### Example 1: Normal Operation

```
[Stage 3] Reselection validation ▼

  PRIMARY (base: #E60000):
    lighter: target Y=0.751 [exactSelections.y (#F5B8B8)] → picked #F5B8B8 hsl(0.0, 68.2%, 91.4%) Y=0.752 [0/8]
    light: target Y=0.542 [exactSelections.y (#ED7373)] → picked #ED7373 hsl(0.0, 68.7%, 83.7%) Y=0.542 [0/8]
    dark: target Y=0.042 [exactSelections.y (#5C0000)] → picked #5C0000 hsl(0.0, 100.0%, 18.0%) Y=0.042 [0/4]
    darker: target Y=0.012 [exactSelections.y (#260000)] → picked #260000 hsl(0.0, 100.0%, 7.5%) Y=0.012 [0/4]
```

**Interpretation:**
- All bands have selections
- 9 lighter/light candidates `[0/8]`
- 5 dark/darker candidates `[0/4]`
- Target Y matches selected Y closely

### Example 2: Base Color Changed (Stale Target)

```
[Stage 3] Reselection validation ▼

  PRIMARY (base: #0000FF):  ← Changed to blue
    lighter: target Y=0.751 [exactSelections.y (#F5B8B8)] → picked #B8B8F5 hsl(240.0, 68.2%, 91.4%) Y=0.752 [0/8]
                                              ↑ Old red color
```

**Interpretation:**
- Base changed from red to blue
- Target Y still from old red color `#F5B8B8`
- New selection is blue `#B8B8F5`
- **Issue:** Stale target Y (will be fixed in Stage 4)

### Example 3: Text-on-Light Adjusted

```
[Stage 3] Reselection validation ▼

  PRIMARY (base: #E60000):
    lighter: target Y=0.571 [exactSelections.y (#ED9999)] → picked #ED9999 hsl(0.0, 68.7%, 83.7%) Y=0.571 [0/8]
    light: target Y=0.420 [exactSelections.y (#E64D4D)] → picked #E64D4D hsl(0.0, 68.9%, 76.5%) Y=0.420 [0/8]
```

**Interpretation:**
- Text-on-light was adjusted (out of range)
- Still have 9 candidates for each band
- Target Y values adjusted accordingly

### Example 4: No Candidates Warning

```
[Stage 3] Reselection validation ▼

  PRIMARY (base: #E60000):
    lighter: No candidates; textOnLight=#8A8A0A, textOnDark=#FFFFFF
```

**Interpretation:**
- No valid candidates for this band
- Text-on-light value shown for debugging
- **Issue:** Need to adjust text colors or base color

### Example 5: Multiple Color Families

```
[Stage 3] Reselection validation ▼

  PRIMARY (base: #E60000):
    lighter: target Y=0.751 [exactSelections.y (#F5B8B8)] → picked #F5B8B8 hsl(0.0, 68.2%, 91.4%) Y=0.752 [0/8]

  SECONDARY (base: #0066CC):
    lighter: target Y=0.751 [exactSelections.y (#B8D9F5)] → picked #B8D9F5 hsl(210.0, 68.2%, 91.4%) Y=0.752 [0/8]

  SUCCESS (base: #00CC00):
    darker: target Y=0.059 [exactSelections.y (#003300)] → picked #003300 hsl(120.0, 100.0%, 10.0%) Y=0.059 [0/4]
```

**Interpretation:**
- Multiple families shown
- Each with their own base color
- Easy to compare across families

## Console Group Usage

### Collapsed (Default)

```
▶ [Stage 3] Reselection validation
▶ [Stage 3] Reselection validation
▶ [Stage 3] Reselection validation
```

Click to expand when needed.

### Expanded

```
▼ [Stage 3] Reselection validation
    PRIMARY (base: #E60000):
      lighter: ...
      light: ...
```

Click to collapse when done.

## Debugging Scenarios

### Scenario: "Wrong color selected"

**Look for:**
1. Base color hex - is it correct?
2. Target Y source hex - does it match base?
3. Index - is it selecting first (0) or different?

**Example:**
```
PRIMARY (base: #E60000):  ← Current base
  lighter: [exactSelections.y (#F5B8B8)] ← Old target
```
**Diagnosis:** Stale target Y

### Scenario: "Not enough candidates"

**Look for:**
1. Index format: `[0/8]` = 9 candidates, `[0/4]` = 5 candidates
2. Warning messages about no candidates
3. Text-on-light/dark values

**Example:**
```
lighter: [0/2] ← Only 3 candidates
```
**Diagnosis:** Text colors too restrictive

### Scenario: "Base color didn't change"

**Look for:**
1. Base hex in family header
2. Compare across log groups
3. Check if effect ran

**Example:**
```
PRIMARY (base: #E60000):  ← Still old color
```
**Diagnosis:** Effect hasn't run yet or base didn't update

## Index Format Explained

### Format: `[current/max]`

| Display | Meaning |
|---------|---------|
| `[0/8]` | First of 9 candidates |
| `[3/8]` | Fourth of 9 candidates |
| `[0/4]` | First of 5 candidates |
| `[4/4]` | Last of 5 candidates |

### Why Always Index 0?

In Stage 3, all selections show `index=0` because:
1. Target Y values are stale (from previous color)
2. First candidate happens to match old target Y
3. This is **expected behavior** for Stage 3
4. Will be fixed in Stage 4 with actual reselection

## Summary

The enhanced Stage 3 logs provide:
- ✅ Clear visibility into selection process
- ✅ Easy identification of base color changes
- ✅ Diagnostic info for debugging
- ✅ Organized, collapsible output
- ✅ All info needed to validate behavior

**Use this reference when:**
- Debugging color selection issues
- Validating Stage 3 behavior
- Preparing for Stage 4 implementation
- Understanding why certain colors are selected
