import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { Button } from '../components/Button';
import { Textarea } from '../components/Textarea';
import { Input } from '../components/Input';
import {
  Form,
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from '../components/Form';
import { ColorInput } from '../components/ColorInput';
import { ColorDisplay } from '../components/ColorDisplay';
import { PreviewSection } from '../components/PreviewSection';
import LightDarkPreview from '../components/LightDarkPreview';
import { generateThemeJson } from '../helpers/themeJson';
import { generateCssClasses, generateFilenameSuffix } from '../helpers/cssGenerator';
import { Palette, ColorType, SemanticColorType, PaletteWithVariations, SwatchPick, Color } from '../helpers/types';
import { generateShades, hexToRgb, rgbToHslNorm, hslNormToRgb, rgbToHex, solveHslLightnessForY, getContrastRatio, matchBandFromPrimaryByS, luminance } from '../helpers/colorUtils';
import { NEAR_BLACK_RGB, TINT_TARGET_COUNT, LIGHTER_MIN_Y, LIGHTER_MAX_Y, LIGHT_MIN_Y_BASE, LIGHT_MAX_Y_CAP, MIN_DELTA_LUM_TINTS, Y_TARGET_DECIMALS, AAA_MIN, MAX_CONTRAST_TINTS, RECOMMENDED_TINT_Y_GAP, TARGET_LUM_DARK, CLOSE_ENOUGH_TO_WHITE_MIN_LUM, CLOSE_ENOUGH_TO_BLACK_MAX_LUM } from '../helpers/config';
import { LuminanceTestStrips } from '../components/LuminanceTestStrips';
import { generateRibbonForBand, validateRibbons, type RibbonColor } from '../helpers/generateRibbons';
import IndexPage from './_index';

// Validate SwatchPick before storing/using it (module scope)
function isValidHex(hex: unknown): hex is string {
  return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex);
}
function isFiniteInRange(n: unknown, min: number, max: number) {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}
function isValidSwatchPick(p: any): p is SwatchPick {
  if (!p || typeof p !== 'object') return false;
  if (!['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'].includes(p.colorKey)) return false;
  if (!['lighter', 'light', 'dark', 'darker'].includes(p.step)) return false;
  if (!Number.isInteger(p.indexDisplayed) || p.indexDisplayed < 0) return false;
  if (!isValidHex(p.hex)) return false;
  if (!p.hsl || typeof p.hsl !== 'object') return false;
  if (!isFiniteInRange(p.hsl.h, 0, 360) || !isFiniteInRange(p.hsl.s, 0, 1) || !isFiniteInRange(p.hsl.l, 0, 1)) return false;
  if (!isFiniteInRange(p.y, 0, 1)) return false;
  if (!isFiniteInRange(p.contrastVsTextOnLight, 1, 21)) return false;
  if (!isFiniteInRange(p.contrastVsTextOnDark, 1, 21)) return false;
  if (!['light', 'dark'].includes(p.textToneUsed)) return false;
  return true;
}

// Smoothly scroll the Adjust panel to a target anchor id.
// Scrolls within the tabsColumn container and respects CSS scroll-margin-top.
function scrollAdjustTo(targetId: string) {
  let tries = 0;
  const maxTries = 12;
  const tick = 50;
  const doScroll = () => {
    const el = document.getElementById(targetId);
    if (!el) {
      if (tries++ < maxTries) setTimeout(doScroll, tick);
      return;
    }
    const desktopPanel = el.closest(`.${styles.tabsColumn}`) as HTMLElement | null;
    const container = desktopPanel;
    if (container) {
      // Compute the element's offset relative to the container
      const rect = (el as HTMLElement).getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      const currentScrollTop = container.scrollTop;
      const relativeTop = rect.top - cRect.top;
      // Honor CSS scroll-margin-top if present on target
      const css = window.getComputedStyle(el as HTMLElement);
      const smt = parseInt(css.scrollMarginTop || '0', 10) || 0;
      const scrollMargin = 12 + smt;
      const targetTop = Math.max(0, currentScrollTop + relativeTop - scrollMargin);
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
      return;
    }
    // Fallback: scroll element into the page viewport
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // give the Adjust tab time to mount
  setTimeout(doScroll, tick);
}

import { useGeneratePalette } from '../helpers/useGeneratePalette';
import { generateAnalogousComplementaryPalette } from '../helpers/colorHarmony';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import styles from './generator.module.css';
import { zipSync, strToU8 } from 'fflate';
import { generateSemanticColors } from '../helpers/generateSemanticColors';
import { buildWpVariationJson, validateBaseContrast } from '../helpers/themeJson';
import AZLogo from '../AZ-WP-Website-Consulting-LLC.svg';
import ThemeVariationDisplayScreenshot from '../assets/images/theme-variation-display-3-permutations.png';
import ColorPaletteGeneratorLightDemo from '../assets/images/color-palette-generator-light-dark-demo-light.png';
import ColorPaletteGeneratorDarkDemo from '../assets/images/color-palette-generator-light-dark-demo-dark.png';
import ColorPaletteGeneratorPaletteTabDemo from '../assets/images/color-palette-generator-palette-tab.png';
import ColorPaletteGeneratorAdjustTabFirstColor from '../assets/images/color-palette-generator-adjust-tab-first-color.png';
import ColorPaletteGeneratorStartingColors from '../assets/images/color-palette-generator-starting-colors.png';
import { applyPaletteToCSSVariables, exportCoreFrameworkCSSFromCurrent } from '../helpers/themeRuntime';

import includeEditorChromeStylesPhp from '../inc/fse-editor-chrome-styles.php?raw';
import { RadioGroup, RadioGroupItem } from '../components/RadioGroup';

// Resolve a hex color for a given color key and variation step for the Demo tab.
// Falls back to the base hex when the requested step isn't present.
function demoStepHex(
  pv: PaletteWithVariations,
  key: keyof PaletteWithVariations,
  step: 'light' | 'dark'
): string {
  try {
    const entry: any = (pv as any)?.[key];
    if (!entry) return '#808080';
    const arr: Array<{ step: string; hex: string }> = Array.isArray(entry.variations) ? entry.variations : [];
    const found = arr.find((v) => v.step === step)?.hex || entry.hex;
    return typeof found === 'string' && /^#[0-9a-f]{6}$/i.test(found) ? found : '#808080';
  } catch {
    return '#808080';
  }
}

const aiFormSchema = z.object({
  // We keep the same field names to match the backend API schema, but we
  // treat them in the UI as: industry => "What is your business",
  // targetAudience => "Who is your Ideal Customer",
  // brandPersonality => "Goals for your business".
  industry: z
    .string()
    .min(2, { message: 'Please describe your business.' })
    .max(2000, { message: 'Please shorten this a bit (max 2000 characters).' }),
  targetAudience: z
    .string()
    .min(5, { message: 'Please describe your ideal customer.' })
    .max(2000, { message: 'Please shorten this a bit (max 2000 characters).' }),
  brandPersonality: z
    .string()
    .min(5, { message: 'Please describe your goals.' })
    .max(2000, { message: 'Please shorten this a bit (max 2000 characters).' }),
  avoidColors: z
    .string()
    .max(200, { message: 'Please keep this concise (max 200 characters).' })
    .optional(),
});

const manualFormSchema = z.object({
  themeName: z.string().max(100).optional().default(''),
  textOnDark: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color'),
  textOnLight: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color'),
  primary: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color'),
  secondary: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color'),
  tertiary: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color'),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color'),
  error: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color').optional(),
  warning: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color').optional(),
  success: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color').optional(),
});

const initialPalette: Palette = {
  primary: { name: 'Primary', hex: '#2563eb' },
  secondary: { name: 'Secondary', hex: '#4f46e5' },
  tertiary: { name: 'Tertiary', hex: '#059669' },
  accent: { name: 'Accent', hex: '#db2777' },
  error: { name: 'Error', hex: '#c53030' },
  warning: { name: 'Notice', hex: '#fff700' },
  success: { name: 'Success', hex: '#38a169' },
};

const GeneratorPage = () => {
  const [palette, setPalette] = useState<Palette>(() => {
    // Ensure palette is always fully initialized with all 7 colors
    return { ...initialPalette };
  });
  const [selections, setSelections] = useState<
    Partial<Record<ColorType | SemanticColorType, {
      lighterIndex?: number;
      lightIndex?: number;
      lighterY?: number;  // Target Y for lighter band (tints)
      lightY?: number;    // Target Y for light band (tints)
      darkerY?: number;
      darkY?: number
    }>>
  >(() => {
    // Initialize empty - let Adjust tab's RowTints/RowShades components set defaults
    // (They pick middle for first band, gap-respecting for second band)
    return {};
  });
  // Exact picks captured from Adjust (used to override Palette/Export)
  // Type matches spec: Partial<Record<ColorType|SemanticColorType, { lighter?: SwatchPick; light?: SwatchPick; dark?: SwatchPick; darker?: SwatchPick }>>
  // Invariant [I1]: After initialization, every color key and band should have an exact selection
  const [exactSelections, setExactSelections] = useState<
    Partial<Record<ColorType | SemanticColorType, { lighter?: SwatchPick; light?: SwatchPick; dark?: SwatchPick; darker?: SwatchPick }>>
  >(() => {
    // Initialize from localStorage so Palette overrides apply on first render
    try {
      const raw = localStorage.getItem('gl_palette_exact_selections');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const cleaned: Partial<Record<ColorType | SemanticColorType, { lighter?: SwatchPick; light?: SwatchPick; dark?: SwatchPick; darker?: SwatchPick }>> = {};
      (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const).forEach((k) => {
        const bands = (parsed as any)[k];
        if (!bands || typeof bands !== 'object') return;
        const out: any = {};
        (['lighter', 'light', 'dark', 'darker'] as const).forEach((step) => {
          const pick = (bands as any)[step];
          if (isValidSwatchPick(pick)) out[step] = pick;
        });
        if (Object.keys(out).length) (cleaned as any)[k] = out;
      });
      return cleaned;
    } catch { return {}; }
  });
  const generatePaletteMutation = useGeneratePalette();
  const [activeTab, setActiveTab] = useState<'instructions' | 'ai' | 'manual' | 'palette' | 'adjust' | 'export' | 'demo' | 'landing'>('instructions');
  const savedManualJsonRef = useRef<string>('');
  const [demoScheme, setDemoScheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [themeName, setThemeName] = useState<string>('');
  // Export variation mode: 6 (rotate P/S/T; Accent fixed) or 24 (rotate P/S/T/Accent)
  const [exportVariationMode, setExportVariationMode] = useState<'6' | '24'>('6');
  // Per-scheme selection of which band to export/use for semantic colors
  type Band = 'lighter' | 'light' | 'dark' | 'darker';
  type SemanticPerScheme = { light: Band; dark: Band };
  type SemanticBandSelection = { error: SemanticPerScheme; warning: SemanticPerScheme; success: SemanticPerScheme };
  const SEMANTIC_BAND_DEFAULTS: SemanticBandSelection = {
    error: { light: 'light', dark: 'dark' },
    warning: { light: 'light', dark: 'dark' },
    success: { light: 'light', dark: 'dark' },
  };
  const [semanticBandSelection, setSemanticBandSelection] = useState<SemanticBandSelection>(SEMANTIC_BAND_DEFAULTS);
  const [themeConfig, setThemeConfig] = useState<any | undefined>(undefined);
  const dirInputRef = useRef<HTMLInputElement | null>(null);
  const themeJsonInputRef = useRef<HTMLInputElement | null>(null);
  const styleCssInputRef = useRef<HTMLInputElement | null>(null);
  const wheelRowRef = useRef<HTMLDivElement | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const [wheelSizePx, setWheelSizePx] = useState<number>(200);
  const [showWheelHint, setShowWheelHint] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<{
    method?: 'picker' | 'legacy';
    rawStartingPath?: string; // exact path string first seen for theme JSON
    folderFromPicker?: string;
    themeJsonRel?: string;
    styleCssRelTried?: string;
    styleCssFound?: boolean;
  }>({});
  // Details parsed from an imported theme.json (for display only)
  const [importDetails, setImportDetails] = useState<{
    schema?: string;
    version?: string | number;
    colors?: Array<{ slug: string; color: string }>;
    title?: string;
    warnings?: string[];
    error?: string;
  } | null>(null);
  // Hydrate imported theme.json and import details
  useEffect(() => {
    try {
      const rawTheme = localStorage.getItem('gl_imported_theme_json');
      if (rawTheme) setThemeConfig(JSON.parse(rawTheme));
      const rawDetails = localStorage.getItem('gl_import_details');
      if (rawDetails) {
        const parsed: any = JSON.parse(rawDetails);
        let next = parsed && typeof parsed === 'object' ? { ...parsed } : {};
        setImportDetails(next);
      }
    } catch { }
  }, []);

  // Show drag hint only when the wheel row actually overflows horizontally
  useEffect(() => {
    const el = wheelRowRef.current;
    if (!el) return;
    const check = () => {
      try {
        const hasOverflow = el.scrollWidth > el.clientWidth + 1; // +1 for FP rounding
        setShowWheelHint(hasOverflow);
      } catch { }
    };
    check();
    const ro = new (window as any).ResizeObserver ? new ResizeObserver(check) : null;
    if (ro) ro.observe(el);
    const onWin = () => check();
    window.addEventListener('resize', onWin);
    return () => {
      window.removeEventListener('resize', onWin);
      if (ro) try { ro.disconnect(); } catch { }
    };
  }, [wheelRowRef]);

  // Track actual wheel size for accurate marker/label positioning
  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    const update = () => {
      try {
        const rect = el.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height);
        if (size > 0) setWheelSizePx(size);
      } catch { }
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      if (ro) try { ro.disconnect(); } catch { }
    };
  }, []);

  // Ensure the folder picker input has proper directory attributes across browsers
  useEffect(() => {
    const el = dirInputRef.current;
    if (!el) return;
    try {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
      el.setAttribute('mozdirectory', '');
    } catch { }
  }, []);



  // Default when nothing has been saved yet; a hydration effect below will
  // load persisted values from localStorage and overwrite these shortly.
  // Defaults per request
  const [textOnDark, setTextOnDark] = useState<string>('#F8F7F7');
  const [textOnLight, setTextOnLight] = useState<string>('#453521');

  // Track previous values for Stage 3 trigger logging
  // Initialize to undefined so first run is detected as "Initial load"
  const prevTextOnLightRef = useRef<string | undefined>(undefined);
  const prevTextOnDarkRef = useRef<string | undefined>(undefined);
  const prevPrimaryHexRef = useRef<string | undefined>(undefined);
  const prevSecondaryHexRef = useRef<string | undefined>(undefined);
  const prevTertiaryHexRef = useRef<string | undefined>(undefined);
  const prevAccentHexRef = useRef<string | undefined>(undefined);
  const prevErrorHexRef = useRef<string | undefined>(undefined);
  const prevWarningHexRef = useRef<string | undefined>(undefined);
  const prevSuccessHexRef = useRef<string | undefined>(undefined);
  const lastShownValidationErrorRef = useRef<string>('');

  // Generate ribbons ONCE - this is the single source of truth for color variations
  const ribbons = useMemo(() => {
    console.log('[Ribbons] Generating ribbons from palette:', palette);
    const families = ['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const;
    const result: Record<string, Record<string, RibbonColor[]>> = {};

    families.forEach(colorKey => {
      const color = palette[colorKey];
      if (!color || !color.hex) {
        // Skip if color not initialized yet
        console.error(`[Ribbons] ERROR: ${colorKey} is undefined or missing hex!`, { color, palette });
        result[colorKey] = {
          lighter: [],
          light: [],
          dark: [],
          darker: [],
        };
        return;
      }

      const baseHex = color.hex;
      result[colorKey] = {
        lighter: generateRibbonForBand(baseHex, 'lighter', textOnLight, textOnDark),
        light: generateRibbonForBand(baseHex, 'light', textOnLight, textOnDark),
        dark: generateRibbonForBand(baseHex, 'dark', textOnLight, textOnDark),
        darker: generateRibbonForBand(baseHex, 'darker', textOnLight, textOnDark),
      };
    });

    return result;
  }, [palette, textOnLight, textOnDark]);

  // Validate ribbons and memoize result - only recalculates when ribbons change
  const ribbonValidation = useMemo(() => {
    const validation = validateRibbons(ribbons);
    // Only log errors once when validation changes
    if (!validation.valid) {
      console.error('[Ribbons] Invalid text colors:', validation.errors);
    }
    return validation;
  }, [ribbons]);

  // Show toast errors if text colors are invalid (only once per unique error)
  useEffect(() => {
    if (!ribbonValidation.valid) {
      // Only show toast if diagnostics enabled AND not on Manual tab (Manual tab has banner)
      // AND if we haven't already shown this exact error
      const errorKey = `${textOnLight}-${textOnDark}`;
      if (showDiagnostics && activeTab !== 'manual' && lastShownValidationErrorRef.current !== errorKey) {
        lastShownValidationErrorRef.current = errorKey;
        toast.error(
          ribbonValidation.summary || 'Text color configuration is invalid',
          { duration: 15000 }
        );
      }
    } else {
      // Reset when valid so next invalid state will show
      lastShownValidationErrorRef.current = '';
    }
  }, [ribbonValidation, showDiagnostics, activeTab, textOnLight, textOnDark]);

  // Build base variations from ribbons (single source of truth)
  const paletteWithVariationsBase = useMemo<PaletteWithVariations>(() => {
    try {
      // Apply semantic defaults to ensure error/warning/success exist with valid hexes
      const withSem = generateSemanticColors(palette as any) as any;

      // Band definitions (defined once, not per color)
      const BANDS: Array<{ step: 'lighter' | 'light' | 'dark' | 'darker'; label: string }> = [
        { step: 'lighter', label: 'Lighter' },
        { step: 'light', label: 'Light' },
        { step: 'dark', label: 'Dark' },
        { step: 'darker', label: 'Darker' },
      ];

      // Convert ribbons to variations format
      const build = (key: keyof PaletteWithVariations) => {
        const entry = withSem[key] as { name: string; hex: string };
        const colorRibbons = ribbons[key];
        const userSelections = (exactSelections as any)?.[key];

        // Convert RibbonColor[] to Color[] format
        const variations: Color[] = [];

        if (colorRibbons) {
          BANDS.forEach(({ step, label }) => {
            const ribbonColors = colorRibbons[step];
            if (!ribbonColors || ribbonColors.length === 0) return;

            // Use the user's exact selection if available
            const userPick = userSelections?.[step];
            let selectedHex: string;

            if (userPick?.hex) {
              // User has made a selection - use it directly
              selectedHex = userPick.hex;
            } else {
              // No user selection - default to last (darkest) ribbon
              const lastRibbon = ribbonColors[ribbonColors.length - 1];
              selectedHex = lastRibbon ? lastRibbon.hex : '#000000';
            }

            variations.push({
              name: `${entry.name} ${label}`,
              hex: selectedHex,
              step: step,
            });
          });
        }

        return { ...entry, variations };
      };

      return {
        primary: build('primary'),
        secondary: build('secondary'),
        tertiary: build('tertiary'),
        accent: build('accent'),
        error: build('error'),
        warning: build('warning'),
        success: build('success'),
      };
    } catch (err) {
      console.error('[paletteWithVariationsBase] Error building from ribbons:', err);
      // Safe fallback: mirror current palette with empty variations to avoid crashes
      const fb: any = {};
      (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const).forEach((k) => {
        fb[k] = { ...(palette as any)[k], variations: [] };
      });
      return fb as PaletteWithVariations;
    }
  }, [palette, ribbons, exactSelections]);

  // Build variations with exactSelections overrides applied (for display in Palette tab)
  const paletteWithVariations = useMemo<PaletteWithVariations>(() => {
    try {
      // Start with base variations
      const out: PaletteWithVariations = JSON.parse(JSON.stringify(paletteWithVariationsBase));

      // Override any generated band hexes with exact user picks
      const applyExact = (key: keyof PaletteWithVariations) => {
        const picks = (exactSelections as any)?.[key];
        if (!picks) return;
        const arr: any[] = Array.isArray((out as any)[key]?.variations) ? (out as any)[key].variations : [];
        const setHex = (step: 'lighter' | 'light' | 'dark' | 'darker', hex?: string) => {
          if (!hex) return;
          const v = arr.find((x) => x && x.step === step);
          if (v) v.hex = hex;
        };
        setHex('lighter', picks.lighter?.hex);
        setHex('light', picks.light?.hex);
        setHex('dark', picks.dark?.hex);
        setHex('darker', picks.darker?.hex);
      };
      (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as (keyof PaletteWithVariations)[])
        .forEach(applyExact);
      return out;
    } catch {
      return paletteWithVariationsBase;
    }
  }, [paletteWithVariationsBase, exactSelections]);

  // ============================================================================
  // Stage 3: Reselection Architecture - Helper Functions
  // ============================================================================

  // Resolve target Y for reselection using spec priority rules
  const resolveTargetY = useCallback((
    k: ColorType | SemanticColorType,
    band: 'lighter' | 'light' | 'dark' | 'darker'
  ): { y: number; source: string; hex?: string } | undefined => {
    try {
      // Priority 1: Use exactSelections[k][band].y if present
      const exactY = (exactSelections as any)?.[k]?.[band]?.y;
      if (typeof exactY === 'number' && Number.isFinite(exactY)) {
        const exactHex = (exactSelections as any)?.[k]?.[band]?.hex;
        return { y: exactY, source: 'exactSelections.y', hex: exactHex };
      }

      // Priority 2: Compute Y from exactSelections[k][band].hex
      const exactHex = (exactSelections as any)?.[k]?.[band]?.hex;
      if (typeof exactHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(exactHex)) {
        const { r, g, b } = hexToRgb(exactHex);
        return { y: luminance(r, g, b), source: 'exactSelections.hex', hex: exactHex };
      }

      // Priority 3: Use selections[k].<bandY> (for backwards compatibility)
      const bandYKey = `${band}Y` as 'lighterY' | 'lightY' | 'darkY' | 'darkerY';
      const selY = (selections as any)?.[k]?.[bandYKey];
      if (typeof selY === 'number' && Number.isFinite(selY)) {
        return { y: selY, source: 'selections.bandY' };
      }

      return undefined; // No target Y available
    } catch {
      return undefined;
    }
  }, [exactSelections, selections]);

  // Read band candidates from paletteWithVariationsBase (without exactSelections overrides)
  // Note: Not using useCallback to avoid stale closures - effect will read fresh paletteWithVariationsBase
  const readBandCandidates = (
    k: ColorType | SemanticColorType,
    band: 'lighter' | 'light' | 'dark' | 'darker'
  ): Array<{ hex: string; step: string }> => {
    try {
      const entry = (paletteWithVariationsBase as any)?.[k];
      const variations: Array<{ hex: string; step: string }> = Array.isArray(entry?.variations) ? entry.variations : [];
      return variations.filter(v => v.step === band);
    } catch {
      return [];
    }
  };

  // Adopt closest slot by Y distance
  const adoptClosestSlot = useCallback((
    k: ColorType | SemanticColorType,
    band: 'lighter' | 'light' | 'dark' | 'darker',
    targetY: number
  ): { index: number; pick: SwatchPick } | undefined => {
    try {
      const candidates = readBandCandidates(k, band);
      if (candidates.length === 0) return undefined;

      // Find closest by Y
      let bestIdx = 0;
      let bestDist = Infinity;
      candidates.forEach((cand, i) => {
        const { r, g, b } = hexToRgb(cand.hex);
        const y = luminance(r, g, b);
        const dist = Math.abs(y - targetY);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      });

      const hex = candidates[bestIdx]?.hex;
      if (!hex) return undefined;

      // Build full SwatchPick
      const { r, g, b } = hexToRgb(hex);
      const { h, s, l } = rgbToHslNorm(r, g, b);
      const y = luminance(r, g, b);
      const cLight = getContrastRatio({ r, g, b }, hexToRgb(textOnLight));
      const cDark = getContrastRatio({ r, g, b }, hexToRgb(textOnDark));
      const preferWhite = (band === 'dark' || band === 'darker');

      const pick: SwatchPick = {
        colorKey: k,
        step: band,
        indexDisplayed: bestIdx,
        hex,
        hsl: { h, s, l },
        y,
        contrastVsTextOnLight: cLight,
        contrastVsTextOnDark: cDark,
        textToneUsed: preferWhite ? 'light' : 'dark',
      };

      return { index: bestIdx, pick };
    } catch {
      return undefined;
    }
  }, [readBandCandidates, textOnLight, textOnDark]);

  // Apply selection updates atomically (batch state update)
  const applySelectionAtomically = useCallback((updates: {
    selections: typeof selections;
    exactSelections: typeof exactSelections;
  }) => {
    try {
      // Update both states in sequence (React will batch these)
      setSelections(updates.selections);
      setExactSelections(updates.exactSelections);
    } catch { }
  }, []);

  // ============================================================================
  // Stage 4: Reselection Effect (with state updates)
  // ============================================================================
  useEffect(() => {
    try {
      const families = (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const);
      const bands = (['lighter', 'light', 'dark', 'darker'] as const);

      // Build trigger message showing what changed
      const triggers: string[] = [];

      if (textOnLight !== prevTextOnLightRef.current) {
        triggers.push(`Text-on-Light: ${prevTextOnLightRef.current} → ${textOnLight}`);
      }
      if (textOnDark !== prevTextOnDarkRef.current) {
        triggers.push(`Text-on-Dark: ${prevTextOnDarkRef.current} → ${textOnDark}`);
      }
      if (palette.primary.hex !== prevPrimaryHexRef.current) {
        triggers.push(`Primary: ${prevPrimaryHexRef.current} → ${palette.primary.hex}`);
      }
      if (palette.secondary.hex !== prevSecondaryHexRef.current) {
        triggers.push(`Secondary: ${prevSecondaryHexRef.current} → ${palette.secondary.hex}`);
      }
      if (palette.tertiary.hex !== prevTertiaryHexRef.current) {
        triggers.push(`Tertiary: ${prevTertiaryHexRef.current} → ${palette.tertiary.hex}`);
      }
      if (palette.accent.hex !== prevAccentHexRef.current) {
        triggers.push(`Accent: ${prevAccentHexRef.current} → ${palette.accent.hex}`);
      }
      if (palette.error.hex !== prevErrorHexRef.current) {
        triggers.push(`Error: ${prevErrorHexRef.current} → ${palette.error.hex}`);
      }
      if (palette.warning.hex !== prevWarningHexRef.current) {
        triggers.push(`Warning: ${prevWarningHexRef.current} → ${palette.warning.hex}`);
      }
      if (palette.success.hex !== prevSuccessHexRef.current) {
        triggers.push(`Success: ${prevSuccessHexRef.current} → ${palette.success.hex}`);
      }

      // Determine trigger message and whether to proceed with reselection
      let triggerMsg: string;
      let shouldReselect = false;

      if (triggers.length > 0) {
        triggerMsg = triggers.join(', ');
        shouldReselect = true; // Base colors or text colors changed
      } else if (prevTextOnLightRef.current === undefined) {
        // First run - refs not yet initialized
        triggerMsg = 'Initial load';
        shouldReselect = true;
      } else {
        // Subsequent run with no tracked changes (e.g., from toggling diagnostics, user clicking Adjust tab)
        triggerMsg = 'Re-render (no tracked changes)';
        shouldReselect = false; // Don't reselect on user clicks
      }

      // Only log if Show Diagnostics is enabled
      if (showDiagnostics) {
        console.groupCollapsed(`[Stage 4] ${triggerMsg}`);
      }

      // Build state updates (using functional setState to avoid dependency on selections/exactSelections)
      let hasUpdates = false;
      const updates: Array<{ k: ColorType | SemanticColorType; band: 'lighter' | 'light' | 'dark' | 'darker'; result: { index: number; pick: SwatchPick } }> = [];

      // Only perform reselection if triggered by base/text color changes, not user clicks
      if (shouldReselect) {
        // Perform reselection for all families and bands
        families.forEach((k) => {
          const baseHex = (palette as any)[k]?.hex;
          let hasLogs = false;

          bands.forEach((band) => {
            const targetInfo = resolveTargetY(k, band);
            const candidates = readBandCandidates(k, band);

            if (candidates.length === 0) {
              // No valid colors found - text colors likely don't provide AAA contrast
              // Only log detailed diagnostics if showDiagnostics is enabled
              if (showDiagnostics) {
                const isTintBand = band === 'lighter' || band === 'light';
                const problematicText = isTintBand ? textOnLight : textOnDark;
                const textType = isTintBand ? 'text-on-light' : 'text-on-dark';

                if (!hasLogs) {
                  console.log(`\n${k.toUpperCase()} (base: ${baseHex}):`);
                  hasLogs = true;
                }

                // Calculate actual contrast for diagnostic purposes
                const textRgb = hexToRgb(problematicText);
                const textY = luminance(textRgb.r, textRgb.g, textRgb.b);

                // Sample a few Y values in the band range to show what contrast we're getting
                const sampleYs = isTintBand
                  ? [0.30, 0.50, 0.70, 0.90, 0.95] // LIGHT_MIN_Y_BASE to LIGHTER_MAX_Y
                  : [0.02, 0.05, 0.08, 0.12, 0.20]; // DARKER_MIN_Y to DARK_MAX_Y

                const contrastSamples = sampleYs.map(targetY => {
                  const rgb = solveHslLightnessForY(hexToRgb(baseHex), targetY);
                  const contrast = getContrastRatio(rgb, textRgb);
                  return `Y=${targetY.toFixed(2)}→${contrast.toFixed(2)}:1`;
                }).join(', ');

                console.error(
                  `  ❌ ${band}: NO CANDIDATES FOUND\n` +
                  `     Base color: ${baseHex}\n` +
                  `     ${textType}: ${problematicText} (Y=${textY.toFixed(3)})\n` +
                  `     Problem: No colors in ${band} band achieve AAA contrast (≥7.05:1) AND ≤18:1\n` +
                  `     Sample contrasts in ${band} range: ${contrastSamples}\n` +
                  `     Solution: ${isTintBand ? 'Use a darker text-on-light (closer to black, e.g., #1a1a1a)' : 'Use a lighter text-on-dark (closer to white, e.g., #fafafa)'}`
                );
              }

              // Skip this band - can't reselect without valid candidates
              return;
            }

            if (!targetInfo) {
              if (showDiagnostics) {
                if (!hasLogs) {
                  console.log(`\n${k.toUpperCase()} (base: ${baseHex}):`);
                  hasLogs = true;
                }
                console.log(`  ${band}: No target Y, skipping reselection`);
              }
              return;
            }

            const result = adoptClosestSlot(k, band, targetInfo.y);
            if (result) {
              if (showDiagnostics) {
                if (!hasLogs) {
                  console.log(`\n${k.toUpperCase()} (base: ${baseHex}):`);
                  hasLogs = true;
                }
                const hslStr = `hsl(${(result.pick.hsl.h * 360).toFixed(1)}, ${(result.pick.hsl.s * 100).toFixed(1)}%, ${(result.pick.hsl.l * 100).toFixed(1)}%)`;
                const sourceInfo = targetInfo.hex ? `${targetInfo.source} (${targetInfo.hex})` : targetInfo.source;
                console.log(`  ${band}: target Y=${targetInfo.y.toFixed(3)} [${sourceInfo}] → picked ${result.pick.hex} ${hslStr} Y=${result.pick.y.toFixed(3)} [${result.index}/${candidates.length - 1}]`);
              }

              // Collect update for later application
              updates.push({ k, band, result });
              hasUpdates = true;
            }
          });
        });
      } // End shouldReselect

      if (showDiagnostics) {
        console.log(`[Stage 4] Collected ${updates.length} updates, hasUpdates=${hasUpdates}`);
        console.groupEnd();
      }

      // Apply state updates using functional setState to avoid dependency loop
      // Only update if values actually changed
      // NOTE: We only update selections (Y targets), not exactSelections
      // The Adjust tab will pick the actual colors based on these Y targets
      if (hasUpdates) {
        setSelections((prev) => {
          const next = { ...prev };
          let changed = false;
          updates.forEach(({ k, band, result }) => {
            if (!next[k]) next[k] = {};
            if (band === 'lighter') {
              // Don't update index - let Adjust tab's initialization handle it
              if (next[k]!.lighterY !== result.pick.y) {
                next[k]!.lighterY = result.pick.y;
                changed = true;
              }
            } else if (band === 'light') {
              // Don't update index - let Adjust tab's initialization handle it
              if (next[k]!.lightY !== result.pick.y) {
                next[k]!.lightY = result.pick.y;
                changed = true;
              }
            } else if (band === 'dark') {
              if (next[k]!.darkY !== result.pick.y) {
                next[k]!.darkY = result.pick.y;
                changed = true;
              }
            } else if (band === 'darker') {
              if (next[k]!.darkerY !== result.pick.y) {
                next[k]!.darkerY = result.pick.y;
                changed = true;
              }
            }
          });
          return changed ? next : prev;
        });

        // Don't update exactSelections from reselection - let Adjust tab handle it
        // The Adjust tab will sync exactSelections based on user selections or its initialization
      }

      // Update refs for next comparison
      prevTextOnLightRef.current = textOnLight;
      prevTextOnDarkRef.current = textOnDark;
      prevPrimaryHexRef.current = palette.primary.hex;
      prevSecondaryHexRef.current = palette.secondary.hex;
      prevTertiaryHexRef.current = palette.tertiary.hex;
      prevAccentHexRef.current = palette.accent.hex;
      prevErrorHexRef.current = palette.error.hex;
      prevWarningHexRef.current = palette.warning.hex;
      prevSuccessHexRef.current = palette.success.hex;
    } catch (err) {
      console.error('[Stage 4] Reselection effect error:', err);
    }
  }, [
    palette.primary.hex,
    palette.secondary.hex,
    palette.tertiary.hex,
    palette.accent.hex,
    palette.error.hex,
    palette.warning.hex,
    palette.success.hex,
    textOnLight,
    textOnDark,
    showDiagnostics,
    resolveTargetY,
    adoptClosestSlot,
    paletteWithVariationsBase,
  ]); // Note: Depends on paletteWithVariationsBase to get fresh candidates when base colors change

  // Keep exactSelections (Palette/Export source) in sync with current Adjust selections.
  const syncExactFromSelections = useCallback(() => {
    try {
      const families = (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const);
      const next: typeof exactSelections = { ...(exactSelections as any) } as any;
      families.forEach((k) => {
        const sel = (selections as any)[k];
        if (!sel) return;
        const hasAnySelection = sel.lighterIndex != null || sel.lightIndex != null || sel.darkY != null || sel.darkerY != null;
        if (!hasAnySelection) return;
        // Read from ribbons (the actual source of truth), not paletteWithVariationsBase
        const colorRibbons = (ribbons as any)[k];
        if (!colorRibbons) return;

        const addPick = (step: 'lighter' | 'light' | 'dark' | 'darker', indexMaybe?: number, yMaybe?: number) => {
          let hex: string | undefined;
          let indexDisplayed: number | undefined;

          const ribbonColors = colorRibbons[step];
          if (!ribbonColors || ribbonColors.length === 0) return;

          // For lighter/light, use index directly from ribbons array
          if (step === 'lighter' || step === 'light') {
            if (typeof indexMaybe !== 'number') return; // Wait for Adjust tab to set index
            // Clamp index to valid range to handle stale/invalid selections
            const clampedIndex = Math.max(0, Math.min(indexMaybe, ribbonColors.length - 1));
            const ribbon = ribbonColors[clampedIndex];
            if (ribbon?.hex) {
              hex = ribbon.hex;
              indexDisplayed = clampedIndex;
            }
          } else {
            // For dark/darker, find ribbon closest to target Y
            if (typeof yMaybe !== 'number') return;
            let best = 0, dBest = Infinity;
            ribbonColors.forEach((ribbon: any, i: number) => {
              const d = Math.abs(ribbon.y - yMaybe);
              if (d < dBest) { dBest = d; best = i; }
            });
            if (ribbonColors[best]?.hex) {
              hex = ribbonColors[best].hex;
              indexDisplayed = best;
            }
          }
          if (!hex) return;
          const { r, g, b } = hexToRgb(hex);
          const { h, s, l } = rgbToHslNorm(r, g, b);
          const y = luminance(r, g, b);
          const cLight = getContrastRatio({ r, g, b }, hexToRgb(textOnLight));
          const cDark = getContrastRatio({ r, g, b }, hexToRgb(textOnDark));
          const pick: any = { colorKey: k, step, indexDisplayed: indexDisplayed ?? 0, hex, hsl: { h, s, l }, y, contrastVsTextOnLight: cLight, contrastVsTextOnDark: cDark, textToneUsed: y >= 0.5 ? 'dark' : 'light' };
          next[k] = { ...(next as any)[k], [step]: pick } as any;
        };
        addPick('lighter', sel.lighterIndex);
        addPick('light', sel.lightIndex);
        addPick('dark', undefined, sel.darkY);
        addPick('darker', undefined, sel.darkerY);
      });
      // Avoid unnecessary state updates that cause render loops
      const same = (() => {
        try { return JSON.stringify(next) === JSON.stringify(exactSelections); } catch { return false; }
      })();
      if (!same) setExactSelections(next);
    } catch { }
  }, [ribbons, selections, textOnLight, textOnDark, exactSelections]);

  // Don't run syncExactFromSelections automatically on every state change
  // Only sync when explicitly needed (user clicks, tab switch, etc.)

  // Sync after Adjust tab has initialized selections (indices are set)
  // This runs when paletteWithVariationsBase changes OR when selections get indices for the first time
  const prevHasIndicesRef = useRef(false);
  useEffect(() => {
    // Check if selections have been initialized (at least one index is set)
    const hasIndices = Object.values(selections).some((sel: any) =>
      sel?.lighterIndex != null || sel?.lightIndex != null
    );
    const justInitialized = hasIndices && !prevHasIndicesRef.current;

    if (showDiagnostics && justInitialized) {
      console.log(`[Sync] Adjust tab just initialized indices`,
        { selections: JSON.parse(JSON.stringify(selections)) });
    }

    if (hasIndices) {
      if (showDiagnostics) console.log(`[Sync] Calling syncExactFromSelections()`);
      syncExactFromSelections();
    }

    prevHasIndicesRef.current = hasIndices;
  }, [ribbons, selections, showDiagnostics, syncExactFromSelections]); // Trigger on ribbons OR selections change

  // When switching to Palette tab, ensure sync has occurred (covers user-perceived lag after edits)
  useEffect(() => {
    if (activeTab === 'palette') {
      // Defer one tick to allow any in-flight palette recalcs to complete
      setTimeout(() => { try { syncExactFromSelections(); } catch { } }, 0);
    }
  }, [activeTab, syncExactFromSelections]);

  // Synchronize Adjust highlights (selections) from exactSelections so the initially highlighted
  // swatches match what Palette/Export are using.
  // DISABLED: This was setting indices to 0 before RowTints could initialize properly
  // Let RowTints/RowShades control initialization, then syncExactFromSelections will populate exactSelections
  useEffect(() => {
    try {
      // Skip this sync - it was causing index 0 to be set before RowTints initialization
      console.log('[syncSelectionsFromExact] DISABLED - letting RowTints/RowShades initialize first');
      return;

      if (!exactSelections || Object.keys(exactSelections).length === 0) {
        console.log('[syncSelectionsFromExact] Skipping: exactSelections empty');
        return;
      }
      console.log('[syncSelectionsFromExact] Running with exactSelections:', exactSelections);
      const next: typeof selections = { ...(selections as any) } as any;
      (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const).forEach((k) => {
        const entry = (paletteWithVariations as any)[k];
        const arr: Array<{ step: string; hex: string }> = Array.isArray(entry?.variations) ? entry.variations : [];
        const byStep = (step: 'lighter' | 'light' | 'dark' | 'darker') => arr.filter(v => v.step === step);
        const picks = (exactSelections as any)[k];
        if (!picks) return;
        const cur = (next as any)[k] || {};
        // Tints: set lighter/light by exact hex index if not already set
        (['lighter', 'light'] as const).forEach((step) => {
          const pick = picks?.[step]?.hex as string | undefined;
          if (!pick) return;
          const list = byStep(step);
          const idx = list.findIndex(v => (v.hex || '').toLowerCase() === pick.toLowerCase());
          if (idx >= 0) {
            if (step === 'lighter' && cur.lighterIndex == null) {
              console.log(`[syncSelectionsFromExact] ${k}.lighterIndex = ${idx} (was null)`);
              cur.lighterIndex = idx;
            } else if (step === 'lighter') {
              console.log(`[syncSelectionsFromExact] ${k}.lighterIndex already set to ${cur.lighterIndex}, skipping`);
            }
            if (step === 'light' && cur.lightIndex == null) {
              console.log(`[syncSelectionsFromExact] ${k}.lightIndex = ${idx} (was null)`);
              cur.lightIndex = idx;
            } else if (step === 'light') {
              console.log(`[syncSelectionsFromExact] ${k}.lightIndex already set to ${cur.lightIndex}, skipping`);
            }
          }
        });
        // Shades: set Y by luminance of exact hex if not already set
        (['dark', 'darker'] as const).forEach((step) => {
          const pick = picks?.[step]?.hex as string | undefined;
          if (!pick) return;
          const { r, g, b } = hexToRgb(pick);
          const y = luminance(r, g, b);
          if (step === 'dark' && cur.darkY == null) cur.darkY = y;
          if (step === 'darker' && cur.darkerY == null) cur.darkerY = y;
        });
        (next as any)[k] = cur;
      });
      // Avoid unnecessary state updates to prevent render loops
      const same = (() => { try { return JSON.stringify(next) === JSON.stringify(selections); } catch { return false; } })();
      if (!same) setSelections(next);
    } catch { }
  }, [exactSelections, paletteWithVariations]);

  // Stage 2: Ensure invariant [I1] - all exactSelections[k][b] are populated after first render
  // This guarantees that every color key and band has an exact selection for Target Y Resolution
  // DISABLED: Let Adjust tab's RowTints/RowShades components handle initialization instead
  useEffect(() => {
    try {
      // Skip Stage 2 - Adjust tab components will initialize via onSelectTint/onSelectShade
      return;

      if (!paletteWithVariations) return;
      const families = (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const);
      const bands = (['lighter', 'light', 'dark', 'darker'] as const);
      let needsInit = false;

      // Check if any band is missing
      families.forEach((k) => {
        bands.forEach((b) => {
          if (!(exactSelections as any)?.[k]?.[b]) needsInit = true;
        });
      });

      if (!needsInit) return; // All bands already populated

      // Populate missing bands with middle slot from each ribbon (use ribbons, not paletteWithVariations)
      const next: typeof exactSelections = { ...(exactSelections as any) } as any;
      families.forEach((k) => {
        const colorRibbons = (ribbons as any)[k];
        if (!colorRibbons) return;

        bands.forEach((step) => {
          // Skip if already exists
          if ((next as any)?.[k]?.[step]) return;

          const ribbonColors = colorRibbons[step];
          if (!ribbonColors || ribbonColors.length === 0) return; // No candidates available

          // Pick middle slot as default
          const midIdx = Math.floor(ribbonColors.length / 2);
          const ribbon = ribbonColors[midIdx];
          if (!ribbon?.hex) return;
          const hex = ribbon.hex;

          const { r, g, b } = hexToRgb(hex);
          const { h, s, l } = rgbToHslNorm(r, g, b);
          const y = luminance(r, g, b);
          const cLight = getContrastRatio({ r, g, b }, hexToRgb(textOnLight));
          const cDark = getContrastRatio({ r, g, b }, hexToRgb(textOnDark));
          const preferWhite = (step === 'dark' || step === 'darker');

          const pick: SwatchPick = {
            colorKey: k,
            step,
            indexDisplayed: midIdx,
            hex,
            hsl: { h, s, l },
            y,
            contrastVsTextOnLight: cLight,
            contrastVsTextOnDark: cDark,
            textToneUsed: preferWhite ? 'light' : 'dark',
          };

          if (!(next as any)[k]) (next as any)[k] = {};
          (next as any)[k][step] = pick;
        });
      });

      setExactSelections(next);
    } catch { }
  }, [paletteWithVariations, textOnLight, textOnDark]); // Run when palette/tokens change, but NOT on exactSelections change

  // Helpful derived colors and filenames
  const accentDarkHex = useMemo(() => demoStepHex(paletteWithVariations, 'accent', 'dark'), [paletteWithVariations]);
  const warningDarkHex = useMemo(() => demoStepHex(paletteWithVariations, 'warning', 'dark'), [paletteWithVariations]);
  const warningLightHex = useMemo(() => demoStepHex(paletteWithVariations, 'warning', 'light'), [paletteWithVariations]);
  const darkHexSuffix = useMemo(() => {
    try { return generateFilenameSuffix(paletteWithVariations as any); } catch { return 'palette'; }
  }, [paletteWithVariations]);


  // Heuristic: which of the four base colors is most "eye-catching" (highest saturation)
  const mostEyeCatching = useMemo(() => {
    try {
      const bases = ['primary', 'secondary', 'tertiary', 'accent'] as const;
      let bestKey: typeof bases[number] = 'accent';
      let bestS = -1;
      bases.forEach((k) => {
        const hex = (palette as any)[k]?.hex as string | undefined;
        if (!hex) return;
        const { r, g, b } = hexToRgb(hex);
        const { s } = rgbToHslNorm(r, g, b);
        if (s > bestS) { bestS = s; bestKey = k; }
      });
      return bestKey;
    } catch { return 'accent' as const; }
  }, [palette]);


  // Load saved selections once, with migration from Y-based tints to index-based
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gl_palette_luminance_selections');
      if (raw) {
        const parsed = JSON.parse(raw);
        // If the saved object contains lighterY/lightY, preserve as-is for shades and drop tints (they'll init per component)
        const migrated: Partial<Record<ColorType | SemanticColorType, { lighterIndex?: number; lightIndex?: number; darkerY?: number; darkY?: number }>> = {};
        (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as (ColorType | SemanticColorType)[]).forEach((k) => {
          const v = parsed?.[k] || {};
          migrated[k] = {
            darkerY: v.darkerY,
            darkY: v.darkY,
            lighterIndex: v.lighterIndex, // may already be migrated
            lightIndex: v.lightIndex,
          };
        });
        setSelections(migrated);
      }
    } catch { }
  }, []);

  // Load saved exact selections (redundant safety to pick up changes from other tabs/windows)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'gl_palette_exact_selections') return;
      try {
        const raw = e.newValue;
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        const cleaned: typeof exactSelections = {} as any;
        (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const).forEach((k) => {
          const bands = parsed[k];
          if (!bands || typeof bands !== 'object') return;
          const out: any = {};
          (['lighter', 'light', 'dark', 'darker'] as const).forEach((step) => {
            const pick = (bands as any)[step];
            if (isValidSwatchPick(pick)) out[step] = pick;
          });
          if (Object.keys(out).length) (cleaned as any)[k] = out;
        });
        setExactSelections(cleaned);
      } catch { }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Persist exact selections
  useEffect(() => {
    try { localStorage.setItem('gl_palette_exact_selections', JSON.stringify(exactSelections)); } catch { }
  }, [exactSelections]);

  // When text tokens change, ensure palette picks shown in Palette tab remain AAA by adjusting
  // exactSelections to the nearest AAA-compliant variation of the same band.
  useEffect(() => {
    try {
      if (!paletteWithVariations) return;
      const next: typeof exactSelections = { ...(exactSelections as any) } as any;
      const families: (keyof PaletteWithVariations)[] = ['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'];
      let changed = false;
      families.forEach((k) => {
        const entry: any = (paletteWithVariations as any)[k];
        const vars: Array<{ step: 'lighter' | 'light' | 'dark' | 'darker'; hex: string }> = Array.isArray(entry?.variations) ? entry.variations : [];
        const ensureBand = (step: 'lighter' | 'light' | 'dark' | 'darker') => {
          const list = vars.filter(v => v.step === step);
          if (!list.length) return;
          const pick = (next as any)[k]?.[step];
          const targetHex: string | undefined = pick?.hex;
          const preferWhite = (step === 'dark' || step === 'darker');
          const tokenHex = preferWhite ? textOnDark : textOnLight;
          const token = tokenHex ? hexToRgb(tokenHex) : undefined;
          const hasAAA = (hex: string) => {
            try { return token ? getContrastRatio(hexToRgb(hex), token) >= AAA_MIN : true; } catch { return true; }
          };
          const currentIsAAA = targetHex ? hasAAA(targetHex) : false;
          // choose the closest-by-Y variation within this band that meets AAA
          const curY = targetHex ? (() => { const { r, g, b } = hexToRgb(targetHex); return luminance(r, g, b); })() : undefined;
          let bestHex: string | undefined;
          let bestD = Number.POSITIVE_INFINITY;
          list.forEach(v => {
            if (!hasAAA(v.hex)) return;
            if (curY == null) { // no current pick: choose mid-ish AAA by minimizing distance to band median Y
              const y0 = (() => { const { r, g, b } = hexToRgb(list[0]!.hex); return luminance(r, g, b); })();
              const y1 = (() => { const { r, g, b } = hexToRgb(list[list.length - 1]!.hex); return luminance(r, g, b); })();
              const medianY = (y0 + y1) / 2;
              const y = (() => { const { r, g, b } = hexToRgb(v.hex); return luminance(r, g, b); })();
              const d = Math.abs(y - medianY);
              if (d < bestD) { bestD = d; bestHex = v.hex; }
              return;
            }
            const y = (() => { const { r, g, b } = hexToRgb(v.hex); return luminance(r, g, b); })();
            const d = Math.abs(y - curY);
            if (d < bestD) { bestD = d; bestHex = v.hex; }
          });
          if (currentIsAAA) return;
          if (!bestHex || bestHex === targetHex) return;
          {
            const safeHex = bestHex!;
            const { r, g, b } = hexToRgb(safeHex);
            const { h, s, l } = rgbToHslNorm(r, g, b);
            const y = luminance(r, g, b);
            const cLight = textOnLight ? getContrastRatio({ r, g, b }, hexToRgb(textOnLight)) : 0;
            const cDark = textOnDark ? getContrastRatio({ r, g, b }, hexToRgb(textOnDark)) : 0;
            const idx = list.findIndex(v => v.hex.toLowerCase() === safeHex.toLowerCase());
            const pickObj: any = { colorKey: k, step, indexDisplayed: Math.max(0, idx), hex: safeHex, hsl: { h, s, l }, y, contrastVsTextOnLight: cLight, contrastVsTextOnDark: cDark, textToneUsed: preferWhite ? 'light' : 'dark' };
            next[k] = { ...(next as any)[k], [step]: pickObj } as any;
            changed = true;
          }
        };
        (['lighter', 'light', 'dark', 'darker'] as const).forEach(ensureBand);
      });
      if (changed) setExactSelections(next);
    } catch { }
  }, [textOnLight, textOnDark, paletteWithVariations]);

  // Load/save textOnDark/textOnLight overrides
  useEffect(() => {
    try {
      const b = localStorage.getItem('gl_theme_text_on_dark_hex');
      const c = localStorage.getItem('gl_theme_text_on_light_hex');
      if (b) setTextOnDark(b);
      if (c) setTextOnLight(c);
    } catch { }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('gl_theme_text_on_dark_hex', textOnDark);
      localStorage.setItem('gl_theme_text_on_light_hex', textOnLight);
    } catch { }
  }, [textOnDark, textOnLight]);

  const aiForm = useForm({
    schema: aiFormSchema,
    defaultValues: {
      industry: '',
      targetAudience: '',
      brandPersonality: '',
      avoidColors: '',
    },
  });

  const manualForm = useForm({
    schema: manualFormSchema,
    defaultValues: {
      themeName: themeName,
      textOnDark: textOnDark,
      textOnLight: textOnLight,
      primary: palette.primary.hex,
      secondary: palette.secondary.hex,
      tertiary: palette.tertiary.hex,
      accent: palette.accent.hex,
      error: palette.error.hex,
      warning: palette.warning.hex,
      success: palette.success.hex,
    },
  });

  // Update manual colors and live palette when user edits
  const handleManualColorChange = useCallback((colorType: ColorType | SemanticColorType, hex: string) => {
    const newValues = { ...manualForm.values, [colorType]: hex } as any;
    manualForm.setValues(newValues);
    if (/^#[0-9a-f]{6}$/i.test(hex)) {
      setPalette((prev) => ({
        ...prev,
        [colorType]: { ...(prev as any)[colorType], hex },
      } as any));
    }
  }, [manualForm, setPalette]);

  // Match semantics to Primary button handler (light: warning=light, error/success=dark)
  const handleMatchSemanticsToPrimary = useCallback(() => {
    try {
      setSemanticBandSelection((prev) => ({
        ...prev,
        warning: { light: 'light', dark: prev.warning.dark },
        error: { light: prev.error.light, dark: 'dark' },
        success: { light: prev.success.light, dark: 'dark' },
      }));
      toast.success('Matched Error/Notice/Success to Primary (current dark band)');
    } catch (e) {
      console.error('Failed to match semantic colors:', e);
      toast.error('Failed to match semantic colors');
    }
  }, [setSemanticBandSelection]);

  // Download .zip export handler (full implementation with error trapping and notices)
  const handleExportGzipAll = useCallback(async () => {
    const title = (themeName && themeName.trim()) || 'Generated Color Palette';
    const suffix = (() => { try { return generateFilenameSuffix(paletteWithVariations as any); } catch { return 'palette'; } })();
    const zipName = `themes-${suffix}.zip`;

    try {
      // 1) Build assets for ALL P/S/T permutations (accent fixed as 'a')
      const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const pv: any = paletteWithVariations as any;
      const buildPaletteFromCode = (code: string) => {
        const pick = (ch: string) => ch === 'p' ? pv.primary : ch === 's' ? pv.secondary : ch === 't' ? pv.tertiary : pv.accent;
        return { ...pv, primary: pick(code[0]!), secondary: pick(code[1]!), tertiary: pick(code[2]!), accent: pick(code[3]!) };
      };
      const permute = (arr: string[]): string[][] => {
        const out: string[][] = [];
        const used = new Array(arr.length).fill(false);
        const backtrack = (path: string[]) => {
          if (path.length === arr.length) { out.push(path.slice()); return; }
          for (let i = 0; i < arr.length; i++) {
            if (used[i]) continue;
            const val = arr[i];
            if (typeof val !== 'string') continue;
            used[i] = true; path.push(val); backtrack(path); path.pop(); used[i] = false;
          }
        };
        backtrack([]);
        return out;
      };
      const codes: string[] = exportVariationMode === '24'
        ? permute(['p', 's', 't', 'a']).map(x => x.join(''))
        : ['psta', 'ptsa', 'spta', 'stpa', 'tpsa', 'tspa'];
      const variants: Array<{ code: string; palette: any }> = codes.map(code => ({ code, palette: buildPaletteFromCode(code) }));

      const files: Record<string, Uint8Array> = {};
      const contentsList: string[] = [];
      // Include helper file for users to drop into their child theme inc/ folder (use existing file content)
      files['inc/fse-editor-chrome-styles.php'] = strToU8(includeEditorChromeStylesPhp);
      contentsList.push(' - inc/fse-editor-chrome-styles.php');
      // Generate a single shared utilities CSS file for all variations
      // Prepare alias variables from the uploaded theme.json palette (if any)
      const themeAliases: Array<{ slug: string; color: string; name?: string }> = Array.isArray((themeConfig as any)?.settings?.color?.palette)
        ? ((themeConfig as any).settings.color.palette as Array<any>)
          .filter((e) => e && typeof e.slug === 'string' && typeof e.color === 'string' && e.slug.trim() && e.color.trim())
          .map((e) => ({ slug: String(e.slug).trim().toLowerCase(), color: String(e.color).trim(), name: e.name }))
        : [];
      const cssStrOnce = generateCssClasses(
        paletteWithVariations as any,
        semanticBandSelection as any,
        { textOnDark, textOnLight, themeAliases }
      );
      const utilitiesCssPath = `styles/${titleSlug}-utilities.css`;
      files[utilitiesCssPath] = strToU8(cssStrOnce);
      contentsList.push(` - ${utilitiesCssPath}`);

      for (const v of variants) {
        const jsonStr = buildWpVariationJson(
          v.palette,
          `${title} ${v.code}`,
          themeConfig,
          { semanticBandSelection, textOnDark, textOnLight }
        );
        const jsonPath = `styles/${titleSlug}-${v.code}.json`;
        files[jsonPath] = strToU8(jsonStr);
        contentsList.push(` - ${jsonPath}`);
      }

      const readmeModeLine = exportVariationMode === '24'
        ? 'This archive contains ALL permutations of Primary/Secondary/Tertiary/Accent.'
        : 'This archive contains ALL permutations of Primary/Secondary/Tertiary (Accent fixed).';
      const readme = [
        '# Generated by Color Palette Generator, by AZ WP Website Consulting LLC',
        '',
        `Title: ${title}`,
        `Filename suffix: ${suffix}`,
        '',
        readmeModeLine,
        'For each permutation, there is a theme variation JSON. A single shared CSS utilities file is included for all variations.',
        '',
        'Contents:',
        ...contentsList,
        '',
        'How to use:',
        '1) For WordPress: copy all your *.json and the single utilities *.css file into wp-content/themes/your-theme/styles/ (create styles folder if needed)',
        '   Then switch Style variation in the Site Editor > Styles.',
        '2) Optional helper for editor sidebar swatches:',
        '   - Copy inc/fse-editor-chrome-styles.php into wp-content/themes/your-child-theme/inc/ (create inc/ if needed).',
        '   - Add the following to your child theme functions.php:',
        "     require_once get_stylesheet_directory() . '/inc/fse-editor-chrome-styles.php';",
        "     add_action('enqueue_block_editor_assets', 'fse_enqueue_block_editor_admin_chrome_styles', 20);",
        '3) Merge variables and classes from styles/*-utilities.css into your child theme style.css as needed.',
      ].join('\n');
      files['README.txt'] = strToU8(readme);

      const zipped = zipSync(files, { level: 9 });
      // Convert Uint8Array view to a plain ArrayBuffer for BlobPart compatibility
      const ab = new ArrayBuffer(zipped.byteLength);
      new Uint8Array(ab).set(zipped);
      const blob = new Blob([ab], { type: 'application/zip' });

      // 3) Try File System Access API first (allows user to choose location)
      // Not all browsers support this; fallback to anchor download.
      const supportsFS = typeof (window as any).showSaveFilePicker === 'function';
      if (supportsFS) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: zipName,
            types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }],
          });
          const w = await handle.createWritable();
          await w.write(blob);
          await w.close();
          toast.success(`Exported: ${zipName}`);
          return;
        } catch (fsErr) {
          // If user cancels or FS write fails, fall back to anchor method
          console.warn('File System Access save failed, falling back to browser download', fsErr);
        }
      }

      // 4) Fallback: trigger browser download
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = zipName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.success(`Download started: ${zipName}`);
    } catch (e: any) {
      console.error('Export failed:', e);
      const msg = (e && (e.message || e.toString())) || 'Unknown error';
      toast.error(`Export failed: ${msg}`);
    }
  }, [paletteWithVariations, themeConfig, themeName, semanticBandSelection, exportVariationMode, textOnDark, textOnLight]);

  // Track whether Manual form has unsaved changes compared to last saved snapshot
  const isManualDirty = useMemo(() => {
    try {
      const current = JSON.stringify(manualForm.values);
      return !!(savedManualJsonRef.current && current !== savedManualJsonRef.current);
    } catch {
      return false;
    }
  }, [manualForm.values]);

  // Warn on page unload only when there are unsaved changes
  useEffect(() => {
    if (!isManualDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isManualDirty]);

  // Apply runtime overrides once on startup based on current palette/manual values
  const didApplyRuntimeRef = useRef(false);
  useEffect(() => {
    if (didApplyRuntimeRef.current) return;
    didApplyRuntimeRef.current = true;
    try {
      const mv: any = manualForm?.values || {};
      const isHex = (s: any) => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
      const def = initialPalette;
      applyPaletteToCSSVariables({
        primary: { hex: isHex(mv.primary) ? mv.primary : palette.primary.hex || def.primary.hex },
        secondary: { hex: isHex(mv.secondary) ? mv.secondary : palette.secondary.hex || def.secondary.hex },
        tertiary: { hex: isHex(mv.tertiary) ? mv.tertiary : palette.tertiary.hex || def.tertiary.hex },
        accent: { hex: isHex(mv.accent) ? mv.accent : palette.accent.hex || def.accent.hex },
        error: { hex: isHex(mv.error) ? mv.error : palette.error.hex || def.error.hex },
        success: { hex: isHex(mv.success) ? mv.success : palette.success.hex || def.success.hex },
        notice: { hex: isHex(mv.warning) ? mv.warning : palette.warning.hex || def.warning.hex },
      } as any, {
        ...(exactSelections?.accent?.dark?.hex && { accentDark: exactSelections.accent.dark.hex }),
        ...(exactSelections?.error?.light?.hex && { errorLight: exactSelections.error.light.hex }),
        ...(exactSelections?.warning?.light?.hex && { warningLight: exactSelections.warning.light.hex }),
        ...(exactSelections?.success?.light?.hex && { successLight: exactSelections.success.light.hex }),
      });
    } catch { }
  }, [palette, exactSelections]);

  // Load/save semantic band selection
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gl_semantic_band_selection');
      if (raw) {
        const parsed = JSON.parse(raw);
        // shallow validate keys/values
        const bands: Band[] = ['lighter', 'light', 'dark', 'darker'];
        const ok = (x: any): x is SemanticPerScheme => x && bands.includes(x.light) && bands.includes(x.dark);
        if (parsed && ok(parsed.error) && ok(parsed.warning) && ok(parsed.success)) {
          setSemanticBandSelection(parsed);
        }
      }
    } catch { }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('gl_semantic_band_selection', JSON.stringify(semanticBandSelection));
    } catch { }
  }, [semanticBandSelection]);

  // Import an existing theme.json to read schema/version and surface base/contrast colors for the user to copy
  const handleImportThemeJson = useCallback(async (file: File, rawInputPath?: string) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setThemeConfig(parsed);
      // Prefer imported title if manual themeName is empty
      if ((!themeName || !themeName.trim()) && typeof parsed.title === 'string' && parsed.title.trim()) {
        setThemeName(parsed.title.trim());
      }
      // Gather import details without mutating user inputs
      let schema: string | undefined = typeof parsed?.$schema === 'string' ? parsed.$schema : undefined;
      const version: string | number | undefined = parsed?.version;
      const impPalette: Array<{ slug?: string; color?: string }> = parsed?.settings?.color?.palette || [];
      const wanted = new Set(['base', 'contrast', 'basecolor', 'contrastcolor']);
      const colors = impPalette
        .filter((e) => e && typeof e.slug === 'string' && typeof e.color === 'string' && wanted.has(String(e.slug)))
        .map((e) => ({ slug: String(e.slug), color: String(e.color) }));

      // Prefer trunk schema when schema is missing but version or relevant colors exist
      if (!schema && (version != null || (colors && colors.length > 0))) {
        schema = 'https://schemas.wp.org/trunk/theme.json';
        // Persist the inferred schema into themeConfig for export
        try {
          const next = { ...parsed, $schema: schema };
          setThemeConfig(next);
        } catch { }
      }

      // Build warnings for missing schema or missing version; do NOT warn on non-numeric version like "trunk"
      const warnings: string[] = [];
      if (!schema) warnings.push('No $schema found; export will default to https://schemas.wp.org/trunk/theme.json.');
      if (version == null) {
        warnings.push('No version found; export will default to 3.');
      }

      // Build details object without undefined optional keys (exactOptionalPropertyTypes)
      // Use the file input's value as-is for display (browsers usually return a fake path for security).
      const nicePath = (() => {
        const s = typeof rawInputPath === 'string' ? rawInputPath : '';
        return s || undefined;
      })();
      const details: any = { colors, warnings };
      // Build a concise display path: wp-content/themes/<theme>/theme.json when possible
      const deriveDisplayPath = (): string => {
        const src = nicePath || '';
        if (src) {
          const norm = src.replace(/\\/g, '/');
          const m = norm.match(/wp-content\/themes\/([^/]+)\/theme\.json$/i);
          if (m) return `wp-content/themes/${m[1]}/theme.json`;
          const m2 = norm.match(/themes\/([^/]+)\/theme\.json$/i);
          if (m2) return `themes/${m2[1]}/theme.json`;
          // General: show <parent-folder>/theme.json. If the immediate parent is 'theme.json', back up one more segment.
          const idx = norm.toLowerCase().lastIndexOf('/theme.json');
          if (idx >= 0) {
            const dir = norm.slice(0, idx).replace(/\/$/, '');
            const parts = dir.split('/').filter(Boolean);
            let folder = parts.pop();
            if (folder && folder.toLowerCase() === 'theme.json') folder = parts.pop();
            if (folder) return `${folder}/theme.json`;
          }
        }
        return file?.name || 'theme.json';
      };
      details.file = deriveDisplayPath();
      try { localStorage.setItem('gl_theme_input_path', nicePath || ''); } catch { }
      if (schema) details.schema = schema;
      if (version != null) details.version = version;
      setImportDetails(details);
      try { localStorage.setItem('gl_import_details', JSON.stringify(details)); } catch { }

      // Do not show a success toast; details are displayed inline under the explanation.
    } catch (e) {
      console.error('Failed to import theme.json:', e);
      setImportDetails({ error: 'Invalid theme.json file. Please select a valid JSON.' });
    }
  }, [themeName]);

  // Import style.css to extract Theme Name from header
  const handleImportStyleCss = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      // WordPress header is in a CSS comment at the top; scan first ~200 lines
      const lines = text.split(/\r?\n/).slice(0, 200);
      let found: string | undefined;
      for (const ln of lines) {
        const m1 = ln.match(/^\s*Theme\s*Name\s*:\s*(.+)$/i);
        const m2 = m1 ? null : ln.match(/^\s*Theme\s*:\s*(.+)$/i);
        const m = m1 || m2;
        if (m && m[1]) { found = String(m[1]).trim(); break; }
      }
      if (found) {
        setThemeName(found);
        // Merge into importDetails for display
        setImportDetails((prev) => ({ ...(prev || {}), title: found }));
        try { localStorage.setItem('gl_style_theme_name', found); } catch { }
      } else {
        setImportDetails((prev) => {
          const warnings = [...(prev?.warnings || []), 'Theme name not found in style.css'];
          return { ...(prev || {}), warnings } as any;
        });
      }
    } catch { }
  }, []);

  // Two-step import: after user picks theme.json, prompt for style.css
  // Note: We can't auto-trigger the second file picker because browsers require user activation.
  // Instead, show a persistent toast with a button to pick style.css.
  const [showStyleCssPrompt, setShowStyleCssPrompt] = useState(false);
  const handleImportThemeJsonPicked = useCallback(async (file: File | undefined) => {
    try {
      if (!file) return;
      setDiagnostics((d) => ({ ...d, method: 'legacy', rawStartingPath: file.name, themeJsonRel: file.name }));
      await handleImportThemeJson(file, file.name);
      setImportDetails((prev) => ({ ...(prev || {}), file: file.name }));
      // Show prompt for style.css (user must click button due to browser security)
      setShowStyleCssPrompt(true);
      toast.info('theme.json loaded. Click "Select style.css" to load theme name.');
    } catch { }
  }, [handleImportThemeJson]);

  const handleImportStyleCssPicked = useCallback(async (file: File | undefined) => {
    try {
      if (!file) return;
      setDiagnostics((d) => ({ ...d, styleCssRelTried: file.name, styleCssFound: true }));
      await handleImportStyleCss(file);
      setShowStyleCssPrompt(false);
    } catch { }
  }, [handleImportStyleCss]);

  // Import both theme.json and style.css from a selected theme directory
  const handleImportThemeDir = useCallback(async (files: FileList | null) => {
    try {
      if (!files || files.length === 0) return;
      setDiagnostics((d) => ({ ...d, method: 'legacy' }));
      const all = Array.from(files);
      const getRel = (f: File) => ((f as any).webkitRelativePath || f.name || '').replace(/\\/g, '/');
      // Find theme.json
      const themeFile = all.find(f => /(^|\/)theme\.json$/i.test(getRel(f)));
      if (themeFile) {
        const rel0 = getRel(themeFile);
        setDiagnostics((d) => ({ ...d, rawStartingPath: rel0, themeJsonRel: rel0 }));
        await handleImportThemeJson(themeFile, rel0);
      }
      // Find style.css in same folder as theme.json if possible
      if (themeFile) {
        const rel = getRel(themeFile);
        const baseDir = rel.replace(/\/theme\.json$/i, '').replace(/\/$/, '');
        const styleExact = all.find(f => getRel(f).toLowerCase() === `${baseDir}/style.css`.toLowerCase());
        const styleFile = styleExact || all.find(f => /(^|\/)style\.css$/i.test(getRel(f)));
        if (styleFile) {
          await handleImportStyleCss(styleFile);
          setDiagnostics((d) => ({ ...d, styleCssRelTried: `${baseDir}/style.css`, styleCssFound: true }));
        } else {
          setDiagnostics((d) => ({ ...d, styleCssRelTried: `${baseDir}/style.css`, styleCssFound: false }));
          setImportDetails((prev) => {
            const warnings = [...(prev?.warnings || []), 'style.css not found in the selected folder; cannot determine Theme Name.'];
            return { ...(prev || {}), warnings } as any;
          });
        }
        // Set import details File: themes/<folder>/theme.json and persist
        const folder = baseDir.split('/').filter(Boolean).pop() || '';
        if (folder) {
          const filePath = `themes/${folder}/theme.json`;
          setImportDetails((prev) => ({ ...(prev || {}), file: filePath }));
          try { localStorage.setItem('gl_theme_dir', folder); } catch { }
          try {
            const raw = localStorage.getItem('gl_import_details');
            const prev = raw ? JSON.parse(raw) : {};
            localStorage.setItem('gl_import_details', JSON.stringify({ ...(prev || {}), file: filePath }));
          } catch { }
        }
      }
    } catch { }
  }, [handleImportThemeJson, handleImportStyleCss]);

  // Prefer File System Access API for folder-pick to avoid selecting many files; fallback to two-step file picks
  const handlePickThemeFolder = useCallback(async () => {
    try {
      const navAny: any = typeof window !== 'undefined' ? (window as any) : undefined;
      const fsPicker = navAny?.showDirectoryPicker;
      if (!fsPicker) { themeJsonInputRef.current?.click(); return; }
      const dirHandle: any = await fsPicker.call(navAny, { id: 'wp-theme-folder', mode: 'read' });
      if (!dirHandle) return;
      setDiagnostics((d) => ({ ...d, method: 'picker' }));
      const getFileIfExists = async (name: string) => {
        try { const h = await dirHandle.getFileHandle(name, { create: false }); return await h.getFile(); } catch { return undefined; }
      };
      const themeFile = await getFileIfExists('theme.json');
      const folderName = String(dirHandle?.name || '').trim();
      setDiagnostics((d) => ({ ...d, folderFromPicker: folderName, rawStartingPath: `themes/${folderName}/theme.json` }));
      if (themeFile) await handleImportThemeJson(themeFile, `themes/${folderName}/theme.json`);
      const styleFile = await getFileIfExists('style.css');
      if (styleFile) { await handleImportStyleCss(styleFile); setDiagnostics((d) => ({ ...d, styleCssRelTried: `themes/${folderName}/style.css`, styleCssFound: true })); }
      else { setDiagnostics((d) => ({ ...d, styleCssRelTried: `themes/${folderName}/style.css`, styleCssFound: false })); }
      if (themeFile && folderName) {
        const filePath = `themes/${folderName}/theme.json`;
        setImportDetails((prev) => ({ ...(prev || {}), file: filePath }));
        try { localStorage.setItem('gl_theme_dir', folderName); } catch { }
        try {
          const raw = localStorage.getItem('gl_import_details');
          const prev = raw ? JSON.parse(raw) : {};
          localStorage.setItem('gl_import_details', JSON.stringify({ ...(prev || {}), file: filePath }));
        } catch { }
      }
    } catch {
      // Fall back to two-step file picks if picker not available or user cancels
      themeJsonInputRef.current?.click();
    }
  }, [handleImportThemeJson, handleImportStyleCss]);

  // Build AAA-compliant tint target lists for a very light base color and resolve Y from an index
  const getTintTargets = React.useCallback((textOnDarkHex: string) => {
    const baseRgb = hexToRgb(textOnDarkHex);
    const filterForBlackTextAAA = (ys: number[]) =>
      ys
        .map((y) => ({ y, rgb: solveHslLightnessForY(baseRgb, y) }))
        .map(({ y, rgb }) => ({ y, rgb, ratio: getContrastRatio(rgb, NEAR_BLACK_RGB) }))
        .filter(({ ratio }) => ratio >= AAA_MIN && ratio <= MAX_CONTRAST_TINTS)
        .map(({ y }) => y);

    const buildTargets = (count = 10, minY = 0.6, maxY = 0.98) => {
      const arr: number[] = [];
      const step = (maxY - minY) / (count - 1);
      for (let i = 0; i < count; i++) arr.push(parseFloat((minY + i * step).toFixed(3)));
      return arr;
    };

    const lighterRaw = buildTargets(TINT_TARGET_COUNT, LIGHTER_MIN_Y, LIGHTER_MAX_Y);
    const lighterTargets = filterForBlackTextAAA(lighterRaw);

    // Light list derived from a fine range, then sampled evenly
    const minY = Math.max(LIGHT_MIN_Y_BASE, 0);
    const maxY = Math.min(LIGHT_MAX_Y_CAP, LIGHTER_MAX_Y - MIN_DELTA_LUM_TINTS);
    const step = 0.005;
    const raw: number[] = [];
    for (let y = minY; y <= maxY + 1e-9; y += step) raw.push(parseFloat(y.toFixed(Y_TARGET_DECIMALS)));
    const aaa = filterForBlackTextAAA(raw);
    const sampleEvenly = (values: number[], count: number) => {
      if (values.length <= count) return values;
      const picks: number[] = [];
      const stepIdx = (values.length - 1) / (count - 1);
      for (let i = 0; i < count; i++) {
        const idx = Math.round(i * stepIdx);
        const val = values[idx];
        if (val !== undefined) picks.push(val);
      }
      return Array.from(new Set(picks));
    };
    const lightTargets = sampleEvenly(aaa, TINT_TARGET_COUNT);

    // Enforce matchability between lighter and light
    const canMatch = (LL: number, L: number) => (LL - L) >= RECOMMENDED_TINT_Y_GAP;
    const lightStep1 = lightTargets.filter(L => lighterTargets.some(LL => canMatch(LL, L)));
    const lighterStep1 = lighterTargets.filter(LL => lightStep1.some(L => canMatch(LL, L)));
    const lightFinal = lightStep1.filter(L => lighterStep1.some(LL => canMatch(LL, L)));
    const lighterFinal = lighterStep1;

    return { lighterTargets: lighterFinal, lightTargets: lightFinal };
  }, []);

  const resolveTintYFromIndex = React.useCallback(
    (textOnDarkHex: string, kind: 'lighter' | 'light', index?: number): number | undefined => {
      if (index == null || index < 0) return undefined;
      const { lighterTargets, lightTargets } = getTintTargets(textOnDarkHex);
      const list = kind === 'lighter' ? lighterTargets : lightTargets;
      if (!list.length) return undefined;
      const clamped = Math.max(0, Math.min(index, list.length - 1));
      return list[clamped];
    },
    [getTintTargets]
  );



  // Load saved manual colors once
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gl_palette_manual_colors');
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Record<string, string>>;
      if (!saved) return;
      const nextValues = { ...manualForm.values };
      Object.keys(nextValues).forEach((k) => {
        const v = (saved as any)[k];
        if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) (nextValues as any)[k] = v;
      });
      // Also restore themeName from saved manual colors if present
      const savedThemeName = typeof (saved as any).themeName === 'string' ? (saved as any).themeName.trim() : '';
      if (savedThemeName) nextValues.themeName = savedThemeName;
      manualForm.setValues(nextValues as any);
      setPalette((prev) => ({
        ...prev,
        primary: { ...prev.primary, hex: (nextValues as any).primary || prev.primary?.hex || initialPalette.primary.hex },
        secondary: { ...prev.secondary, hex: (nextValues as any).secondary || prev.secondary?.hex || initialPalette.secondary.hex },
        tertiary: { ...prev.tertiary, hex: (nextValues as any).tertiary || prev.tertiary?.hex || initialPalette.tertiary.hex },
        accent: { ...prev.accent, hex: (nextValues as any).accent || prev.accent?.hex || initialPalette.accent.hex },
        error: { ...(prev.error || initialPalette.error), hex: (nextValues as any).error || prev.error?.hex || initialPalette.error.hex },
        warning: { ...(prev.warning || initialPalette.warning), hex: (nextValues as any).warning || prev.warning?.hex || initialPalette.warning.hex },
        success: { ...(prev.success || initialPalette.success), hex: (nextValues as any).success || prev.success?.hex || initialPalette.success.hex },
      }));
      if ((nextValues as any).textOnDark) setTextOnDark((nextValues as any).textOnDark);
      if ((nextValues as any).textOnLight) setTextOnLight((nextValues as any).textOnLight);
      // Track the last saved snapshot for unsaved-changes warning
      try { savedManualJsonRef.current = JSON.stringify({ ...nextValues }); } catch { savedManualJsonRef.current = raw; }
      const tn = localStorage.getItem('gl_theme_name');
      const manualName = typeof nextValues.themeName === 'string' ? nextValues.themeName.trim() : '';
      const chosenName = manualName || (tn || '');
      if (chosenName) {
        setThemeName(chosenName);
        // Keep both storages in sync at load time
        try {
          localStorage.setItem('gl_theme_name', chosenName);
          const rawSaved = localStorage.getItem('gl_palette_manual_colors');
          const savedObj = rawSaved ? JSON.parse(rawSaved) as any : {};
          savedObj.themeName = chosenName;
          localStorage.setItem('gl_palette_manual_colors', JSON.stringify(savedObj));
        } catch { }
      }
    } catch { }
  }, []);

  const handleAiSubmit = async (values: z.infer<typeof aiFormSchema>) => {
    console.log('AI Generation Input:', values);
    try {
      const result = await generatePaletteMutation.mutateAsync(values);
      // Extract the base colors from the palette with variations
      const newPalette: Palette = {
        primary: { name: result.primary.name, hex: result.primary.hex },
        secondary: { name: result.secondary.name, hex: result.secondary.hex },
        tertiary: { name: result.tertiary.name, hex: result.tertiary.hex },
        accent: { name: result.accent.name, hex: result.accent.hex },
        error: { name: 'Error', hex: '#c53030' },
        warning: { name: 'Notice', hex: '#d69e2e' },
        success: { name: 'Success', hex: '#38a169' },
      };

      setPalette(newPalette);
      manualForm.setValues({
        ...manualForm.values,
        primary: newPalette.primary.hex,
        secondary: newPalette.secondary.hex,
        tertiary: newPalette.tertiary.hex,
        accent: newPalette.accent.hex,
      } as any);
    } catch (error) {
      console.error('AI generation failed, using fallback palette:', error);
      // Generate fallback palette using color harmony
      const fallbackPalette = generateAnalogousComplementaryPalette();
      console.log('Generated fallback palette:', fallbackPalette);

      setPalette(fallbackPalette);
      manualForm.setValues({
        ...manualForm.values,
        primary: fallbackPalette.primary.hex,
        secondary: fallbackPalette.secondary.hex,
        tertiary: fallbackPalette.tertiary.hex,
        accent: fallbackPalette.accent.hex,
      } as any);

      // Show fallback message to user
      toast.warning("AI generation failed, but we've created a harmonious color palette for you! You can customize it using the Manual Input tab.");
    }
  };

  // ...

  const isDarkScheme = (() => {
    try { return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; }
  })();

  // ...

  useEffect(() => {
    const pv = paletteWithVariations as any;
    const variationsOf = (k: string) => (pv?.[k]?.variations ?? []) as { name: string; hex: string }[];
    const byName = (arr: { name: string; hex: string }[]) =>
      Object.fromEntries(arr.map((x) => [x.name.toLowerCase(), x.hex]));

    // ...

    // For light mode, prefer Notice: light; Error: dark; Success: dark.
    // For dark mode, fall back to user-selected 'dark' (existing behavior).
    const pickSemanticWithPreference = (k: 'warning' | 'error' | 'success') => {
      const map = byName(variationsOf(k));
      const desiredBand: Band | undefined = !isDarkScheme
        ? (k === 'warning' ? 'light' : 'dark')
        : (semanticBandSelection[k]?.dark as Band | undefined);
      if (desiredBand && map[desiredBand]) return map[desiredBand];
      // Fallback chain
      return map['dark'] ?? map['darker'] ?? map['light'] ?? pv?.[k]?.hex;
    };

    const noticeHex = pickSemanticWithPreference('warning');
    const errHex = pickSemanticWithPreference('error');
    const succHex = pickSemanticWithPreference('success');
    if (!noticeHex && !errHex && !succHex) return;
    try {
      const root = document.documentElement;

      const setTriplet = (prefix: 'notice' | 'error' | 'success', baseHex?: string) => {
        if (!baseHex) return;
        const { r, g, b } = hexToRgb(baseHex);
        const Y = luminance(r, g, b);
        // Choose fg based on bg lightness; use user-configured near-black/near-white equivalents
        const fgHex = Y > 0.5 ? textOnLight : textOnDark;
        // Border: blend towards fg for visibility
        const borderHex = (() => {
          const { h, s, l } = rgbToHslNorm(r, g, b);
          const borderRgb = hslNormToRgb(h, Math.max(0.35, s * 0.6), Math.min(0.85, Math.max(0.6, l + 0.2)));
          return rgbToHex(borderRgb.r, borderRgb.g, borderRgb.b);
        })();

        root.style.setProperty(`--${prefix}-bg`, baseHex);
        root.style.setProperty(`--${prefix}-fg`, fgHex);
        root.style.setProperty(`--${prefix}-border`, borderHex);
      };

      // Map palette.warning -> app 'notice' variables and WP preset 'notice'
      setTriplet('notice', noticeHex);
      root.style.setProperty('--wp--preset--color--notice', noticeHex || '');
      setTriplet('error', errHex);
      root.style.setProperty('--wp--preset--color--error', errHex || '');
      setTriplet('success', succHex);
      root.style.setProperty('--wp--preset--color--success', succHex || '');
    } catch { }
  }, [paletteWithVariations, semanticBandSelection, textOnDark, textOnLight]);

  return (
    <>
      <Helmet>
        <title>Color Palette Generator | GL</title>
        <meta
          name="description"
          content="Generate and customize professional color palettes for your brand."
        />
      </Helmet>
      <div className={styles.pageWrapper}>
        {/* Desktop: 2-column layout */}
        <div className={styles.desktopLayout}>
          <div className={styles.tabsColumn}>
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                // Block tab switching if text colors are invalid (except staying on manual tab)
                if (!ribbonValidation.valid && v !== 'manual' && activeTab === 'manual') {
                  toast.error(
                    ribbonValidation.summary || 'The text colors aren\'t right yet. Fix Text on Light / Text on Dark before switching tabs.',
                    { duration: 10000 }
                  );
                  return; // Block the tab change
                }
                setActiveTab(v as any);
              }}
              className={styles.tabs}
            >
              <TabsList
                className={styles.tabsHeader}
                style={{
                  // Menu should use Accent-dark instead of Primary-dark
                  ['--primary' as any]: accentDarkHex,
                  ['--card' as any]: textOnDark,
                }}
              >
                <TabsTrigger value="instructions">Instructions</TabsTrigger>
                <TabsTrigger value="ai">AI (coming soon)</TabsTrigger>
                <TabsTrigger value="manual">1. Starting Colors</TabsTrigger>
                <TabsTrigger value="adjust">2. Adjust</TabsTrigger>
                <TabsTrigger value="palette">3. View Palette</TabsTrigger>
                <TabsTrigger value="demo">4. Demo Palette</TabsTrigger>
                <TabsTrigger value="export">5. Export</TabsTrigger>
                {/* <TabsTrigger value="landing">Landing (unused)</TabsTrigger> */}
              </TabsList>

              {/* Instructions Tab (desktop) */}
              <TabsContent value="instructions" className={styles.tabContent}>
                <div className={styles.instructionsContent}>
                  <h2 className={styles.sectionTitle}>Instructions</h2>
                  <p><strong>This application generates Color Palettes for WordPress.</strong></p>
                  <p>This tool creates a professional color set for your website and checks contrast so text stays easy to read. It plugs into WordPress “Theme Variations”, so you can switch complete looks in one click.
                  </p>
                  <ul className="u-list-circle">
                    <li>It adjusts every color you enter, to ensure proper contrast and readability. WCAG AAA contrast or better. Only colors meeting WCAG AAA contrast get output.</li>
                    <li>You will have <b>3 basic colors, and an accent color</b> (primary, secondary, tertiary, accent).</li>
                    <li>You will have <b>2 tints and 2 shades</b> of each color, to use on your website. (lighter, light, dark, darker)</li>
                    <li>Also, you will have three message colors (notice, error, success), for light mode and dark mode.</li>
                    <li>The Palette will have light mode and dark mode, using <em>your colors</em> not colors made up by some algorithm. Even if the main theme doesn't have dark mode.</li>
                    <li>You will now have <b>named color variables</b> assigned to blocks. Change the <em>values</em> of color variables, in one place, to change your site colors; very little work. Most themes use <b>color numbers</b> embedded in your pages; to change site colors, you would have to edit every Block on every page where you set a color; a <em>lot</em> of work. (Most, but not all, blocks will use your color palette.)</li>
                    <li>Change the site colors by changing the color palette. No editing your pages to change the colors, for blocks that use your color palette.</li>
                  </ul>

                  <h3 className={styles.sectionTitle}>Checklist:</h3>
                  <ul className="u-list-circle">
                    <li>1. Set your Starting Colors</li>
                    <li>2. Adjust tints and shades</li>
                    <li>3. View Palette selections</li>
                    <li>4. Demo Palette (check light mode and dark mode)</li>
                    <li>5. Export, and copy to WordPress</li>
                  </ul>

                  <h3 className={styles.sectionTitle}>In the Starting Colors tab:</h3>
                  <ul className="u-list-circle">
                    <li>Upload your child theme's <code>theme.json</code> file. This is <em>needed</em> so your generated theme variations match the theme's version, and so all the colors your theme expects will be available (you can set the color to a new color number; but you shouldn't skip defining it, even if you don't plan to use it).</li>
                    <li>Enter your Theme Name (brief, as it appears in a WordPress tooltip in the Site Editor, Palette selection).</li>
                    <li>Enter hex <b>color numbers</b>, or click on the <b>color swatches</b> for HSL adjustment.</li>
                    <li>There is a color wheel, so you can check that colors aren't too close to each other. Generally have colors with a hue difference of at least 30, or make the saturation different enough the colors look different.</li>
                    <li><strong>Text on Light / Text on Dark:</strong> These do not need to be pure black or pure white. They can have a slight hue. What matters most is luminance: Text on Light should be <strong>Near Black (low Y)</strong> and Text on Dark should be <strong>Near White (high Y)</strong>. If they are not dark/light enough, some colors won’t be able to generate AAA-contrast tints/shades. Warm, neutral, and cool text colors are provided, or enter your own.</li>
                    <li><strong>Show Diagnostics:</strong> Enable this to see detailed console logging (in your Browser's Console) about color reselection and adjustments. Useful for understanding how the automatic color selection works.</li>
                    <li>Click the "Save colors and settings" button so your choices are there when you restart.</li>
                  </ul>
                  <img
                    src={ColorPaletteGeneratorStartingColors}
                    alt="Color Palette Generator Starting Colors"
                    className={styles.instructionsImage}
                  />
                  <h3 className={styles.sectionTitle}>In the Adjust tab:</h3>
                  <ul className="u-list-circle">
                    <li>Select your preferred tints and shades from among those that have excellent contrast (and are visibly different).</li>
                    <li><b>Click on your preference of color swatches</b> to select it.</li>
                    <li>Your selections for each row are saved locally, since you will tend to use about the same selection even as you change hues.</li>
                  </ul>
                  <img
                    src={ColorPaletteGeneratorAdjustTabFirstColor}
                    alt="Color Palette Generator Adjust Tab (First Color)"
                    className={styles.instructionsImage}
                  />

                  <h3 className={styles.sectionTitle}>In the View Palette tab:</h3>
                  <ul className="u-list-circle">
                    <li>Review the current contrast-adjusted colors.</li>
                    <li>Click any swatch to jump to the <strong>Adjust</strong> tab for that color, if they don't look right, or to check which you like best.</li>
                  </ul>
                  <img
                    src={ColorPaletteGeneratorPaletteTabDemo}
                    alt="Color Palette Generator Palette Tab"
                    className={styles.instructionsImage}
                  />

                  <h3 className={styles.sectionTitle}>In the Demo Palette tab:</h3>
                  <ul className="u-list-circle">
                    <li>Preview components in light and dark schemes.</li>
                    <li>See how your colors work together in real webpage elements.</li>
                  </ul>
                  <img
                    src={ColorPaletteGeneratorLightDemo}
                    alt="Demo color palette in Light mode"
                    className={styles.instructionsImage}
                  />
                  <img
                    src={ColorPaletteGeneratorDarkDemo}
                    alt="Demo color palette in Dark mode"
                    className={styles.instructionsImage}
                  />

                  <h3 className={styles.sectionTitle}>In the Export tab:</h3>
                  <ul className="u-list-circle">
                    <li>Download your ZIP file with all your Theme Variations.</li>
                    <li>You can export either <strong>6 variations</strong> (rotate Primary/Secondary/Tertiary, keeping Accent set) or <strong>24 variations</strong> (rotate Primary/Secondary/Tertiary/Accent). The variations are named for the order of the colors you selected; p, s, t, a for Primary, Secondary, Tertiary, Accent.</li>
                    <li>The ZIP includes Theme Variation <code>styles/*.json</code> files and a companion CSS utilities file. </li>
                    <li>The Export tab also shows HEX and HSL lists, easy to copy into whatever other places you need the colors. One place could be your company's style guide. Another could be your page builder, if you aren't using the Block Editor.</li>
                  </ul>

                  <h3 className={styles.sectionTitle}>Install Your Palette</h3>
                  <ul className="u-list-circle">
                    <li>Copy the exported files (from the Export tab) to your theme folder <code>wp-content/YOURTHEME/styles/</code> on your hosting location.</li>
                    <li>Make a <code>styles</code> folder there, if there isn't one.</li>
                    <li>No manually entering all those colors.</li>
                    <li>The <code>theme.json</code> files will show as Palettes in your WordPress Site Editor.</li>
                    <li>You can also copy the CSS file to the styles folder, but WordPress won't use it. Copy the CSS you want to add to your existing <code>style.css</code> file. There are CSS classes defined, that use your color variables, including ones that WordPress uses. When you pick a color off the WordPress color palette picker, it will use your color variables.</li>
                  </ul>

                  <h3 className={styles.sectionTitle}>WPWM Theme Variation Display</h3>
                  <p>Better than the Site Editor's "Browse Styles", see the <a href="https://github.com/glerner/wpwm-theme-variation-display" target="_blank" rel="noopener noreferrer">WPWM Theme Variation Display plugin on GitHub</a>.</p>
                  <ul className="u-list-circle">
                    <li>Shows all the colors, with sample text.</li>
                    <li>Lets you "slide show" through your theme variations.</li>
                    <li>Makes it easy to compare and choose your favorite palette.</li>
                  </ul>
                  <img
                    src={ThemeVariationDisplayScreenshot}
                    alt="WPWM Theme Variation Display showing color palettes"
                    className={styles.instructionsImage}
                  />
                  <img
                    src={AZLogo}
                    alt="AZ WP Website Consulting LLC"
                    className={styles.instructionsLogo}
                  />
                  <p>Copyright © 2025 AZ WP Website Consulting LLC.</p>
                </div>
              </TabsContent>

              {/* AI Tab */}
              <TabsContent value="ai" className={styles.tabContent}>
                <h2 className={styles.sectionTitle}>Use AI to pick starting colors for your palette</h2>
                <p className={styles.formHelp}>
                  Selecting a website color palette is a methodical process that balances art, science, and strategy. It’s not just about what looks good to you, but also about what works to communicate your brand, guide user behavior, and help people want to do business with you. Don’t worry about being concise or perfect—free-write in the fields below. We’ll merge your answers into a single AI prompt.
                </p>
                <Form {...aiForm}>
                  <form onSubmit={aiForm.handleSubmit(handleAiSubmit)} className={styles.aiForm}>
                    <FormItem name="industry">
                      <FormLabel>What is your business?</FormLabel>
                      <FormDescription className={styles.highContrastDescription}>
                        <strong>What to write:</strong> Paint a vivid picture of your brand. Include how you help people feel (e.g., calm confidence, energized focus), what makes you different, values (e.g., precision, warmth, sustainability), and your voice and vibe (e.g., elegant, minimal, earthy, bold). Visual metaphors help (e.g., morning light on fresh linen; polished steel and glass; cozy café wood and brass). Add any color preferences or boundaries (e.g., avoid neon; love muted earth; open to dark mode).
                        <br /><br />
                        <strong>Example starters:</strong>
                        <br />• “We help overwhelmed solo founders feel in control and proud of their brand—calm, clear, quietly premium.”
                        <br />• “Think sun-warmed terracotta, olive leaves, and cream linen: natural, artisanal, unhurried.”
                        <br />• “We’re precise and modern but never cold—more graphite and cloud than chrome and black.”
                        <br />• “Avoid childish brights; aim for confident, contemporary, approachable.”
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          rows={8}
                          value={aiForm.values.industry}
                          onChange={(e) => aiForm.setValues({ ...aiForm.values, industry: e.target.value })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="targetAudience">
                      <FormLabel>Who is your Ideal Customer?</FormLabel>
                      <FormDescription className={styles.highContrastDescription}>
                        <strong>Example starters:</strong>
                        <br />• “She’s a 38-year-old creative consultant who loves clean lines, good typography, warm neutrals, and hates visual clutter.”
                        <br />• “He’s tech-savvy but time-poor; wants quick clarity and zero friction; avoids flashy, prefers quiet premium.”
                        <br />• “They wear charcoal, navy, cream; love oak and stone; dislike neon and busy patterns.”
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          rows={8}
                          value={aiForm.values.targetAudience}
                          onChange={(e) => aiForm.setValues({ ...aiForm.values, targetAudience: e.target.value })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="brandPersonality">
                      <FormLabel>Goals for your business</FormLabel>
                      <FormDescription className={styles.highContrastDescription}>
                        <strong>Example starters:</strong>
                        <br />• “Primary: Book strategy calls. Secondary: Grow newsletter. The ‘Book a Call’ button should be the most eye-catching.”
                        <br />• “Reading comfort matters—long-form articles with low eye strain; accents used sparingly for trust signals.”
                        <br />• “We want a premium, welcoming feel—accessible contrast, no harsh fluorescents.”
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          rows={8}
                          value={aiForm.values.brandPersonality}
                          onChange={(e) => aiForm.setValues({ ...aiForm.values, brandPersonality: e.target.value })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="avoidColors">
                      <FormLabel>Colors to avoid (optional)</FormLabel>
                      <FormDescription className={styles.highContrastDescription}>
                        Optional: list any color boundaries (e.g., avoid neon; no red due to industry norms).
                      </FormDescription>
                      <FormControl>
                        <Input
                          value={aiForm.values.avoidColors}
                          onChange={(e) => aiForm.setValues({ ...aiForm.values, avoidColors: e.target.value })}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>

                    {generatePaletteMutation.isError && (
                      <div className={styles.errorContainer}>
                        <div className={styles.errorHeader}>
                          <AlertTriangle size={16} />
                          <span>Generation Failed</span>
                        </div>
                        <p className={styles.errorMessage}>
                          {generatePaletteMutation.error?.message || 'Failed to generate palette. Please try again.'}
                        </p>
                        {generatePaletteMutation.error?.message?.toLowerCase().includes('quota') && (
                          <div className={styles.errorSuggestion}>
                            <strong>Suggestion:</strong> Check your OpenAI billing settings or try again later.
                          </div>
                        )}
                        {generatePaletteMutation.error?.message?.toLowerCase().includes('api key') && (
                          <div className={styles.errorSuggestion}>
                            <strong>Suggestion:</strong> Please verify your OpenAI API configuration.
                          </div>
                        )}
                        {generatePaletteMutation.error?.message?.toLowerCase().includes('network') && (
                          <div className={styles.errorSuggestion}>
                            <strong>Suggestion:</strong> Check your internet connection and try again.
                          </div>
                        )}
                        <Button
                          type="submit"
                          variant="outline"
                          className={styles.retryButton}
                          disabled={generatePaletteMutation.isPending}
                        >
                          <RefreshCw size={16} />
                          Try Again
                        </Button>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className={styles.submitButton}
                      disabled={generatePaletteMutation.isPending}
                    >
                      {generatePaletteMutation.isPending ? 'Generating...' : 'Generate with AI'}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              {/* Palette Tab (desktop) */}
              <TabsContent value="palette" className={styles.tabContent}>
                {/* Header with save buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-3)', flexWrap: 'wrap', gap: 'var(--spacing-2)' }}>
                  <h2 className={`${styles.sectionTitle} cf-font-600`} style={{ margin: 0 }}>Color Palette</h2>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', flexWrap: 'wrap' }}>
                    <Button
                      variant="primary"
                      onClick={() => {
                        try {
                          localStorage.setItem('gl_palette_luminance_selections', JSON.stringify(selections));
                          localStorage.setItem('gl_palette_exact_selections', JSON.stringify(exactSelections));
                          toast.success('Palette selections saved');
                        } catch (e) {
                          toast.error('Failed to save selections');
                        }
                      }}
                    >
                      Save Palette Selections
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        try {
                          // Save all manual colors and settings (same as Manual tab)
                          const toSave = {
                            primary: manualForm.values.primary,
                            secondary: manualForm.values.secondary,
                            tertiary: manualForm.values.tertiary,
                            accent: manualForm.values.accent,
                            error: manualForm.values.error,
                            warning: manualForm.values.warning,
                            success: manualForm.values.success,
                          };
                          localStorage.setItem('gl_palette_manual_colors', JSON.stringify(toSave));
                          localStorage.setItem('gl_theme_name', manualForm.values.themeName || '');
                          localStorage.setItem('gl_theme_text_on_dark_hex', manualForm.values.textOnDark || '');
                          localStorage.setItem('gl_theme_text_on_light_hex', manualForm.values.textOnLight || '');
                          localStorage.setItem('gl_theme_semantic_error_hex', manualForm.values.error || '');
                          localStorage.setItem('gl_theme_semantic_warning_hex', manualForm.values.warning || '');
                          localStorage.setItem('gl_theme_semantic_success_hex', manualForm.values.success || '');
                          localStorage.setItem('gl_palette_exact_selections', JSON.stringify(exactSelections));
                          localStorage.setItem('gl_palette_luminance_selections', JSON.stringify(selections));
                          savedManualJsonRef.current = JSON.stringify({ ...manualForm.values });
                          applyPaletteToCSSVariables({
                            primary: { hex: manualForm.values.primary },
                            secondary: { hex: manualForm.values.secondary },
                            tertiary: { hex: manualForm.values.tertiary },
                            accent: { hex: manualForm.values.accent },
                            error: { hex: manualForm.values.error || palette.error.hex },
                            success: { hex: manualForm.values.success || palette.success.hex },
                            notice: { hex: manualForm.values.warning || palette.warning.hex },
                          } as any, {
                            ...(exactSelections?.accent?.dark?.hex && { accentDark: exactSelections.accent.dark.hex }),
                            ...(exactSelections?.error?.light?.hex && { errorLight: exactSelections.error.light.hex }),
                            ...(exactSelections?.warning?.light?.hex && { warningLight: exactSelections.warning.light.hex }),
                            ...(exactSelections?.success?.light?.hex && { successLight: exactSelections.success.light.hex }),
                          });
                          toast.success('All colors and settings saved');
                        } catch (e) {
                          toast.error('Failed to save');
                        }
                      }}
                    >
                      Save All Colors & Settings
                    </Button>
                  </div>
                </div>
                <div className={styles.previewContent}>
                  <ColorDisplay
                    palette={paletteWithVariations}
                    isLoading={false}
                    showDiagnostics={showDiagnostics}
                    semanticBandSelection={semanticBandSelection}
                    textOnLight={textOnLight}
                    textOnDark={textOnDark}
                    onVariationClick={(key, step) => {
                      setActiveTab('adjust');
                      const suffix = (step === 'dark' || step === 'darker') ? '-shades' : '';
                      scrollAdjustTo(`d-luminance-${key}${suffix}`);
                    }}
                  />
                </div>
              </TabsContent>
              {/* Manual Tab */}
              <TabsContent value="manual" className={styles.tabContent}>
                <h2 className={styles.sectionTitle}>Starting Colors</h2>
                {(() => {
                  if (!ribbonValidation.valid) {
                    return (
                      <div style={{
                        background: '#9f1239',
                        color: '#ffffff',
                        border: '2px solid #9f1239',
                        borderRadius: 'var(--radius)',
                        padding: 'var(--spacing-3)',
                        marginBottom: 'var(--spacing-3)',
                        fontWeight: 600
                      }}>
                        ⚠️ {ribbonValidation.summary || 'Text colors invalid'} — Tab switching disabled until fixed.
                      </div>
                    );
                  }
                  return null;
                })()}
                <Form {...manualForm}>
                  <div className={styles.manualGrid}>
                    {/* Left column: explanatory content and actions */}
                    <div className={styles.manualCol}>
                      {/* Explanation + Import row */}
                      <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', marginBottom: 'var(--spacing-3)', flexWrap: 'wrap' }}>
                        <div>
                          <p className={styles.formHelp} style={{ fontSize: 'var(--cf-text-s)' }}>
                            Import the schema and version from your child theme's theme.json (to ensure exported files match it), and load the theme name from style.css.
                            Only theme.json and style.css are read; other files are ignored and never uploaded.
                          </p>
                          <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Button variant="outline" wrap onClick={handlePickThemeFolder} style={{ marginTop: 'var(--spacing-2)' }}>Import theme folder</Button>
                            {showStyleCssPrompt && (
                              <Button
                                variant="outline"
                                wrap
                                onClick={() => styleCssInputRef.current?.click()}
                                style={{ marginTop: 'var(--spacing-2)', background: 'var(--accent)', color: 'var(--accent-foreground)' }}
                              >
                                Select style.css
                              </Button>
                            )}
                            <Button variant="outline" wrap onClick={() => setShowDiagnostics(v => !v)} style={{ marginTop: 'var(--spacing-2)' }}>
                              {showDiagnostics ? 'Hide diagnostics' : 'Show diagnostics'}
                            </Button>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
                            <div className={styles.formHelp} style={{ fontSize: 'var(--cf-text-s)' }}>
                              <div>
                                <strong>File:</strong>{' '}
                                {(() => {
                                  try {
                                    const raw0 = (importDetails as any)?.file || (typeof localStorage !== 'undefined' ? (localStorage.getItem('gl_theme_input_path') || '') : '');
                                    const p = String(raw0 || '').replace(/\\/g, '/');
                                    if (!p) return '(unknown)';
                                    // Prefer wp-content/themes/<folder>
                                    const mWp = p.match(/wp-content\/themes\/([^/]+)\/([^/]+)$/i);
                                    if (mWp) {
                                      const folder = String(mWp[1] || '');
                                      const file = String(mWp[2] || '');
                                      return /^(theme\.json)$/i.test(file) ? folder : `${folder}/${file}`;
                                    }
                                    // Prefer themes/<folder>
                                    const mThemes = p.match(/themes\/([^/]+)\/([^/]+)$/i);
                                    if (mThemes) {
                                      const folder = String(mThemes[1] || '');
                                      const file = String(mThemes[2] || '');
                                      return /^(theme\.json)$/i.test(file) ? folder : `${folder}/${file}`;
                                    }
                                    // General: split into folder + filename
                                    const parts = p.split('/').filter(Boolean);
                                    if (parts.length >= 2) {
                                      const file = parts.pop()!;
                                      const folder = parts.pop()!;
                                      return /^(theme\.json)$/i.test(file) ? folder : `${folder}/${file}`;
                                    }
                                    return '(unknown)';
                                  } catch { return '(unknown)'; }
                                })()}
                              </div>
                              {showDiagnostics && (
                                <div style={{ marginTop: 6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: '12px', background: 'var(--muted)', padding: '8px', borderRadius: 6 }}>
                                  <div><strong>Diagnostics</strong></div>
                                  <div>method: {diagnostics.method || '(unknown)'}</div>
                                  <div>rawStartingPath: {diagnostics.rawStartingPath || '(none)'}</div>
                                  <div>folderFromPicker: {diagnostics.folderFromPicker || '(n/a)'}</div>
                                  <div>themeJsonRel: {diagnostics.themeJsonRel || '(n/a)'}</div>
                                  <div>styleCssRelTried: {diagnostics.styleCssRelTried || '(n/a)'}</div>
                                  <div>styleCssFound: {String(diagnostics.styleCssFound ?? false)}</div>
                                  <div>importDetails.file: {String((importDetails as any)?.file || '(none)')}</div>
                                  <div>gl_theme_input_path: {String((typeof localStorage !== 'undefined' && localStorage.getItem('gl_theme_input_path')) || '(none)')}</div>
                                </div>
                              )}
                              <div><strong>Theme name:</strong> {importDetails?.title || '(not loaded from style.css)'}</div>
                              {Array.isArray(importDetails?.warnings) && (importDetails!.warnings as string[]).length > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  {(importDetails!.warnings as string[]).map((w, i) => (
                                    <div key={i} style={{ color: 'var(--foreground)', opacity: 0.8 }}>• {w}</div>
                                  ))}
                                </div>
                              )}
                              {(() => {
                                try {
                                  const schemaStr = (themeConfig && typeof (themeConfig as any).$schema === 'string')
                                    ? (themeConfig as any).$schema
                                    : (importDetails?.schema || '');
                                  const versionStr = (themeConfig && (themeConfig as any).version != null)
                                    ? String((themeConfig as any).version)
                                    : (importDetails?.version != null ? String(importDetails.version) : '');
                                  const themePalette: Array<{ slug: string; color: string }> = Array.isArray((themeConfig as any)?.settings?.color?.palette)
                                    ? (themeConfig as any).settings.color.palette
                                    : [];
                                  const detailsPalette: Array<{ slug: string; color: string }> = Array.isArray(importDetails?.colors)
                                    ? (importDetails as any).colors
                                    : [];
                                  const mergedRaw = [...themePalette, ...detailsPalette];
                                  const dedup = new Map<string, { slug: string; value: string }>();
                                  mergedRaw.forEach((c: any) => {
                                    if (!c) return;
                                    const slug = String(c.slug || '').trim();
                                    const color = String(c.color || '').trim();
                                    if (!slug || !color) return;
                                    const value = color;
                                    dedup.set(slug + '::' + value, { slug, value });
                                  });
                                  const cols = Array.from(dedup.values());
                                  // Partition entries
                                  const hexRegex = /^#[0-9a-fA-F]{6}$/;
                                  const hexEntries = cols.filter(c => hexRegex.test(c.value)).map(c => {
                                    const { r, g, b } = hexToRgb(c.value);
                                    const { h } = rgbToHslNorm(r, g, b);
                                    const Y = luminance(r, g, b);
                                    return { ...c, h, Y } as { slug: string; value: string; h: number; Y: number };
                                  });
                                  const nonHexEntries = cols.filter(c => !hexRegex.test(c.value));
                                  // Best base/contrast from luminance extremes (if available)
                                  const mostWhite = hexEntries.length ? hexEntries.slice().sort((a, b) => b.Y - a.Y)[0] : undefined;
                                  const mostBlack = hexEntries.length ? hexEntries.slice().sort((a, b) => a.Y - b.Y)[0] : undefined;
                                  // Sort remaining hex by hue
                                  const byHue = hexEntries.slice().sort((a, b) => a.h - b.h);
                                  // Build final ordered list: best base/contrast (dedup), then hue, then non-hex (by slug)
                                  const seen = new Set<string>();
                                  const ordered: Array<{ slug: string; value: string; badge?: string }> = [];
                                  const pushUnique = (item?: { slug: string; value: string }, badge?: string) => {
                                    if (!item) return;
                                    const key = item.slug + '::' + item.value;
                                    if (seen.has(key)) return;
                                    seen.add(key);
                                    // Avoid specifying optional property when undefined (exactOptionalPropertyTypes)
                                    ordered.push(badge ? { ...item, badge } : { ...item });
                                  };
                                  pushUnique(mostWhite, 'best for Text on Dark (near white)');
                                  pushUnique(mostBlack, 'best for Text on Light (near black)');
                                  byHue.forEach(e => pushUnique({ slug: e.slug, value: e.value }));
                                  nonHexEntries
                                    .slice()
                                    .sort((a, b) => a.slug.localeCompare(b.slug))
                                    .forEach(e => pushUnique(e));
                                  return (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                      <div style={{ fontSize: 'var(--cf-text-s)' }}>
                                        <strong>Schema:</strong> {schemaStr || '—'}
                                      </div>
                                      <div style={{ fontSize: 'var(--cf-text-s)' }}>
                                        <strong>Version:</strong> {versionStr || '—'}
                                      </div>
                                      <div style={{ fontWeight: 600 }}>Detected palette entries (copy/paste if desired):</div>
                                      <div>
                                        <p className={styles.formHelp} style={{ marginTop: 8, marginBottom: 8 }}>Click the color swatch or color number to copy to the clipboard. (Sorted by Hue)</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                                          {ordered.map((c) => (
                                            <div
                                              key={c.slug + String(c.value)}
                                              onClick={async () => { try { await navigator.clipboard.writeText((c as any).value); toast.success('Copied'); } catch { toast.error('Copy failed'); } }}
                                              role="button"
                                              tabIndex={0}
                                              onKeyDown={async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); try { await navigator.clipboard.writeText((c as any).value); toast.success('Copied'); } catch { toast.error('Copy failed'); } } }}
                                              title="Click to copy"
                                              style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                                            >
                                              <button
                                                type="button"
                                                title="Click to copy"
                                                onClick={async () => { try { await navigator.clipboard.writeText((c as any).value); toast.success('Copied'); } catch { toast.error('Copy failed'); } }}
                                                style={{ width: 28, height: 28, borderRadius: 4, background: (c as any).value, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.2)', border: 'none', cursor: 'pointer' }}
                                              />
                                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                                                <span style={{ fontSize: 'var(--cf-text-s)' }}>{c.slug}</span>
                                                <button
                                                  type="button"
                                                  title="Click to copy"
                                                  onClick={async () => { try { await navigator.clipboard.writeText((c as any).value); toast.success('Copied'); } catch { toast.error('Copy failed'); } }}
                                                  className={styles.copyCodeButton}
                                                >{(c as any).value}</button>
                                                {c.badge && (
                                                  <span style={{ fontSize: 'var(--cf-text-xs)' }}>{c.badge}</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                } catch { return null; }
                              })()}
                            </div>
                          </div>
                        </div>
                        <hr
                          className={styles.tertiaryDivider}
                          style={{
                            borderTopColor: paletteWithVariations.tertiary?.variations?.find((v: any) => v.step === 'dark')?.hex || palette.tertiary?.hex || '#059669',
                          }}
                        />
                        <input
                          ref={dirInputRef}
                          type="file"
                          multiple
                          accept=".json,.css"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const list = e.target.files;
                            handleImportThemeDir(list);
                            e.currentTarget.value = '';
                          }}
                        />
                        <input
                          ref={themeJsonInputRef}
                          type="file"
                          accept=".json"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const input = e.currentTarget;
                            const f = e.target.files?.[0];
                            if (f) await handleImportThemeJsonPicked(f);
                            if (input) input.value = '';
                          }}
                        />
                        <input
                          ref={styleCssInputRef}
                          type="file"
                          accept=".css"
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const input = e.currentTarget;
                            const f = e.target.files?.[0];
                            if (f) await handleImportStyleCssPicked(f);
                            if (input) input.value = '';
                          }}
                        />
                      </div>

                      {/* Theme Name block */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)', flexWrap: 'wrap' }}>
                        <label className={styles.formLabel} style={{ margin: 0 }}>Output Theme Name</label>
                        <Input
                          placeholder="e.g., Business Calm"
                          value={manualForm.values.themeName}
                          onChange={(e) => {
                            manualForm.setValues({ ...manualForm.values, themeName: e.target.value });
                            setThemeName(e.target.value);
                          }}
                          style={{ width: 'min(15em, 100%)' }}
                        />
                        {isManualDirty && (
                          <span className={styles.unsavedIndicator} title="You have unsaved changes. Click Save to persist locally.">
                            <span className={styles.unsavedDot} />
                            Unsaved changes
                          </span>
                        )}
                        <Button
                          variant="outline"
                          onClick={() => {
                            try {
                              localStorage.setItem('gl_palette_manual_colors', JSON.stringify(manualForm.values));
                              const mv: any = manualForm.values || {};
                              localStorage.setItem('gl_theme_name', (mv.themeName ?? themeName ?? '') as string);
                              if (mv.textOnDark) localStorage.setItem('gl_theme_text_on_dark_hex', mv.textOnDark);
                              if (mv.textOnLight) localStorage.setItem('gl_theme_text_on_light_hex', mv.textOnLight);
                              if (mv.error) localStorage.setItem('gl_theme_semantic_error_hex', mv.error);
                              if (mv.warning) localStorage.setItem('gl_theme_semantic_warning_hex', mv.warning);
                              if (mv.success) localStorage.setItem('gl_theme_semantic_success_hex', mv.success);
                              if (themeConfig) localStorage.setItem('gl_imported_theme_json', JSON.stringify(themeConfig));
                              if (importDetails) localStorage.setItem('gl_import_details', JSON.stringify(importDetails));
                              // Update last-saved snapshot
                              try { savedManualJsonRef.current = JSON.stringify({ ...manualForm.values }); } catch { }
                              // Apply runtime overrides to CSS variables
                              try {
                                applyPaletteToCSSVariables({
                                  primary: { hex: manualForm.values.primary },
                                  secondary: { hex: manualForm.values.secondary },
                                  tertiary: { hex: manualForm.values.tertiary },
                                  accent: { hex: manualForm.values.accent },
                                  error: { hex: manualForm.values.error || palette.error.hex },
                                  success: { hex: manualForm.values.success || palette.success.hex },
                                  notice: { hex: manualForm.values.warning || palette.warning.hex },
                                } as any, {
                                  ...(exactSelections?.accent?.dark?.hex && { accentDark: exactSelections.accent.dark.hex }),
                                  ...(exactSelections?.error?.light?.hex && { errorLight: exactSelections.error.light.hex }),
                                  ...(exactSelections?.warning?.light?.hex && { warningLight: exactSelections.warning.light.hex }),
                                  ...(exactSelections?.success?.light?.hex && { successLight: exactSelections.success.light.hex }),
                                });
                              } catch { }
                              toast.success('Theme name, colors, and settings saved');
                            } catch { }
                          }}
                        >
                          Save colors and settings
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            try {
                              // Clear saved data
                              const keys = [
                                'gl_palette_manual_colors', 'gl_theme_name', 'gl_theme_text_on_dark_hex', 'gl_theme_text_on_light_hex',
                                'gl_theme_semantic_error_hex', 'gl_theme_semantic_warning_hex', 'gl_theme_semantic_success_hex'
                              ];
                              keys.forEach(k => localStorage.removeItem(k));
                            } catch { }
                            // Reset state to initial defaults
                            setThemeName('');
                            setTextOnDark('#F8F7F7');
                            setTextOnLight('#453521');
                            setPalette(initialPalette);
                            manualForm.setValues({
                              themeName: '',
                              textOnDark: '#F8F7F7',
                              textOnLight: '#453521',
                              primary: initialPalette.primary.hex,
                              secondary: initialPalette.secondary.hex,
                              tertiary: initialPalette.tertiary.hex,
                              accent: initialPalette.accent.hex,
                              error: initialPalette.error.hex,
                              warning: initialPalette.warning.hex,
                              success: initialPalette.success.hex,
                            });
                            // Re-apply defaults to CSS variables
                            try {
                              applyPaletteToCSSVariables({
                                primary: { hex: initialPalette.primary.hex },
                                secondary: { hex: initialPalette.secondary.hex },
                                tertiary: { hex: initialPalette.tertiary.hex },
                                accent: { hex: initialPalette.accent.hex },
                                error: { hex: initialPalette.error.hex },
                                success: { hex: initialPalette.success.hex },
                                notice: { hex: initialPalette.warning.hex },
                              } as any, {
                                ...(exactSelections?.accent?.dark?.hex && { accentDark: exactSelections.accent.dark.hex }),
                                ...(exactSelections?.error?.light?.hex && { errorLight: exactSelections.error.light.hex }),
                                ...(exactSelections?.warning?.light?.hex && { warningLight: exactSelections.warning.light.hex }),
                                ...(exactSelections?.success?.light?.hex && { successLight: exactSelections.success.light.hex }),
                              });
                            } catch { }
                            toast.success('Reset to defaults');
                          }}
                        >
                          Reset to defaults
                        </Button>
                      </div>
                      <hr
                        className={styles.tertiaryDivider}
                        style={{
                          borderTopColor: demoStepHex(paletteWithVariations, 'tertiary', 'dark'),
                        }}
                      />
                      {/* Color Wheel (non-interactive) */}
                      <div
                        className={styles.wheelRow}
                        ref={wheelRowRef}
                        style={{
                          ['--wheel-container-size' as any]: `${Math.max(2 * 205, wheelSizePx)}px`,
                        }}
                      >
                        <div className={styles.colorWheelStage}>
                          {/* Leader lines SVG overlay */}
                          <svg
                            className={styles.wheelLeadersSvg}
                            aria-hidden="true"
                            viewBox={`0 0 ${Math.max(2 * 205, wheelSizePx)} ${Math.max(2 * 205, wheelSizePx)}`}
                            preserveAspectRatio="none"
                          >
                            {(() => {
                              const MARKER_SIZE_PX = 18;
                              const LABEL_CONTAINER_RADIUS_PX = 205;
                              const LABEL_TEXT_RADIUS_PX = 170;
                              const LABEL_EDGE_PADDING_PX = 10;
                              const LABEL_MIN_SPACING_PX = 22;
                              const VERTICAL_ZONE_HUE_DEG = 20;

                              const normalizeHue = (h: number) => ((h % 360) + 360) % 360;
                              const isHueNear = (h: number, center: number, tol: number) => {
                                const hh = normalizeHue(h);
                                const cc = normalizeHue(center);
                                const d = Math.abs(hh - cc);
                                return Math.min(d, 360 - d) <= tol;
                              };

                              const containerSize = Math.max(2 * LABEL_CONTAINER_RADIUS_PX, wheelSizePx);
                              const cx = containerSize / 2;
                              const cy = containerSize / 2;
                              const wheelRadius = Math.max(0, wheelSizePx / 2 - MARKER_SIZE_PX);

                              type WheelPoint = {
                                key: ColorType | SemanticColorType;
                                name: string;
                                hex: string;
                                h: number;
                                s: number;
                                angleDeg: number;
                                dotX: number;
                                dotY: number;
                                side: 'left' | 'right' | 'top' | 'bottom';
                                labelX: number;
                                labelY: number;
                              };

                              const points: WheelPoint[] = (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as (ColorType | SemanticColorType)[])
                                .map((key) => {
                                  const hex = manualForm.values[key] || (palette as any)[key]?.hex;
                                  const rgb = hexToRgb(hex);
                                  const { h, s } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
                                  const angleDeg = (360 - h) % 360;
                                  const angleRad = (angleDeg * Math.PI) / 180;
                                  const r = wheelRadius * Math.max(0, Math.min(1, s));
                                  const dx = Math.cos(angleRad) * r;
                                  const dy = Math.sin(angleRad) * r;
                                  const dotX = cx + dx;
                                  const dotY = cy + dy;
                                  const name = (palette as any)[key]?.name || String(key);
                                  const side: 'left' | 'right' | 'top' | 'bottom' =
                                    isHueNear(h, 270, VERTICAL_ZONE_HUE_DEG) ? 'bottom'
                                      : isHueNear(h, 90, VERTICAL_ZONE_HUE_DEG) ? 'top'
                                        : (Math.cos(angleRad) >= 0 ? 'right' : 'left');
                                  const labelX =
                                    side === 'right' ? cx + LABEL_TEXT_RADIUS_PX
                                      : side === 'left' ? cx - LABEL_TEXT_RADIUS_PX
                                        : dotX;
                                  const labelY =
                                    side === 'top' ? cy - LABEL_TEXT_RADIUS_PX
                                      : side === 'bottom' ? cy + LABEL_TEXT_RADIUS_PX
                                        : dotY;
                                  return { key, name, hex, h, s, angleDeg, dotX, dotY, side, labelX, labelY };
                                });

                              // Resolve overlapping labels
                              const resolveSideY = (side: 'left' | 'right') => {
                                const arr = points.filter((p) => p.side === side).sort((a, b) => a.labelY - b.labelY);
                                let lastY = -Infinity;
                                for (const p of arr) {
                                  let y = p.labelY;
                                  if (y < lastY + LABEL_MIN_SPACING_PX) y = lastY + LABEL_MIN_SPACING_PX;
                                  y = Math.max(LABEL_EDGE_PADDING_PX, Math.min(containerSize - LABEL_EDGE_PADDING_PX, y));
                                  p.labelY = y;
                                  lastY = y;
                                }
                              };
                              const resolveSideX = (side: 'top' | 'bottom') => {
                                const arr = points.filter((p) => p.side === side).sort((a, b) => a.labelX - b.labelX);
                                let lastX = -Infinity;
                                for (const p of arr) {
                                  let x = p.labelX;
                                  if (x < lastX + LABEL_MIN_SPACING_PX) x = lastX + LABEL_MIN_SPACING_PX;
                                  x = Math.max(LABEL_EDGE_PADDING_PX, Math.min(containerSize - LABEL_EDGE_PADDING_PX, x));
                                  p.labelX = x;
                                  lastX = x;
                                }
                              };
                              resolveSideY('left');
                              resolveSideY('right');
                              resolveSideX('top');
                              resolveSideX('bottom');

                              return (
                                <>
                                  {points.map((p) => {
                                    const x2 =
                                      p.side === 'right' ? p.labelX - 6
                                        : p.side === 'left' ? p.labelX + 6
                                          : p.labelX;
                                    const y2 =
                                      p.side === 'bottom' ? p.labelY - 6
                                        : p.side === 'top' ? p.labelY + 6
                                          : p.labelY;
                                    return (
                                      <line
                                        key={`leader-${p.key}`}
                                        className={styles.wheelLeaderLine}
                                        x1={p.dotX}
                                        y1={p.dotY}
                                        x2={x2}
                                        y2={y2}
                                      />
                                    );
                                  })}
                                </>
                              );
                            })()}
                          </svg>

                          {/* Labels layer */}
                          <div className={styles.wheelLabels}>
                            {(() => {
                              const MARKER_SIZE_PX = 18;
                              const LABEL_CONTAINER_RADIUS_PX = 205;
                              const LABEL_TEXT_RADIUS_PX = 170;
                              const LABEL_EDGE_PADDING_PX = 10;
                              const LABEL_MIN_SPACING_PX = 22;
                              const VERTICAL_ZONE_HUE_DEG = 20;

                              const normalizeHue = (h: number) => ((h % 360) + 360) % 360;
                              const isHueNear = (h: number, center: number, tol: number) => {
                                const hh = normalizeHue(h);
                                const cc = normalizeHue(center);
                                const d = Math.abs(hh - cc);
                                return Math.min(d, 360 - d) <= tol;
                              };

                              const containerSize = Math.max(2 * LABEL_CONTAINER_RADIUS_PX, wheelSizePx);
                              const cx = containerSize / 2;
                              const cy = containerSize / 2;
                              const wheelRadius = Math.max(0, wheelSizePx / 2 - MARKER_SIZE_PX);

                              type WheelPoint = {
                                key: ColorType | SemanticColorType;
                                name: string;
                                h: number;
                                s: number;
                                angleDeg: number;
                                dotX: number;
                                dotY: number;
                                side: 'left' | 'right' | 'top' | 'bottom';
                                labelX: number;
                                labelY: number;
                              };

                              const points: WheelPoint[] = (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as (ColorType | SemanticColorType)[])
                                .map((key) => {
                                  const hex = manualForm.values[key] || (palette as any)[key]?.hex;
                                  const rgb = hexToRgb(hex);
                                  const { h, s } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
                                  const angleDeg = (360 - h) % 360;
                                  const angleRad = (angleDeg * Math.PI) / 180;
                                  const r = wheelRadius * Math.max(0, Math.min(1, s));
                                  const dx = Math.cos(angleRad) * r;
                                  const dy = Math.sin(angleRad) * r;
                                  const dotX = cx + dx;
                                  const dotY = cy + dy;
                                  const name = (palette as any)[key]?.name || String(key);
                                  const side: 'left' | 'right' | 'top' | 'bottom' =
                                    isHueNear(h, 270, VERTICAL_ZONE_HUE_DEG) ? 'bottom'
                                      : isHueNear(h, 90, VERTICAL_ZONE_HUE_DEG) ? 'top'
                                        : (Math.cos(angleRad) >= 0 ? 'right' : 'left');
                                  const labelX =
                                    side === 'right' ? cx + LABEL_TEXT_RADIUS_PX
                                      : side === 'left' ? cx - LABEL_TEXT_RADIUS_PX
                                        : dotX;
                                  const labelY =
                                    side === 'top' ? cy - LABEL_TEXT_RADIUS_PX
                                      : side === 'bottom' ? cy + LABEL_TEXT_RADIUS_PX
                                        : dotY;
                                  return { key, name, h, s, angleDeg, dotX, dotY, side, labelX, labelY };
                                });

                              // Resolve overlapping labels
                              const resolveSideY = (side: 'left' | 'right') => {
                                const arr = points.filter((p) => p.side === side).sort((a, b) => a.labelY - b.labelY);
                                let lastY = -Infinity;
                                for (const p of arr) {
                                  let y = p.labelY;
                                  if (y < lastY + LABEL_MIN_SPACING_PX) y = lastY + LABEL_MIN_SPACING_PX;
                                  y = Math.max(LABEL_EDGE_PADDING_PX, Math.min(containerSize - LABEL_EDGE_PADDING_PX, y));
                                  p.labelY = y;
                                  lastY = y;
                                }
                              };
                              const resolveSideX = (side: 'top' | 'bottom') => {
                                const arr = points.filter((p) => p.side === side).sort((a, b) => a.labelX - b.labelX);
                                let lastX = -Infinity;
                                for (const p of arr) {
                                  let x = p.labelX;
                                  if (x < lastX + LABEL_MIN_SPACING_PX) x = lastX + LABEL_MIN_SPACING_PX;
                                  x = Math.max(LABEL_EDGE_PADDING_PX, Math.min(containerSize - LABEL_EDGE_PADDING_PX, x));
                                  p.labelX = x;
                                  lastX = x;
                                }
                              };
                              resolveSideY('left');
                              resolveSideY('right');
                              resolveSideX('top');
                              resolveSideX('bottom');

                              return points.map((p) => {
                                const transform =
                                  p.side === 'right' ? `translate(0, -50%)`
                                    : p.side === 'left' ? `translate(-100%, -50%)`
                                      : p.side === 'top' ? `translate(-50%, -100%)`
                                        : `translate(-50%, 0)`;
                                return (
                                  <span
                                    key={`label-${p.key}`}
                                    className={styles.wheelMarkerLabelAbs}
                                    style={{
                                      left: p.labelX,
                                      top: p.labelY,
                                      transform,
                                    }}
                                  >
                                    {p.name}
                                  </span>
                                );
                              });
                            })()}
                          </div>

                          {/* The actual color wheel */}
                          <div className={styles.colorWheel} ref={wheelRef}>
                            {/* ticks at 0/90/180/270 */}
                            {([0, 90, 180, 270] as number[]).map((deg) => (
                              <span
                                key={`tick-${deg}`}
                                className={`${styles.wheelTick} ${([90, 270].includes(deg) ? styles.wheelTickVertical : '')}`}
                                style={{ transform: `translate(-50%, -50%) rotate(${(360 - deg) % 360}deg) translate(var(--tick-radius)) rotate(-${(360 - deg) % 360}deg)` }}
                              />
                            ))}
                            {/* Labels every 45° (0..315). Keep text horizontal; add extra radius for 90/270. */}
                            {([0, 45, 90, 135, 180, 225, 270, 315] as number[]).map((deg) => (
                              <span
                                key={`tick-label-${deg}`}
                                className={styles.wheelTickLabel}
                                style={{
                                  transform: `translate(-50%, -50%) rotate(${(360 - deg) % 360}deg) translate(var(${[90, 270].includes(deg) ? '--tick-label-radius-vertical' : '--tick-label-radius'})) rotate(0deg)`
                                }}
                              >
                                {deg}
                              </span>
                            ))}

                            {/* markers positioned by hue (angle) and saturation (radius) */}
                            {(['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as (ColorType | SemanticColorType)[]).map((key) => {
                              const hex = manualForm.values[key] || (palette as any)[key]?.hex;
                              const rgb = hexToRgb(hex);
                              const { h, s } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
                              const angle = (360 - h) % 360;
                              const wheelRadius = Math.max(0, wheelSizePx / 2 - 18);
                              const r = wheelRadius * Math.max(0, Math.min(1, s));
                              return (
                                <span
                                  key={`marker-${key}`}
                                  className={styles.wheelMarker}
                                  title={`${(palette as any)[key]?.name}`}
                                  style={{
                                    background: `hsl(${Math.round(h)}, 50%, 50%)`,
                                    transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${r}px) rotate(-${angle}deg)`,
                                  }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      {/* Save button moved above, next to Theme Name */}

                      {/* Imported theme.json palette block moved above (replaces partial list) */}
                      {showWheelHint && (
                        <p className={styles.formHelp} style={{ fontSize: 'var(--cf-text-xs)', textAlign: 'center', marginTop: 'var(--spacing-1)' }}>
                          On narrow screens, drag horizontally to view the full color wheel and labels.
                        </p>
                      )}
                    </div>

                    {/* Right column: color entry controls */}
                    <div className={styles.manualCol}>
                      <form className={styles.manualForm}>
                        <p className={`${styles.formHelp} ${styles.formHelpTight}`}>
                          Enter hexadecimal color numbers, or click the color swatch to enter HSL (type or up/down arrow keys in fields, or drag in the color picker).
                        </p>
                        {/* Order: Text on Light above Text on Dark */}
                        <FormItem name="textOnLight">
                          <FormControl>
                            <ColorInput
                              value={manualForm.values.textOnLight}
                              onChange={(hex) => {
                                manualForm.setValues({ ...manualForm.values, textOnLight: hex });
                                setTextOnLight(hex);
                              }}
                              trailing={(() => {
                                try {
                                  const { r, g, b } = hexToRgb(manualForm.values.textOnLight);
                                  const { h, s, l } = rgbToHslNorm(r, g, b);
                                  const Y = luminance(r, g, b);
                                  const ok = Y <= CLOSE_ENOUGH_TO_BLACK_MAX_LUM;
                                  const stillMissingTintOptions =
                                    !ribbonValidation.valid &&
                                    ribbonValidation.errors.some((e) =>
                                      e.includes('-lighter:') || e.includes('-light:')
                                    );
                                  const needsDarkerTextOnLight = !ok || stillMissingTintOptions;
                                  return (
                                    <div>
                                      <FormLabel>
                                        Text on Light (near black)
                                      </FormLabel>
                                      <div className={styles.formMeta}>
                                        HSL({Math.round(h)}, {Math.round(s * 100)}%, {Math.round(l * 100)}%)
                                      </div>
                                      <div className={styles.metaLabel}>
                                        Y= {Y.toFixed(3)}
                                      </div>
                                      {needsDarkerTextOnLight && (
                                        <div className={styles.contrastHint}>
                                          Not enough AAA tints. Make Text on Light darker.
                                        </div>
                                      )}
                                      {/* Suggestions */}
                                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#0A0A0A';
                                            manualForm.setValues({ ...manualForm.values, textOnLight: hex });
                                            setTextOnLight(hex);
                                          }}
                                        >Neutral black</Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#111827';
                                            manualForm.setValues({ ...manualForm.values, textOnLight: hex });
                                            setTextOnLight(hex);
                                          }}
                                        >Cool (ink)</Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#1F1A17';
                                            manualForm.setValues({ ...manualForm.values, textOnLight: hex });
                                            setTextOnLight(hex);
                                          }}
                                        >Warm (espresso)</Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#222222';
                                            manualForm.setValues({ ...manualForm.values, textOnLight: hex });
                                            setTextOnLight(hex);
                                          }}
                                        >Neutral gray</Button>
                                      </div>
                                    </div>
                                  );
                                } catch {
                                  return null;
                                }
                              })()}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        <FormItem name="textOnDark">
                          <FormControl>
                            <ColorInput
                              value={manualForm.values.textOnDark}
                              onChange={(hex) => {
                                manualForm.setValues({ ...manualForm.values, textOnDark: hex });
                                setTextOnDark(hex);
                              }}
                              trailing={(() => {
                                try {
                                  const { r, g, b } = hexToRgb(manualForm.values.textOnDark);
                                  const { h, s, l } = rgbToHslNorm(r, g, b);
                                  const Y = luminance(r, g, b);
                                  const ok = Y >= CLOSE_ENOUGH_TO_WHITE_MIN_LUM;
                                  const stillMissingShadeOptions =
                                    !ribbonValidation.valid &&
                                    ribbonValidation.errors.some((e) =>
                                      e.includes('-darker:') || e.includes('-dark:')
                                    );
                                  const needsLighterTextOnDark = !ok || stillMissingShadeOptions;
                                  return (
                                    <div>
                                      <FormLabel>
                                        Text on Dark (near white)
                                      </FormLabel>
                                      <div className={styles.formMeta}>
                                        HSL({Math.round(h)}, {Math.round(s * 100)}%, {Math.round(l * 100)}%)
                                      </div>
                                      <div className={styles.metaLabel}>
                                        Y= {Y.toFixed(Y_TARGET_DECIMALS)}
                                      </div>
                                      {needsLighterTextOnDark && (
                                        <div className={styles.contrastHint}>
                                          Not enough AAA shades. Make Text on Dark lighter.
                                        </div>
                                      )}
                                      {/* Suggestions */}
                                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#FFFFFF';
                                            manualForm.setValues({ ...manualForm.values, textOnDark: hex });
                                            setTextOnDark(hex);
                                          }}
                                        >Neutral white</Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#F3F4F6';
                                            manualForm.setValues({ ...manualForm.values, textOnDark: hex });
                                            setTextOnDark(hex);
                                          }}
                                        >Cool (gray)</Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#FAF7F2';
                                            manualForm.setValues({ ...manualForm.values, textOnDark: hex });
                                            setTextOnDark(hex);
                                          }}
                                        >Warm (cream)</Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#F9FAFB';
                                            manualForm.setValues({ ...manualForm.values, textOnDark: hex });
                                            setTextOnDark(hex);
                                          }}
                                        >Neutral off-white</Button>
                                      </div>
                                    </div>
                                  );
                                } catch {
                                  return null;
                                }
                              })()}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>

                        {(Object.keys(palette) as (ColorType | SemanticColorType)[]).map((key) => (
                          <FormItem key={key} name={key}>
                            <FormControl>
                              <ColorInput
                                value={(manualForm.values as any)[key] || '#000000'}
                                onChange={(hex) => handleManualColorChange(key as ColorType | SemanticColorType, hex)}
                                trailing={
                                  <FormLabel>
                                    {palette[key].name}
                                    {(() => {
                                      const rgb = hexToRgb(((manualForm.values as any)[key] || '#000000'));
                                      const { h, s, l } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
                                      return (
                                        <span style={{ marginLeft: 8, fontSize: 'var(--cf-text-s)', color: manualForm.values.textOnLight || 'var(--foreground)' }}>
                                          HSL({Math.round(h)}, {Math.round(s * 100)}%, {Math.round(l * 100)}%)
                                        </span>
                                      );
                                    })()}
                                    {(['error', 'warning', 'success'] as Array<ColorType | SemanticColorType>).includes(key) && (
                                      <div style={{ marginTop: 2, fontSize: 'var(--cf-text-s)', color: 'var(--foreground)' }}>
                                        Default {initialPalette[key as keyof Palette].hex}
                                      </div>
                                    )}
                                  </FormLabel>
                                }
                              />
                            </FormControl>
                            <FormMessage />
                            {false && (<></>)}
                            {(['error', 'warning', 'success'] as Array<ColorType | SemanticColorType>).includes(key) && (
                              <div style={{ display: 'flex', gap: 'var(--spacing-2)', marginTop: '6px', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 'var(--cf-text-s)' }}>Light scheme band:</span>
                                  <select
                                    value={semanticBandSelection[key as 'error' | 'warning' | 'success'].light}
                                    onChange={(e) => {
                                      const v = e.target.value as Band;
                                      setSemanticBandSelection((prev) => ({
                                        ...prev,
                                        [key as 'error' | 'warning' | 'success']: { ...prev[key as 'error' | 'warning' | 'success'], light: v },
                                      }));
                                    }}
                                  >
                                    {(['lighter', 'light', 'dark', 'darker'] as Band[]).map((b) => (
                                      <option key={b} value={b}>{b}</option>
                                    ))}
                                  </select>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontSize: 'var(--cf-text-s)' }}>Dark scheme band:</span>
                                  <select
                                    value={semanticBandSelection[key as 'error' | 'warning' | 'success'].dark}
                                    onChange={(e) => {
                                      const v = e.target.value as Band;
                                      setSemanticBandSelection((prev) => ({
                                        ...prev,
                                        [key as 'error' | 'warning' | 'success']: { ...prev[key as 'error' | 'warning' | 'success'], dark: v },
                                      }));
                                    }}
                                  >
                                    {(['lighter', 'light', 'dark', 'darker'] as Band[]).map((b) => (
                                      <option key={b} value={b}>{b}</option>
                                    ))}
                                  </select>
                                </label>
                              </div>
                            )}
                          </FormItem>
                        ))}
                      </form>
                    </div>
                  </div>
                </Form>
              </TabsContent>
              {/* Adjustments Tab */}
              <TabsContent value="adjust" className={styles.tabContent}>
                <h2 className={styles.sectionTitle}>Adjust the Tints and Shades</h2>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-start', marginBottom: 'var(--spacing-3)', flexWrap: 'wrap' }}>
                  <Button
                    variant="outline"
                    wrap
                    onClick={() => {
                      try {
                        localStorage.setItem('gl_palette_luminance_selections', JSON.stringify(selections));
                      } catch { }
                    }}
                  >
                    Save selections
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelections({})}
                  >
                    Clear selections
                  </Button>
                </div>
                <LuminanceTestStrips
                  palette={paletteWithVariations}
                  selections={selections}
                  anchorPrefix="d-"
                  showDiagnostics={showDiagnostics}
                  onTokensAutoAdjusted={(update) => {
                    // Persist adjusted tokens into form, state, and localStorage
                    const nextVals = { ...manualForm.values } as any;
                    if (update.textOnLight) {
                      setTextOnLight(update.textOnLight);
                      nextVals.textOnLight = update.textOnLight;
                      try { localStorage.setItem('gl_theme_text_on_light_hex', update.textOnLight); } catch { }
                    }
                    if (update.textOnDark) {
                      setTextOnDark(update.textOnDark);
                      nextVals.textOnDark = update.textOnDark;
                      try { localStorage.setItem('gl_theme_text_on_dark_hex', update.textOnDark); } catch { }
                    }
                    manualForm.setValues(nextVals);
                  }}
                  onSelectTintIndex={(colorKey, kind, index) => {
                    console.log(`[onSelectTintIndex] ${colorKey}.${kind} = ${index}`);
                    setSelections((prev) => ({
                      ...prev,
                      [colorKey]: {
                        ...(prev[colorKey] || {}),
                        ...(kind === 'lighter' ? { lighterIndex: index } : {}),
                        ...(kind === 'light' ? { lightIndex: index } : {}),
                      },
                    }));
                  }}
                  onSelectShadeY={(colorKey, kind, y) =>
                    setSelections((prev) => ({
                      ...prev,
                      [colorKey]: {
                        ...(prev[colorKey] || {}),
                        ...(kind === 'darker' ? { darkerY: y } : {}),
                        ...(kind === 'dark' ? { darkY: y } : {}),
                      },
                    }))
                  }
                  // New exact-pick handlers (used to override Palette/Export)
                  onSelectTint={(colorKey, kind, pick) => {
                    if (!isValidSwatchPick(pick)) { console.error('Rejected invalid SwatchPick (tint)', { colorKey, kind, pick }); return; }
                    console.log(`[onSelectTint] ${colorKey}.${kind}: hex=${pick.hex}, indexDisplayed=${pick.indexDisplayed}`);
                    setExactSelections((prev) => ({
                      ...prev,
                      [colorKey]: { ...(prev[colorKey] || {}), [kind]: pick },
                    }));
                  }}
                  onSelectShade={(colorKey, kind, pick) => {
                    if (!isValidSwatchPick(pick)) { console.error('Rejected invalid SwatchPick (shade)', { colorKey, kind, pick }); return; }
                    setExactSelections((prev) => ({
                      ...prev,
                      [colorKey]: { ...(prev[colorKey] || {}), [kind]: pick },
                    }));
                  }}
                  textOnLight={textOnLight}
                  textOnDark={textOnDark}
                  onGoPalette={() => setActiveTab('palette')}
                />
              </TabsContent>
              <TabsContent value="export" className={styles.tabContent}>
                <div className={styles.exportSection}>
                  <h2 className={styles.sectionTitle}>Export</h2>
                  <p
                    className={styles.exportDescription}
                    style={{ color: `light-dark(${textOnLight}, ${textOnDark})` }}
                  >
                    Download a ZIP containing the contrast-adjusted theme variations (all combinations of the main 3 colors).<br />
                    The file includes a WordPress theme.json and a CSS file with CSS variables and contrast-optimized utilities, for each variation.<br />
                    Copy each file in it, into your child theme's <code>styles</code> folder.<br />
                    Below see the exported colors, their hex numbers, and HSL values.
                  </p>
                  {/* Export preview and details */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: 'var(--spacing-4)',
                    marginTop: 'var(--spacing-3)'
                  }}>
                    {/* Metadata */}
                    <div style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--spacing-3)'
                    }}>
                      <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-2)', fontSize: 'var(--cf-text-m)' }}>Details to be exported</h3>
                      {(() => {
                        const safe = (name: string) => name.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
                        const prefix = themeName ? safe(themeName) : 'themes';
                        const effectiveSchema = (themeConfig && typeof (themeConfig as any).$schema === 'string')
                          ? (themeConfig as any).$schema
                          : 'https://schemas.wp.org/trunk/theme.json';
                        const effectiveVersion = (themeConfig && (themeConfig as any).version != null)
                          ? (themeConfig as any).version
                          : 3;
                        const filename = `${prefix}-${darkHexSuffix}.zip`;
                        return (
                          <>
                            <ul className="u-list-circle">
                              <li><strong>Theme Name:</strong> {themeName || 'Theme'}</li>
                              <li><strong>Schema & Version:</strong> {String(effectiveSchema)}, {String(effectiveVersion)}</li>
                              <li><strong>Suggested file name:</strong> {filename}</li>
                              <li><strong>Destination:</strong> You will be prompted to choose a save location (or your browser will save to the default downloads folder).</li>
                            </ul>
                            <div style={{ marginTop: 'var(--spacing-3)' }}>
                              <label style={{ display: 'block', fontWeight: 600 }}>How many theme variations to export?</label>
                              <RadioGroup
                                value={exportVariationMode}
                                onValueChange={(v) => setExportVariationMode((v === '24' ? '24' : '6'))}
                                style={{ display: 'flex', gap: 'var(--spacing-3)', marginTop: 'var(--spacing-2)' }}
                                aria-label="Variation count"
                              >
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <RadioGroupItem value="6" />
                                  <span>6 (rotate P/S/T; Accent fixed)</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <RadioGroupItem value="24" />
                                  <span>24 (rotate all four: P/S/T/Accent)</span>
                                </label>
                              </RadioGroup>
                              <p className={styles.formHelp} style={{ marginTop: 'var(--spacing-2)', fontSize: 'var(--cf-text-s)' }}>
                                {mostEyeCatching === 'accent'
                                  ? 'Tip: Your Accent color appears the most eye‑catching. Consider exporting 6 variations so links, menus, and buttons use Accent consistently.'
                                  : 'Tip: If one color is clearly more eye‑catching for links/menus/buttons, set it as Accent and export 6 variations.'}
                              </p>
                            </div>
                            <div style={{ marginTop: 'var(--spacing-3)' }}>
                              <Button
                                onClick={handleExportGzipAll}
                                className={styles.exportButton}
                                style={{
                                  background: accentDarkHex,
                                  color: textOnDark,
                                  borderColor: accentDarkHex
                                }}
                              >
                                Download .zip file
                              </Button>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* 3-column flex: Swatches | HEX | HSL */}
                    <div style={{ display: 'flex', gap: 'var(--spacing-3)', flexWrap: 'wrap' }}>
                      {/* Swatch preview */}
                      <div style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: 'var(--spacing-3)',
                        flex: '1 1 340px',
                        minWidth: '340px'
                      }}>
                        <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-2)', fontSize: 'var(--cf-text-m)' }}>Colors to be exported (contrast-adjusted only)</h3>
                        {/* Text on Light/Dark preview */}
                        <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 'var(--spacing-3)' }}>
                          {[{ label: 'text-on-light', hex: textOnLight }, { label: 'text-on-dark', hex: textOnDark }].map(({ label, hex }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 6, padding: 6 }}>
                              <span title={hex} style={{ display: 'inline-block', width: '2.5rem', height: '2.5rem', borderRadius: 4, background: hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)' }} />
                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                                <span style={{ fontSize: 'var(--cf-text-s)' }}>{label}</span>
                                <span style={{ fontFamily: '"Fira Code", "Liberation Mono", "Nimbus Mono L", "FreeMono", "DejaVu Mono", "Bitstream Vera Mono", "Lucida Console", "Andale Mono", "Courier New", monospace', fontSize: 'var(--cf-text-s)' }}>{(hex || '').toUpperCase()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gap: 'var(--spacing-3)' }}>
                          {(['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const).map((key) => {
                            const entry: any = (paletteWithVariations as any)?.[key];
                            if (!entry) return null;
                            const isSemantic = key === 'error' || key === 'warning' || key === 'success';
                            const items: Array<{ label: string; hex: string }> = [];
                            const pushItem = (label: string, hex: string | undefined) => {
                              if (!hex) return;
                              items.push({ label, hex });
                            };
                            if (Array.isArray(entry.variations)) {
                              if (isSemantic) {
                                // Only show the chosen light/dark bands for semantic colors, labeled as key-step
                                const sel = semanticBandSelection[key as 'error' | 'warning' | 'success'];
                                const findHex = (step: string) => entry.variations.find((v: any) => v.step === step)?.hex;
                                const prefix = key === 'warning' ? 'notice' : key;
                                pushItem(`${prefix}-light`, findHex(sel.light));
                                pushItem(`${prefix}-dark`, findHex(sel.dark));
                              } else {
                                // Exclude base; only include adjusted bands. Prefer ordering: dark, darker, light, lighter
                                const order = ['dark', 'darker', 'light', 'lighter'];
                                const adjusted = entry.variations.filter((v: any) => v.step !== 'base');
                                adjusted.sort((a: any, b: any) => order.indexOf(a.step) - order.indexOf(b.step));
                                adjusted.forEach((v: any) => pushItem(v.step || 'unknown', v.hex));
                              }
                            }
                            const toHsl = (hex: string) => {
                              try {
                                const { r, g, b } = hexToRgb(hex);
                                const { h, s, l } = rgbToHslNorm(r, g, b);
                                const H = Math.round(h);
                                const S = Math.round(s * 100);
                                const L = Math.round(l * 100);
                                return `hsl(${H}, ${S}%, ${L}%)`;
                              } catch {
                                return 'hsl(0, 0%, 0%)';
                              }
                            };
                            return (
                              <div key={key}>
                                <h4 style={{ margin: 0, marginBottom: 6 }}>{entry?.name || key}</h4>
                                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                                  {items.map(({ label, hex }) => (
                                    <div key={label + hex} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 6, padding: 6 }}>
                                      <span title={hex} style={{ display: 'inline-block', width: '2.5rem', height: '2.5rem', borderRadius: 4, background: hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)' }} />
                                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                                        <span style={{ fontSize: 'var(--cf-text-s)' }}>{label}</span>
                                        <span style={{ fontFamily: '"Fira Code", "Liberation Mono", "Nimbus Mono L", "FreeMono", "DejaVu Mono", "Bitstream Vera Mono", "Lucida Console", "Andale Mono", "Courier New", monospace', fontSize: 'var(--cf-text-s)' }}>{hex.toUpperCase()}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {/* Copy-friendly lists (HEX and HSL as separate cards) */}
                      <div style={{ display: 'contents' }}>
                        {(() => {
                          type Key = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'error' | 'warning' | 'success';
                          const keys: Key[] = ['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'];
                          const linesHex: string[] = [];
                          const linesHsl: string[] = [];
                          const slugFor = (key: Key, step: string) => `${key}-${step}`;
                          const displaySlugFor = (key: Key, step: string) => `${key === 'warning' ? 'notice' : key}-${step}`;
                          const toHsl = (hex: string) => {
                            try {
                              const { r, g, b } = hexToRgb(hex);
                              const { h, s, l } = rgbToHslNorm(r, g, b);
                              const H = Math.round(h);
                              const S = Math.round(s * 100);
                              const L = Math.round(l * 100);
                              return `hsl(${H}, ${S}%, ${L}%)`;
                            } catch {
                              return 'hsl(0, 0%, 0%)';
                            }
                          };
                          // Add text-on light/dark first
                          if (textOnLight) {
                            linesHex.push(`text-on-light: ${textOnLight.toUpperCase()}`);
                            linesHsl.push(`text-on-light: ${toHsl(textOnLight)}`);
                          }
                          if (textOnDark) {
                            linesHex.push(`text-on-dark: ${textOnDark.toUpperCase()}`);
                            linesHsl.push(`text-on-dark: ${toHsl(textOnDark)}`);
                          }
                          // Add adjusted color bands for each key (exclude base)
                          keys.forEach((key) => {
                            const entry: any = (paletteWithVariations as any)?.[key];
                            if (!entry) return;
                            const isSemantic = key === 'error' || key === 'warning' || key === 'success';
                            const add = (step: string, hex?: string) => {
                              if (!hex) return;
                              const slug = slugFor(key as Key, step);
                              const displaySlug = displaySlugFor(key as Key, step);
                              linesHex.push(`${displaySlug}: ${hex.toUpperCase()}`);
                              linesHsl.push(`${displaySlug}: ${toHsl(hex)}`);
                            };
                            if (Array.isArray(entry.variations)) {
                              if (isSemantic) {
                                const sel = semanticBandSelection[key as 'error' | 'warning' | 'success'];
                                const findHex = (step: string) => entry.variations.find((v: any) => v.step === step)?.hex;
                                add('light', findHex(sel.light));
                                add('dark', findHex(sel.dark));
                              } else {
                                const order = ['dark', 'darker', 'light', 'lighter'];
                                const adjusted = entry.variations.filter((v: any) => v.step !== 'base');
                                adjusted.sort((a: any, b: any) => order.indexOf(a.step) - order.indexOf(b.step));
                                adjusted.forEach((v: any) => add(v.step || 'unknown', v.hex));
                              }
                            }
                          });
                          return (
                            <>
                              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-3)', flex: '0 0 320px', minWidth: '320px' }}>
                                <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-2)', fontSize: 'var(--cf-text-m)' }}>HEX</h3>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 'var(--cf-text-s)', fontFamily: '"Fira Code", "Liberation Mono", "Nimbus Mono L", "FreeMono", "DejaVu Mono", "Bitstream Vera Mono", "Lucida Console", "Andale Mono", "Courier New", monospace' }}>
                                  {linesHex.join('\n')}
                                </pre>
                              </div>
                              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 'var(--spacing-3)', flex: '0 0 440px', minWidth: '440px' }}>
                                <h3 style={{ marginTop: 0, marginBottom: 'var(--spacing-2)', fontSize: 'var(--cf-text-m)' }}>HSL</h3>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 'var(--cf-text-s)', fontFamily: '"Fira Code", "Liberation Mono", "Nimbus Mono L", "FreeMono", "DejaVu Mono", "Bitstream Vera Mono", "Lucida Console", "Andale Mono", "Courier New", monospace' }}>
                                  {linesHsl.join('\n')}
                                </pre>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                </div>
              </TabsContent>
              {/* Demo Tab */}
              <TabsContent value="demo" className={styles.tabContent}>
                <h2 className={styles.sectionTitle}>Demo</h2>
                <LightDarkPreview
                  palette={paletteWithVariations}
                  textOnLight={textOnLight}
                  textOnDark={textOnDark}
                  scheme={demoScheme}
                  onSchemeChange={setDemoScheme}
                >
                  <PreviewSection
                    palette={paletteWithVariations}
                    isLoading={generatePaletteMutation.isPending}
                    scheme={demoScheme}
                  />
                  {/* Status messages demo */}
                  <div className={styles.statusMessages} aria-label="Status messages demo">
                    <div className={[styles.status, styles.statusError].join(' ')} role="alert">
                      <strong>Error:</strong> Something went wrong. Please try again.
                    </div>
                    <div className={[styles.status, styles.statusWarning].join(' ')} role="status">
                      <strong>Notice:</strong> Unsaved changes. Don’t forget to save.
                    </div>
                    <div className={[styles.status, styles.statusSuccess].join(' ')} role="status">
                      <strong>Success:</strong> Your settings have been saved.
                    </div>
                  </div>
                </LightDarkPreview>
              </TabsContent>
              {/* Landing Page Tab */}
              <TabsContent value="landing" className={styles.tabContent}>
                <IndexPage />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
}

export default GeneratorPage;
