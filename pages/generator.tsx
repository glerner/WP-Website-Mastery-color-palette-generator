import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
import { ThemeVariations } from '../components/ThemeVariations';
import { generateThemeJson } from '../helpers/themeJson';
import { generateCssClasses, generateFilenameSuffix } from '../helpers/cssGenerator';
import { Palette, ColorType, SemanticColorType, PaletteWithVariations } from '../helpers/types';
import { generateShades, hexToRgb, rgbToHslNorm, hslNormToRgb, rgbToHex } from '../helpers/colorUtils';
import { LuminanceTestStrips } from '../components/LuminanceTestStrips';
import { useGeneratePalette } from '../helpers/useGeneratePalette';
import { generateThemeVariations } from '../helpers/generateThemeVariations';
import { generateAnalogousComplementaryPalette } from '../helpers/colorHarmony';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import styles from './generator.module.css';
import { zipSync, strToU8 } from 'fflate';
import { generateSemanticColors } from '../helpers/generateSemanticColors';

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
  primary: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color'),
  secondary: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color'),
  tertiary: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color'),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Invalid hex color'),
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
    Partial<Record<ColorType, { lighterY?: number; lightY?: number; darkerY?: number; darkY?: number }>>
  >({});
  const generatePaletteMutation = useGeneratePalette();

  // Load saved selections once
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gl_palette_luminance_selections');
      if (raw) {
        const parsed = JSON.parse(raw);
        setSelections(parsed);
      }
    } catch {}
  }, []);

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
      primary: palette.primary.hex,
      secondary: palette.secondary.hex,
      tertiary: palette.tertiary.hex,
      accent: palette.accent.hex,
    },
  });

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

  const handleManualColorChange = (colorType: ColorType, hex: string) => {
    const newValues = { ...manualForm.values, [colorType]: hex };
    manualForm.setValues(newValues);

    if (/^#[0-9a-f]{6}$/i.test(hex)) {
      setPalette((prev) => ({
        ...prev,
        [colorType]: { ...prev[colorType], hex },
      }));
    }
  };

  const handleExport = () => {
    const filenameSuffix = generateFilenameSuffix(paletteWithVariations);
    
    // Export theme.json
    const themeJsonString = generateThemeJson(paletteWithVariations);
    const themeBlob = new Blob([themeJsonString], { type: 'application/json' });
    const themeUrl = URL.createObjectURL(themeBlob);
    const themeLink = document.createElement('a');
    themeLink.href = themeUrl;
    themeLink.download = `theme-${filenameSuffix}.json`;
    document.body.appendChild(themeLink);
    themeLink.click();
    document.body.removeChild(themeLink);
    URL.revokeObjectURL(themeUrl);
    
    // Export CSS file
    const cssString = generateCssClasses(paletteWithVariations);
    const cssBlob = new Blob([cssString], { type: 'text/css' });
    const cssUrl = URL.createObjectURL(cssBlob);
    const cssLink = document.createElement('a');
    cssLink.href = cssUrl;
    cssLink.download = `styles-${filenameSuffix}.css`;
    document.body.appendChild(cssLink);
    cssLink.click();
    document.body.removeChild(cssLink);
    URL.revokeObjectURL(cssUrl);
    
    console.log('Exported files:', {
      theme: `theme-${filenameSuffix}.json`,
      css: `styles-${filenameSuffix}.css`,
      colors: paletteWithVariations
    });
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
          targetLighterY: sel.lighterY,
          targetLightY: sel.lightY,
          targetDarkY: sel.darkY,
          targetDarkerY: sel.darkerY,
        }),
      };
    });
    return fullPalette as PaletteWithVariations;
  }, [palette, selections]);

  const themeVariations = useMemo(() => {
    return generateThemeVariations(paletteWithVariations);
  }, [paletteWithVariations]);

  // Build a filename suffix using dark hexes for base colors
  const darkHexSuffix = useMemo(() => {
    const pickDark = (c: any) => (c.variations.find((v: any) => v.step === 'dark')?.hex || c.hex).replace('#','');
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

    // Base (current palette)
    const baseDir = `base/`;
    const baseTheme = generateThemeJson(paletteWithVariations);
    const baseCss = generateCssClasses(paletteWithVariations);
    files[`${baseDir}theme.json`] = strToU8(baseTheme);
    files[`${baseDir}styles.css`] = strToU8(baseCss);

    // Variations
    themeVariations.forEach((tv: any) => {
      const dir = `${safe(tv.name)}/`;
      const themeJson = generateThemeJson(tv.palette);
      const cssText = generateCssClasses(tv.palette);
      files[`${dir}theme.json`] = strToU8(themeJson);
      files[`${dir}styles.css`] = strToU8(cssText);
      // Optional: small metadata file
      const meta = {
        name: tv.name,
        description: tv.description,
      };
      files[`${dir}meta.json`] = strToU8(JSON.stringify(meta, null, 2));
    });

    // Add a README
    const readme = `This archive contains WordPress theme.json and CSS for the base palette and its variations.\n` +
      `- Import theme.json files into your theme or use as Global Styles.\n` +
      `- styles.css includes background and text utility classes with AAA contrast.\n`;
    files['README.txt'] = strToU8(readme);

    // Create ZIP and trigger download
    const zipBytes = zipSync(files, { level: 9 });
    const blob = new Blob([zipBytes], { type: 'application/zip' });
    const filename = `themes-${darkHexSuffix}.zip`;

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
  }, [paletteWithVariations, themeVariations, darkHexSuffix]);

  useEffect(() => {
    const pv = paletteWithVariations as any;
    const variationsOf = (k: string) => (pv?.[k]?.variations ?? []) as { name: string; hex: string }[];
    const byName = (arr: { name: string; hex: string }[]) =>
      Object.fromEntries(arr.map((x) => [x.name.toLowerCase(), x.hex]));
    const pickSemantic = (k: 'warning' | 'error' | 'success') => {
      const map = byName(variationsOf(k));
      if (k === 'warning') return map['light'] ?? map['lighter'] ?? map['dark'] ?? pv?.[k]?.hex;
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
      // warning (chosen variant)
      if (warn) {
        const t = deriveTriplet(warn)!;
        root.style.setProperty('--warning-bg', t.bg);
        root.style.setProperty('--warning-fg', t.fg);
        root.style.setProperty('--warning-border', t.border);
        root.style.setProperty('--wp--preset--color--warning', warn);
      }
      // error (chosen variant)
      if (err) {
        const t = deriveTriplet(err)!;
        root.style.setProperty('--error-bg', t.bg);
        root.style.setProperty('--error-fg', t.fg);
        root.style.setProperty('--error-border', t.border);
        root.style.setProperty('--wp--preset--color--error', err);
      }
      // success (chosen variant)
      if (succ) {
        const t = deriveTriplet(succ)!;
        root.style.setProperty('--success-bg', t.bg);
        root.style.setProperty('--success-fg', t.fg);
        root.style.setProperty('--success-border', t.border);
        root.style.setProperty('--wp--preset--color--success', succ);
      }
    } catch {}
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
        <div className={styles.controlsColumn}>
          <div className={styles.controlsContent}>
            <Tabs defaultValue="ai" className={styles.tabs}>
              <TabsList>
                <TabsTrigger value="ai">AI Generator</TabsTrigger>
                <TabsTrigger value="manual">Manual Input</TabsTrigger>
              </TabsList>
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
              <TabsContent value="manual" className={styles.tabContent}>
                <Form {...manualForm}>
                  <form className={styles.manualForm}>
                    {(Object.keys(palette) as ColorType[]).map((key) => (
                      <FormItem key={key} name={key}>
                        <FormLabel>{palette[key].name}</FormLabel>
                        <FormControl>
                          <ColorInput
                            value={manualForm.values[key]}
                            onChange={(hex) => handleManualColorChange(key, hex)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    ))}
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
            <div className={styles.exportSection}>
              <h3 className={styles.exportTitle}>Export Palette</h3>
              <p className={styles.exportDescription}>
                Download both a WordPress `theme.json` file and a CSS file with 
                contrast-optimized background and text color classes.
              </p>
              <Button
                variant="outline"
                onClick={handleExport}
                className={styles.exportButton}
              >
                Export Files
              </Button>
              <div style={{ marginTop: 'var(--spacing-2)' }}>
                <Button
                  variant="primary"
                  onClick={handleExportGzipAll}
                  className={styles.exportButton}
                >
                  Export .zip (all variations: theme.json + CSS)
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.previewColumn}>
          <div className={styles.previewContent}>
            <div style={{ display: 'flex', gap: 'var(--spacing-2)', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                onClick={() => {
                  try {
                    localStorage.setItem('gl_palette_luminance_selections', JSON.stringify(selections));
                  } catch {}
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
            <ColorDisplay
              palette={paletteWithVariations}
              isLoading={generatePaletteMutation.isPending}
            />
            <div style={{ fontSize: '0.85rem', opacity: 0.8, margin: 'var(--spacing-2) 0' }}>
              You can pick your preferred tints and shades in the luminance strips below.
            </div>
            <ThemeVariations
              variations={themeVariations}
              isLoading={generatePaletteMutation.isPending}
            />
            <LuminanceTestStrips
              palette={paletteWithVariations}
              selections={selections}
              onSelect={(colorKey, kind, y) =>
                setSelections((prev) => ({
                  ...prev,
                  [colorKey]: {
                    ...(prev[colorKey] || {}),
                    ...(kind === 'lighter' ? { lighterY: y } : {}),
                    ...(kind === 'light' ? { lightY: y } : {}),
                    ...(kind === 'darker' ? { darkerY: y } : {}),
                    ...(kind === 'dark' ? { darkY: y } : {}),
                  },
                }))
              }
            />
            <PreviewSection
              palette={paletteWithVariations}
              isLoading={generatePaletteMutation.isPending}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default GeneratorPage;