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
        <div className={styles.metaLine}>{level} {contrast.toFixed(2)}</div>
        <div className={styles.metaLine}>{hsl}</div>
        <div className={styles.metaLine}>Y {y.toFixed(Y_DISPLAY_DECIMALS)}</div>
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
  selectedLighterY?: number;
  selectedLightY?: number;
  onSelect: (colorKey: ColorType, kind: 'lighter' | 'light', y: number) => void;
};

function Row({ name, baseHex, colorKey, selectedLighterY, selectedLightY, onSelect }: RowProps) {
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
  const lightTargets = React.useMemo(() => {
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
  const lighterClosest = React.useMemo(() => findClosestIndex(lighterTargets, selectedLighterY ?? TARGET_LUM_LIGHTER), [lighterTargets, selectedLighterY]);
  const lightClosest = React.useMemo(() => findClosestIndex(lightTargets, selectedLightY ?? TARGET_LUM_LIGHT), [lightTargets, selectedLightY]);
  const lighterRgb = React.useMemo(() => solveHslLightnessForY(baseRgb, selectedLighterY ?? TARGET_LUM_LIGHTER), [baseRgb, selectedLighterY]);
  const lighterHex = React.useMemo(() => rgbToHex(lighterRgb.r, lighterRgb.g, lighterRgb.b), [lighterRgb]);
  const lighterY = React.useMemo(() => luminance(lighterRgb.r, lighterRgb.g, lighterRgb.b), [lighterRgb]);
  const lighterHsl = React.useMemo(() => hslStringFromRgb(lighterRgb, true), [lighterRgb]);
  const EPS = 1e-6;
  const lightGap = (selectedLighterY != null && selectedLightY != null)
    ? (selectedLighterY - selectedLightY)
    : Number.POSITIVE_INFINITY;
  const tooClose = Number.isFinite(lightGap) && (lightGap + EPS) < RECOMMENDED_TINT_Y_GAP;

  return (
    <div>
      <div className={styles.rowTitle}>
        {name} — white → lighter gap {selectedLighterY != null ? (1 - selectedLighterY).toFixed(3) : '-'} (recommended minimum gap: {MIN_DELTA_LUM_TINTS_FROM_WHITE.toFixed(2)})
      </div>
      <div className={styles.stripGrid}>
        {lighterTargets.map((targetY, i) => {
          const rgb = solveHslLightnessForY(baseRgb, targetY);
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          const contrast = getContrastRatio(rgb, NEAR_BLACK_RGB);
          const level = contrast >= AAA_MIN ? 'AAA' : contrast >= AA_SMALL_MIN ? 'AA' : 'FAIL';
          const hsl = hslStringFromRgb(rgb, true);
          const y = luminance(rgb.r, rgb.g, rgb.b);
          const isSelected = i === lighterClosest;
          return (
            <div
              key={`${name}-${targetY}`}
              className={`${styles.swatch} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelect(colorKey, 'lighter', targetY)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(colorKey, 'lighter', targetY); }}
            >
              {renderPickerSwatchContent({ hex, hsl, y, level, contrast, textColor: '#000' })}
            </div>
          );
        })}
      </div>

      <div className={styles.rowTitle}>
        {name} — lighter → light gap {selectedLighterY != null && selectedLightY != null ? (selectedLighterY - selectedLightY).toFixed(3) : '-'} (recommended minimum gap: {RECOMMENDED_TINT_Y_GAP.toFixed(2)})
      </div>
      {tooClose && (
        <div className={styles.warningInline}>
          Selected lighter (Y {(selectedLighterY ?? 0).toFixed(3)}) and light (Y {(selectedLightY ?? 0).toFixed(3)}) are closer than recommended {RECOMMENDED_TINT_Y_GAP.toFixed(2)} (difference {(selectedLighterY != null && selectedLightY != null ? (selectedLighterY - selectedLightY) : 0).toFixed(3)}). Palette will preserve your selections, which may reduce perceptual separation.
        </div>
      )}
      <div className={styles.stripGrid}>
        {lightTargets.map((targetY, i) => {
          const rgb = solveHslLightnessForY(baseRgb, targetY);
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          const contrast = getContrastRatio(rgb, NEAR_BLACK_RGB);
          const level = contrast >= AAA_MIN ? 'AAA' : contrast >= AA_SMALL_MIN ? 'AA' : 'FAIL';
          const hsl = hslStringFromRgb(rgb, true);
          const y = luminance(rgb.r, rgb.g, rgb.b);
          const isSelected = i === lightClosest;
          return (
            <div
              key={`${name}-light-${targetY}`}
              className={`${styles.swatch} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelect(colorKey, 'light', targetY)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(colorKey, 'light', targetY); }}
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

  const darkerTargets = React.useMemo(() => {
    const minY = DARKER_MIN_Y;
    const maxY = DARKER_MAX_Y;
    const raw = buildTargets(SHADE_TARGET_COUNT, minY, maxY);
    return filterForWhiteTextAAA(raw);
  }, [filterForWhiteTextAAA]);

  const darkTargets = React.useMemo(() => {
    const minY = Math.min(DARK_OVERLAP_MIN_Y, TARGET_LUM_DARKER + MIN_DELTA_LUM_SHADES); // allow overlap with darker
    const maxY = DARK_MAX_Y;
    const raw = buildTargets(SHADE_TARGET_COUNT, parseFloat(minY.toFixed(Y_TARGET_DECIMALS)), maxY);
    return filterForWhiteTextAAA(raw);
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
    // Compute desired defaults deterministically
    const desiredDarker = (darkerTargets.length > 0)
      ? (selectedDarkerY ?? darkerTargets[Math.min(1, darkerTargets.length - 1)])
      : undefined;

    // Ensure darker has a default, but only if it changes
    setIf(selectedDarkerY == null && desiredDarker != null, () => {
      if (selectedDarkerY !== desiredDarker) {
        onSelect(colorKey, 'darker', desiredDarker);
      }
    });

    // Ensure dark has a default respecting hard min gap from darker; do not override when "too close"
    const base = selectedDarkerY ?? desiredDarker;
    if ((selectedDarkY == null) && darkTargets.length > 0 && base != null) {
      const candidate = darkTargets.find(y => y >= base + HARD_MIN_SHADE_Y_GAP) ?? darkTargets[darkTargets.length - 1];
      if (candidate != null && candidate !== selectedDarkY) {
        onSelect(colorKey, 'dark', candidate);
      }
    }
  }, [selectedDarkerY, selectedDarkY, darkerTargets, darkTargets, tooClose, onSelect, colorKey]);

  return (
    <div>
      <div className={styles.rowTitle}>
        {name} — black → darker gap {selectedDarkerY != null ? (selectedDarkerY - 0).toFixed(3) : '-'} (recommended minimum gap: {HARD_MIN_SHADE_Y_GAP.toFixed(2)})
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
      <div className={styles.rowTitle}>
        {name} — darker → dark gap {selectedDarkerY != null && selectedDarkY != null ? (selectedDarkY - selectedDarkerY).toFixed(3) : '-'} (recommended minimum gap: {RECOMMENDED_SHADE_Y_GAP.toFixed(2)})
      </div>
      {tooClose && (
        <div className={styles.warningInline}>
          Selected darker (Y {selectedDarkerY?.toFixed(3) ?? '-'}) and dark (Y {selectedDarkY?.toFixed(3) ?? '-'}) are closer than recommended {RECOMMENDED_SHADE_Y_GAP.toFixed(2)} (difference {selectedDarkY != null && selectedDarkerY != null ? (selectedDarkY - selectedDarkerY).toFixed(3) : '-'}). Palette will preserve your selections.
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
  onSelect,
}: {
  palette: PaletteWithVariations;
  selections: Partial<Record<ColorType, { lighterY?: number; lightY?: number; darkerY?: number; darkY?: number }>>;
  onSelect: (colorKey: ColorType, kind: 'lighter' | 'light' | 'darker' | 'dark', y: number) => void;
}) {
  return (
    <section className={styles.testStripsSection}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Luminance test strips</h3>
        <div className={styles.sectionNote}>Each group: white reference plus {TINT_TARGET_COUNT} tint targets and {SHADE_TARGET_COUNT} shade targets (AAA with white text). Pick your preferred Y values.</div>
      </div>

      <div className={styles.rows}>
        <div className={styles.whiteBar}>White reference — #FFFFFF — hsl(0, 0%, 100%) — Y 1.000</div>
        <Row
          name="Primary"
          baseHex={palette.primary.hex}
          colorKey="primary"
          selectedLighterY={selections.primary?.lighterY}
          selectedLightY={selections.primary?.lightY}
          onSelect={onSelect}
        />
        <RowShades
          name="Primary"
          baseHex={palette.primary.hex}
          colorKey="primary"
          selectedDarkerY={selections.primary?.darkerY}
          selectedDarkY={selections.primary?.darkY}
          onSelect={onSelect}
        />

        <div className={styles.whiteBar}>White reference — #FFFFFF — hsl(0, 0%, 100%) — Y 1.000</div>
        <Row
          name="Secondary"
          baseHex={palette.secondary.hex}
          colorKey="secondary"
          selectedLighterY={selections.secondary?.lighterY}
          selectedLightY={selections.secondary?.lightY}
          onSelect={onSelect}
        />
        <RowShades
          name="Secondary"
          baseHex={palette.secondary.hex}
          colorKey="secondary"
          selectedDarkerY={selections.secondary?.darkerY}
          selectedDarkY={selections.secondary?.darkY}
          onSelect={onSelect}
        />

        <div className={styles.whiteBar}>White reference — #FFFFFF — hsl(0, 0%, 100%) — Y 1.000</div>
        <Row
          name="Tertiary"
          baseHex={palette.tertiary.hex}
          colorKey="tertiary"
          selectedLighterY={selections.tertiary?.lighterY}
          selectedLightY={selections.tertiary?.lightY}
          onSelect={onSelect}
        />
        <RowShades
          name="Tertiary"
          baseHex={palette.tertiary.hex}
          colorKey="tertiary"
          selectedDarkerY={selections.tertiary?.darkerY}
          selectedDarkY={selections.tertiary?.darkY}
          onSelect={onSelect}
        />

        <div className={styles.whiteBar}>White reference — #FFFFFF — hsl(0, 0%, 100%) — Y 1.000</div>
        <Row
          name="Accent"
          baseHex={palette.accent.hex}
          colorKey="accent"
          selectedLighterY={selections.accent?.lighterY}
          selectedLightY={selections.accent?.lightY}
          onSelect={onSelect}
        />
        <RowShades
          name="Accent"
          baseHex={palette.accent.hex}
          colorKey="accent"
          selectedDarkerY={selections.accent?.darkerY}
          selectedDarkY={selections.accent?.darkY}
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}
