# MSVC Architecture - Preliminary Design

## Overview

This document defines the Model-Service-View-Controller architecture for the color palette generator, with a focus on testability, single source of truth, and clear separation of concerns.

**Key Principle**: Data flows in ONE direction: User Input → Model → Service → Controller → View

---

## Current State vs. Future Vision

### Current State (Prototype/Discovery Phase)

**Purpose**: Rapid experimentation to discover what works and what the application needs.

**Acceptable Trade-offs**:
- ✅ Sloppy code is acceptable during discovery
- ✅ Hardcoded lists and duplicate logic are fine for prototyping
- ✅ Mixed concerns (Model + View + Controller in one file) speed up iteration
- ✅ Manual testing is sufficient for exploring features

**Known Issues**:
- ⚠️ Debugging is challenging due to tangled dependencies
- ⚠️ Improving code requires touching multiple unrelated areas
- ⚠️ Adding features requires changes in many places
- ⚠️ No automated tests make refactoring risky

**Current Features**:
- 7 color families: primary, secondary, tertiary, accent, error, warning, success
- 4 variation bands: lighter, light, dark, darker
- WCAG AAA contrast validation
- Manual color selection in Adjust tab
- Export to theme.json

### Future Vision (Production Rewrite)

**Purpose**: Production-ready application with extensibility and maintainability.

**Architecture Goals**:
- ✅ MSVC separation for testability
- ✅ Configuration-driven behavior
- ✅ Single source of truth for all algorithms
- ✅ Comprehensive test coverage (unit, integration, E2E)
- ✅ Clear data flow and debugging

**Planned Features**:

#### 1. Color Wheel Harmonies
Generate color families based on color theory:
- **Analogous + Complementary**: `['primary', 'analogous1', 'analogous2', 'complementary']`
- **Triadic**: `['primary', 'triadic1', 'triadic2']`
- **Split-Complementary**: `['primary', 'splitComp1', 'splitComp2']`
- **Tetradic**: `['primary', 'tetradic1', 'tetradic2', 'tetradic3']`
- **Custom**: User-defined color sets with custom names

**Implementation**:
```typescript
export class HarmonyGenerator {
  static generateAnalogous(baseHue: number, count: number): string[] {
    // Generate colors ±30° on color wheel
  }

  static generateComplementary(baseHue: number): string {
    // Generate color 180° opposite
  }

  static generateTriadic(baseHue: number): string[] {
    // Generate colors 120° apart
  }
}

// Usage
const harmony = HarmonyGenerator.generateAnalogous(220, 2); // Blue + 2 analogous
PaletteConfig.COLOR_FAMILIES = ['primary', 'analogous1', 'analogous2', 'complementary'];
```

#### 2. Tailwind-like Numeric Scale (10-90)
Add to "lighter/light/dark/darker" (that users would pick from) a numeric scale (that theme designers would use):
- **10-40**: Tints (lightest to light)
- **50**: Base color (middle, not the original hex color)
- **60-90**: Shades (dark to darkest)

**Benefits**:
- More granular control (9 steps instead of 4)
- Industry-standard naming (matches Tailwind CSS)
- Easier to communicate ("use primary-30" vs "use primary lighter")

**Implementation**:
```typescript
static readonly BANDS = [
  { step: 10, label: '10', luminanceRange: [0.95, 1.0] },
  { step: 20, label: '20', luminanceRange: [0.85, 0.95] },
  { step: 30, label: '30', luminanceRange: [0.75, 0.85] },
  { step: 40, label: '40', luminanceRange: [0.65, 0.75] },
  { step: 50, label: '50', luminanceRange: [0.45, 0.65] }, // Base
  { step: 60, label: '60', luminanceRange: [0.35, 0.45] },
  { step: 70, label: '70', luminanceRange: [0.25, 0.35] },
  { step: 80, label: '80', luminanceRange: [0.15, 0.25] },
  { step: 90, label: '90', luminanceRange: [0.05, 0.15] },
] as const;

// Usage: primary-30, secondary-70, accent-50-alpha-20
```

#### 3. Transparency Variants
Add alpha channel support for each shade:
- **Alpha levels**: 10%, 20%, 30%, ..., 90%
- **Naming**: `primary-50-alpha-20` (primary shade 50 at 20% opacity)
- **Use cases**: Overlays, shadows, glass effects

**Implementation**:
```typescript
export interface ColorVariationWithAlpha extends ColorVariation {
  alpha?: number;  // 0-1 (0.1 = 10%, 0.9 = 90%)
  rgba?: string;   // rgba(37, 99, 235, 0.2)
}

export class AlphaVariantGenerator {
  static generateAlphaVariants(hex: string, alphaLevels: number[]): ColorVariationWithAlpha[] {
    return alphaLevels.map(alpha => ({
      hex,
      alpha,
      rgba: hexToRgba(hex, alpha),
      // ... other fields
    }));
  }
}
```

#### 4. User-Defined Color Sets
Allow custom color family names:
- **Brand colors**: `['brand', 'accent', 'highlight', 'muted']`
- **Semantic colors**: `['info', 'success', 'warning', 'error', 'neutral']`
- **Custom sets**: User can define any names

**Implementation**:
```typescript
export class DynamicPaletteConfig extends PaletteConfig {
  constructor(colorFamilies: string[], bands: BandDefinition[]) {
    // Override static config with user-provided values
  }
}

// Usage
const customConfig = new DynamicPaletteConfig(
  ['brand', 'accent', 'highlight'],
  [{ step: 10, label: '10' }, /* ... */]
);
```

### Migration Path: Prototype → Production

**Phase 1: Document Current Behavior** ✅
- Write down what works and what doesn't
- Identify pain points and bottlenecks
- Define future requirements (this document)

**Phase 2: Extract Pure Functions** (Next)
- Move color generation logic to pure functions
- Write unit tests for algorithms
- No UI changes yet

**Phase 3: Create Configuration Layer**
- Implement `PaletteConfig` class
- Replace hardcoded lists with config
- Maintain backward compatibility

**Phase 4: Implement MSVC Architecture**
- Extract Model, Service, Controller layers
- Write comprehensive tests
- Refactor UI to use new architecture

**Phase 5: Add New Features**
- Color wheel harmonies
- Tailwind numeric scale
- Transparency variants
- User-defined color sets

**Key Insight**: The current "sloppy" code served its purpose—it helped discover requirements. Now that we know what we need, we can build it properly with MSVC architecture.

---

## Model Layer (Pure TypeScript - No React, No Side Effects)

### ColorGeneration.ts

Pure functions for generating color variations. No state, no React, fully testable.

```typescript
/**
 * Configuration for color variation generation
 */
export interface GenerationConfig {
  tintTargetCount: number;      // Number of tints to generate (default: 9)
  shadeTargetCount: number;     // Number of shades to generate (default: 5)
  lighterMaxY: number;          // Maximum Y for lighter band
  lightMinY: number;            // Minimum Y for light band
  darkerMinY: number;           // Minimum Y for darker band
  darkMaxY: number;             // Maximum Y for dark band
}

/**
 * A single color variation with all metadata
 */
export interface ColorVariation {
  hex: string;                  // #RRGGBB
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  y: number;                    // Luminance (0-1)
  step: 'lighter' | 'light' | 'dark' | 'darker';
  index: number;                // Position in its band (0-based)
}

/**
 * Generate all variations for a single base color.
 * This is the SINGLE SOURCE OF TRUTH for color generation.
 * Used by both Adjust tab and Palette tab.
 *
 * @param baseHex - Base color in #RRGGBB format
 * @param config - Generation configuration
 * @returns Array of color variations, sorted by band and Y value
 */
export function generateColorVariations(
  baseHex: string,
  config: GenerationConfig
): ColorVariation[] {
  // Implementation uses buildTargets() algorithm from LuminanceTestStrips
  // NOT generateShades() - we eliminate the duplicate system
}

/**
 * Generate variations for a specific band only.
 * Used when you only need one band (optimization).
 */
export function generateBandVariations(
  baseHex: string,
  band: 'lighter' | 'light' | 'dark' | 'darker',
  config: GenerationConfig
): ColorVariation[] {
  // Subset of generateColorVariations
}

/**
 * Get default configuration values
 */
export function getDefaultConfig(): GenerationConfig {
  // Returns config from helpers/config.ts
}
```

### ColorSelection.ts

Pure functions for selection logic. No state, fully testable.

```typescript
/**
 * Target for reselection - what we're trying to find
 */
export interface SelectionTarget {
  targetY: number;              // Desired luminance
  source: 'user' | 'auto' | 'stored';
  originalHex?: string;         // Original color if available
}

/**
 * Result of a selection operation
 */
export interface SelectionResult {
  variation: ColorVariation;    // The selected color
  index: number;                // Index in the band
  distance: number;             // Distance from target Y
}

/**
 * Find the closest color to a target Y value.
 * This is the core reselection algorithm.
 *
 * @param targetY - Desired luminance (0-1)
 * @param candidates - Available color variations
 * @returns The closest match
 */
export function findClosestByY(
  targetY: number,
  candidates: ColorVariation[]
): SelectionResult {
  // Implementation from adoptClosestSlot()
  // Pure function - no side effects
}

/**
 * Find closest color with additional constraints
 */
export function findClosestWithConstraints(
  target: SelectionTarget,
  candidates: ColorVariation[],
  constraints: {
    minY?: number;
    maxY?: number;
    minGap?: number;            // Minimum gap from another selection
    otherY?: number;            // Y value to maintain gap from
  }
): SelectionResult {
  // Used for auto-correction to avoid too-close selections
}

/**
 * Determine if two selections are too close
 */
export function areSelectionsTooClose(
  y1: number,
  y2: number,
  minimumGap: number
): boolean {
  return Math.abs(y1 - y2) < minimumGap;
}
```

### ColorValidation.ts

Pure functions for validation and quality checks.

```typescript
/**
 * Contrast validation result
 */
export interface ContrastCheck {
  ratio: number;                // Contrast ratio
  level: 'AAA' | 'AA' | 'FAIL';
  passes: boolean;
}

/**
 * Y-gap validation result
 */
export interface YGapCheck {
  gap: number;
  minimum: number;
  recommended: number;
  passes: boolean;
  warning?: string;
}

/**
 * Check contrast ratio between two colors
 */
export function checkContrast(
  foreground: { r: number; g: number; b: number },
  background: { r: number; g: number; b: number },
  level: 'AAA' | 'AA'
): ContrastCheck {
  // Implementation from existing contrast functions
}

/**
 * Check Y-gap between two selections
 */
export function checkYGap(
  y1: number,
  y2: number,
  type: 'tint' | 'shade'
): YGapCheck {
  // Implementation from existing gap validation
}

/**
 * Validate a complete palette
 */
export interface PaletteValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  contrastIssues: Array<{ color: string; band: string; issue: string }>;
  gapIssues: Array<{ color: string; bands: string; issue: string }>;
}

export function validatePalette(
  palette: CompletePalette,
  textOnLight: string,
  textOnDark: string
): PaletteValidation {
  // Comprehensive validation
}
```

---

## Service Layer (Business Logic - Orchestration)

### PaletteService.ts

Orchestrates Model functions to implement business workflows.

```typescript
/**
 * Complete palette with all selections
 */
export interface CompletePalette {
  colors: {
    primary: ColorFamily;
    secondary: ColorFamily;
    tertiary: ColorFamily;
    accent: ColorFamily;
    error: ColorFamily;
    warning: ColorFamily;
    success: ColorFamily;
  };
  textOnLight: string;
  textOnDark: string;
  metadata: {
    generatedAt: Date;
    version: string;
  };
}

/**
 * A color family with base color and all variations
 */
export interface ColorFamily {
  base: string;                 // Base hex color
  variations: ColorVariation[]; // All generated variations
  selections: {
    lighter: SelectionResult;
    light: SelectionResult;
    dark: SelectionResult;
    darker: SelectionResult;
  };
}

/**
 * Service for palette operations
 */
export class PaletteService {
  private config: GenerationConfig;

  constructor(config?: Partial<GenerationConfig>) {
    this.config = { ...getDefaultConfig(), ...config };
  }

  /**
   * Generate a complete color family from a base color
   */
  generateColorFamily(baseHex: string): ColorFamily {
    const variations = generateColorVariations(baseHex, this.config);

    // Auto-select defaults (first of each band)
    const selections = {
      lighter: findClosestByY(0.85, variations.filter(v => v.step === 'lighter')),
      light: findClosestByY(0.65, variations.filter(v => v.step === 'light')),
      dark: findClosestByY(0.08, variations.filter(v => v.step === 'dark')),
      darker: findClosestByY(0.05, variations.filter(v => v.step === 'darker')),
    };

    return { base: baseHex, variations, selections };
  }

  /**
   * Reselect variations when base color changes
   * Maintains Y targets from previous selections
   */
  reselectColorFamily(
    newBaseHex: string,
    previousSelections: ColorFamily['selections']
  ): ColorFamily {
    const variations = generateColorVariations(newBaseHex, this.config);

    // Maintain Y targets from previous selections
    const selections = {
      lighter: findClosestByY(
        previousSelections.lighter.variation.y,
        variations.filter(v => v.step === 'lighter')
      ),
      light: findClosestByY(
        previousSelections.light.variation.y,
        variations.filter(v => v.step === 'light')
      ),
      dark: findClosestByY(
        previousSelections.dark.variation.y,
        variations.filter(v => v.step === 'dark')
      ),
      darker: findClosestByY(
        previousSelections.darker.variation.y,
        variations.filter(v => v.step === 'darker')
      ),
    };

    return { base: newBaseHex, variations, selections };
  }

  /**
   * Update a single band selection
   */
  updateBandSelection(
    family: ColorFamily,
    band: 'lighter' | 'light' | 'dark' | 'darker',
    index: number
  ): ColorFamily {
    const bandVariations = family.variations.filter(v => v.step === band);
    if (index < 0 || index >= bandVariations.length) {
      throw new Error(`Invalid index ${index} for band ${band}`);
    }

    const newSelection = {
      variation: bandVariations[index],
      index,
      distance: 0,
    };

    return {
      ...family,
      selections: {
        ...family.selections,
        [band]: newSelection,
      },
    };
  }

  /**
   * Generate complete palette from base colors
   */
  generateCompletePalette(baseColors: {
    primary: string;
    secondary: string;
    tertiary: string;
    accent: string;
    error: string;
    warning: string;
    success: string;
  }): CompletePalette {
    return {
      colors: {
        primary: this.generateColorFamily(baseColors.primary),
        secondary: this.generateColorFamily(baseColors.secondary),
        tertiary: this.generateColorFamily(baseColors.tertiary),
        accent: this.generateColorFamily(baseColors.accent),
        error: this.generateColorFamily(baseColors.error),
        warning: this.generateColorFamily(baseColors.warning),
        success: this.generateColorFamily(baseColors.success),
      },
      textOnLight: '#000000',
      textOnDark: '#FFFFFF',
      metadata: {
        generatedAt: new Date(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Export palette to theme.json format
   */
  exportToThemeJson(palette: CompletePalette): object {
    // Implementation returns WordPress theme.json structure
  }
}
```

### StorageService.ts

Handles persistence to localStorage.

```typescript
/**
 * Service for localStorage operations
 */
export class StorageService {
  private readonly KEYS = {
    PALETTE: 'gl_palette',
    SELECTIONS: 'gl_palette_selections',
    TEXT_ON_LIGHT: 'gl_theme_text_on_light_hex',
    TEXT_ON_DARK: 'gl_theme_text_on_dark_hex',
  };

  /**
   * Save complete palette
   */
  savePalette(palette: CompletePalette): void {
    try {
      localStorage.setItem(this.KEYS.PALETTE, JSON.stringify(palette));
    } catch (error) {
      console.error('Failed to save palette:', error);
    }
  }

  /**
   * Load complete palette
   */
  loadPalette(): CompletePalette | null {
    try {
      const raw = localStorage.getItem(this.KEYS.PALETTE);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error('Failed to load palette:', error);
      return null;
    }
  }

  /**
   * Clear all stored data
   */
  clearAll(): void {
    Object.values(this.KEYS).forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error(`Failed to remove ${key}:`, error);
      }
    });
  }
}
```

---

## Controller Layer (React Hooks - State Management)

### useColorGeneration.ts

Hook for managing color generation state.

```typescript
/**
 * Hook for color generation
 */
export function useColorGeneration(baseColors: {
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
  error: string;
  warning: string;
  success: string;
}) {
  const service = useMemo(() => new PaletteService(), []);

  const [palette, setPalette] = useState<CompletePalette>(() => {
    return service.generateCompletePalette(baseColors);
  });

  // When base colors change, reselect maintaining Y targets
  useEffect(() => {
    const updated = { ...palette };
    let changed = false;

    (Object.keys(baseColors) as Array<keyof typeof baseColors>).forEach(key => {
      if (baseColors[key] !== palette.colors[key].base) {
        updated.colors[key] = service.reselectColorFamily(
          baseColors[key],
          palette.colors[key].selections
        );
        changed = true;
      }
    });

    if (changed) {
      setPalette(updated);
    }
  }, [baseColors, palette, service]);

  return palette;
}
```

### useColorSelection.ts

Hook for managing user selections.

```typescript
/**
 * Hook for managing color selections
 */
export function useColorSelection(initialPalette: CompletePalette) {
  const service = useMemo(() => new PaletteService(), []);
  const [palette, setPalette] = useState(initialPalette);

  const updateSelection = useCallback((
    colorKey: keyof CompletePalette['colors'],
    band: 'lighter' | 'light' | 'dark' | 'darker',
    index: number
  ) => {
    setPalette(prev => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorKey]: service.updateBandSelection(prev.colors[colorKey], band, index),
      },
    }));
  }, [service]);

  return { palette, updateSelection };
}
```

### usePaletteSync.ts

Hook for syncing with localStorage.

```typescript
/**
 * Hook for palette persistence
 */
export function usePaletteSync(palette: CompletePalette) {
  const storage = useMemo(() => new StorageService(), []);

  // Save on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      storage.savePalette(palette);
    }, 500);

    return () => clearTimeout(timer);
  }, [palette, storage]);

  // Load on mount
  useEffect(() => {
    const saved = storage.loadPalette();
    if (saved) {
      // Merge saved with current (handled by parent)
    }
  }, [storage]);

  return { clearStorage: () => storage.clearAll() };
}
```

---

## View Layer (React Components - Presentation Only)

### ManualColorInput.tsx

```typescript
interface ManualColorInputProps {
  colorKey: string;
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

/**
 * Dumb component - just renders input and emits events
 */
export function ManualColorInput({ colorKey, label, value, onChange }: ManualColorInputProps) {
  return (
    <div>
      <label htmlFor={colorKey}>{label}</label>
      <input
        id={colorKey}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        pattern="^#[0-9A-Fa-f]{6}$"
      />
    </div>
  );
}
```

### AdjustRibbon.tsx

```typescript
interface AdjustRibbonProps {
  colorKey: string;
  band: 'lighter' | 'light' | 'dark' | 'darker';
  variations: ColorVariation[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Dumb component - displays color ribbon and emits selection events
 */
export function AdjustRibbon({ colorKey, band, variations, selectedIndex, onSelect }: AdjustRibbonProps) {
  return (
    <div className="ribbon">
      {variations.map((variation, index) => (
        <button
          key={`${colorKey}-${band}-${index}`}
          className={index === selectedIndex ? 'selected' : ''}
          style={{ backgroundColor: variation.hex }}
          onClick={() => onSelect(index)}
          data-testid={`${colorKey}-${band}-${index}`}
        >
          <span>Y={variation.y.toFixed(3)}</span>
        </button>
      ))}
    </div>
  );
}
```

### PaletteDisplay.tsx

```typescript
interface PaletteDisplayProps {
  palette: CompletePalette;
}

/**
 * Dumb component - displays the final palette
 */
export function PaletteDisplay({ palette }: PaletteDisplayProps) {
  return (
    <div className="palette-grid">
      {Object.entries(palette.colors).map(([key, family]) => (
        <div key={key} className="color-family">
          <h3>{key}</h3>
          {Object.entries(family.selections).map(([band, selection]) => (
            <div
              key={`${key}-${band}`}
              className="color-swatch"
              style={{ backgroundColor: selection.variation.hex }}
              data-testid={`palette-${key}-${band}`}
            >
              <span>{band}</span>
              <span>Y={selection.variation.y.toFixed(3)}</span>
              <span>{selection.variation.hex}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## Test Layer

### Model Tests (Fast - Pure Functions)

```typescript
// helpers/ColorGeneration.test.ts
describe('generateColorVariations', () => {
  it('generates 9 lighter variations for primary color', () => {
    const variations = generateColorVariations('#2563eb', getDefaultConfig());
    const lighter = variations.filter(v => v.step === 'lighter');
    expect(lighter).toHaveLength(9);
  });

  it('generates variations in ascending Y order within each band', () => {
    const variations = generateColorVariations('#2563eb', getDefaultConfig());
    const lighter = variations.filter(v => v.step === 'lighter');
    for (let i = 1; i < lighter.length; i++) {
      expect(lighter[i].y).toBeGreaterThan(lighter[i - 1].y);
    }
  });

  it('generates same variations for same input (deterministic)', () => {
    const v1 = generateColorVariations('#2563eb', getDefaultConfig());
    const v2 = generateColorVariations('#2563eb', getDefaultConfig());
    expect(v1).toEqual(v2);
  });
});

// helpers/ColorSelection.test.ts
describe('findClosestByY', () => {
  it('finds exact match when available', () => {
    const candidates: ColorVariation[] = [
      { hex: '#aaa', y: 0.5, /* ... */ },
      { hex: '#bbb', y: 0.7, /* ... */ },
      { hex: '#ccc', y: 0.9, /* ... */ },
    ];
    const result = findClosestByY(0.7, candidates);
    expect(result.variation.hex).toBe('#bbb');
    expect(result.distance).toBe(0);
  });

  it('finds closest when no exact match', () => {
    const candidates: ColorVariation[] = [
      { hex: '#aaa', y: 0.5, /* ... */ },
      { hex: '#bbb', y: 0.7, /* ... */ },
      { hex: '#ccc', y: 0.9, /* ... */ },
    ];
    const result = findClosestByY(0.75, candidates);
    expect(result.variation.hex).toBe('#bbb');
    expect(result.distance).toBeCloseTo(0.05);
  });
});
```

### Service Tests (Medium - Business Logic)

```typescript
// services/PaletteService.test.ts
describe('PaletteService', () => {
  let service: PaletteService;

  beforeEach(() => {
    service = new PaletteService();
  });

  it('generates color family with 4 selections', () => {
    const family = service.generateColorFamily('#2563eb');
    expect(family.selections.lighter).toBeDefined();
    expect(family.selections.light).toBeDefined();
    expect(family.selections.dark).toBeDefined();
    expect(family.selections.darker).toBeDefined();
  });

  it('reselection maintains Y targets', () => {
    const original = service.generateColorFamily('#2563eb');
    const reselected = service.reselectColorFamily('#d62828', original.selections);

    // Y values should be close (within tolerance)
    expect(reselected.selections.lighter.variation.y)
      .toBeCloseTo(original.selections.lighter.variation.y, 1);
  });

  it('updating band selection changes only that band', () => {
    const family = service.generateColorFamily('#2563eb');
    const updated = service.updateBandSelection(family, 'lighter', 3);

    expect(updated.selections.lighter.index).toBe(3);
    expect(updated.selections.light).toEqual(family.selections.light);
    expect(updated.selections.dark).toEqual(family.selections.dark);
    expect(updated.selections.darker).toEqual(family.selections.darker);
  });
});
```

### E2E Tests (Slow - User Workflows)

```typescript
// e2e/palette-generation.spec.ts
import { test, expect } from '@playwright/test';

test('complete palette generation workflow', async ({ page }) => {
  await page.goto('/generator');

  // 1. Change primary color
  await page.fill('[data-testid="primary-hex"]', '#d62828');

  // 2. Verify Adjust tab shows red variations
  await page.click('[data-testid="adjust-tab"]');
  const lighterSwatch = page.locator('[data-testid="primary-lighter-0"]');
  await expect(lighterSwatch).toHaveCSS('background-color', /rgb\(.*\)/);

  // 3. Click a different selection
  await page.click('[data-testid="primary-lighter-3"]');

  // 4. Verify Palette tab reflects selection
  await page.click('[data-testid="palette-tab"]');
  const paletteColor = page.locator('[data-testid="palette-primary-lighter"]');
  const yValue = await paletteColor.locator('text=Y=').textContent();
  expect(yValue).toMatch(/Y=0\.\d{3}/);

  // 5. Export theme.json
  await page.click('[data-testid="export-tab"]');
  const downloadPromise = page.waitForEvent('download');
  await page.click('[data-testid="export-button"]');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('theme.json');
});

test('palette persists after reload', async ({ page }) => {
  await page.goto('/generator');

  // Set colors
  await page.fill('[data-testid="primary-hex"]', '#d62828');
  await page.click('[data-testid="adjust-tab"]');
  await page.click('[data-testid="primary-lighter-3"]');

  // Reload
  await page.reload();

  // Verify persistence
  await page.click('[data-testid="palette-tab"]');
  const paletteColor = page.locator('[data-testid="palette-primary-lighter"]');
  await expect(paletteColor).toBeVisible();
});
```

---

## Migration Strategy

### Phase 1: Extract Model (No UI Changes)
1. Create `helpers/ColorGeneration.ts` with `generateColorVariations()`
2. Create `helpers/ColorSelection.ts` with `findClosestByY()`
3. Write unit tests for both
4. **No changes to UI yet** - just extract and test

### Phase 2: Replace Dual Generation
1. Update `paletteWithVariationsBase` to use `generateColorVariations()`
2. Update `LuminanceTestStrips` to use `generateColorVariations()`
3. Delete `generateShades()` and `buildTargets()`
4. **Result**: Single source of truth

### Phase 3: Extract Service
1. Create `PaletteService` class
2. Move business logic from `generator.tsx` to service
3. Write service tests
4. Update `generator.tsx` to use service

### Phase 4: Extract Controllers
1. Create custom hooks (`useColorGeneration`, etc.)
2. Move state management from component to hooks
3. Simplify `generator.tsx` to just composition

### Phase 5: Extract Views
1. Break `generator.tsx` into small components
2. Each component is dumb (props in, events out)
3. Write component tests

---

## Configuration Management

### Problem: Hardcoded Lists Everywhere

**Current anti-pattern in `generator.tsx`:**
```typescript
// Hardcoded color names (lines 411-417)
return {
  primary: build('primary'),
  secondary: build('secondary'),
  tertiary: build('tertiary'),
  accent: build('accent'),
  error: build('error'),
  warning: build('warning'),
  success: build('success'),
};

// Hardcoded band names (lines 387-391)
const bands = [
  { step: 'lighter', label: 'Lighter' },
  { step: 'light', label: 'Light' },
  { step: 'dark', label: 'Dark' },
  { step: 'darker', label: 'Darker' },
];

// Hardcoded fallback list (line 423)
['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success']
```

**Problems:**
1. **Duplicate lists**: Color names repeated in 3+ places
2. **Fragile**: Adding "info" color requires changes in multiple files
3. **No single source of truth**: Lists can get out of sync
4. **Hard to test**: Can't easily test with different configurations
5. **Not extensible**: Can't support custom color sets

### Solution: Configuration Classes

**Create `helpers/PaletteConfig.ts`:**
```typescript
/**
 * Configuration for palette structure
 * SINGLE SOURCE OF TRUTH for color names, bands, etc.
 */
export class PaletteConfig {
  /**
   * All color families in the palette
   *
   * FUTURE: Support color wheel harmonies
   * - Analogous + Complementary: ['primary', 'analogous1', 'analogous2', 'complementary']
   * - Triadic: ['primary', 'triadic1', 'triadic2']
   * - Split-Complementary: ['primary', 'splitComp1', 'splitComp2']
   * - Tetradic: ['primary', 'tetradic1', 'tetradic2', 'tetradic3']
   *
   * FUTURE: Allow user-defined color sets
   * - Custom names: ['brand', 'accent', 'highlight', 'muted']
   * - Dynamic generation based on harmony rules
   */
  static readonly COLOR_FAMILIES = [
    'primary',
    'secondary',
    'tertiary',
    'accent',
    'error',
    'warning',
    'success',
  ] as const;

  /**
   * All variation bands
   *
   * FUTURE: Tailwind-like numeric scale (10-90)
   * - Tints: 10, 20, 30, 40, 50 (lightest to medium)
   * - Shades: 60, 70, 80, 90 (medium to darkest)
   * - Base color at 50
   *
   * FUTURE: Transparency variants
   * - Alpha channels: 10%, 20%, 30%, ..., 90%
   * - Naming: 'primary-50-alpha-20' (50 shade at 20% opacity)
   */
  static readonly BANDS = [
    { step: 'lighter', label: 'Lighter' },
    { step: 'light', label: 'Light' },
    { step: 'dark', label: 'Dark' },
    { step: 'darker', label: 'Darker' },
  ] as const;

  /**
   * Get all color family keys
   */
  static getColorKeys(): readonly string[] {
    return this.COLOR_FAMILIES;
  }

  /**
   * Get all band definitions
   */
  static getBands() {
    return this.BANDS;
  }

  /**
   * Check if a key is a valid color family
   */
  static isValidColorKey(key: string): boolean {
    return this.COLOR_FAMILIES.includes(key as any);
  }

  /**
   * Check if a step is a valid band
   */
  static isValidBand(step: string): boolean {
    return this.BANDS.some(b => b.step === step);
  }
}

// Type helpers derived from config
export type ColorFamilyKey = typeof PaletteConfig.COLOR_FAMILIES[number];
export type BandStep = typeof PaletteConfig.BANDS[number]['step'];
```

**Usage in `generator.tsx` - BEFORE:**
```typescript
// ❌ Hardcoded, repetitive, fragile
return {
  primary: build('primary'),
  secondary: build('secondary'),
  tertiary: build('tertiary'),
  accent: build('accent'),
  error: build('error'),
  warning: build('warning'),
  success: build('success'),
};
```

**Usage in `generator.tsx` - AFTER:**
```typescript
// ✅ Dynamic, maintainable, single source of truth
const buildAllColors = () => {
  const result: any = {};
  PaletteConfig.getColorKeys().forEach(key => {
    result[key] = build(key);
  });
  return result as PaletteWithVariations;
};

return buildAllColors();
```

**Benefits:**
1. **Add new color**: Just add to `COLOR_FAMILIES` array - all code updates automatically
2. **Change band names**: Update `BANDS` array - all UI updates automatically
3. **Testable**: Can mock config for different scenarios
4. **Type-safe**: TypeScript types derived from config
5. **Single source of truth**: One place to change, everywhere updates

**Alternative naming schemes:**
```typescript
// For "Main, Alternate, Occasional" instead of "Lighter, Light, Dark"
static readonly BANDS = [
  { step: 'lighter', label: 'Main' },
  { step: 'light', label: 'Alternate' },
  { step: 'dark', label: 'Occasional' },
  { step: 'darker', label: 'Rare' },
];

// For numeric labels "20, 40, 60, 80"
static readonly BANDS = [
  { step: 'lighter', label: '20' },
  { step: 'light', label: '40' },
  { step: 'dark', label: '60' },
  { step: 'darker', label: '80' },
];
```

**Extend for Adjust tab:**
```typescript
/**
 * Configuration for Adjust tab display
 */
export class AdjustTabConfig {
  /**
   * Which bands to show in Adjust tab
   */
  static readonly VISIBLE_BANDS = PaletteConfig.BANDS;

  /**
   * How many variations to show per band
   */
  static readonly VARIATIONS_PER_BAND = 9;

  /**
   * Default selected index for each band
   */
  static readonly DEFAULT_SELECTIONS = {
    lighter: 4,  // Middle of 9 variations
    light: 4,
    dark: 2,
    darker: 2,
  };
}
```

---

## Critical Implementation Patterns

### Null vs. Zero: Distinguishing "Not Set" from "First Item"

**Problem**: In JavaScript, `0` is falsy, and `null == 0` is false BUT `!0` is true. This causes bugs when index 0 is a valid selection.

**Anti-Pattern** ❌:
```typescript
// BUG: Treats index 0 as "not set"
if (!selectedIndex) {
  selectedIndex = getDefaultIndex(); // Never runs when index is 0!
}

// BUG: Ambiguous - does 0 mean "not set" or "first item"?
const selectedIndex: number = 0; // Is this initialized or default?
```

**Correct Pattern** ✅:

**Option 1: Use null/undefined (TypeScript idiomatic)**
```typescript
// Use null/undefined to mean "not set", 0+ to mean "explicitly selected"
const selectedIndex: number | null | undefined;

// Check explicitly for null/undefined
if (selectedIndex === null || selectedIndex === undefined) {
  selectedIndex = getDefaultIndex(); // Only runs when truly not set
}

// Or use loose equality (checks both null AND undefined)
if (selectedIndex == null) {
  selectedIndex = getDefaultIndex();
}
```

**Option 2: Use sentinel value (C/PHP style)**
```typescript
// Use -1 or large number to mean "not set"
const NOT_SET = -1; // or Number.MAX_SAFE_INTEGER
let selectedIndex: number = NOT_SET;

// Check for sentinel
if (selectedIndex === NOT_SET) {
  selectedIndex = getDefaultIndex();
}

// Pros: No need for nullable types, simpler type signatures; clearer intention so easier to debug. Less idiomatic means your eyes will see it.
// Cons: Must ensure -1 is never a valid index, less TypeScript-idiomatic
```

**Real Bug Example**:
```typescript
// generator.tsx - WRONG initialization
const [selections, setSelections] = useState({
  primary: { lighterIndex: 0, lightIndex: 0 } // BUG: 0 looks like default, prevents proper init
});

// LuminanceTestStrips.tsx - Correct check
if (selectedLighterIndex == null) { // ✅ Only runs if null/undefined
  const mid = Math.floor(array.length / 2);
  onSelect(colorKey, 'lighter', mid);
}
```

**Solution**: Initialize state as empty object `{}` or with `null` values, not `0`.

```typescript
// ✅ CORRECT: Let components initialize
const [selections, setSelections] = useState<SelectionsType>({});

// ✅ CORRECT: Explicit null means "not set"
const [selections, setSelections] = useState<SelectionsType>({
  primary: { lighterIndex: null, lightIndex: null }
});
```

### Two-Tier Thresholds: Technical vs Practical

**Problem**: What's technically possible (AAA compliant) isn't always what's practically useful.

**Example - Lightest Tints**:
- **Technical minimum**: Y=0.96 (4% gap from white) - "still visibly different" but washed out
- **Practical threshold**: Y=0.93 (7% gap from white) - "looks good in actual use"

**Pattern**:
```typescript
// Technical minimum (reference only, not used in UI)
export const MIN_DELTA_LUM_TINTS_FROM_WHITE_TECHNICAL = 0.04; // 4% gap

// Practical threshold: Used by both Adjust and Palette tabs
export const MIN_DELTA_LUM_TINTS_FROM_WHITE = 0.07; // 7% gap
```

**Usage**:
- **Adjust tab**: Shows colors up to practical threshold (max Y ~0.93)
- **Palette tab**: Uses same practical threshold for consistency
- **Manual tab**: Can override to any value (power users)
- **For "slightly-blue near-white"**: User can set it as text-on-dark color

**Real example**:
- Y=0.949 looks "slightly green" and washed out
- Y=0.933 looks good for lightest palette color
- Both are AAA compliant, but 0.933 is better default

---

## Palette Color Validation Requirements

### Critical Data Validation (Must Enforce)

**Text Colors** (Already Implemented):
- `text-on-light`: Must be dark (Y ≤ 0.20) - allows dark colors like dark red #d62828
- `text-on-dark`: Must be light (Y ≥ 0.90) - near-white for readability
- **Enforcement**: Manual tab blocks navigation until valid
- **Feedback**: Error banner + field warnings + suggested colors

**Base Palette Colors** (TODO - High Priority):
1. **Primary, Secondary, Tertiary, Accent**:
   - Cannot be too close to white (Y > 0.85) - insufficient hue/saturation for reliable lighter variations
   - Cannot be too close to black (Y < 0.15) - insufficient hue/saturation for reliable darker variations
   - Should have reasonable saturation (S ≥ 0.15) - need perceptible color variations
   - **Rationale**: Colors near white/black have minimal chroma (colorfulness), making it impossible to generate visually distinct tints/shades while maintaining AAA contrast

   **Low Saturation Problem**:
   - Deep green with S=0.05 (nearly gray) → tint/shade algorithm **works** but produces barely distinguishable colors
   - Algorithm uses `solveHslLightnessForY()` which holds H and S constant, only varies L
   - With low S, changing L produces colors that look nearly identical (all grayish)
   - **Example**: S=0.05, varying L from 0.2 to 0.9 → all look like slightly different grays
   - **Minimum recommended**: S ≥ 0.15 for perceptible color variations
   - **Ideal**: S ≥ 0.30 for vibrant, clearly distinct variations

2. **Semantic Colors (Error, Warning, Success)**:
   - Same luminance constraints as base colors
   - Should be distinguishable from each other (hue difference > 30°)

**Transparency** (Design Decision):
- Currently not supported in color inputs
- **For text elements**: Alpha must be 1.0 (100% opaque) to ensure WCAG compliance
  - **Problem**: Transparent text over variable backgrounds = unpredictable contrast ratios
  - **Solution**: Only allow opaque colors for text to guarantee AAA contrast everywhere
- **For non-text elements**: Transparency acceptable (borders, shadows, decorative elements). Output opacity in CSS, for theme developer use.
- **Future**: Variations could use transparency for overlays, but never for text

### How Many Variations Do We Need?

**Current Implementation**: 3 minimum per band (3 lighter, 3 light, 3 dark, 3 darker)

**Could We Use Fewer?**

**1 Tint + 1 Shade** (Minimal):
- ✅ **Technically functional**: AAA contrast maintained
- ❌ **Design limitation**: Very limited palette - "lighter" and "light" would be same color
- ❌ **User expectation**: Modern design systems expect multiple shades
- **Use case**: Emergency fallback only

**2 Tints + 2 Shades** (Constrained):
- ✅ **Functional**: Enough for basic UI (hover states, disabled states)
- ⚠️ **Limited**: No room for subtle variations (focus rings, borders, backgrounds)
- **Use case**: Minimal design systems or colors with poor contrast characteristics

**3+ Tints + 3+ Shades** (Recommended):
- ✅ **Flexible**: Supports rich UI patterns (multiple hover states, nested elements, gradients)
- ✅ **User expectation**: Matches Material Design, Tailwind, etc.
- ✅ **Future-proof**: Room for design evolution
- **Use case**: Default for all palettes

**Configurable Range**: 1-20 variations per band
- **Architecture**: Don't hard-code "3" - use config constant
- **Validation**: Check `variations.length >= MIN_VARIATIONS_PER_BAND`
- **Config location**: `helpers/config.ts`
- **Default**: `MIN_VARIATIONS_PER_BAND = 3`
- **Power users**: Can override via env var or Manual tab
- **Rationale**: Some colors (near-gray, near-white) may only yield 1-2 valid variations

### Validation Levels

**Level 1: Block Invalid (Critical)**
- Text colors outside acceptable range → Block tab switching
- Base colors too extreme (Y < 0.10 or Y > 0.95) → Block export
- **Insufficient variations**: < 1 variation per band → Block export with error

**Level 2: Warn but Allow (Guidance)**
- Base colors near limits (0.10 < Y < 0.15 or 0.85 < Y < 0.95) → Show warning
- Low saturation (S < 0.20) → Suggest more vibrant color
- Similar hues between semantic colors → Suggest adjustment
- **Limited variations**: 1-2 variations per band → Warn "Limited palette - consider adjusting base color"

**Level 3: Info Only (Best Practices)**
- Recommended luminance gaps between variations
- Contrast ratio achievements (AAA vs AA)
- Accessibility notes
- **Variation count**: Show "X variations available" for each band

---

## Chatbot Color Input (Future Feature)

### Supported Color Formats

**Hex** (Current):
```
#FF5733
#f57
```

**RGB** (Planned):
```
rgb(255, 87, 51)
rgb(100%, 34%, 20%)
```

**HSL** (Planned):
```
hsl(9, 100%, 60%)
hsl(9deg, 100%, 60%)
```

**OKLCH** (Planned - Perceptually Uniform):
```
oklch(0.628 0.257 29.23)
oklch(62.8% 0.257 29.23deg)
```

### Chatbot Input Examples

**User**: "Make primary a vibrant blue"
**Bot**: Suggests `#0066FF` (hsl(220, 100%, 50%))

**User**: "Tertiary should be a warm orange with 70% lightness"
**Bot**: Converts to `hsl(30, 80%, 70%)` → `#F2C299`

**User**: "Error color needs more contrast"
**Bot**: Analyzes current error, suggests darker shade with Y ≤ 0.15

**User**: "Use OKLCH for perceptually uniform spacing"
**Bot**: Converts all colors to OKLCH, generates variations in OKLCH space, converts back to hex

### Implementation Notes

1. **Parser**: Create `parseColorInput(input: string)` that handles all formats
2. **Converter**: Normalize all inputs to internal RGB format (but consider future rewrite to OKLCH internally)
3. **Validator**: Run same validation rules regardless of input format
4. **Feedback**: Show color in user's preferred format + hex
5. **OKLCH**: Use for perceptual uniformity in variation generation

---

## Benefits of MSVC Architecture

1. **Testability**: Each layer can be tested independently
2. **Single Source of Truth**: One algorithm for color generation, one config for structure
3. **Clear Contracts**: Interfaces define data flow
4. **Maintainability**: Small, focused modules
5. **Reusability**: Model/Service can be used in other projects
6. **Performance**: Pure functions can be memoized
7. **Debugging**: Clear data flow, easy to trace bugs
8. **Refactoring**: Change implementation without breaking tests
9. **Configuration-driven**: Change behavior by updating config, not code
