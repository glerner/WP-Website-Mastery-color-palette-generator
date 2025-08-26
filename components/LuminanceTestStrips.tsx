import * as React from 'react';
import styles from './LuminanceTestStrips.module.css';
import { PaletteWithVariations, ColorType } from '../helpers/types';
import { hexToRgb, rgbToHex, rgbToHslNorm, solveHslLightnessForY, luminance, getContrastRatio } from '../helpers/colorUtils';
import { NEAR_WHITE_RGB, NEAR_BLACK_RGB, TINT_TARGET_COUNT, SHADE_TARGET_COUNT, LIGHTER_MIN_Y, LIGHTER_MAX_Y, LIGHT_MIN_Y_BASE, LIGHT_MAX_Y_CAP, DARKER_MIN_Y, DARKER_MAX_Y, DARK_OVERLAP_MIN_Y, DARK_MAX_Y, Y_TARGET_DECIMALS, Y_DISPLAY_DECIMALS, RECOMMENDED_TINT_Y_GAP, RECOMMENDED_SHADE_Y_GAP, HARD_MIN_SHADE_Y_GAP, TARGET_LUM_LIGHTER, TARGET_LUM_LIGHT, TARGET_LUM_DARK, TARGET_LUM_DARKER, MIN_DELTA_LUM_TINTS, MIN_DELTA_LUM_TINTS_FROM_WHITE, MIN_DELTA_LUM_SHADES, AAA_MIN, AA_SMALL_MIN, MAX_CONTRAST_TINTS, MAX_CONTRAST_SHADES } from '../helpers/config';

function hslStringFromRgb(rgb: { r: number; g: number; b: number }, oneDecimal = true): string {
  const { h, s, l } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
  const H = oneDecimal ? h.toFixed(1) : Math.round(h).toString();
  const S = oneDecimal ? (s * 100).toFixed(1) : Math.round(s * 100).toString();
  const L = oneDecimal ? (l * 100).toFixed(1) : Math.round(l * 100).toString();
  return `hsl(${H}, ${S}%, ${L}%)`;
}

function buildTargets(count = 10, minY = 0.60, maxY = 0.98): number[] {
  const arr: number[] = [];
  const step = (maxY - minY) / (count - 1);
  for (let i = 0; i < count; i++) arr.push(parseFloat((minY + i * step).toFixed(3)));
  return arr;
}

// Shared content renderer so all pickers display identically
function renderPickerSwatchContent(params: {
  hex: string;
  hsl: string;
  y: number;
  level: 'AAA' | 'AA' | 'FAIL';
  contrast: number;
  textColor: '#000' | '#fff';
}) {
  const { hex, hsl, y, level, contrast, textColor } = params;
  return (
    <>
      <div className={styles.swatchColor} style={{ backgroundColor: hex, color: textColor }}>
        <div className={styles.metaStack}>
          <span className={styles.metaFixed}>{level} {contrast.toFixed(2)}</span>
          <span className={styles.metaFixed}>Y={y.toFixed(Y_DISPLAY_DECIMALS)}</span>
        </div>
        <div className={styles.metaLine}>{hsl}</div>
      </div>
    </>
  );
}

function findClosestIndex(values: number[], target: number) {
  let idx = 0; let best = Infinity;
  values.forEach((v, i) => {
    const d = Math.abs(v - target);
    if (d < best) { best = d; idx = i; }
  });
  return idx;
}

type RowProps = {
  name: string;
  baseHex: string;
  colorKey: ColorType;
  selectedLighterIndex?: number;
  selectedLightIndex?: number;
  onSelect: (colorKey: ColorType, kind: 'lighter' | 'light', index: number) => void;
};

function Row({ name, baseHex, colorKey, selectedLighterIndex, selectedLightIndex, onSelect }: RowProps) {
  const baseRgb = hexToRgb(baseHex);
  const filterForBlackTextAAA = React.useCallback((ys: number[]) => {
    return ys
      .map((y) => ({ y, rgb: solveHslLightnessForY(baseRgb, y) }))
      .map(({ y, rgb }) => ({ y, rgb, ratio: getContrastRatio(rgb, NEAR_BLACK_RGB) }))
      .filter(({ ratio }) => ratio >= AAA_MIN && ratio <= MAX_CONTRAST_TINTS)
      .map(({ y }) => y);
  }, [baseRgb]);

  const lighterTargets = React.useMemo(() => {
    const raw = buildTargets(TINT_TARGET_COUNT, LIGHTER_MIN_Y, LIGHTER_MAX_Y);
    return filterForBlackTextAAA(raw);
  }, [filterForBlackTextAAA]);

  // Build the full AAA-valid range for "light" with a fine step, then sample up to TINT_TARGET_COUNT evenly
  let lightTargets = React.useMemo(() => {
    const minY = Math.max(LIGHT_MIN_Y_BASE, 0);
    const maxY = Math.min(LIGHT_MAX_Y_CAP, LIGHTER_MAX_Y - MIN_DELTA_LUM_TINTS);
    // Generate a fine-grained range, then filter to AAA and sample evenly
    const step = 0.005; // fine step to discover full AAA band
    const makeRange = (start: number, end: number, s: number) => {
      const out: number[] = [];
      for (let y = start; y <= end + 1e-9; y += s) out.push(parseFloat(y.toFixed(Y_TARGET_DECIMALS)));
      return out;
    };
    const sampleEvenly = (values: number[], count: number) => {
      if (values.length <= count) return values;
      const picks: number[] = [];
      const stepIdx = (values.length - 1) / (count - 1);
      for (let i = 0; i < count; i++) {
        const idx = Math.round(i * stepIdx);
        picks.push(values[idx]);
      }
      return Array.from(new Set(picks));
    };
    const raw = makeRange(minY, maxY, step);
    const aaa = filterForBlackTextAAA(raw);
    return sampleEvenly(aaa, TINT_TARGET_COUNT);
  }, [filterForBlackTextAAA]);

  // Enforce mutual matchability for tints: only show lighter that can match some light, and light that can match some lighter
  const { lighterTargetsFiltered, lightTargetsFiltered } = React.useMemo(() => {
    const canMatchLight = (LL: number, L: number) => (LL - L) >= RECOMMENDED_TINT_Y_GAP;
    const step1Light = lightTargets.filter(L => lighterTargets.some(LL => canMatchLight(LL, L)));
    const step1Lighter = lighterTargets.filter(LL => step1Light.some(L => canMatchLight(LL, L)));
    // Recompute lights against the trimmed lighter list to remove too-light lights
    const step2Light = step1Light.filter(L => step1Lighter.some(LL => canMatchLight(LL, L)));
    return { lighterTargetsFiltered: step1Lighter, lightTargetsFiltered: step2Light };
  }, [lighterTargets, lightTargets]);
  const lighterIndex = React.useMemo(() => {
    if (!lighterTargetsFiltered.length) return 0;
    if (selectedLighterIndex != null && selectedLighterIndex >= 0 && selectedLighterIndex < lighterTargetsFiltered.length) return selectedLighterIndex;
    return Math.floor(lighterTargetsFiltered.length / 2);
  }, [lighterTargetsFiltered, selectedLighterIndex]);
  const lightIndex = React.useMemo(() => {
    if (!lightTargetsFiltered.length) return 0;
    if (selectedLightIndex != null && selectedLightIndex >= 0 && selectedLightIndex < lightTargetsFiltered.length) return selectedLightIndex;
    // pick last by default; will be adjusted below to meet gap when possible
    return Math.max(0, lightTargetsFiltered.length - 1);
  }, [lightTargetsFiltered, selectedLightIndex]);

  const lighterYSelected = lighterTargetsFiltered[lighterIndex] ?? TARGET_LUM_LIGHTER;
  const lightYSelected = lightTargetsFiltered[lightIndex] ?? TARGET_LUM_LIGHT;

  const lighterRgb = React.useMemo(() => solveHslLightnessForY(baseRgb, lighterYSelected), [baseRgb, lighterYSelected]);
  const lighterHex = React.useMemo(() => rgbToHex(lighterRgb.r, lighterRgb.g, lighterRgb.b), [lighterRgb]);
  const lighterY = React.useMemo(() => luminance(lighterRgb.r, lighterRgb.g, lighterRgb.b), [lighterRgb]);
  const lighterHsl = React.useMemo(() => hslStringFromRgb(lighterRgb, true), [lighterRgb]);
  const EPS = 1e-6;
  const lightGap = (lighterYSelected != null && lightYSelected != null)
    ? (lighterYSelected - lightYSelected)
    : Number.POSITIVE_INFINITY;
  const tooClose = Number.isFinite(lightGap) && (lightGap + EPS) < RECOMMENDED_TINT_Y_GAP;

  // Initialize defaults from picker lists: middle lighter, then a light that respects recommended gap when possible
  React.useEffect(() => {
    if (!lighterTargetsFiltered.length || !lightTargetsFiltered.length) return;
    // Initialize lighter index to middle if unset
    if (selectedLighterIndex == null) {
      const mid = Math.floor(lighterTargetsFiltered.length / 2);
      onSelect(colorKey, 'lighter', mid);
    }
    // Initialize light index to satisfy gap relative to lighter when possible
    if (selectedLightIndex == null) {
      const baseY = lighterTargetsFiltered[selectedLighterIndex ?? Math.floor(lighterTargetsFiltered.length / 2)];
      if (baseY != null) {
        const idx = lightTargetsFiltered.findIndex(L => (baseY - L) >= RECOMMENDED_TINT_Y_GAP);
        const fallback = Math.max(0, lightTargetsFiltered.length - 1);
        onSelect(colorKey, 'light', idx >= 0 ? idx : fallback);
      }
    }
  }, [lighterTargetsFiltered, lightTargetsFiltered, selectedLighterIndex, selectedLightIndex, onSelect, colorKey]);

  return (
    <div>
      <div className={`${styles.rowTitle} cf-font-600`}>
        {name}: Y-gap (white→lighter): {lighterYSelected != null ? (1 - lighterYSelected).toFixed(3) : '-'} (min: {MIN_DELTA_LUM_TINTS_FROM_WHITE.toFixed(2)})
      </div>
      <div className={styles.stripGrid}>
        {lighterTargetsFiltered.map((targetY, i) => {
          const rgb = solveHslLightnessForY(baseRgb, targetY);
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          const contrast = getContrastRatio(rgb, NEAR_BLACK_RGB);
          const level = contrast >= AAA_MIN ? 'AAA' : contrast >= AA_SMALL_MIN ? 'AA' : 'FAIL';
          const hsl = hslStringFromRgb(rgb, true);
          const y = luminance(rgb.r, rgb.g, rgb.b);
          const isSelected = i === lighterIndex;
          return (
            <div
              key={`${name}-${targetY}`}
              className={`${styles.swatch} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelect(colorKey, 'lighter', i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(colorKey, 'lighter', i); }}
            >
              {renderPickerSwatchContent({ hex, hsl, y, level, contrast, textColor: '#000' })}
            </div>
          );
        })}
      </div>

      <div className={`${styles.rowTitle} cf-font-600`}>
        {name}: Y-gap (lighter→light): {lighterYSelected != null && lightYSelected != null ? (lighterYSelected - lightYSelected).toFixed(3) : '-'} (min: {RECOMMENDED_TINT_Y_GAP.toFixed(3)})
      </div>
      {tooClose && (
        <div className={styles.warningInline}>
          Selected lighter (Y {lighterYSelected?.toFixed(3) ?? '-'}) and light (Y {lightYSelected?.toFixed(3) ?? '-'}) are closer than recommended {RECOMMENDED_TINT_Y_GAP.toFixed(3)} (difference {Number.isFinite(lightGap) ? lightGap.toFixed(3) : '-'}). Palette will preserve your selections, which may reduce perceptual separation.
        </div>
      )}
      <div className={styles.stripGrid}>
        {lightTargetsFiltered.map((targetY, i) => {
          const rgb = solveHslLightnessForY(baseRgb, targetY);
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          const contrast = getContrastRatio(rgb, NEAR_BLACK_RGB);
          const level = contrast >= AAA_MIN ? 'AAA' : contrast >= AA_SMALL_MIN ? 'AA' : 'FAIL';
          const hsl = hslStringFromRgb(rgb, true);
          const y = luminance(rgb.r, rgb.g, rgb.b);
          const isSelected = i === lightIndex;
          return (
            <div
              key={`${name}-light-${targetY}`}
              className={`${styles.swatch} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelect(colorKey, 'light', i)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(colorKey, 'light', i); }}
            >
              {renderPickerSwatchContent({ hex, hsl, y, level, contrast, textColor: '#000' })}
            </div>
          );
        })}
      </div>
      {/* warning now shown inline above the strip when tooClose */}
    </div>
  );
}

type RowShadesProps = {
  name: string;
  baseHex: string;
  colorKey: ColorType;
  selectedDarkerY?: number; // we will still honor both selections mapping into same 10-strip
  selectedDarkY?: number;
  onSelect: (colorKey: ColorType, kind: 'darker' | 'dark', y: number) => void;
};

function RowShades({ name, baseHex, colorKey, selectedDarkerY, selectedDarkY, onSelect }: RowShadesProps) {
  const baseRgb = hexToRgb(baseHex);
  const filterForWhiteTextAAA = React.useCallback((ys: number[]) => {
    return ys
      .map((y) => ({ y, rgb: solveHslLightnessForY(baseRgb, y) }))
      .map(({ y, rgb }) => ({ y, rgb, ratio: getContrastRatio(rgb, NEAR_WHITE_RGB) }))
      .filter(({ ratio }) => ratio >= AAA_MIN && ratio <= MAX_CONTRAST_SHADES)
      .map(({ y }) => y);
  }, [baseRgb]);

  // Build one combined AAA-valid shade list, then split extremes
  const { darkerTargets, darkTargets, totalShades } = React.useMemo(() => {
    const minY = DARKER_MIN_Y;
    const maxY = DARK_MAX_Y;
    const step = 0.005;
    const raw: number[] = [];
    for (let y = minY; y <= maxY + 1e-9; y += step) raw.push(parseFloat(y.toFixed(Y_TARGET_DECIMALS)));
    const aaaAll = filterForWhiteTextAAA(raw);
    // Deduplicate consecutive Ys at our precision to avoid duplicate swatches
    const uniq: number[] = [];
    let last: number | undefined;
    for (const y of aaaAll.sort((a, b) => a - b)) {
      const r = parseFloat(y.toFixed(Y_TARGET_DECIMALS));
      if (last == null || r !== last) {
        uniq.push(r);
        last = r;
      }
    }
    // Decide split counts (up to 10 each)
    const take = Math.min(10, uniq.length);
    const dkr = uniq.slice(0, Math.min(take, uniq.length));
    const drk = uniq.slice(Math.max(0, uniq.length - take));
    // Apply matchability constraints
    const darkestDarker = dkr.length ? dkr[0] : undefined;
    const drkFiltered = drk.filter(y => darkestDarker != null && (y - darkestDarker) >= RECOMMENDED_SHADE_Y_GAP);
    const dkrFiltered = dkr.filter(y => drkFiltered.some(dy => (dy - y) >= RECOMMENDED_SHADE_Y_GAP));
    return { darkerTargets: dkrFiltered, darkTargets: drkFiltered, totalShades: uniq.length };
  }, [filterForWhiteTextAAA]);

  const darkerClosest = React.useMemo(() => findClosestIndex(darkerTargets, selectedDarkerY ?? TARGET_LUM_DARKER), [darkerTargets, selectedDarkerY]);
  const darkClosest = React.useMemo(() => findClosestIndex(darkTargets, selectedDarkY ?? TARGET_LUM_DARK), [darkTargets, selectedDarkY]);

  const EPS = 1e-6;
  const darkGap = (selectedDarkerY != null && selectedDarkY != null)
    ? (selectedDarkY - selectedDarkerY)
    : Number.POSITIVE_INFINITY;
  const tooClose = Number.isFinite(darkGap) && (darkGap + EPS) < RECOMMENDED_SHADE_Y_GAP;

  // Auto-correct defaults to avoid adjacent/too-close selection
  React.useEffect(() => {
    const setIf = (cond: boolean, fn: () => void) => { if (cond) fn(); };
    // Compute desired defaults deterministically: pick middle of darker list
    const desiredDarker = (darkerTargets.length > 0)
      ? (selectedDarkerY ?? darkerTargets[Math.floor(darkerTargets.length / 2)])
      : undefined;

    // Ensure darker has a default, but only if it changes
    setIf(selectedDarkerY == null && desiredDarker != null, () => {
      if (selectedDarkerY !== desiredDarker) {
        onSelect(colorKey, 'darker', desiredDarker);
      }
    });

    // Ensure dark has a default preferring recommended gap from darker; fall back to hard min/last
    const base = selectedDarkerY ?? desiredDarker;
    if ((selectedDarkY == null) && darkTargets.length > 0 && base != null) {
      const candidate = darkTargets.find(y => y >= base + RECOMMENDED_SHADE_Y_GAP)
        ?? darkTargets.find(y => y >= base + HARD_MIN_SHADE_Y_GAP)
        ?? darkTargets[darkTargets.length - 1];
      if (candidate != null && candidate !== selectedDarkY) {
        onSelect(colorKey, 'dark', candidate);
      }
    }
  }, [selectedDarkerY, selectedDarkY, darkerTargets, darkTargets, tooClose, onSelect, colorKey]);

  return (
    <div>
      <div className={`${styles.rowTitle} cf-font-600`}>
        {name}: Y-gap (black→darker): {selectedDarkerY != null ? (selectedDarkerY - 0).toFixed(3) : '-'} (min: {HARD_MIN_SHADE_Y_GAP.toFixed(3)})
      </div>
      <div className={styles.stripGrid}>
        {darkerTargets.map((targetY, i) => {
          const rgb = solveHslLightnessForY(baseRgb, targetY);
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          const y = luminance(rgb.r, rgb.g, rgb.b);
          const contrast = getContrastRatio(rgb, NEAR_WHITE_RGB);
          const level = contrast >= AAA_MIN ? 'AAA' : contrast >= AA_SMALL_MIN ? 'AA' : 'FAIL';
          const isSelected = i === darkerClosest;
          return (
            <div
              key={`${name}-darker-${targetY}`}
              className={`${styles.swatch} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelect(colorKey, 'darker', targetY)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(colorKey, 'darker', targetY); }}
            >
              {renderPickerSwatchContent({ hex, hsl: hslStringFromRgb(rgb, true), y, level, contrast, textColor: '#fff' })}
            </div>
          );
        })}
      </div>
      {typeof totalShades === 'number' && totalShades < 6 && (
        <div className={styles.warningInline}>
          Only {totalShades} AAA-compliant dark shades available from this base color. Consider increasing saturation or slightly adjusting hue to widen the dark range.
        </div>
      )}
      <div className={`${styles.rowTitle} cf-font-600`}>
        {name}: Y-gap (darker→dark): {selectedDarkerY != null && selectedDarkY != null ? (selectedDarkY - selectedDarkerY).toFixed(3) : '-'} (min: {RECOMMENDED_SHADE_Y_GAP.toFixed(3)})
      </div>
      {tooClose && (
        <div className={styles.warningInline}>
          Selected darker (Y {selectedDarkerY?.toFixed(3) ?? '-'}) and dark (Y {selectedDarkY?.toFixed(3) ?? '-'}) are closer than recommended {RECOMMENDED_SHADE_Y_GAP.toFixed(3)} (difference {selectedDarkY != null && selectedDarkerY != null ? (selectedDarkY - selectedDarkerY).toFixed(3) : '-'}). Palette will preserve your selections.
        </div>
      )}
      <div className={styles.stripGrid}>
        {darkTargets.map((targetY, i) => {
          const rgb = solveHslLightnessForY(baseRgb, targetY);
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          const y = luminance(rgb.r, rgb.g, rgb.b);
          const contrast = getContrastRatio(rgb, NEAR_WHITE_RGB);
          const level = contrast >= AAA_MIN ? 'AAA' : contrast >= AA_SMALL_MIN ? 'AA' : 'FAIL';
          const isSelected = i === darkClosest;
          return (
            <div
              key={`${name}-dark-${targetY}`}
              className={`${styles.swatch} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelect(colorKey, 'dark', targetY)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(colorKey, 'dark', targetY); }}
            >
              {renderPickerSwatchContent({ hex, hsl: hslStringFromRgb(rgb, true), y, level, contrast, textColor: '#fff' })}
            </div>
          );
        })}
      </div>
      {darkTargets.length === 0 && (
        <div className={styles.warningInline}>No AAA-compliant dark options found for {name} in the configured range.</div>
      )}
    </div>
  );
}

export function LuminanceTestStrips({
  palette,
  selections,
  onSelectTintIndex,
  onSelectShadeY,
}: {
  palette: PaletteWithVariations;
  selections: Partial<Record<ColorType, { lighterIndex?: number; lightIndex?: number; darkerY?: number; darkY?: number }>>;
  onSelectTintIndex: (colorKey: ColorType, kind: 'lighter' | 'light', index: number) => void;
  onSelectShadeY: (colorKey: ColorType, kind: 'darker' | 'dark', y: number) => void;
}) {
  return (
    <section className={styles.testStripsSection}>
      <div className={styles.sectionHeader}>
        <h2 className={`${styles.sectionTitle} cf-font-600`}>Luminance test strips</h2>
        <div className={styles.sectionNote}>Each group: tint choices and shade choices (all have at least AAA contrast with black or white text). "Y values" are the luminance.</div>
      </div>

      <div className={styles.rows}>
        <div id="luminance-primary" />
        <Row
          name="Primary"
          baseHex={palette.primary.hex}
          colorKey="primary"
          selectedLighterIndex={selections.primary?.lighterIndex}
          selectedLightIndex={selections.primary?.lightIndex}
          onSelect={onSelectTintIndex}
        />
        <div id="luminance-primary-shades" />
        <RowShades
          name="Primary"
          baseHex={palette.primary.hex}
          colorKey="primary"
          selectedDarkerY={selections.primary?.darkerY}
          selectedDarkY={selections.primary?.darkY}
          onSelect={onSelectShadeY}
        />
        <div id="luminance-secondary" />
        <Row
          name="Secondary"
          baseHex={palette.secondary.hex}
          colorKey="secondary"
          selectedLighterIndex={selections.secondary?.lighterIndex}
          selectedLightIndex={selections.secondary?.lightIndex}
          onSelect={onSelectTintIndex}
        />
        <div id="luminance-secondary-shades" />
        <RowShades
          name="Secondary"
          baseHex={palette.secondary.hex}
          colorKey="secondary"
          selectedDarkerY={selections.secondary?.darkerY}
          selectedDarkY={selections.secondary?.darkY}
          onSelect={onSelectShadeY}
        />
        <div id="luminance-tertiary" />
        <Row
          name="Tertiary"
          baseHex={palette.tertiary.hex}
          colorKey="tertiary"
          selectedLighterIndex={selections.tertiary?.lighterIndex}
          selectedLightIndex={selections.tertiary?.lightIndex}
          onSelect={onSelectTintIndex}
        />
        <div id="luminance-tertiary-shades" />
        <RowShades
          name="Tertiary"
          baseHex={palette.tertiary.hex}
          colorKey="tertiary"
          selectedDarkerY={selections.tertiary?.darkerY}
          selectedDarkY={selections.tertiary?.darkY}
          onSelect={onSelectShadeY}
        />
        <div id="luminance-accent" />
        <Row
          name="Accent"
          baseHex={palette.accent.hex}
          colorKey="accent"
          selectedLighterIndex={selections.accent?.lighterIndex}
          selectedLightIndex={selections.accent?.lightIndex}
          onSelect={onSelectTintIndex}
        />
        <div id="luminance-accent-shades" />
        <RowShades
          name="Accent"
          baseHex={palette.accent.hex}
          colorKey="accent"
          selectedDarkerY={selections.accent?.darkerY}
          selectedDarkY={selections.accent?.darkY}
          onSelect={onSelectShadeY}
        />
      </div>
    </section>
  );
}
