export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('')
  );
};

// WCAG relative luminance calculation
export const luminance = (r: number, g: number, b: number): number => {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
};

export const getContrastRatio = (
  rgb1: { r: number; g: number; b: number },
  rgb2: { r: number; g: number; b: number }
): number => {
  const lum1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = luminance(rgb2.r, rgb2.g, rgb2.b);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return parseFloat(((brightest + 0.05) / (darkest + 0.05)).toFixed(2));
};

import { AAA_MIN, AA_SMALL_MIN } from './config';

export const getContrastLevel = (ratio: number): 'AAA' | 'AA' | 'FAIL' => {
  // Compare only against centralized thresholds from helpers/config.ts
  if (ratio >= AAA_MIN) return 'AAA';
  if (ratio >= AA_SMALL_MIN) return 'AA';
  return 'FAIL';
};

// HSL helpers (normalized ranges: H [0, 360), S/L [0,1])
export const rgbToHslNorm = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  return { h: (h * 360 + 360) % 360, s, l };
};

export const hslNormToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const Hp = (h % 360) / 60;
  const X = C * (1 - Math.abs((Hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (0 <= Hp && Hp < 1) { r1 = C; g1 = X; b1 = 0; }
  else if (1 <= Hp && Hp < 2) { r1 = X; g1 = C; b1 = 0; }
  else if (2 <= Hp && Hp < 3) { r1 = 0; g1 = C; b1 = X; }
  else if (3 <= Hp && Hp < 4) { r1 = 0; g1 = X; b1 = C; }
  else if (4 <= Hp && Hp < 5) { r1 = X; g1 = 0; b1 = C; }
  else { r1 = C; g1 = 0; b1 = X; }
  const m = l - C / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return { r: Math.max(0, Math.min(255, r)), g: Math.max(0, Math.min(255, g)), b: Math.max(0, Math.min(255, b)) };
};

// Solve for HSL lightness that yields a target luminance Y while holding H and S constant.
export const solveHslLightnessForY = (
  baseRgb: { r: number; g: number; b: number },
  targetY: number,
  opts: { eps?: number; maxIters?: number; relaxSaturation?: boolean } = {}
): { r: number; g: number; b: number } => {
  const { h, s } = rgbToHslNorm(baseRgb.r, baseRgb.g, baseRgb.b);
  const eps = opts.eps ?? 0.001;
  const maxIters = opts.maxIters ?? 22;
  let low = 0, high = 1;
  let best = hslNormToRgb(h, s, 0.5);
  let bestDiff = Math.abs(luminance(best.r, best.g, best.b) - targetY);
  for (let i = 0; i < maxIters; i++) {
    const mid = (low + high) / 2;
    const rgb = hslNormToRgb(h, s, mid);
    const y = luminance(rgb.r, rgb.g, rgb.b);
    const diff = Math.abs(y - targetY);
    if (diff < bestDiff) { best = rgb; bestDiff = diff; }
    if (diff < eps) break;
    if (y < targetY) low = mid; else high = mid;
  }
  // Optional mild saturation relaxation if we missed by a lot
  if (bestDiff > eps && opts.relaxSaturation) {
    let sCur = s;
    for (let k = 0; k < 6 && sCur > 0.1 && bestDiff > eps; k++) {
      sCur *= 0.96;
      let low2 = 0, high2 = 1;
      for (let i = 0; i < Math.floor(maxIters / 2); i++) {
        const mid = (low2 + high2) / 2;
        const rgb = hslNormToRgb(h, sCur, mid);
        const y = luminance(rgb.r, rgb.g, rgb.b);
        const diff = Math.abs(y - targetY);
        if (diff < bestDiff) { best = rgb; bestDiff = diff; }
        if (y < targetY) low2 = mid; else high2 = mid;
      }
    }
  }
  return best;
};

// Solve for RGB given explicit H and S that achieves a target WCAG luminance (Y) by binary-searching L.
// Units: h in [0,360), s in [0,1], targetY in [0,1].
export const solveHslLightnessForYFromHS = (
  h: number,
  s: number,
  targetY: number,
  opts: { eps?: number; maxIters?: number } = {}
): { r: number; g: number; b: number } => {
  const eps = opts.eps ?? 0.001;
  const maxIters = opts.maxIters ?? 22;
  let low = 0, high = 1;
  let best = hslNormToRgb(h, s, 0.5);
  let bestDiff = Math.abs(luminance(best.r, best.g, best.b) - targetY);
  for (let i = 0; i < maxIters; i++) {
    const mid = (low + high) / 2;
    const rgb = hslNormToRgb(h, s, mid);
    const y = luminance(rgb.r, rgb.g, rgb.b);
    const diff = Math.abs(y - targetY);
    if (diff < bestDiff) { best = rgb; bestDiff = diff; }
    if (diff < eps) break;
    if (y < targetY) low = mid; else high = mid;
  }
  return best;
};

// Convenience: given Primary's band color (to read its saturation), target hue, and target band Y,
// build a color that matches Primary's saturation while hitting the target luminance at the new hue.
export const matchBandFromPrimaryByS = (
  primaryBandRgb: { r: number; g: number; b: number },
  targetHueDeg: number,
  targetY: number,
  opts: { eps?: number; maxIters?: number } = {}
) => {
  const { s } = rgbToHslNorm(primaryBandRgb.r, primaryBandRgb.g, primaryBandRgb.b);
  return solveHslLightnessForYFromHS(((targetHueDeg % 360) + 360) % 360, s, targetY, opts);
};

// Contrast-aware Y nudger that stays HSL-locked (moves Y, re-solves L each step)
const adjustHslLockedForContrast = (
  baseRgb: { r: number; g: number; b: number },
  initialY: number,
  prefer: 'black' | 'white'
) => {
  const step = 0.005;
  const minY = 0.02;
  const maxY = 0.98;
  let y = initialY;
  const targetTextRgb = prefer === 'black' ? NEAR_BLACK_RGB : NEAR_WHITE_RGB;
  const minContrast = AAA_MIN;
  const MAX_CAP = prefer === 'black' ? MAX_CONTRAST_TINTS : MAX_CONTRAST_SHADES;

  const move = prefer === 'black' ? (yy: number) => Math.min(maxY, yy + step) : (yy: number) => Math.max(minY, yy - step);
  let best = solveHslLightnessForY(baseRgb, y);
  let bestY = luminance(best.r, best.g, best.b);
  let contrast = getContrastRatio(best, targetTextRgb);
  for (let i = 0; i < 200 && (contrast < minContrast || contrast > MAX_CAP); i++) {
    if (contrast < minContrast) {
      y = move(y);
    } else if (contrast > MAX_CAP) {
      y = prefer === 'black' ? Math.max(minY, y - step) : Math.min(maxY, y + step);
    }
    const candidate = solveHslLightnessForY(baseRgb, y);
    best = candidate;
    bestY = luminance(best.r, best.g, best.b);
    contrast = getContrastRatio(best, targetTextRgb);
    if (y === minY || y === maxY) break;
  }
  const meetsAAA = contrast >= minContrast && contrast <= MAX_CAP;
  const meetsAA = contrast >= AA_SMALL_MIN;
  return { rgb: best, y: bestY, contrast, meetsAAA, meetsAA };
};

// Convert RGB to LAB color space for perceptual lightness
const rgbToLab = (r: number, g: number, b: number): { labL: number; labA: number; labB: number } => {
  // Convert RGB to XYZ
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  // Apply gamma correction
  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  // Convert to XYZ using D65 illuminant
  const x = (rNorm * 0.4124 + gNorm * 0.3576 + bNorm * 0.1805) / 0.95047;
  const y = (rNorm * 0.2126 + gNorm * 0.7152 + bNorm * 0.0722) / 1.00000;
  const z = (rNorm * 0.0193 + gNorm * 0.1192 + bNorm * 0.9505) / 1.08883;

  // Convert XYZ to LAB
  const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
  const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
  const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);

  const labL = 116 * fy - 16;
  const labA = 500 * (fx - fy);
  const labB = 200 * (fy - fz);

  return { labL, labA, labB };
};

// Convert LAB back to RGB
const labToRgb = (labL: number, labA: number, labB: number): { r: number; g: number; b: number } => {
  // Convert LAB to XYZ
  const fy = (labL + 16) / 116;
  const fx = labA / 500 + fy;
  const fz = fy - labB / 200;

  const x = (fx > 0.206897 ? Math.pow(fx, 3) : (fx - 16/116) / 7.787) * 0.95047;
  const y = (fy > 0.206897 ? Math.pow(fy, 3) : (fy - 16/116) / 7.787) * 1.00000;
  const z = (fz > 0.206897 ? Math.pow(fz, 3) : (fz - 16/116) / 7.787) * 1.08883;

  // Convert XYZ to RGB
  let rResult = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let gResult = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bResult = x * 0.0557 + y * -0.2040 + z * 1.0570;

  // Apply inverse gamma correction
  rResult = rResult > 0.0031308 ? 1.055 * Math.pow(rResult, 1/2.4) - 0.055 : 12.92 * rResult;
  gResult = gResult > 0.0031308 ? 1.055 * Math.pow(gResult, 1/2.4) - 0.055 : 12.92 * gResult;
  bResult = bResult > 0.0031308 ? 1.055 * Math.pow(bResult, 1/2.4) - 0.055 : 12.92 * bResult;

  // Clamp to valid RGB range
  rResult = Math.max(0, Math.min(255, Math.round(rResult * 255)));
  gResult = Math.max(0, Math.min(255, Math.round(gResult * 255)));
  bResult = Math.max(0, Math.min(255, Math.round(bResult * 255)));

  return { r: rResult, g: gResult, b: bResult };
};

// Adjust color to target WCAG luminance using binary search
const adjustToTargetLuminance = (baseRgb: { r: number; g: number; b: number }, targetLuminance: number): { r: number; g: number; b: number } => {
  const baseLab = rgbToLab(baseRgb.r, baseRgb.g, baseRgb.b);
  const currentLuminance = luminance(baseRgb.r, baseRgb.g, baseRgb.b);

  // If already close to target, return as-is
  if (Math.abs(currentLuminance - targetLuminance) < 0.01) {
    return baseRgb;
  }

  // Binary search for the right LAB lightness
  let lowL = targetLuminance < currentLuminance ? 0 : baseLab.labL;
  let highL = targetLuminance < currentLuminance ? baseLab.labL : 100;
  let bestRgb = baseRgb;
  let bestDiff = Math.abs(currentLuminance - targetLuminance);

  for (let i = 0; i < 20; i++) { // Limit iterations
    const testL = (lowL + highL) / 2;
    const testRgb = labToRgb(testL, baseLab.labA, baseLab.labB);
    const testLuminance = luminance(testRgb.r, testRgb.g, testRgb.b);
    const diff = Math.abs(testLuminance - targetLuminance);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestRgb = testRgb;
    }

    if (diff < 0.005) break; // Good enough

    if (testLuminance < targetLuminance) {
      lowL = testL;
    } else {
      highL = testL;
    }
  }

  return bestRgb;
};

import {
  TARGET_LUM_LIGHTER,
  TARGET_LUM_LIGHT,
  TARGET_LUM_DARK,
  TARGET_LUM_DARKER,
  MIN_DELTA_LUM_TINTS_FROM_WHITE,
  MIN_DELTA_LUM_TINTS,
  MIN_DELTA_LUM_SHADES,
  NEAR_BLACK_RGB,
  NEAR_WHITE_RGB,
  MAX_CONTRAST_TINTS,
  MAX_CONTRAST_SHADES,
} from './config';

// Use centralized thresholds

type StepTag = 'lighter' | 'light' | 'dark' | 'darker';

// Nudge luminance toward extreme to meet contrast without exceeding max recommended.
const adjustLuminanceForContrast = (
  baseRgb: { r: number; g: number; b: number },
  initialY: number,
  prefer: 'black' | 'white'
) => {
  const step = 0.005;
  const minY = 0.02;
  const maxY = 0.98;
  let y = initialY;
  const targetTextRgb = prefer === 'black' ? NEAR_BLACK_RGB : NEAR_WHITE_RGB;
  const minContrast = AAA_MIN;
  const MAX_CAP = prefer === 'black' ? MAX_CONTRAST_TINTS : MAX_CONTRAST_SHADES;

  // Move lighter up if prefer black; move darker down if prefer white
  const move = prefer === 'black' ? (yy: number) => Math.min(maxY, yy + step) : (yy: number) => Math.max(minY, yy - step);

  let best = adjustToTargetLuminance(baseRgb, y);
  let bestY = luminance(best.r, best.g, best.b);
  let contrast = getContrastRatio(best, targetTextRgb);

  // Try improving until we hit thresholds or bounds
  for (let i = 0; i < 200 && (contrast < minContrast || contrast > MAX_CAP); i++) {
    // If contrast too low, keep moving toward preferred direction; if too high, gently back off
    if (contrast < minContrast) {
      y = move(y);
    } else if (contrast > MAX_CAP) {
      // back off slightly in opposite direction
      y = prefer === 'black' ? Math.max(minY, y - step) : Math.min(maxY, y + step);
    }
    const candidate = adjustToTargetLuminance(baseRgb, y);
    best = candidate;
    bestY = luminance(best.r, best.g, best.b);
    contrast = getContrastRatio(best, targetTextRgb);
    if (y === minY || y === maxY) break;
  }

  const meetsAAA = contrast >= minContrast && contrast <= MAX_CAP;
  const meetsAA = contrast >= AA_SMALL_MIN;
  return { rgb: best, y: bestY, contrast, meetsAAA, meetsAA };
};

export const generateShades = (
  hex: string,
  colorName: string = 'Color',
  opts?: { targetLighterY?: number; targetLightY?: number; targetDarkY?: number; targetDarkerY?: number }
) => {
  const baseRgb = hexToRgb(hex);
  const baseY = luminance(baseRgb.r, baseRgb.g, baseRgb.b);

  // Inform if base is extreme
  if (baseY >= 0.95) {
    console.warn(`${colorName}: Base color is very light (Y=${baseY.toFixed(3)}). Generating darker shades to ensure contrast.`);
  } else if (baseY <= 0.05) {
    console.warn(`${colorName}: Base color is very dark (Y=${baseY.toFixed(3)}). Generating lighter tints to ensure contrast.`);
  }

  // Target the requested bands; if user provided targets, respect them exactly
  // Otherwise, adjust for contrast around the defaults
  const tLighter = opts?.targetLighterY ?? TARGET_LUM_LIGHTER;
  const tLight = opts?.targetLightY ?? TARGET_LUM_LIGHT;
  const tDark = opts?.targetDarkY ?? TARGET_LUM_DARK;
  const tDarker = opts?.targetDarkerY ?? TARGET_LUM_DARKER;
  const userSetLighter = opts?.targetLighterY != null;
  const userSetLight = opts?.targetLightY != null;
  const userSetDark = opts?.targetDarkY != null;
  const userSetDarker = opts?.targetDarkerY != null;

  const lighterAdj = userSetLighter
    ? { rgb: solveHslLightnessForY(baseRgb, tLighter), y: tLighter, contrast: 0, meetsAAA: true, meetsAA: true }
    : adjustHslLockedForContrast(baseRgb, tLighter, 'black');
  const lightAdj = userSetLight
    ? { rgb: solveHslLightnessForY(baseRgb, tLight), y: tLight, contrast: 0, meetsAAA: true, meetsAA: true }
    : adjustHslLockedForContrast(baseRgb, tLight, 'black');
  const darkAdj = userSetDark
    ? { rgb: solveHslLightnessForY(baseRgb, tDark), y: tDark, contrast: 0, meetsAAA: true, meetsAA: true }
    : adjustHslLockedForContrast(baseRgb, tDark, 'white');
  const darkerAdj = userSetDarker
    ? { rgb: solveHslLightnessForY(baseRgb, tDarker), y: tDarker, contrast: 0, meetsAAA: true, meetsAA: true }
    : adjustHslLockedForContrast(baseRgb, tDarker, 'white');

  // Enforce distinctness between lighter/light and dark/darker
  let yLighter = lighterAdj.y;
  let yLight = lightAdj.y;
  if (yLighter - yLight < MIN_DELTA_LUM_TINTS) {
    const userSetLighter = opts?.targetLighterY != null;
    const userSetLight = opts?.targetLightY != null;
    if (userSetLighter || userSetLight) {
      // At least one provided by user/picker; do not auto-nudge to a non-picker Y. Keep as-is and let UI warn.
    } else {
      // Neither explicitly provided by user; we may gently enforce minimum distinctness by moving lighter above light.
      const targetUp = Math.min(0.98, yLight + MIN_DELTA_LUM_TINTS);
      const nudged = adjustLuminanceForContrast(baseRgb, targetUp, 'black');
      yLighter = nudged.y; // avoid pulling light down
    }
  }

  let yDark = darkAdj.y;
  let yDarker = darkerAdj.y;
  // Preserve picker-provided selections exactly. Only adjust when neither value was explicitly provided.
  if (yDark - yDarker < MIN_DELTA_LUM_SHADES) {
    if (userSetDark && userSetDarker) {
      // Both provided by user; keep as-is even if too close.
    } else if (userSetDark && !userSetDarker) {
      // Keep user's dark; leave darker as selected if provided, otherwise do not nudge here to avoid non-picker Y.
      // No-op: rely on UI warnings instead of auto-nudging.
    } else if (!userSetDark && userSetDarker) {
      // Keep user's darker; do not auto-nudge dark to a non-picker value.
      // No-op.
    } else {
      // Neither explicitly provided by user; we can gently enforce minimum distinctness.
      const targetDown = Math.max(0.02, yDark - MIN_DELTA_LUM_SHADES);
      const nudged = adjustLuminanceForContrast(baseRgb, targetDown, 'white');
      if (nudged.meetsAA) {
        yDarker = nudged.y;
      } else {
        const targetUp = Math.min(0.98, yDarker + MIN_DELTA_LUM_SHADES);
        const nudgedUp = adjustLuminanceForContrast(baseRgb, targetUp, 'white');
        yDark = nudgedUp.y;
      }
    }
  }

  // Recompute colors at the settled luminances
  let lighterRgb = solveHslLightnessForY(baseRgb, yLighter);
  let lightRgb = solveHslLightnessForY(baseRgb, yLight);
  const darkRgb = solveHslLightnessForY(baseRgb, yDark);
  const darkerRgb = solveHslLightnessForY(baseRgb, yDarker);

  // Post-process: if lighter and light collapse to same hex, nudge to enforce visual distinctness
  const toHex = (rgb: { r:number; g:number; b:number }) => rgbToHex(rgb.r, rgb.g, rgb.b);
  if (toHex(lighterRgb) === toHex(lightRgb)) {
    const userSetLighter = opts?.targetLighterY != null;
    const userSetLight = opts?.targetLightY != null;
    const nudge = 0.03;
    if (userSetLighter && userSetLight) {
      console.warn(`${colorName} tints: selected lighter and light collapsed to same color. Keeping user selections as-is.`);
    } else if (userSetLighter && !userSetLight) {
      // Preserve lighter; nudge light down
      const tryDown = Math.max(0.02, yLight - Math.max(nudge, MIN_DELTA_LUM_TINTS / 2));
      const downRgb = solveHslLightnessForY(baseRgb, tryDown);
      if (toHex(downRgb) !== toHex(lighterRgb)) {
        lightRgb = downRgb;
        yLight = luminance(downRgb.r, downRgb.g, downRgb.b);
      }
    } else if (!userSetLighter && userSetLight) {
      // Preserve light; nudge lighter up
      const tryUp = Math.min(0.98, yLighter + Math.max(nudge, MIN_DELTA_LUM_TINTS / 2));
      const upRgb = solveHslLightnessForY(baseRgb, tryUp);
      if (toHex(upRgb) !== toHex(lightRgb)) {
        lighterRgb = upRgb;
        yLighter = luminance(upRgb.r, upRgb.g, upRgb.b);
      }
    } else {
      // No explicit user targets; default heuristic
      const tryUp = Math.min(0.98, yLighter + Math.max(nudge, MIN_DELTA_LUM_TINTS / 2));
      const upRgb = solveHslLightnessForY(baseRgb, tryUp);
      if (toHex(upRgb) !== toHex(lightRgb)) {
        lighterRgb = upRgb;
        yLighter = luminance(upRgb.r, upRgb.g, upRgb.b);
      } else {
        const tryDown = Math.max(0.02, yLight - Math.max(nudge, MIN_DELTA_LUM_TINTS / 2));
        const downRgb = solveHslLightnessForY(baseRgb, tryDown);
        if (toHex(downRgb) !== toHex(lighterRgb)) {
          lightRgb = downRgb;
          yLight = luminance(downRgb.r, downRgb.g, downRgb.b);
        }
      }
    }
  }

  const items = [
    { step: 'lighter' as StepTag, rgb: lighterRgb, y: luminance(lighterRgb.r, lighterRgb.g, lighterRgb.b) },
    { step: 'light' as StepTag, rgb: lightRgb, y: luminance(lightRgb.r, lightRgb.g, lightRgb.b) },
    { step: 'dark' as StepTag, rgb: darkRgb, y: luminance(darkRgb.r, darkRgb.g, darkRgb.b) },
    { step: 'darker' as StepTag, rgb: darkerRgb, y: luminance(darkerRgb.r, darkerRgb.g, darkerRgb.b) },
  ];

  // Validate contrast bands and log notices
  const tints = items.filter(i => i.step === 'lighter' || i.step === 'light');
  const shades = items.filter(i => i.step === 'dark' || i.step === 'darker');

  const checkBand = (band: typeof items, prefer: 'black' | 'white', label: string) => {
    const textRgb = prefer === 'black' ? NEAR_BLACK_RGB : NEAR_WHITE_RGB;
    const minContrast = AAA_MIN;
    const MAX_CAP = prefer === 'black' ? MAX_CONTRAST_TINTS : MAX_CONTRAST_SHADES;
    const ratios = band.map(i => getContrastRatio(i.rgb, textRgb));
    const allAAA = ratios.every(r => r >= minContrast && r <= MAX_CAP);
    const allAA = ratios.every(r => r >= AA_SMALL_MIN);
    if (!allAAA) {
      if (allAA) {
        console.warn(`${colorName} ${label}: AAA contrast could not be achieved while keeping 2 distinct ${label}. Falling back to highest possible contrast ≥ AA.`);
      } else {
        console.warn(`${colorName} ${label}: Could not reach AA for small text at both levels; selected the highest achievable contrast while keeping them visually distinct.`);
      }
    }
  };

  checkBand(tints, 'black', 'tints');
  checkBand(shades, 'white', 'shades');

  // Map to final output in fixed logical order: lighter, light, dark, darker
  const stepOrder: StepTag[] = ['lighter', 'light', 'dark', 'darker'];
  const finalShades = stepOrder
    .map(step => items.find(i => i.step === step)!)
    .map(variation => ({
      name: `${colorName}-${variation.step}`,
      hex: rgbToHex(variation.rgb.r, variation.rgb.g, variation.rgb.b),
      step: variation.step,
    }));

  return finalShades;
};
