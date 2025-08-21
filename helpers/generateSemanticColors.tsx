import { Palette, PaletteWithVariations } from './types';
import { hexToRgb, rgbToHslNorm, hslNormToRgb, rgbToHex, luminance } from './colorUtils';

// Choose a hue near a target but avoid being too close to existing hues. If too close, fallback to a triad of primary.
function chooseHue(targetHue: number, existingHues: number[], primaryHue: number): number {
  const norm = (h: number) => (h % 360 + 360) % 360;
  const dist = (a: number, b: number) => {
    const d = Math.abs(norm(a) - norm(b));
    return Math.min(d, 360 - d);
  };
  const tooClose = existingHues.some((h) => dist(h, targetHue) < 18);
  if (!tooClose) return norm(targetHue);
  // Try spaced candidates around primary that avoid common analogous/complement overlaps
  const candidates = [primaryHue + 60, primaryHue + 120, primaryHue + 240, primaryHue + 300];
  let best = norm(candidates[0]);
  let bestScore = -1;
  for (const c of candidates) {
    const cNorm = norm(c);
    const minD = Math.min(...existingHues.map((h) => dist(h, cNorm)));
    if (minD > bestScore) { bestScore = minD; best = cNorm; }
  }
  return best;
}

function buildSemantic(base: Palette): Pick<Palette, 'error' | 'warning' | 'success'> {
  // Extract palette hues
  const hues: number[] = [];
  ['primary','secondary','tertiary','accent'].forEach((k) => {
    const rgb = hexToRgb((base as any)[k].hex);
    const { h } = rgbToHslNorm(rgb.r, rgb.g, rgb.b);
    hues.push(h);
  });
  const primaryHue = hues[0] ?? 0;

  const pickColor = (targetHue: number, sat = 0.86, light = 0.44) => {
    const hue = chooseHue(targetHue, hues, primaryHue);
    const rgb = hslNormToRgb(hue, sat, light);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    return { name: '', hex };
  };

  // Red-ish, yellow-ish, green-ish initial targets
  const error = pickColor(8, 0.86, 0.44);
  error.name = 'Error';
  const warning = pickColor(48, 0.92, 0.58);
  warning.name = 'Warning';
  const success = pickColor(145, 0.62, 0.40);
  success.name = 'Success';

  return { error, warning, success };
}

export function generateSemanticColors(base: Palette): Palette {
  const isHex = (v?: string) => !!v && /^#[0-9a-f]{6}$/i.test(v);
  const sem = buildSemantic(base);
  const errorHex = isHex((base as any).error?.hex) ? (base as any).error.hex : sem.error.hex;
  const warningHex = isHex((base as any).warning?.hex) ? (base as any).warning.hex : sem.warning.hex;
  const successHex = isHex((base as any).success?.hex) ? (base as any).success.hex : sem.success.hex;
  return {
    ...base,
    error: { name: 'Error', hex: errorHex },
    warning: { name: 'Warning', hex: warningHex },
    success: { name: 'Success', hex: successHex },
  };
}
