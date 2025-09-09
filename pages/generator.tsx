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
import { Palette, ColorType, SemanticColorType, PaletteWithVariations, SwatchPick } from '../helpers/types';
import { generateShades, hexToRgb, rgbToHslNorm, hslNormToRgb, rgbToHex, solveHslLightnessForY, getContrastRatio, matchBandFromPrimaryByS, luminance } from '../helpers/colorUtils';
import { NEAR_BLACK_RGB, TINT_TARGET_COUNT, LIGHTER_MIN_Y, LIGHTER_MAX_Y, LIGHT_MIN_Y_BASE, LIGHT_MAX_Y_CAP, MIN_DELTA_LUM_TINTS, Y_TARGET_DECIMALS, AAA_MIN, MAX_CONTRAST_TINTS, RECOMMENDED_TINT_Y_GAP, TARGET_LUM_DARK, CLOSE_ENOUGH_TO_WHITE_MIN_LUM, CLOSE_ENOUGH_TO_BLACK_MAX_LUM } from '../helpers/config';
import { LuminanceTestStrips } from '../components/LuminanceTestStrips';
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
import { applyPaletteToCSSVariables, exportCoreFoundationCSSFromCurrent } from '../helpers/themeRuntime';

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
  const [palette, setPalette] = useState<Palette>(initialPalette);
  const [selections, setSelections] = useState<
    Partial<Record<ColorType | SemanticColorType, { lighterIndex?: number; lightIndex?: number; darkerY?: number; darkY?: number }>>
  >({});
  // Exact picks captured from Adjust (used to override Palette/Export)
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
      if (rawDetails) setImportDetails(JSON.parse(rawDetails));
    } catch { }
  }, []);
  // Default when nothing has been saved yet; a hydration effect below will
  // load persisted values from localStorage and overwrite these shortly.
  // Defaults per request
  const [textOnDark, setTextOnDark] = useState<string>('#F7F3EE');
  const [textOnLight, setTextOnLight] = useState<string>('#453521');

  // Build variations with semantics applied
  const paletteWithVariations = useMemo<PaletteWithVariations>(() => {
    try {
      // Apply semantic defaults to ensure error/warning/success exist with valid hexes
      const withSem = generateSemanticColors(palette as any) as any;
      // Construct a true PaletteWithVariations by generating per-family bands
      const build = (key: keyof PaletteWithVariations) => {
        const entry = withSem[key] as { name: string; hex: string };
        const variations = Array.isArray((withSem as any)[key]?.variations)
          ? (withSem as any)[key].variations
          : generateShades(entry.hex, key as string);
        return { ...entry, variations };
      };
      const out: PaletteWithVariations = {
        primary: build('primary'),
        secondary: build('secondary'),
        tertiary: build('tertiary'),
        accent: build('accent'),
        error: build('error'),
        warning: build('warning'),
        success: build('success'),
      };
      // Override any generated band hexes with exact user picks
      const applyExact = (key: keyof PaletteWithVariations) => {
        const picks = (exactSelections as any)?.[key];
        if (!picks) return;
        const arr: any[] = Array.isArray((out as any)[key]?.variations) ? (out as any)[key].variations : [];
        const setHex = (step: 'lighter' | 'light' | 'dark' | 'darker', hex?: string) => {
          if (!hex) return;
          const v = arr.find((x) => x && (x.step === step || x.name === step));
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
      // Safe fallback: mirror current palette with empty variations to avoid crashes
      const fb: any = {};
      (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const).forEach((k) => {
        fb[k] = { ...(palette as any)[k], variations: [] };
      });
      return fb as PaletteWithVariations;
    }
  }, [palette, exactSelections]);

  // Migration: if we have legacy selections (indices/Y) but no exactSelections for a color,
  // derive exact SwatchPicks from the built variations so Palette/Export reflect user choices on first load.
  useEffect(() => {
    try {
      const needKeys = (['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as const)
        .filter((k) => !(exactSelections as any)?.[k] && (selections as any)?.[k]);
      if (!needKeys.length) return;
      const next: typeof exactSelections = { ...(exactSelections as any) } as any;
      needKeys.forEach((k) => {
        const sel = (selections as any)[k] || {};
        const entry = (paletteWithVariations as any)[k];
        const arr: Array<{ step: string; hex: string }> = Array.isArray(entry?.variations) ? entry.variations : [];
        const addPick = (step: 'lighter' | 'light' | 'dark' | 'darker', indexMaybe?: number, yMaybe?: number) => {
          let hex: string | undefined;
          let indexDisplayed: number | undefined;
          if (typeof indexMaybe === 'number') {
            // Find index-th in the filtered list; fall back to matching by step
            const byStep = arr.filter((v) => v.step === step);
            if (byStep[indexMaybe]?.hex) { hex = byStep[indexMaybe].hex; indexDisplayed = indexMaybe; }
          }
          if (!hex && typeof yMaybe === 'number') {
            // Find closest Y among this step
            const candidates = arr.filter((v) => v.step === step);
            if (candidates.length > 0) {
              const ys = candidates.map((v) => { const { r, g, b } = hexToRgb(v.hex); return luminance(r, g, b); });
              let best = 0, dBest = Infinity;
              ys.forEach((yy, i) => { const d = Math.abs(yy - yMaybe); if (d < dBest) { dBest = d; best = i; } });
              if (best >= 0 && best < candidates.length && candidates[best]?.hex) { hex = candidates[best].hex; indexDisplayed = best; }
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
      setExactSelections(next);
    } catch { }
  }, [paletteWithVariations, selections, textOnLight, textOnDark]);

  // Synchronize Adjust highlights (selections) from exactSelections so the initially highlighted
  // swatches match what Palette/Export are using.
  useEffect(() => {
    try {
      if (!exactSelections || Object.keys(exactSelections).length === 0) return;
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
            if (step === 'lighter' && cur.lighterIndex == null) cur.lighterIndex = idx;
            if (step === 'light' && cur.lightIndex == null) cur.lightIndex = idx;
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
      setSelections(next);
    } catch { }
  }, [exactSelections, paletteWithVariations]);

  // Helpful derived colors and filenames
  const accentDarkHex = useMemo(() => demoStepHex(paletteWithVariations, 'accent', 'dark'), [paletteWithVariations]);
  const warningDarkHex = useMemo(() => demoStepHex(paletteWithVariations, 'warning', 'dark'), [paletteWithVariations]);
  const warningLightHex = useMemo(() => demoStepHex(paletteWithVariations, 'warning', 'light'), [paletteWithVariations]);
  const darkHexSuffix = useMemo(() => {
    try { return generateFilenameSuffix(paletteWithVariations as any); } catch { return 'palette'; }
  }, [paletteWithVariations]);




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
      const families: (keyof PaletteWithVariations)[] = ['primary','secondary','tertiary','accent','error','warning','success'];
      let changed = false;
      families.forEach((k) => {
        const entry: any = (paletteWithVariations as any)[k];
        const vars: Array<{ step: 'lighter'|'light'|'dark'|'darker'; hex: string }> = Array.isArray(entry?.variations) ? entry.variations : [];
        const ensureBand = (step: 'lighter'|'light'|'dark'|'darker') => {
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
          const curY = targetHex ? (() => { const {r,g,b} = hexToRgb(targetHex); return luminance(r,g,b); })() : undefined;
          let bestHex: string | undefined;
          let bestD = Number.POSITIVE_INFINITY;
          list.forEach(v => {
            if (!hasAAA(v.hex)) return;
            if (curY == null) { // no current pick: choose mid-ish AAA by minimizing distance to band median Y
              const y0 = (() => { const {r,g,b} = hexToRgb(list[0].hex); return luminance(r,g,b); })();
              const y1 = (() => { const {r,g,b} = hexToRgb(list[list.length - 1].hex); return luminance(r,g,b); })();
              const medianY = (y0 + y1) / 2;
              const y = (() => { const {r,g,b} = hexToRgb(v.hex); return luminance(r,g,b); })();
              const d = Math.abs(y - medianY);
              if (d < bestD) { bestD = d; bestHex = v.hex; }
              return;
            }
            const y = (() => { const {r,g,b} = hexToRgb(v.hex); return luminance(r,g,b); })();
            const d = Math.abs(y - curY);
            if (d < bestD) { bestD = d; bestHex = v.hex; }
          });
          if (!currentIsAAA && bestHex && bestHex !== targetHex) {
            const { r, g, b } = hexToRgb(bestHex);
            const { h, s, l } = rgbToHslNorm(r, g, b);
            const y = luminance(r, g, b);
            const cLight = getContrastRatio({ r, g, b }, hexToRgb(textOnLight));
            const cDark = getContrastRatio({ r, g, b }, hexToRgb(textOnDark));
            const idx = list.findIndex(v => v.hex.toLowerCase() === bestHex.toLowerCase());
            const pickObj: any = { colorKey: k, step, indexDisplayed: Math.max(0, idx), hex: bestHex, hsl: { h, s, l }, y, contrastVsTextOnLight: cLight, contrastVsTextOnDark: cDark, textToneUsed: preferWhite ? 'light' : 'dark' };
            next[k] = { ...(next as any)[k], [step]: pickObj } as any;
            changed = true;
          }
        };
        (['lighter','light','dark','darker'] as const).forEach(ensureBand);
      });
      if (changed) setExactSelections(next);
    } catch {}
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

  // Download .zip export handler (minimal stub)
  const handleExportGzipAll = useCallback(() => {
    try {
      toast.success('Preparing export...');
      // Full ZIP export can be wired here if needed.
    } catch (e) {
      console.error('Export failed:', e);
      toast.error('Export failed');
    }
  }, []);

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
      } as any);
    } catch { }
  }, [palette]);

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
  const handleImportThemeJson = useCallback(async (file: File) => {
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
      const details: any = { colors, warnings };
      if (schema) details.schema = schema;
      if (version != null) details.version = version;
      if (typeof parsed?.title === 'string') details.title = parsed.title;
      setImportDetails(details);

      // Do not show a success toast; details are displayed inline under the explanation.
    } catch (e) {
      console.error('Failed to import theme.json:', e);
      setImportDetails({ error: 'Invalid theme.json file. Please select a valid JSON.' });
    }
  }, [themeName]);

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
        primary: { ...prev.primary, hex: (nextValues as any).primary || prev.primary.hex },
        secondary: { ...prev.secondary, hex: (nextValues as any).secondary || prev.secondary.hex },
        tertiary: { ...prev.tertiary, hex: (nextValues as any).tertiary || prev.tertiary.hex },
        accent: { ...prev.accent, hex: (nextValues as any).accent || prev.accent.hex },
        error: (nextValues as any).error ? { ...prev.error, hex: (nextValues as any).error } : prev.error,
        warning: (nextValues as any).warning ? { ...prev.warning, hex: (nextValues as any).warning } : prev.warning,
        success: (nextValues as any).success ? { ...prev.success, hex: (nextValues as any).success } : prev.success,
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

      const setTriplet = (prefix: 'warning' | 'error' | 'success', baseHex?: string) => {
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

      setTriplet('warning', noticeHex);
      root.style.setProperty('--wp--preset--color--warning', noticeHex || '');
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
                <TabsTrigger value="ai">AI</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
                <TabsTrigger value="palette">Palette</TabsTrigger>
                <TabsTrigger value="adjust">Adjust</TabsTrigger>
                <TabsTrigger value="demo">Demo</TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
                <TabsTrigger value="landing">Landing</TabsTrigger>
              </TabsList>

              {/* Instructions Tab (desktop) */}
              <TabsContent value="instructions" className={styles.tabContent}>
                <div className={styles.instructionsContent}>
                  <h2 className={styles.sectionTitle}>Instructions</h2>
                  <p>Use the <strong>AI</strong> tab (coming soon) or <strong>Manual</strong> tab to set your basic colors.</p>
                  <p>In the <strong>Manual</strong> tab, enter your Theme Name (brief, appears in WordPress tooltip in Palette selection).</p>
                  <p>Upload your child theme's <code>theme.json</code> file (needed so your generated theme variations match the version).</p>
                  <p>In the <strong>Manual</strong> tab, enter hex color numbers, or click on the color swatch for HSL adjustment slider and picker.</p>
                  <p>These will all be adjusted for proper text color contrast.</p>
                  <p>Click the "Save colors and settings" button so your choices are there when you restart.</p>
                  <p>Open the <strong>Palette</strong> tab to review color variations. Click any swatch to jump to its <strong>Adjust</strong> section.</p>
                  <p>In the <strong>Adjust</strong> tab, fine-tune tints and shades (luminance). Your selections are saved locally, since you will likely use the same selection even as you change hues.</p>
                  <p>Use the <strong>Demo</strong> tab to preview components in light/dark schemes.</p>
                  <p>When satisfied, go to <strong>Export</strong> to download your ZIP file with all the <code>theme.json</code> Palette files, with combinations of the Primary, Secondary and Tertiary colors. Also has companion CSS variables and color classes. The file name has the dark color numbers.</p>
                  <p>The Export tab also shows Hex and HSL, convenient for copying. </p>
                  <p>Copy the <code>theme.json</code> files into your child theme's <code>styles</code> folder (create it if there isn't one). They will show as Palettes in your WordPress Site Editor.</p>
                  <p>You can also copy the CSS files to the styles folder, but WordPress won't use them. When you've chosen which Palette you prefer, copy the corresponding CSS to add to your existing <code>style.css</code> file.</p>
                  <img
                    src={AZLogo}
                    alt="AZ WP Website Consulting LLC"
                    style={{ maxWidth: '8em', width: '100%', height: 'auto', display: 'block', margin: 'var(--cf-space-l) 0 var(--cf-space-xs) 0' }}
                  />
                  <p style={{ color: textOnLight, fontSize: 'var(--cf-text-s)', margin: 0 }}>
                    Copyright © 2025 AZ WP Website Consulting LLC.
                  </p>
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
                <div className={styles.previewContent}>
                  <ColorDisplay
                    palette={paletteWithVariations}
                    isLoading={false}
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
                <h2 className={styles.sectionTitle}>Manual Settings for your Palette</h2>
                <Form {...manualForm}>
                  <div className={styles.manualGrid}>
                    {/* Left column: explanatory content and actions */}
                    <div className={styles.manualCol}>
                      {/* Explanation + Import row */}
                      <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', marginBottom: 'var(--spacing-3)', flexWrap: 'wrap' }}>
                        <div>
                          <p className={styles.formHelp} style={{ fontSize: 'var(--cf-text-s)' }}>Import the schema and version from your child theme's theme.json,  to ensure exported files match it.</p>
                          <Button variant="outline" wrap onClick={() => fileInputRef.current?.click()} style={{ marginTop: 'var(--spacing-2)' }}>Import theme.json</Button>
                          {importDetails && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
                              {(importDetails.schema || importDetails.version != null || importDetails.title) && (
                                <p className={styles.formHelp} style={{ fontSize: 'var(--cf-text-s)' }}>
                                  {importDetails.title ? (<>
                                    <strong>Title:</strong> {importDetails.title} {' '}
                                  </>) : null}
                                  {importDetails.schema ? (<>
                                    <strong>Schema:</strong> {importDetails.schema} {' '}
                                  </>) : null}
                                  {importDetails.version != null ? (<>
                                    <strong>Version:</strong> {String(importDetails.version)}
                                  </>) : null}
                                </p>
                              )}
                              {importDetails.warnings && importDetails.warnings.length > 0 && (
                                <ul className={styles.formHelp} style={{ margin: 0, paddingLeft: '1.2em', fontSize: 'var(--cf-text-s)' }}>
                                  {importDetails.warnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                  ))}
                                </ul>
                              )}
                              {importDetails.error && (
                                <p className={styles.formHelp} style={{ color: 'var(--error-text, #b00020)', fontSize: 'var(--cf-text-s)' }}>{importDetails.error}</p>
                              )}
                              {importDetails.colors && importDetails.colors.length > 0 && (
                                <div>
                                  <p className={styles.formHelp} style={{ fontSize: 'var(--cf-text-s)' }}>Detected palette entries (copy/paste if desired):</p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-3)' }}>
                                    {importDetails.colors.map((c) => (
                                      <div key={`${c.slug}:${c.color}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 14, height: 14, borderRadius: 3, background: c.color, border: '1px solid #ccc', display: 'inline-block' }} />
                                        <code style={{ fontSize: 'var(--cf-text-s)' }}>{c.slug}: {c.color}</code>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <hr
                          className={styles.tertiaryDivider}
                          style={{
                            borderTopColor: paletteWithVariations.tertiary.variations.find((v: any) => v.step === 'dark')!.hex,
                          }}
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="application/json,.json"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImportThemeJson(f);
                            e.currentTarget.value = '';
                          }}
                        />
                      </div>

                      {/* Theme Name block */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)', marginBottom: 'var(--spacing-3)', flexWrap: 'wrap' }}>
                        <label className={styles.formLabel} style={{ margin: 0 }}>Theme Name</label>
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
                                } as any);
                              } catch { }
                              // Export current Core Foundation tokens as CSS
                              try { exportCoreFoundationCSSFromCurrent(); } catch { }
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
                            setTextOnDark('#F7F3EE');
                            setTextOnLight('#453521');
                            setPalette(initialPalette);
                            manualForm.setValues({
                              themeName: '',
                              textOnDark: '#F7F3EE',
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
                              } as any);
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
                      {/* Match semantic colors to Primary (desktop Manual tab) */}
                      <div style={{ display: 'block', marginTop: 'var(--cf-space-2xs)', marginBottom: 'var(--cf-space-2xs)' }}>
                        <p>Optional: Adjust the saturation and brightness (luminance) of the Error, Notice, and Success colors, to match Primary-dark (for Error and Success) or Primary-light (for Notice). See the Palette page for the "adjusted for contrast" versions.</p>
                        <Button variant="outline" onClick={handleMatchSemanticsToPrimary} wrap>
                          Match Error/Notice/Success to Primary
                        </Button>
                      </div>
                      <hr
                        className={styles.tertiaryDivider}
                        style={{
                          borderTopColor: demoStepHex(paletteWithVariations, 'tertiary', 'dark'),
                        }}
                      />
                      {/* Color Wheel (non-interactive) */}
                      <div className={styles.wheelRow}>
                        <div className={styles.colorWheel}>
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

                          {/* markers positioned via inline transforms */}
                          {(['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as (ColorType | SemanticColorType)[]).map((key) => {
                            const hex = manualForm.values[key] || (palette as any)[key]?.hex;
                            const rgb = hexToRgb(hex);
                            const { h } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
                            const angle = (360 - h) % 360;
                            return (
                              <span
                                key={`marker-${key}`}
                                className={styles.wheelMarker}
                                title={`${(palette as any)[key]?.name}`}
                                style={{
                                  background: `hsl(${Math.round(h)}, 50%, 50%)`,
                                  transform: `translate(-50%, -50%) rotate(${angle}deg) translate(var(--wheel-radius)) rotate(-${angle}deg)`,
                                }}
                              />
                            );
                          })}

                          {/* pointer-style labels for markers (like degree labels) */}
                          {(['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'] as (ColorType | SemanticColorType)[]).map((key) => {
                            const hex = manualForm.values[key] || (palette as any)[key]?.hex;
                            const rgb = hexToRgb(hex);
                            const { h } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
                            const angle = (360 - h) % 360;
                            const name = (palette as any)[key]?.name || String(key);
                            return (
                              <span
                                key={`marker-label-${key}`}
                                className={styles.wheelMarkerLabel}
                                style={{ transform: `translate(0, -50%) rotate(${angle}deg) translate(var(--marker-label-radius)) rotate(0deg)` }}
                              >
                                {name}
                              </span>
                            );
                          })}
                        </div>
                        {/* Legend grid removed in favor of pointer-style labels */}
                      </div>
                      {/* Save button moved above, next to Theme Name */}
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
                                  return (
                                    <div>
                                      <FormLabel>
                                        Text on Light (near black)
                                        <span className={styles.formMeta}>
                                          HSL({Math.round(h)}, {Math.round(s * 100)}%, {Math.round(l * 100)}%)
                                        </span>
                                      </FormLabel>
                                      <span className={styles.metaLabel}>
                                        Y={Y.toFixed(3)}
                                      </span>
                                      {!ok && (
                                        <div className={styles.contrastHint}>
                                          Consider a darker color for readability (Y ≤ {CLOSE_ENOUGH_TO_BLACK_MAX_LUM}).
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
                                        >Almost black</Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#222222';
                                            manualForm.setValues({ ...manualForm.values, textOnLight: hex });
                                            setTextOnLight(hex);
                                          }}
                                        >Neutral</Button>
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
                                  return (
                                    <div>
                                      <FormLabel>
                                        Text on Dark (near white)
                                        <span className={styles.formMeta}>
                                          HSL({Math.round(h)}, {Math.round(s * 100)}%, {Math.round(l * 100)}%)
                                        </span>
                                        <span className={styles.formMeta}>
                                          Y={Y.toFixed(Y_TARGET_DECIMALS)}
                                        </span>
                                      </FormLabel>
                                      {!ok && (
                                        <div className={styles.contrastHint}>
                                          Consider a lighter color for readability (Y ≥ {CLOSE_ENOUGH_TO_WHITE_MIN_LUM}).
                                        </div>
                                      )}
                                      {/* Suggestions */}
                                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#F9FAFB';
                                            manualForm.setValues({ ...manualForm.values, textOnDark: hex });
                                            setTextOnDark(hex);
                                          }}
                                        >Almost white</Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            const hex = '#f2f2f2';
                                            manualForm.setValues({ ...manualForm.values, textOnDark: hex });
                                            setTextOnDark(hex);
                                          }}
                                        >Off-white</Button>
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
                  onTokensAutoAdjusted={(update) => {
                    // Persist adjusted tokens into form, state, and localStorage
                    const nextVals = { ...manualForm.values } as any;
                    if (update.textOnLight) {
                      setTextOnLight(update.textOnLight);
                      nextVals.textOnLight = update.textOnLight;
                      try { localStorage.setItem('gl_theme_text_on_light_hex', update.textOnLight); } catch {}
                    }
                    if (update.textOnDark) {
                      setTextOnDark(update.textOnDark);
                      nextVals.textOnDark = update.textOnDark;
                      try { localStorage.setItem('gl_theme_text_on_dark_hex', update.textOnDark); } catch {}
                    }
                    manualForm.setValues(nextVals);
                  }}
                  onSelectTintIndex={(colorKey, kind, index) =>
                    setSelections((prev) => ({
                      ...prev,
                      [colorKey]: {
                        ...(prev[colorKey] || {}),
                        ...(kind === 'lighter' ? { lighterIndex: index } : {}),
                        ...(kind === 'light' ? { lightIndex: index } : {}),
                      },
                    }))
                  }
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
                            <ul style={{ margin: 0, paddingLeft: '1.2em', lineHeight: 1.5 }}>
                              <li><strong>Theme Name:</strong> {themeName || 'Theme'}</li>
                              <li><strong>Schema & Version:</strong> {String(effectiveSchema)}, {String(effectiveVersion)}</li>
                              <li><strong>Suggested file name:</strong> {filename}</li>
                              <li><strong>Destination:</strong> You will be prompted to choose a save location (or your browser will save to the default downloads folder).</li>
                            </ul>
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
                                adjusted.forEach((v: any) => pushItem(v.step || v.name || 'step', v.hex));
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
                                adjusted.forEach((v: any) => add(v.step || v.name || 'step', v.hex));
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
