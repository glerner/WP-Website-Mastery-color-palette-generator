import * as React from 'react';
import styles from './LuminanceTestStrips.module.css';
import { Button } from './Button';
import { PaletteWithVariations, ColorType, SemanticColorType, SwatchPick } from '../helpers/types';
import { hexToRgb, rgbToHex, rgbToHslNorm, solveHslLightnessForY, luminance, getContrastRatio, hslNormToRgb } from '../helpers/colorUtils';
import { chooseForeground } from '../helpers/themeRuntime';
import { NEAR_BLACK_RGB, NEAR_WHITE_RGB, TINT_TARGET_COUNT, SHADE_TARGET_COUNT, LIGHT_MIN_Y_BASE, LIGHTER_MAX_Y, LIGHT_MAX_Y_CAP, DARKER_MIN_Y, DARKER_MAX_Y, DARK_OVERLAP_MIN_Y, DARK_MAX_Y, Y_TARGET_DECIMALS, Y_DISPLAY_DECIMALS, RECOMMENDED_TINT_Y_GAP, RECOMMENDED_SHADE_Y_GAP, RECOMMENDED_SHADE_Y_GAP_TOLERANCE, HARD_MIN_SHADE_Y_GAP, TARGET_LUM_LIGHTER, TARGET_LUM_LIGHT, TARGET_LUM_DARK, TARGET_LUM_DARKER, MIN_DELTA_LUM_TINTS, MIN_DELTA_LUM_TINTS_FROM_WHITE, MIN_DELTA_LUM_SHADES, AAA_MIN, AA_SMALL_MIN, MAX_CONTRAST_TINTS, MAX_CONTRAST_SHADES, CLOSE_ENOUGH_TO_WHITE_MIN_LUM, CLOSE_ENOUGH_TO_BLACK_MAX_LUM } from '../helpers/config';

// Sentinel value for "not found" - explicit constant makes debugging clearer than -1
const INDEX_NOT_FOUND = -1;

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

// Keep only visibly-distinct Y values and cap to desired count
function finalizeTargets(values: number[], minDelta: number, maxCount: number) {
  const out: number[] = [];
  let last: number | undefined;
  for (const y of values) {
    if (last == null || Math.abs(y - last) >= minDelta - 1e-9) {
      out.push(parseFloat(y.toFixed(Y_TARGET_DECIMALS)));
      last = y;
      if (out.length >= maxCount) break;
    }
  }
  return out;
}

type RowProps = {
  name: string;
  baseHex: string;
  colorKey: ColorType | SemanticColorType;
  showDiagnostics?: boolean | undefined;
  selectedLighterIndex?: number | undefined;
  selectedLightIndex?: number | undefined;
  onSelect: (colorKey: ColorType | SemanticColorType, kind: 'lighter' | 'light', index: number) => void;
  onSelectTint?: ((colorKey: ColorType | SemanticColorType, kind: 'lighter' | 'light', pick: SwatchPick) => void) | undefined;
  textOnLightRgb?: { r: number; g: number; b: number } | undefined;
  textOnDarkRgb?: { r: number; g: number; b: number } | undefined;
  textOnLight?: string | undefined;
  textOnDark?: string | undefined;
  noticeBgHex?: string | undefined;
  onGoPalette?: (() => void) | undefined;
  anchorId?: string;
};

function RowTints({ name, baseHex, colorKey, showDiagnostics, selectedLighterIndex, selectedLightIndex, onSelect, onSelectTint, textOnLightRgb, textOnDarkRgb, textOnLight, textOnDark, noticeBgHex, onGoPalette, anchorId }: RowProps) {
  const baseRgb = hexToRgb(baseHex);
  // Prefer live text-on-light token if provided; fall back to near-black
  const blackLike = textOnLightRgb ?? NEAR_BLACK_RGB;
  const filterForBlackTextAAA = React.useCallback((ys: number[]) => {
    return ys
      .map((y) => ({ y, rgb: solveHslLightnessForY(baseRgb, y) }))
      .map(({ y, rgb }) => ({ y, rgb, ratio: getContrastRatio(rgb, blackLike) }))
      .filter(({ ratio }) => ratio >= AAA_MIN && ratio <= MAX_CONTRAST_TINTS)
      .map(({ y }) => y);
  }, [baseRgb, blackLike.r, blackLike.g, blackLike.b]);

  // Unified AAA-valid list across LIGHT_MIN_Y_BASE..practical max; sample evenly when >= target count; then split
  const { lighterTargetsFiltered, lightTargetsFiltered } = React.useMemo(() => {
    const step = 0.005;
    const raw: number[] = [];
    const minY = Math.max(0, LIGHT_MIN_Y_BASE);
    // Use practical threshold: 1.0 (white) - MIN_DELTA_LUM_TINTS_FROM_WHITE
    const maxY = Math.min(1, 1.0 - MIN_DELTA_LUM_TINTS_FROM_WHITE);
    for (let y = minY; y <= maxY + 1e-9; y += step) raw.push(parseFloat(y.toFixed(Y_TARGET_DECIMALS)));
    const aaa = filterForBlackTextAAA(raw).sort((a, b) => a - b);
    let unified: number[] = [];
    if (aaa.length >= TINT_TARGET_COUNT) {
      const picks: number[] = [];
      const stepIdx = (aaa.length - 1) / (TINT_TARGET_COUNT - 1);
      for (let i = 0; i < TINT_TARGET_COUNT; i++) {
        const idx = Math.round(i * stepIdx);
        const v = aaa[idx];
        if (v !== undefined) picks.push(parseFloat(v.toFixed(Y_TARGET_DECIMALS)));
      }
      unified = Array.from(new Set(picks));
    } else {
      unified = finalizeTargets(aaa, MIN_DELTA_LUM_TINTS_FROM_WHITE, TINT_TARGET_COUNT);
    }
    const N = unified.length;
    if (N === 0) return { lighterTargetsFiltered: [], lightTargetsFiltered: [] };
    if (N <= 5) {
      const take = Math.max(0, N - 1);
      return {
        // lighter = highest Ys
        lighterTargetsFiltered: unified.slice(Math.max(0, N - take)),
        // light = lowest Ys
        lightTargetsFiltered: unified.slice(0, take),
      };
    }
    const base = Math.max(0, Math.floor(N / 2) - 1);
    const overlap = Math.max(0, N - 2 * base);
    // lighter = highest Ys
    const lighter = unified.slice(Math.max(0, N - (base + overlap)));
    // light = lowest Ys
    const light = unified.slice(0, base + overlap);
    return { lighterTargetsFiltered: lighter, lightTargetsFiltered: light };
  }, [filterForBlackTextAAA]);
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
    console.log(`[RowTints Init] ${colorKey}: lighterTargetsFiltered.length=${lighterTargetsFiltered.length}, selectedLighterIndex=${selectedLighterIndex}, selectedLightIndex=${selectedLightIndex}`);

    // Initialize lighter index to middle if unset
    if (selectedLighterIndex == null) {
      const mid = Math.floor(lighterTargetsFiltered.length / 2);
      console.log(`[RowTints Init] ${colorKey}: Setting lighter to middle index ${mid} (of ${lighterTargetsFiltered.length})`);
      onSelect(colorKey, 'lighter', mid);
      // Also initialize exactSelections
      if (onSelectTint) {
        const targetY = lighterTargetsFiltered[mid];
        if (targetY != null) {
          const rgb = solveHslLightnessForY(baseRgb, targetY);
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          const y = luminance(rgb.r, rgb.g, rgb.b);
          const { h, s, l } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
          const cLight = textOnLightRgb ? getContrastRatio(rgb, textOnLightRgb) : getContrastRatio(rgb, blackLike);
          const cDark = textOnDarkRgb ? getContrastRatio(rgb, textOnDarkRgb) : getContrastRatio(rgb, blackLike);
          console.log(`[RowTints Init] ${colorKey}: Calling onSelectTint for lighter with hex=${hex}, indexDisplayed=${mid}`);
          onSelectTint(colorKey, 'lighter', {
            colorKey,
            step: 'lighter',
            indexDisplayed: mid,
            hex,
            hsl: { h, s, l },
            y,
            contrastVsTextOnLight: cLight,
            contrastVsTextOnDark: cDark,
            textToneUsed: 'dark',
          });
        }
      }
    } else {
      console.log(`[RowTints Init] ${colorKey}: Skipping lighter init (already set to ${selectedLighterIndex})`);
    }

    // Initialize light index to satisfy gap relative to lighter when possible
    if (selectedLightIndex == null) {
      const baseY = lighterTargetsFiltered[selectedLighterIndex ?? Math.floor(lighterTargetsFiltered.length / 2)];
      if (baseY != null) {
        // Search from LIGHTEST (end of array) to find brightest light that maintains gap
        // This gives better visual hierarchy: lighter→light goes bright→slightly-less-bright
        let idx = INDEX_NOT_FOUND;
        for (let i = lightTargetsFiltered.length - 1; i >= 0; i--) {
          const lightY = lightTargetsFiltered[i];
          if (lightY != null && (baseY - lightY) >= RECOMMENDED_TINT_Y_GAP) {
            idx = i;
            break;
          }
        }
        const fallback = Math.max(0, lightTargetsFiltered.length - 1);
        const finalIdx = (idx !== INDEX_NOT_FOUND) ? idx : fallback;
        console.log(`[RowTints Init] ${colorKey}: Setting light to index ${finalIdx} (found=${idx >= 0}, fallback=${fallback}, of ${lightTargetsFiltered.length}, searchedFromLightest=true)`);
        onSelect(colorKey, 'light', finalIdx);
        // Also initialize exactSelections
        if (onSelectTint) {
          const targetY = lightTargetsFiltered[finalIdx];
          if (targetY != null) {
            const rgb = solveHslLightnessForY(baseRgb, targetY);
            const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
            const y = luminance(rgb.r, rgb.g, rgb.b);
            const { h, s, l } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
            const cLight = textOnLightRgb ? getContrastRatio(rgb, textOnLightRgb) : getContrastRatio(rgb, blackLike);
            const cDark = textOnDarkRgb ? getContrastRatio(rgb, textOnDarkRgb) : getContrastRatio(rgb, blackLike);
            console.log(`[RowTints Init] ${colorKey}: Calling onSelectTint for light with hex=${hex}, indexDisplayed=${finalIdx}`);
            onSelectTint(colorKey, 'light', {
              colorKey,
              step: 'light',
              indexDisplayed: finalIdx,
              hex,
              hsl: { h, s, l },
              y,
              contrastVsTextOnLight: cLight,
              contrastVsTextOnDark: cDark,
              textToneUsed: 'dark',
            });
          }
        }
      }
    } else {
      console.log(`[RowTints Init] ${colorKey}: Skipping light init (already set to ${selectedLightIndex})`);
    }
  }, [lighterTargetsFiltered, lightTargetsFiltered, selectedLighterIndex, selectedLightIndex, onSelect, onSelectTint, colorKey, baseRgb, blackLike, textOnLightRgb, textOnDarkRgb]);

  return (
    <div>
      <div id={anchorId} className={`${styles.rowTitle} cf-font-600`}>
        {name}-lighter: {showDiagnostics ? (() => {
          if (lighterYSelected == null) return 'Gap between white→lighter: - (min: ' + MIN_DELTA_LUM_TINTS_FROM_WHITE.toFixed(2) + ')';
          const yL = parseFloat(lighterYSelected.toFixed(Y_DISPLAY_DECIMALS));
          const gap = 1 - yL;
          return `Gap between white→lighter: ${gap.toFixed(3)} (min: ${MIN_DELTA_LUM_TINTS_FROM_WHITE.toFixed(2)})`;
        })() : 'Click your favorite to select it'}
      </div>
      <div className={styles.stripGrid}>
        {lighterTargetsFiltered.map((targetY, i) => {
          const rgb = solveHslLightnessForY(baseRgb, targetY);
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          const contrast = getContrastRatio(rgb, blackLike);
          const level = contrast >= AAA_MIN ? 'AAA' : contrast >= AA_SMALL_MIN ? 'AA' : 'FAIL';
          const hsl = hslStringFromRgb(rgb, true);
          const y = luminance(rgb.r, rgb.g, rgb.b);
          const isSelected = i === lighterIndex;
          return (
            <div
              key={`${name}-lighter-${i}-${targetY}`}
              className={`${styles.swatch} ${isSelected ? styles.selected : ''}`}
              onClick={() => {
                onSelect(colorKey, 'lighter', i);
                try {
                  const cLight = textOnLightRgb ? getContrastRatio(rgb, textOnLightRgb) : contrast;
                  const cDark = textOnDarkRgb ? getContrastRatio(rgb, textOnDarkRgb) : contrast;
                  const { h, s, l } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
                  const pick: SwatchPick = {
                    colorKey,
                    step: 'lighter',
                    indexDisplayed: i,
                    hex,
                    hsl: { h, s, l },
                    y,
                    contrastVsTextOnLight: cLight,
                    contrastVsTextOnDark: cDark,
                    textToneUsed: 'dark',
                  };
                  onSelectTint && onSelectTint(colorKey, 'lighter', pick);
                } catch { }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelect(colorKey, 'lighter', i); onSelectTint && onSelectTint(colorKey, 'lighter', {
                    colorKey, step: 'lighter', indexDisplayed: i, hex, hsl: (() => { const { h, s, l } = rgbToHslNorm(rgb.r, rgb.g, rgb.b); return { h, s, l }; })(), y,
                    contrastVsTextOnLight: textOnLightRgb ? getContrastRatio(rgb, textOnLightRgb) : contrast,
                    contrastVsTextOnDark: textOnDarkRgb ? getContrastRatio(rgb, textOnDarkRgb) : contrast,
                    textToneUsed: 'dark',
                  });
                }
              }}
            >
              {renderPickerSwatchContent({ hex, hsl, y, level, contrast, textColor: '#000' })}
            </div>
          );
        })}
      </div>

      {(() => {
        // Show a low-count warning for tints if the combined unique AAA items are few
        const uniqueCount = new Set<number>([...lighterTargetsFiltered, ...lightTargetsFiltered]).size;
        if (uniqueCount > 0 && uniqueCount < 6) {
          return (
            <div className={styles.warningInline}>
              {`Only ${uniqueCount} AAA-compliant light tints available for this color. Consider darkening the "Text on Light" color, or for this color try increasing saturation or slightly adjusting hue to widen the light range.`}
            </div>
          );
        }
        return null;
      })()}

      <div className={`${styles.rowTitle} cf-font-600`}>
        {name}-light: {showDiagnostics ? (() => {
          if (lighterYSelected == null || lightYSelected == null) return 'Gap between lighter→light: - (min: ' + RECOMMENDED_TINT_Y_GAP.toFixed(3) + ')';
          const yL = parseFloat(lighterYSelected.toFixed(Y_DISPLAY_DECIMALS));
          const yLt = parseFloat(lightYSelected.toFixed(Y_DISPLAY_DECIMALS));
          const gap = yL - yLt;
          return `Gap between lighter→light: ${gap.toFixed(3)} (min: ${RECOMMENDED_TINT_Y_GAP.toFixed(3)})`;
        })() : 'Click your favorite to select it'}
        {onGoPalette && (
          <Button size="sm" variant="secondary" style={{ marginLeft: 12 }} onClick={onGoPalette}>
            Return to Palette tab
          </Button>
        )}
      </div>
      {tooClose && (
        <div className={styles.noticeInline}>
          These colors appear too similar. Pick ones further apart.
        </div>
      )}
      <div className={styles.stripGrid}>
        {lightTargetsFiltered.map((targetY, i) => {
          const rgb = solveHslLightnessForY(baseRgb, targetY);
          const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
          const contrast = getContrastRatio(rgb, blackLike);
          const level = contrast >= AAA_MIN ? 'AAA' : contrast >= AA_SMALL_MIN ? 'AA' : 'FAIL';
          const hsl = hslStringFromRgb(rgb, true);
          const y = luminance(rgb.r, rgb.g, rgb.b);
          const isSelected = i === lightIndex;
          return (
            <div
              key={`${name}-light-${i}-${targetY}`}
              className={`${styles.swatch} ${isSelected ? styles.selected : ''}`}
              onClick={() => {
                onSelect(colorKey, 'light', i);
                try {
                  const cLight = textOnLightRgb ? getContrastRatio(rgb, textOnLightRgb) : contrast;
                  const cDark = textOnDarkRgb ? getContrastRatio(rgb, textOnDarkRgb) : contrast;
                  const { h, s, l } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
                  const pick: SwatchPick = {
                    colorKey,
                    step: 'light',
                    indexDisplayed: i,
                    hex,
                    hsl: { h, s, l },
                    y,
                    contrastVsTextOnLight: cLight,
                    contrastVsTextOnDark: cDark,
                    textToneUsed: 'dark',
                  };
                  onSelectTint && onSelectTint(colorKey, 'light', pick);
                } catch { }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelect(colorKey, 'light', i); onSelectTint && onSelectTint(colorKey, 'light', {
                    colorKey, step: 'light', indexDisplayed: i, hex, hsl: (() => { const { h, s, l } = rgbToHslNorm(rgb.r, rgb.g, rgb.b); return { h, s, l }; })(), y,
                    contrastVsTextOnLight: textOnLightRgb ? getContrastRatio(rgb, textOnLightRgb) : contrast,
                    contrastVsTextOnDark: textOnDarkRgb ? getContrastRatio(rgb, textOnDarkRgb) : contrast,
                    textToneUsed: 'dark',
                  });
                }
              }}
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
  colorKey: ColorType | SemanticColorType;
  showDiagnostics?: boolean | undefined;
  selectedDarkerY?: number | undefined; // we will still honor both selections mapping into same 10-strip
  selectedDarkY?: number | undefined;
  onSelect: (colorKey: ColorType | SemanticColorType, kind: 'darker' | 'dark', y: number) => void;
  onSelectShade?: ((colorKey: ColorType | SemanticColorType, kind: 'darker' | 'dark', pick: SwatchPick) => void) | undefined;
  textOnLightRgb?: { r: number; g: number; b: number } | undefined;
  textOnDarkRgb?: { r: number; g: number; b: number } | undefined;
  textOnLight?: string | undefined;
  textOnDark?: string | undefined;
  noticeBgHex?: string | undefined;
  onGoPalette?: (() => void) | undefined;
  anchorId?: string;
};

function RowShades({ name, baseHex, colorKey, showDiagnostics, selectedDarkerY, selectedDarkY, onSelect, onSelectShade, textOnLightRgb, textOnDarkRgb, textOnLight, textOnDark, noticeBgHex, anchorId }: RowShadesProps) {
  const baseRgb = hexToRgb(baseHex);
  // Prefer live text-on-dark token if provided; fall back to near-white
  const whiteLike = textOnDarkRgb ?? NEAR_WHITE_RGB;
  const filterForWhiteTextAAA = React.useCallback((ys: number[]) => {
    return ys
      .map((y) => ({ y, rgb: solveHslLightnessForY(baseRgb, y) }))
      .map(({ y, rgb }) => ({ y, rgb, ratio: getContrastRatio(rgb, whiteLike) }))
      .filter(({ ratio }) => ratio >= AAA_MIN && ratio <= MAX_CONTRAST_SHADES)
      .map(({ y }) => y);
  }, [baseRgb, whiteLike.r, whiteLike.g, whiteLike.b]);

  // Unified AAA-valid shade list across DARKER_MIN_Y..DARK_MAX_Y; sample evenly when >= target count; then split
  const { darkerTargets, darkTargets, totalShades } = React.useMemo(() => {
    const step = 0.005;
    const raw: number[] = [];
    for (let y = DARKER_MIN_Y; y <= DARK_MAX_Y + 1e-9; y += step) raw.push(parseFloat(y.toFixed(Y_TARGET_DECIMALS)));
    const aaa = filterForWhiteTextAAA(raw).sort((a, b) => a - b);
    let unified: number[] = [];
    if (aaa.length === 0) unified = [];
    else {
      // Compute dynamic step: ensure at least HARD_MIN_SHADE_Y_GAP, or fill span over max count
      const firstY = aaa[0]!;
      const lastY = aaa[aaa.length - 1]!;
      const span = lastY - firstY;
      const desired = SHADE_TARGET_COUNT > 1 ? (span / (SHADE_TARGET_COUNT - 1)) : span;
      const minStep = Math.max(HARD_MIN_SHADE_Y_GAP, desired);
      let lastPicked: number | undefined;
      for (const y of aaa) {
        if (lastPicked == null || Math.abs(y - lastPicked) >= minStep - 1e-9) {
          unified.push(parseFloat(y.toFixed(Y_TARGET_DECIMALS)));
          lastPicked = y;
          if (unified.length >= SHADE_TARGET_COUNT) break;
        }
      }
      // In case we under-selected due to discrete sampling, try a second pass offset by half step
      if (unified.length < Math.min(SHADE_TARGET_COUNT, aaa.length)) {
        let last2 = unified.length ? unified[unified.length - 1] : undefined;
        for (const y of aaa) {
          if (last2 == null || Math.abs(y - last2) >= minStep - 1e-9) {
            const r = parseFloat(y.toFixed(Y_TARGET_DECIMALS));
            if (!unified.includes(r)) {
              unified.push(r);
              last2 = y;
              if (unified.length >= SHADE_TARGET_COUNT) break;
            }
          }
        }
      }
      unified = unified.sort((a, b) => a - b);
    }
    const N = unified.length;
    if (N === 0) return { darkerTargets: [], darkTargets: [], totalShades: 0 };
    if (N <= 5) {
      const take = Math.max(0, N - 1);
      return {
        darkerTargets: unified.slice(0, take),
        darkTargets: unified.slice(Math.max(0, N - take)),
        totalShades: N,
      };
    }
    const base = Math.max(0, Math.floor(N / 2) - 1);
    const overlap = Math.max(0, N - 2 * base);
    const darker = unified.slice(0, base + overlap);
    const dark = unified.slice(Math.max(0, N - (base + overlap)));
    return { darkerTargets: darker, darkTargets: dark, totalShades: N };
  }, [filterForWhiteTextAAA]);

  const darkerClosest = React.useMemo(() => findClosestIndex(darkerTargets, selectedDarkerY ?? TARGET_LUM_DARKER), [darkerTargets, selectedDarkerY]);
  const darkClosest = React.useMemo(() => findClosestIndex(darkTargets, selectedDarkY ?? TARGET_LUM_DARK), [darkTargets, selectedDarkY]);

  const darkGap = (selectedDarkerY != null && selectedDarkY != null)
    ? (selectedDarkY - selectedDarkerY)
    : Number.POSITIVE_INFINITY;
  const tooClose = Number.isFinite(darkGap) && darkGap < (RECOMMENDED_SHADE_Y_GAP - RECOMMENDED_SHADE_Y_GAP_TOLERANCE);

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
        onSelect(colorKey, 'darker', desiredDarker!);
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

  // Band definitions in display order
  const SHADE_BANDS: Array<{
    step: 'dark' | 'darker';
    label: string;
    targets: number[];
    selectedY: number | undefined;
    closestIndex: number;
    gapLabel: string;
    gapCalc: () => string;
    minGap: number;
  }> = [
      {
        step: 'dark',
        label: 'dark',
        targets: darkTargets,
        selectedY: selectedDarkY,
        closestIndex: darkClosest,
        gapLabel: 'darker→dark',
        gapCalc: () => {
          if (selectedDarkerY == null || selectedDarkY == null) return '-';
          return (parseFloat(selectedDarkY.toFixed(Y_DISPLAY_DECIMALS)) - parseFloat(selectedDarkerY.toFixed(Y_DISPLAY_DECIMALS))).toFixed(3);
        },
        minGap: RECOMMENDED_SHADE_Y_GAP,
      },
      {
        step: 'darker',
        label: 'darker',
        targets: darkerTargets,
        selectedY: selectedDarkerY,
        closestIndex: darkerClosest,
        gapLabel: 'black→darker',
        gapCalc: () => {
          if (selectedDarkerY == null) return '-';
          return (parseFloat(selectedDarkerY.toFixed(Y_DISPLAY_DECIMALS)) - 0).toFixed(3);
        },
        minGap: HARD_MIN_SHADE_Y_GAP,
      },
    ];

  return (
    <div>
      {SHADE_BANDS.map((band, bandIdx) => (
        <React.Fragment key={band.step}>
          {bandIdx === 0 && (
            <div id={anchorId} className={`${styles.rowTitle} cf-font-600`}>
              {name}-{band.label}: {showDiagnostics ? `Gap between ${band.gapLabel}: ${band.gapCalc()} (min: ${band.minGap.toFixed(3)})` : 'Click your favorite to select it'}
            </div>
          )}
          {bandIdx === 0 && tooClose && (
            <div className={styles.noticeInline}>
              These colors appear too similar. Pick ones further apart.
            </div>
          )}
          {bandIdx !== 0 && (
            <div className={`${styles.rowTitle} cf-font-600`}>
              {name}-{band.label}: {showDiagnostics ? `Gap between ${band.gapLabel}: ${band.gapCalc()} (min: ${band.minGap.toFixed(3)})` : 'Click your favorite to select it'}
            </div>
          )}
          <div className={styles.stripGrid}>
            {band.targets.map((targetY, i) => {
              const rgb = solveHslLightnessForY(baseRgb, targetY);
              const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
              const y = luminance(rgb.r, rgb.g, rgb.b);
              const contrast = getContrastRatio(rgb, whiteLike);
              const level = contrast >= AAA_MIN ? 'AAA' : contrast >= AA_SMALL_MIN ? 'AA' : 'FAIL';
              const isSelected = i === band.closestIndex;
              return (
                <div
                  key={`${name}-${band.step}-${i}-${targetY}`}
                  className={`${styles.swatch} ${isSelected ? styles.selected : ''}`}
                  onClick={() => {
                    onSelect(colorKey, band.step, targetY);
                    try {
                      const cLight = textOnLightRgb ? getContrastRatio(rgb, textOnLightRgb) : contrast;
                      const cDark = textOnDarkRgb ? getContrastRatio(rgb, textOnDarkRgb) : contrast;
                      const { h, s, l } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
                      const pick: SwatchPick = {
                        colorKey,
                        step: band.step,
                        indexDisplayed: i,
                        hex,
                        hsl: { h, s, l },
                        y,
                        contrastVsTextOnLight: cLight,
                        contrastVsTextOnDark: cDark,
                        textToneUsed: 'light',
                      };
                      onSelectShade && onSelectShade(colorKey, band.step, pick);
                    } catch { }
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelect(colorKey, band.step, targetY);
                      onSelectShade && onSelectShade(colorKey, band.step, {
                        colorKey,
                        step: band.step,
                        indexDisplayed: i,
                        hex,
                        hsl: (() => { const { h, s, l } = rgbToHslNorm(rgb.r, rgb.g, rgb.b); return { h, s, l }; })(),
                        y,
                        contrastVsTextOnLight: textOnLightRgb ? getContrastRatio(rgb, textOnLightRgb) : contrast,
                        contrastVsTextOnDark: textOnDarkRgb ? getContrastRatio(rgb, textOnDarkRgb) : contrast,
                        textToneUsed: 'light',
                      });
                    }
                  }}
                >
                  {renderPickerSwatchContent({ hex, hsl: hslStringFromRgb(rgb, true), y, level, contrast, textColor: '#fff' })}
                </div>
              );
            })}
          </div>
          {bandIdx === 0 && band.targets.length === 0 && (
            <div className={styles.warningInline}>No AAA-compliant dark options found for {name} in the configured range.</div>
          )}
          {bandIdx === 1 && typeof totalShades === 'number' && totalShades < 6 && (
            <div className={styles.warningInline}>
              {(() => {
                const n = totalShades;
                return `Only ${n} AAA-compliant dark shades available for this color. Consider lightening the "Text on Dark" color, or for this color try increasing saturation or slightly adjusting hue to widen the dark range.`;
              })()}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export function LuminanceTestStrips({
  palette,
  selections,
  onSelectTintIndex,
  onSelectShadeY,
  onSelectTint,
  onSelectShade,
  textOnLight,
  textOnDark,
  onGoPalette,
  anchorPrefix = '',
  onTokensAutoAdjusted,
  showDiagnostics,
}: {
  palette: PaletteWithVariations;
  selections: Partial<Record<ColorType | SemanticColorType, {
    lighterIndex?: number;
    lightIndex?: number;
    lighterY?: number;
    lightY?: number;
    darkerY?: number;
    darkY?: number
  }>>;
  onSelectTintIndex: (colorKey: ColorType | SemanticColorType, kind: 'lighter' | 'light', index: number) => void;
  onSelectShadeY: (colorKey: ColorType | SemanticColorType, kind: 'darker' | 'dark', y: number) => void;
  onSelectTint?: (colorKey: ColorType | SemanticColorType, kind: 'lighter' | 'light', pick: SwatchPick) => void;
  onSelectShade?: (colorKey: ColorType | SemanticColorType, kind: 'darker' | 'dark', pick: SwatchPick) => void;
  textOnLight?: string;
  textOnDark?: string;
  onGoPalette?: () => void;
  anchorPrefix?: string;
  onTokensAutoAdjusted?: (update: { textOnLight?: string; textOnDark?: string }) => void;
  showDiagnostics?: boolean;
}) {
  const textOnLightRgbRaw = React.useMemo(() => (textOnLight ? hexToRgb(textOnLight) : undefined), [textOnLight]);
  const textOnDarkRgbRaw = React.useMemo(() => (textOnDark ? hexToRgb(textOnDark) : undefined), [textOnDark]);

  // Clamp text tokens to configured luminance ranges by adjusting only HSL lightness
  const clampToY = React.useCallback((rgb: { r: number; g: number; b: number }, targetY: number) => {
    const { h, s } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
    let lo = 0, hi = 1, best = { r: rgb.r, g: rgb.g, b: rgb.b }, bestDiff = Infinity;
    for (let iter = 0; iter < 18; iter++) {
      const mid = (lo + hi) / 2;
      const cand = hslNormToRgb(h, s, mid);
      const y = luminance(cand.r, cand.g, cand.b);
      const diff = Math.abs(y - targetY);
      if (diff < bestDiff) { best = cand; bestDiff = diff; }
      if (y < targetY) lo = mid; else hi = mid;
    }
    return best;
  }, []);

  // Build helper to compute tint and shade target counts for given tokens
  const computeTintTargets = React.useCallback((baseRgb: { r: number; g: number; b: number }, tolRgb: { r: number; g: number; b: number } | undefined) => {
    const blackLike = tolRgb ?? NEAR_BLACK_RGB;
    const filterAAA = (ys: number[]) => ys
      .map((y) => ({ y, rgb: solveHslLightnessForY(baseRgb, y) }))
      .map(({ y, rgb }) => ({ y, rgb, ratio: getContrastRatio(rgb, blackLike) }))
      .filter(({ ratio }) => ratio >= AAA_MIN && ratio <= MAX_CONTRAST_TINTS)
      .map(({ y }) => y);
    // Unified AAA list across LIGHT_MIN_Y_BASE..LIGHTER_MAX_Y
    const dense: number[] = [];
    for (let y = Math.max(0, LIGHT_MIN_Y_BASE); y <= Math.min(1, LIGHTER_MAX_Y) + 1e-9; y += 0.005) {
      dense.push(parseFloat(y.toFixed(Y_TARGET_DECIMALS)));
    }
    const aaa = filterAAA(dense).sort((a, b) => a - b);
    let unified: number[] = [];
    if (aaa.length >= TINT_TARGET_COUNT) {
      const picks: number[] = [];
      const stepIdx = (aaa.length - 1) / (TINT_TARGET_COUNT - 1);
      for (let i = 0; i < TINT_TARGET_COUNT; i++) {
        const idx = Math.round(i * stepIdx);
        const v = aaa[idx];
        if (v !== undefined) picks.push(parseFloat(v.toFixed(Y_TARGET_DECIMALS)));
      }
      unified = Array.from(new Set(picks));
    } else {
      unified = finalizeTargets(aaa, MIN_DELTA_LUM_TINTS_FROM_WHITE, TINT_TARGET_COUNT);
    }
    const N = unified.length;
    if (N === 0) return { lighter: [], light: [] };
    if (N <= 5) {
      const take = Math.max(0, N - 1);
      return {
        // lighter = highest Ys
        lighter: unified.slice(Math.max(0, N - take)),
        // light = lowest Ys
        light: unified.slice(0, take),
      };
    }
    const base = Math.max(0, Math.floor(N / 2) - 1);
    const overlap = Math.max(0, N - 2 * base);
    return {
      // lighter = highest Ys
      lighter: unified.slice(Math.max(0, N - (base + overlap))),
      // light = lowest Ys
      light: unified.slice(0, base + overlap),
    };
  }, []);

  const computeShadeTargets = React.useCallback((baseRgb: { r: number; g: number; b: number }, todRgb: { r: number; g: number; b: number } | undefined) => {
    const whiteLike = todRgb ?? NEAR_WHITE_RGB;
    const filterAAA = (ys: number[]) => ys
      .map((y) => ({ y, rgb: solveHslLightnessForY(baseRgb, y) }))
      .map(({ y, rgb }) => ({ y, rgb, ratio: getContrastRatio(rgb, whiteLike) }))
      .filter(({ ratio }) => ratio >= AAA_MIN && ratio <= MAX_CONTRAST_SHADES)
      .map(({ y }) => y);
    // Unified AAA list across DARKER_MIN_Y..DARK_MAX_Y
    const dense: number[] = [];
    for (let y = DARKER_MIN_Y; y <= DARK_MAX_Y + 1e-9; y += 0.005) dense.push(parseFloat(y.toFixed(Y_TARGET_DECIMALS)));
    const aaa = filterAAA(dense).sort((a, b) => a - b);
    let unified: number[] = [];
    if (aaa.length >= SHADE_TARGET_COUNT) {
      const picks: number[] = [];
      const stepIdx = (aaa.length - 1) / (SHADE_TARGET_COUNT - 1);
      for (let i = 0; i < SHADE_TARGET_COUNT; i++) {
        const idx = Math.round(i * stepIdx);
        const v = aaa[idx];
        if (v !== undefined) picks.push(parseFloat(v.toFixed(Y_TARGET_DECIMALS)));
      }
      unified = Array.from(new Set(picks));
    } else {
      unified = finalizeTargets(aaa, MIN_DELTA_LUM_SHADES, SHADE_TARGET_COUNT);
    }
    const N = unified.length;
    if (N === 0) return { darker: [], dark: [] };
    if (N <= 5) {
      const take = Math.max(0, N - 1);
      return {
        darker: unified.slice(0, take),
        dark: unified.slice(Math.max(0, N - take)),
      };
    }
    const base = Math.max(0, Math.floor(N / 2) - 1);
    const overlap = Math.max(0, N - 2 * base);
    return {
      darker: unified.slice(0, base + overlap),
      dark: unified.slice(Math.max(0, N - (base + overlap))),
    };
  }, []);

  // Track original values before adjustment for warning messages
  const originalTextOnLightRef = React.useRef<string | undefined>(textOnLight);
  const originalTextOnDarkRef = React.useRef<string | undefined>(textOnDark);

  // Decide whether to clamp based on available options (need at least 3 in each band)
  const { textOnLightRgb, textOnDarkRgb, adjustedNotice, adjustedLight, adjustedDark } = React.useMemo(() => {
    // Check all color families; clamp if ANY has < 3 options in any band
    const keys: Array<keyof PaletteWithVariations> = ['primary', 'secondary', 'tertiary', 'accent', 'error', 'warning', 'success'];
    let insufficient = false;
    for (const k of keys) {
      const baseHex = (palette as any)[k]?.hex as string | undefined;
      if (!baseHex) continue;
      const baseRgb = hexToRgb(baseHex);
      const tintsRaw = computeTintTargets(baseRgb, textOnLightRgbRaw);
      const shadesRaw = computeShadeTargets(baseRgb, textOnDarkRgbRaw);
      if (tintsRaw.lighter.length < 3 || tintsRaw.light.length < 3 || shadesRaw.darker.length < 3 || shadesRaw.dark.length < 3) {
        insufficient = true; break;
      }
    }
    if (!insufficient) return { textOnLightRgb: textOnLightRgbRaw, textOnDarkRgb: textOnDarkRgbRaw, adjustedNotice: false, adjustedLight: false, adjustedDark: false } as const;
    let tLight = textOnLightRgbRaw;
    let tDark = textOnDarkRgbRaw;
    let adjLight = false;
    let adjDark = false;
    if (tLight) {
      const y = luminance(tLight.r, tLight.g, tLight.b);
      if (y > CLOSE_ENOUGH_TO_BLACK_MAX_LUM) { tLight = clampToY(tLight, CLOSE_ENOUGH_TO_BLACK_MAX_LUM); adjLight = true; }
    }
    if (tDark) {
      const y = luminance(tDark.r, tDark.g, tDark.b);
      if (y < CLOSE_ENOUGH_TO_WHITE_MIN_LUM) { tDark = clampToY(tDark, CLOSE_ENOUGH_TO_WHITE_MIN_LUM); adjDark = true; }
    }
    return { textOnLightRgb: tLight, textOnDarkRgb: tDark, adjustedNotice: (adjLight || adjDark), adjustedLight: adjLight, adjustedDark: adjDark } as const;
  }, [palette.primary.hex, textOnLightRgbRaw, textOnDarkRgbRaw, computeTintTargets, computeShadeTargets, clampToY]);

  // If adjusted, notify parent to persist
  React.useEffect(() => {
    if (!adjustedNotice || !onTokensAutoAdjusted) return;
    const out: { textOnLight?: string; textOnDark?: string } = {};
    if (textOnLightRgb && textOnLight) {
      const hex = rgbToHex(textOnLightRgb.r, textOnLightRgb.g, textOnLightRgb.b);
      if (hex.toLowerCase() !== textOnLight.toLowerCase()) {
        // Capture original before adjustment
        originalTextOnLightRef.current = textOnLight;
        out.textOnLight = hex;
      }
    }
    if (textOnDarkRgb && textOnDark) {
      const hex = rgbToHex(textOnDarkRgb.r, textOnDarkRgb.g, textOnDarkRgb.b);
      if (hex.toLowerCase() !== textOnDark.toLowerCase()) {
        // Capture original before adjustment
        originalTextOnDarkRef.current = textOnDark;
        out.textOnDark = hex;
      }
    }
    if (out.textOnLight || out.textOnDark) onTokensAutoAdjusted(out);
  }, [adjustedNotice, onTokensAutoAdjusted, textOnLightRgb, textOnDarkRgb, textOnLight, textOnDark]);

  // Compute notice background from warning-light variation for consistent notice styling
  const noticeBgHex = React.useMemo(() => {
    const warningVariations = (palette.warning as any)?.variations;
    if (Array.isArray(warningVariations)) {
      const lightVar = warningVariations.find((v: any) => v.step === 'light');
      if (lightVar?.hex) return lightVar.hex;
    }
    return undefined;
  }, [palette.warning]);

  return (
    <section className={styles.testStripsSection}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Select Your Preferred Colors</h2>
        <div className={styles.sectionNote}>Click your preference for each row of colors. The selected ones have the multi-color border; these will be used in your palette. (All the tints and shades shown have at least AAA contrast with your near-black or near-white text colors.)</div>
      </div>
      {adjustedNotice && adjustedLight && textOnLightRgb && (
        <div className={styles.noticeInline}>
          Text-on-light was out of recommended range. Adjusted from {originalTextOnLightRef.current || textOnLight} to {rgbToHex(textOnLightRgb.r, textOnLightRgb.g, textOnLightRgb.b)} to ensure at least 3 visibly-distinct tints available for each main color.
        </div>
      )}
      {adjustedNotice && adjustedDark && textOnDarkRgb && (
        <div className={styles.noticeInline}>
          Text-on-dark was out of recommended range. Adjusted from {originalTextOnDarkRef.current || textOnDark} to {rgbToHex(textOnDarkRgb.r, textOnDarkRgb.g, textOnDarkRgb.b)} to ensure at least 3 visibly-distinct shades available for each main color.
        </div>
      )}

      <div className={styles.rows}>
        <RowTints
          name="Primary"
          baseHex={palette.primary.hex}
          colorKey="primary"
          showDiagnostics={showDiagnostics}
          selectedLighterIndex={selections.primary?.lighterIndex}
          selectedLightIndex={selections.primary?.lightIndex}
          onSelect={onSelectTintIndex}
          onSelectTint={onSelectTint}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-primary`}
          onGoPalette={onGoPalette}
        />
        <RowShades
          name="Primary"
          baseHex={palette.primary.hex}
          colorKey="primary"
          showDiagnostics={showDiagnostics}
          selectedDarkerY={selections.primary?.darkerY}
          selectedDarkY={selections.primary?.darkY}
          onSelect={onSelectShadeY}
          onSelectShade={onSelectShade}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-primary-shades`}
          onGoPalette={onGoPalette}
        />
        <RowTints
          name="Secondary"
          baseHex={palette.secondary.hex}
          colorKey="secondary"
          showDiagnostics={showDiagnostics}
          selectedLighterIndex={selections.secondary?.lighterIndex}
          selectedLightIndex={selections.secondary?.lightIndex}
          onSelect={onSelectTintIndex}
          onSelectTint={onSelectTint}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-secondary`}
          onGoPalette={onGoPalette}
        />
        <RowShades
          name="Secondary"
          baseHex={palette.secondary.hex}
          colorKey="secondary"
          showDiagnostics={showDiagnostics}
          selectedDarkerY={selections.secondary?.darkerY}
          selectedDarkY={selections.secondary?.darkY}
          onSelect={onSelectShadeY}
          onSelectShade={onSelectShade}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-secondary-shades`}
          onGoPalette={onGoPalette}
        />
        <RowTints
          name="Tertiary"
          baseHex={palette.tertiary.hex}
          colorKey="tertiary"
          showDiagnostics={showDiagnostics}
          selectedLighterIndex={selections.tertiary?.lighterIndex}
          selectedLightIndex={selections.tertiary?.lightIndex}
          onSelect={onSelectTintIndex}
          onSelectTint={onSelectTint}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-tertiary`}
          onGoPalette={onGoPalette}
        />
        <RowShades
          name="Tertiary"
          baseHex={palette.tertiary.hex}
          colorKey="tertiary"
          showDiagnostics={showDiagnostics}
          selectedDarkerY={selections.tertiary?.darkerY}
          selectedDarkY={selections.tertiary?.darkY}
          onSelect={onSelectShadeY}
          onSelectShade={onSelectShade}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-tertiary-shades`}
          onGoPalette={onGoPalette}
        />
        <RowTints
          name="Accent"
          baseHex={palette.accent.hex}
          colorKey="accent"
          showDiagnostics={showDiagnostics}
          selectedLighterIndex={selections.accent?.lighterIndex}
          selectedLightIndex={selections.accent?.lightIndex}
          onSelect={onSelectTintIndex}
          onSelectTint={onSelectTint}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-accent`}
          onGoPalette={onGoPalette}
        />
        <RowShades
          name="Accent"
          baseHex={palette.accent.hex}
          colorKey="accent"
          showDiagnostics={showDiagnostics}
          selectedDarkerY={selections.accent?.darkerY}
          selectedDarkY={selections.accent?.darkY}
          onSelect={onSelectShadeY}
          onSelectShade={onSelectShade}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-accent-shades`}
          onGoPalette={onGoPalette}
        />
        <RowTints
          name="Error"
          baseHex={palette.error.hex}
          colorKey="error"
          showDiagnostics={showDiagnostics}
          selectedLighterIndex={selections.error?.lighterIndex}
          selectedLightIndex={selections.error?.lightIndex}
          onSelect={onSelectTintIndex}
          onSelectTint={onSelectTint}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-error`}
          onGoPalette={onGoPalette}
        />
        <RowShades
          name="Error"
          baseHex={palette.error.hex}
          colorKey="error"
          showDiagnostics={showDiagnostics}
          selectedDarkerY={selections.error?.darkerY}
          selectedDarkY={selections.error?.darkY}
          onSelect={onSelectShadeY}
          onSelectShade={onSelectShade}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-error-shades`}
          onGoPalette={onGoPalette}
        />
        <RowTints
          name="Notice"
          baseHex={palette.warning.hex}
          colorKey="warning"
          showDiagnostics={showDiagnostics}
          selectedLighterIndex={selections.warning?.lighterIndex}
          selectedLightIndex={selections.warning?.lightIndex}
          onSelect={onSelectTintIndex}
          onSelectTint={onSelectTint}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-warning`}
          onGoPalette={onGoPalette}
        />
        <RowShades
          name="Notice"
          baseHex={palette.warning.hex}
          colorKey="warning"
          showDiagnostics={showDiagnostics}
          selectedDarkerY={selections.warning?.darkerY}
          selectedDarkY={selections.warning?.darkY}
          onSelect={onSelectShadeY}
          onSelectShade={onSelectShade}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-warning-shades`}
          onGoPalette={onGoPalette}
        />
        <RowTints
          name="Success"
          baseHex={palette.success.hex}
          colorKey="success"
          showDiagnostics={showDiagnostics}
          selectedLighterIndex={selections.success?.lighterIndex}
          selectedLightIndex={selections.success?.lightIndex}
          onSelect={onSelectTintIndex}
          onSelectTint={onSelectTint}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-success`}
          onGoPalette={onGoPalette}
        />
        <RowShades
          name="Success"
          baseHex={palette.success.hex}
          colorKey="success"
          showDiagnostics={showDiagnostics}
          selectedDarkerY={selections.success?.darkerY}
          selectedDarkY={selections.success?.darkY}
          onSelect={onSelectShadeY}
          onSelectShade={onSelectShade}
          {...(textOnLightRgb ? { textOnLightRgb } : {})}
          {...(textOnDarkRgb ? { textOnDarkRgb } : {})}
          textOnLight={textOnLight}
          textOnDark={textOnDark}
          noticeBgHex={noticeBgHex}
          anchorId={`${anchorPrefix}luminance-success-shades`}
          onGoPalette={onGoPalette}
        />
      </div>
    </section>
  );
}
