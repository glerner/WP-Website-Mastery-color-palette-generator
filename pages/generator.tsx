import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
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
import { generateThemeJson } from '../helpers/themeJson';
import { generateCssClasses, generateFilenameSuffix } from '../helpers/cssGenerator';
import { Palette, ColorType, SemanticColorType, PaletteWithVariations } from '../helpers/types';
import { generateShades, hexToRgb, rgbToHslNorm, hslNormToRgb, rgbToHex, solveHslLightnessForY, getContrastRatio } from '../helpers/colorUtils';
import { NEAR_BLACK_RGB, TINT_TARGET_COUNT, LIGHTER_MIN_Y, LIGHTER_MAX_Y, LIGHT_MIN_Y_BASE, LIGHT_MAX_Y_CAP, MIN_DELTA_LUM_TINTS, Y_TARGET_DECIMALS, AAA_MIN, MAX_CONTRAST_TINTS, RECOMMENDED_TINT_Y_GAP } from '../helpers/config';
import { LuminanceTestStrips } from '../components/LuminanceTestStrips';
import { useGeneratePalette } from '../helpers/useGeneratePalette';
import { generateThemeVariations } from '../helpers/generateThemeVariations';
import { generateAnalogousComplementaryPalette } from '../helpers/colorHarmony';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import styles from './generator.module.css';
import { zipSync, strToU8 } from 'fflate';
import { generateSemanticColors } from '../helpers/generateSemanticColors';
import { buildWpVariationJson, validateBaseContrast } from '../helpers/themeJson';

const aiFormSchema = z.object({
  industry: z
    .string()
    .min(2, { message: 'Please specify your industry.' })
    .max(100, { message: 'Industry cannot exceed 100 characters.' }),
  targetAudience: z
    .string()
    .min(5, { message: 'Please describe your target audience.' })
    .max(200, { message: 'Target audience cannot exceed 200 characters.' }),
  brandPersonality: z
    .string()
    .min(5, { message: 'Please describe your brand personality.' })
    .max(200, { message: 'Brand personality cannot exceed 200 characters.' }),
  avoidColors: z
    .string()
    .max(100, { message: 'Avoid colors cannot exceed 100 characters.' })
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
  warning: { name: 'Warning', hex: '#d69e2e' },
  success: { name: 'Success', hex: '#38a169' },
};

const GeneratorPage = () => {
  const [palette, setPalette] = useState<Palette>(initialPalette);
  const [selections, setSelections] = useState<
    Partial<Record<ColorType, { lighterIndex?: number; lightIndex?: number; darkerY?: number; darkY?: number }>>
  >({});
  const generatePaletteMutation = useGeneratePalette();
  const [activeTab, setActiveTab] = useState<'ai' | 'manual' | 'adjust' | 'preview' | 'export'>('ai');
  const [themeName, setThemeName] = useState<string>('');
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
  // Default when nothing has been saved yet; a hydration effect below will
  // load persisted values from localStorage and overwrite these shortly.
  // Near-white for text on dark backgrounds (temporary default).
  const [textOnDark, setTextOnDark] = useState<string>('#D6D2CE');
  // Near-black for text on light backgrounds (temporary default).
  const [textOnLight, setTextOnLight] = useState<string>('#1A1514');

  // Load saved selections once, with migration from Y-based tints to index-based
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gl_palette_luminance_selections');
      if (raw) {
        const parsed = JSON.parse(raw);
        // If the saved object contains lighterY/lightY, preserve as-is for shades and drop tints (they'll init per component)
        const migrated: Partial<Record<ColorType, { lighterIndex?: number; lightIndex?: number; darkerY?: number; darkY?: number }>> = {};
        (['primary', 'secondary', 'tertiary', 'accent'] as ColorType[]).forEach((k) => {
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
        } catch {}
      }

      // Build warnings for missing schema or missing version; do NOT warn on non-numeric version like "trunk"
      const warnings: string[] = [];
      if (!schema) warnings.push('No $schema found; export will default to https://schemas.wp.org/trunk/theme.json.');
      if (version == null) {
        warnings.push('No version found; export will default to 3.');
      }

      setImportDetails({ schema, version, colors, title: parsed?.title, warnings });

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
      for (let i = 0; i < count; i++) picks.push(values[Math.round(i * stepIdx)]);
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
      const nextValues = { ...manualForm.values } as Record<string, string>;
      Object.keys(nextValues).forEach((k) => {
        const v = (saved as any)[k];
        if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) nextValues[k] = v;
      });
      manualForm.setValues(nextValues);
      setPalette((prev) => ({
        ...prev,
        primary: { ...prev.primary, hex: nextValues.primary },
        secondary: { ...prev.secondary, hex: nextValues.secondary },
        tertiary: { ...prev.tertiary, hex: nextValues.tertiary },
        accent: { ...prev.accent, hex: nextValues.accent },
        error: nextValues.error ? { ...prev.error, hex: nextValues.error } : prev.error,
        warning: nextValues.warning ? { ...prev.warning, hex: nextValues.warning } : prev.warning,
        success: nextValues.success ? { ...prev.success, hex: nextValues.success } : prev.success,
      }));
      if ((nextValues as any).textOnDark) setTextOnDark((nextValues as any).textOnDark);
      if ((nextValues as any).textOnLight) setTextOnLight((nextValues as any).textOnLight);
      const tn = localStorage.getItem('gl_theme_name');
      const manualName = typeof nextValues.themeName === 'string' ? nextValues.themeName : '';
      const chosenName = manualName?.trim() ? manualName : (tn || '');
      if (chosenName) setThemeName(chosenName);
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
        warning: { name: 'Warning', hex: '#d69e2e' },
        success: { name: 'Success', hex: '#38a169' },
      };

      setPalette(newPalette);
      manualForm.setValues({
        primary: newPalette.primary.hex,
        secondary: newPalette.secondary.hex,
        tertiary: newPalette.tertiary.hex,
        accent: newPalette.accent.hex,
      });
    } catch (error) {
      console.error('AI generation failed, using fallback palette:', error);

      // Generate fallback palette using color harmony
      const fallbackPalette = generateAnalogousComplementaryPalette();
      console.log('Generated fallback palette:', fallbackPalette);

      setPalette(fallbackPalette);
      manualForm.setValues({
        primary: fallbackPalette.primary.hex,
        secondary: fallbackPalette.secondary.hex,
        tertiary: fallbackPalette.tertiary.hex,
        accent: fallbackPalette.accent.hex,
      });

      // Show fallback message to user
      toast.warning("AI generation failed, but we've created a harmonious color palette for you! You can customize it using the Manual Input tab.");
    }
  };

  const handleManualColorChange = (colorType: ColorType | SemanticColorType, hex: string) => {
    const newValues = { ...manualForm.values, [colorType]: hex };
    manualForm.setValues(newValues);

    if (/^#[0-9a-f]{6}$/i.test(hex)) {
      setPalette((prev) => ({
        ...prev,
        [colorType]: { ...prev[colorType], hex },
      }));
    }
  };


  const paletteWithVariations = useMemo(() => {
    // Build semantic colors dynamically from current palette
    const baseWithSemantic = generateSemanticColors(palette);
    const fullPalette: Record<string, any> = {};
    (Object.keys(baseWithSemantic) as (ColorType | SemanticColorType)[]).forEach((key) => {
      const color = baseWithSemantic[key as keyof Palette];
      const sel = selections[key as ColorType] || {};
      fullPalette[key] = {
        ...color,
        variations: generateShades(color.hex, color.name, {
          targetLighterY: resolveTintYFromIndex(color.hex, 'lighter', sel.lighterIndex),
          targetLightY: resolveTintYFromIndex(color.hex, 'light', sel.lightIndex),
          targetDarkY: sel.darkY,
          targetDarkerY: sel.darkerY,
        }),
      };
    });
    return fullPalette as PaletteWithVariations;
  }, [palette, selections, resolveTintYFromIndex]);

  const themeVariations = useMemo(() => {
    return generateThemeVariations(paletteWithVariations);
  }, [paletteWithVariations]);

  // Build a filename suffix using dark hexes for base colors
  const darkHexSuffix = useMemo(() => {
    const pickDark = (c: any) => (c.variations.find((v: any) => v.step === 'dark')?.hex || c.hex).replace('#', '');
    const p = pickDark(paletteWithVariations.primary);
    const s = pickDark(paletteWithVariations.secondary);
    const t = pickDark(paletteWithVariations.tertiary);
    const a = pickDark(paletteWithVariations.accent);
    return `${p}-${s}-${t}-${a}`;
  }, [paletteWithVariations]);

  const handleExportGzipAll = useCallback(async () => {
    // Build a ZIP archive containing theme.json and CSS for base + each variation
    const files: Record<string, Uint8Array> = {};

    const safe = (name: string) => name.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
    const prefix = themeName ? safe(themeName) : 'themes';

    // Helper to map variation name to suffix
    const suffixFor = (name: string) => {
      const m = name.match(/Variant\s+([A-E])/i);
      if (m) return `-${m[1].toLowerCase()}`;
      // Original has no suffix
      return '';
    };

    // Build effective themeConfig with textOnDark/textOnLight from Manual tab and validate
    const incomingPalette: Array<any> = themeConfig?.settings?.color?.palette || [];
    const filtered = Array.isArray(incomingPalette) ? incomingPalette.filter((e) => e?.slug !== 'base' && e?.slug !== 'contrast') : [];
    const { baseHex: vBase, contrastHex: vContrast, swapped, issues } = validateBaseContrast(textOnDark, textOnLight);
    if (swapped) toast.warning('Base and Contrast looked reversed; using a light theme layout (swapped for export).');
    issues.forEach((msg) => toast.warning(msg));
    const mergedThemeConfig = {
      ...(themeConfig || {}),
      settings: {
        ...(themeConfig?.settings || {}),
        color: {
          ...(themeConfig?.settings?.color || {}),
          palette: [
            ...filtered,
            { slug: 'base', color: vBase, name: 'Base' },
            { slug: 'contrast', color: vContrast, name: 'Contrast' },
          ],
        },
      },
    };

    // Base (current palette) as flat files (WordPress style variation JSON v2)
    const baseTitle = themeName || 'Theme';
    const baseTheme = buildWpVariationJson(paletteWithVariations, baseTitle, mergedThemeConfig);
    const baseCss = generateCssClasses(paletteWithVariations);
    files[`${prefix}.json`] = strToU8(baseTheme);
    files[`${prefix}.css`] = strToU8(baseCss);

    // Variations as flat files
    themeVariations.forEach((tv: any) => {
      const sfx = suffixFor(tv.name);
      // Skip creating duplicate of base when sfx === '' and tv.name === 'Original'?
      // We'll only add variations where sfx is non-empty to avoid duplicates.
      if (!sfx) return;
      const varTitle = `${baseTitle} (${tv.description})`;
      const themeJson = buildWpVariationJson(tv.palette, varTitle, mergedThemeConfig);
      const cssText = generateCssClasses(tv.palette);
      files[`${prefix}${sfx}.json`] = strToU8(themeJson);
      files[`${prefix}${sfx}.css`] = strToU8(cssText);
    });

    // Add a README
    const readme = `This archive contains WordPress theme.json and CSS for the base palette and its variations.\n` +
      `- Import theme.json files into your theme or use as Global Styles.\n` +
      `- styles.css includes background and text utility classes with AAA contrast.\n`;
    files['README.txt'] = strToU8(readme);

    // Create ZIP and trigger download
    const zipBytes = zipSync(files, { level: 9 });
    // Use a sliced ArrayBuffer to satisfy TS BlobPart typing and avoid including extra bytes
    const ab = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer;
    const blob = new Blob([ab], { type: 'application/zip' });
    const filename = `${prefix}-${darkHexSuffix}.zip`;

    // Prefer File System Access API when available
    // @ts-ignore
    if (window.showSaveFilePicker) {
      try {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        console.warn('SaveFilePicker failed, falling back to download:', e);
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [paletteWithVariations, themeVariations, darkHexSuffix, themeConfig, textOnDark, textOnLight]);

  useEffect(() => {
    const pv = paletteWithVariations as any;
    const variationsOf = (k: string) => (pv?.[k]?.variations ?? []) as { name: string; hex: string }[];
    const byName = (arr: { name: string; hex: string }[]) =>
      Object.fromEntries(arr.map((x) => [x.name.toLowerCase(), x.hex]));
    const pickSemantic = (k: 'warning' | 'error' | 'success') => {
      const map = byName(variationsOf(k));
      // Always prefer the dark variant; fall back to darker, then light, then base hex
      return map['dark'] ?? map['darker'] ?? map['light'] ?? pv?.[k]?.hex;
    };

    const warn = pickSemantic('warning');
    const err = pickSemantic('error');
    const succ = pickSemantic('success');
    if (!warn && !err && !succ) return;
    try {
      const deriveTriplet = (hex?: string) => {
        if (!hex) return null;
        const { r, g, b } = hexToRgb(hex);
        const { h, s, l } = rgbToHslNorm(r, g, b);
        const bgRgb = hslNormToRgb(h, Math.max(0.25, s * 0.35), Math.min(0.95, Math.max(0.85, l + 0.35)));
        const fgRgb = hslNormToRgb(h, Math.max(0.45, s * 0.8), Math.max(0.25, Math.min(0.4, l * 0.6)));
        const borderRgb = hslNormToRgb(h, Math.max(0.35, s * 0.6), Math.min(0.85, Math.max(0.6, l + 0.2)));
        return {
          bg: rgbToHex(bgRgb.r, bgRgb.g, bgRgb.b),
          fg: rgbToHex(fgRgb.r, fgRgb.g, fgRgb.b),
          border: rgbToHex(borderRgb.r, borderRgb.g, borderRgb.b),
        };
      };

      const root = document.documentElement;
      // warning (chosen dark variant)
      if (warn) {
        const t = deriveTriplet(warn)!;
        root.style.setProperty('--warning-bg', t.bg);
        root.style.setProperty('--warning-fg', t.fg);
        root.style.setProperty('--warning-border', t.border);
        root.style.setProperty('--wp--preset--color--warning', warn);
      }
      // error (chosen dark variant)
      if (err) {
        const t = deriveTriplet(err)!;
        root.style.setProperty('--error-bg', t.bg);
        root.style.setProperty('--error-fg', t.fg);
        root.style.setProperty('--error-border', t.border);
        root.style.setProperty('--wp--preset--color--error', err);
      }
      // success (chosen dark variant)
      if (succ) {
        const t = deriveTriplet(succ)!;
        root.style.setProperty('--success-bg', t.bg);
        root.style.setProperty('--success-fg', t.fg);
        root.style.setProperty('--success-border', t.border);
        root.style.setProperty('--wp--preset--color--success', succ);
      }
    } catch { }
  }, [paletteWithVariations]);

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
        {/* Mobile: 4-tab layout */}
        <div className={styles.mobileLayout}>
          <div className={styles.mobileTabs}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className={styles.tabs}>
              <TabsList className={styles.mobileTabsHeader}>
                <TabsTrigger value="ai">AI</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
                <TabsTrigger value="adjust">Adjust</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
              </TabsList>

              {/* AI Tab */}
              <TabsContent value="ai" className={styles.mobileTabPanel}>
                <Form {...aiForm}>
                  <form onSubmit={aiForm.handleSubmit(handleAiSubmit)} className={styles.aiForm}>
                    <FormItem name="industry">
                      <FormLabel>Industry</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Technology, Healthcare, Finance"
                          value={aiForm.values.industry}
                          onChange={(e) =>
                            aiForm.setValues({ ...aiForm.values, industry: e.target.value })
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        What industry does your business operate in?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="targetAudience">
                      <FormLabel>Target Audience</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Young professionals aged 25-40 who value convenience and trust"
                          rows={3}
                          value={aiForm.values.targetAudience}
                          onChange={(e) =>
                            aiForm.setValues({ ...aiForm.values, targetAudience: e.target.value })
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Who are your primary customers or users?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="brandPersonality">
                      <FormLabel>Brand Personality</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Modern, trustworthy, innovative, approachable"
                          rows={3}
                          value={aiForm.values.brandPersonality}
                          onChange={(e) =>
                            aiForm.setValues({ ...aiForm.values, brandPersonality: e.target.value })
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        How would you describe your brand's personality and values?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="avoidColors">
                      <FormLabel>Colors to Avoid (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Red, bright yellow"
                          value={aiForm.values.avoidColors}
                          onChange={(e) =>
                            aiForm.setValues({ ...aiForm.values, avoidColors: e.target.value })
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Any colors you want to avoid for your brand?
                      </FormDescription>
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
              {/* Manual Tab */}
              <TabsContent value="manual" className={styles.mobileTabPanel}>
                <Form {...manualForm}>
                  {/* Explanation + Import row */}
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
                    <div style={{ flex: 1 }}>
                      <p className={styles.formHelp} style={{ fontSize: 'var(--cf-text-s)' }}>Import only the schema and version so exported files match your base theme.json. (Typography, gradients, and duotone are not imported into palette presets.)</p>
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
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Import theme.json</Button>
                  </div>

                  {/* Details appear inline under the explanation (left column) */}

                  {/* Theme Name block */}
                  <div style={{ display: 'block', marginBottom: 'var(--spacing-3)' }}>
                    <label className={styles.formLabel}>Theme Name</label>
                    <Input
                      placeholder="e.g., Business Calm"
                      value={manualForm.values.themeName}
                      onChange={(e) => {
                        manualForm.setValues({ ...manualForm.values, themeName: e.target.value });
                        setThemeName(e.target.value);
                      }}
                    />
                  </div>

                  {/* Save colors block */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-3)' }}>
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
                          toast.success('Theme name and colors saved');
                        } catch { }
                      }}
                    >
                      Save colors
                    </Button>
                  </div>
                  <form className={styles.manualForm}>
                    <FormItem name="textOnDark">
                      <FormLabel>Text on Dark (near white)</FormLabel>
                      <FormControl>
                        <ColorInput
                          value={manualForm.values.textOnDark}
                          onChange={(hex) => {
                            manualForm.setValues({ ...manualForm.values, textOnDark: hex });
                            setTextOnDark(hex);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    <FormItem name="textOnLight">
                      <FormLabel>Text on Light (near black)</FormLabel>
                      <FormControl>
                        <ColorInput
                          value={manualForm.values.textOnLight}
                          onChange={(hex) => {
                            manualForm.setValues({ ...manualForm.values, textOnLight: hex });
                            setTextOnLight(hex);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    {(Object.keys(palette) as (ColorType | SemanticColorType)[]).map((key) => (
                      <FormItem key={key} name={key}>
                        <FormLabel>{palette[key].name}</FormLabel>
                        <FormControl>
                          <ColorInput
                            value={manualForm.values[key]}
                            onChange={(hex) => handleManualColorChange(key as ColorType | SemanticColorType, hex)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    ))}
                  </form>
                </Form>
              </TabsContent>
              {/* Adjustments Tab */}
              <TabsContent value="adjust" className={styles.mobileTabPanel}>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginBottom: 'var(--spacing-3)' }}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        localStorage.setItem('gl_palette_luminance_selections', JSON.stringify(selections));
                      } catch { }
                    }}
                  >
                    Save selections
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setSelections({})}
                  >
                    Clear selections
                  </Button>
                </div>
                <LuminanceTestStrips
                  palette={paletteWithVariations}
                  selections={selections}
                  onSelectTintIndex={(colorKey, kind, index) => {
                    setSelections((prev) => {
                      const next = {
                        ...prev,
                        [colorKey]: {
                          ...prev[colorKey],
                          [`${kind}Index`]: index,
                        },
                      } as typeof prev;
                      try { localStorage.setItem('gl_palette_luminance_selections', JSON.stringify(next)); } catch { }
                      return next;
                    });
                  }}
                  onSelectShadeY={(colorKey, kind, y) => {
                    setSelections((prev) => {
                      const next = {
                        ...prev,
                        [colorKey]: {
                          ...prev[colorKey],
                          [`${kind}Y`]: y,
                        },
                      } as typeof prev;
                      try { localStorage.setItem('gl_palette_luminance_selections', JSON.stringify(next)); } catch { }
                      return next;
                    });
                  }}
                />
              </TabsContent>
              {/* Preview Tab */}
              <TabsContent value="preview" className={styles.mobileTabPanel}>
                <div className={styles.previewContent}>
                  <ColorDisplay
                    palette={paletteWithVariations}
                    isLoading={generatePaletteMutation.isPending}
                    onColorClick={(key) => {
                      setActiveTab('adjust');
                      // allow tab content to mount, then scroll
                      setTimeout(() => {
                        const el = document.getElementById(`luminance-${key}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 0);
                    }}
                  />
                  {/* Example Components: move directly after Color Palette */}
                  <PreviewSection
                    palette={paletteWithVariations}
                    isLoading={generatePaletteMutation.isPending}
                  />
                  {/* Theme Variations removed */}
                </div>
              </TabsContent>
              {/* Export Tab */}
              <TabsContent value="export" className={styles.mobileTabPanel}>
                <div className={styles.exportSection}>
                  <h3 className={styles.exportTitle}>Export</h3>
                  <p className={styles.exportDescription}>
                    Download a ZIP containing the base palette and all theme variations. Each folder includes a WordPress theme.json and a CSS file with contrast-optimized utilities.
                  </p>
                  <div style={{ marginTop: 'var(--spacing-2)' }}>
                    <Button
                      variant="primary"
                      onClick={handleExportGzipAll}
                      className={styles.exportButton}
                    >
                      Download .zip file
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
        {/* Desktop: 2-column layout */}
        <div className={styles.desktopLayout}>
          <div className={styles.previewColumn}>
            <div className={styles.previewContent}>
              <ColorDisplay
                palette={paletteWithVariations}
                isLoading={generatePaletteMutation.isPending}
                onColorClick={(key) => {
                  setActiveTab('adjust');
                  setTimeout(() => {
                    const el = document.getElementById(`luminance-${key}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 0);
                }}
              />
              {/* Example Components: move directly after Color Palette */}
              <PreviewSection
                palette={paletteWithVariations}
                isLoading={generatePaletteMutation.isPending}
              />
              {/* Luminance controls moved to Adjust tab in desktop */}
            </div>
          </div>
          <div className={styles.tabsColumn}>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className={styles.tabs}>
              <TabsList className={styles.tabsHeader}>
                <TabsTrigger value="ai">AI</TabsTrigger>
                <TabsTrigger value="manual">Manual</TabsTrigger>
                <TabsTrigger value="adjust">Adjust</TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
              </TabsList>

              {/* AI Tab */}
              <TabsContent value="ai" className={styles.tabContent}>
                <Form {...aiForm}>
                  <form onSubmit={aiForm.handleSubmit(handleAiSubmit)} className={styles.aiForm}>
                    <FormItem name="industry">
                      <FormLabel>Industry</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Technology, Healthcare, Finance"
                          value={aiForm.values.industry}
                          onChange={(e) =>
                            aiForm.setValues({ ...aiForm.values, industry: e.target.value })
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        What industry does your business operate in?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="targetAudience">
                      <FormLabel>Target Audience</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Young professionals aged 25-40 who value convenience and trust"
                          rows={3}
                          value={aiForm.values.targetAudience}
                          onChange={(e) =>
                            aiForm.setValues({ ...aiForm.values, targetAudience: e.target.value })
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Who are your primary customers or users?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="brandPersonality">
                      <FormLabel>Brand Personality</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Modern, trustworthy, innovative, approachable"
                          rows={3}
                          value={aiForm.values.brandPersonality}
                          onChange={(e) =>
                            aiForm.setValues({ ...aiForm.values, brandPersonality: e.target.value })
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        How would you describe your brand's personality and values?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>

                    <FormItem name="avoidColors">
                      <FormLabel>Colors to Avoid (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Red, bright yellow"
                          value={aiForm.values.avoidColors}
                          onChange={(e) =>
                            aiForm.setValues({ ...aiForm.values, avoidColors: e.target.value })
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        Any colors you want to avoid for your brand?
                      </FormDescription>
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
              {/* Manual Tab */}
              <TabsContent value="manual" className={styles.tabContent}>
                <Form {...manualForm}>
                  {/* Explanation + Import row */}
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center', marginBottom: 'var(--spacing-3)' }}>
                    <div style={{ flex: 1 }}>
                      <p className={styles.formHelp} style={{ fontSize: 'var(--cf-text-s)' }}>Import from existing theme.json the schema/version to ensure exported files match your base theme.</p>
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
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Import theme.json</Button>
                  </div>

                  {/* Theme Name block */}
                  <div style={{ display: 'block', marginBottom: 'var(--spacing-3)' }}>
                    <label className={styles.formLabel}>Theme Name</label>
                    <Input
                      placeholder="e.g., Business Calm"
                      value={manualForm.values.themeName}
                      onChange={(e) => {
                        manualForm.setValues({ ...manualForm.values, themeName: e.target.value });
                        setThemeName(e.target.value);
                      }}
                    />
                  </div>

                  {/* Save colors block */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--spacing-3)' }}>
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
                          toast.success('Theme name and colors saved');
                        } catch { }
                      }}
                    >
                      Save colors
                    </Button>
                  </div>
                  <form className={styles.manualForm}>
                    <FormItem name="textOnDark">
                      <FormLabel>Text on Dark (near white)</FormLabel>
                      <FormControl>
                        <ColorInput
                          value={manualForm.values.textOnDark}
                          onChange={(hex) => {
                            manualForm.setValues({ ...manualForm.values, textOnDark: hex });
                            setTextOnDark(hex);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    <FormItem name="textOnLight">
                      <FormLabel>Text on Light (near black)</FormLabel>
                      <FormControl>
                        <ColorInput
                          value={manualForm.values.textOnLight}
                          onChange={(hex) => {
                            manualForm.setValues({ ...manualForm.values, textOnLight: hex });
                            setTextOnLight(hex);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                    {(Object.keys(palette) as (ColorType | SemanticColorType)[]).map((key) => (
                      <FormItem key={key} name={key}>
                        <FormLabel>{palette[key].name}</FormLabel>
                        <FormControl>
                          <ColorInput
                            value={manualForm.values[key]}
                            onChange={(hex) => handleManualColorChange(key as ColorType | SemanticColorType, hex)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    ))}
                  </form>
                </Form>
              </TabsContent>
              {/* Adjustments Tab */}
              <TabsContent value="adjust" className={styles.tabContent}>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end', marginBottom: 'var(--spacing-3)' }}>
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        localStorage.setItem('gl_palette_luminance_selections', JSON.stringify(selections));
                      } catch { }
                    }}
                  >
                    Save selections
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setSelections({})}
                  >
                    Clear selections
                  </Button>
                </div>
                <LuminanceTestStrips
                  palette={paletteWithVariations}
                  selections={selections}
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
                />
              </TabsContent>
              {/* Export Tab */}
              <TabsContent value="export" className={styles.tabContent}>
                <div className={styles.exportSection}>
                  <h3 className={styles.exportTitle}>Export</h3>
                  <p className={styles.exportDescription}>
                    Download a ZIP containing the base palette and all theme variations. Each folder includes a WordPress theme.json and a CSS file with contrast-optimized utilities.
                  </p>
                  <div style={{ marginTop: 'var(--spacing-2)' }}>
                    <Button
                      variant="primary"
                      onClick={handleExportGzipAll}
                      className={styles.exportButton}
                    >
                      Download .zip file
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
}

export default GeneratorPage;
