# MSVC Architecture - Preliminary Design

## Overview

This document defines the Model-Service-View-Controller architecture for the color palette generator, with a focus on testability, single source of truth, and clear separation of concerns.

**Key Principle**: Data flows in ONE direction: User Input → Model → Service → Controller → View

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

## Benefits of MSVC Architecture

1. **Testability**: Each layer can be tested independently
2. **Single Source of Truth**: One algorithm for color generation
3. **Clear Contracts**: Interfaces define data flow
4. **Maintainability**: Small, focused modules
5. **Reusability**: Model/Service can be used in other projects
6. **Performance**: Pure functions can be memoized
7. **Debugging**: Clear data flow, easy to trace bugs
8. **Refactoring**: Change implementation without breaking tests
