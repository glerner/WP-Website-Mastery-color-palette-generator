import { hexToRgb, solveHslLightnessForY, rgbToHex, luminance, getContrastRatio } from './colorUtils';
import {
	LIGHT_MIN_Y_BASE,
	LIGHTER_MAX_Y,
	DARKER_MIN_Y,
	DARK_MAX_Y,
	Y_TARGET_DECIMALS,
	TINT_TARGET_COUNT,
	SHADE_TARGET_COUNT,
	MIN_DELTA_LUM_TINTS_FROM_WHITE,
	AAA_MIN,
	MAX_CONTRAST_TINTS,
	MAX_CONTRAST_SHADES,
	MIN_VARIATIONS_PER_BAND,
} from './config';

/**
 * A single color in a ribbon with all metadata
 */
export interface RibbonColor {
	hex: string;
	y: number;
	index: number;
}

/**
 * Generate ribbon colors for a single band.
 * This is the SINGLE SOURCE OF TRUTH for color generation.
 * Extracted from LuminanceTestStrips.tsx logic (lines 96-133 for tints, 361-403 for shades).
 *
 * @param baseHex - Base color in #RRGGBB format
 * @param band - Which band to generate ('lighter', 'light', 'dark', 'darker')
 * @param textOnLight - Text color for light backgrounds (near-black)
 * @param textOnDark - Text color for dark backgrounds (near-white)
 * @returns Array of 0-15 colors that meet AAA contrast requirements
 */
export function generateRibbonForBand(
	baseHex: string,
	band: 'lighter' | 'light' | 'dark' | 'darker',
	textOnLight: string,
	textOnDark: string
): RibbonColor[] {
	const baseRgb = hexToRgb(baseHex);
	const textOnLightRgb = hexToRgb(textOnLight);
	const textOnDarkRgb = hexToRgb(textOnDark);

	const luminanceIncrement = 0.005; // Luminance sampling granularity
	const rawLuminanceValues: number[] = [];

	if (band === 'lighter' || band === 'light') {
		// TINTS: Generate from LIGHT_MIN_Y_BASE to LIGHTER_MAX_Y
		// Filter for AAA contrast with text-on-light (near-black)
		const minY = LIGHT_MIN_Y_BASE;
		const maxY = LIGHTER_MAX_Y;

		// Sample at 0.005 granularity
		for (let luminanceValue = minY; luminanceValue <= maxY + 1e-9; luminanceValue += luminanceIncrement) {
			rawLuminanceValues.push(parseFloat(luminanceValue.toFixed(Y_TARGET_DECIMALS)));
		}

		// Filter for AAA contrast with textOnLight
		const aaaValidLuminances = rawLuminanceValues.filter((luminanceTarget: number) => {
			const rgb = solveHslLightnessForY(baseRgb, luminanceTarget);
			const contrast = getContrastRatio(rgb, textOnLightRgb);
			return contrast >= AAA_MIN && contrast <= MAX_CONTRAST_TINTS;
		}).sort((a: number, b: number) => a - b);

		if (aaaValidLuminances.length === 0) {
			return []; // No valid colors - text-on-light is invalid
		}

		// Sample evenly to get up to TINT_TARGET_COUNT (15) colors
		let unifiedLuminances: number[] = [];
		if (aaaValidLuminances.length >= TINT_TARGET_COUNT) {
			const picks: number[] = [];
			const stepIdx = (aaaValidLuminances.length - 1) / (TINT_TARGET_COUNT - 1);
			for (let i = 0; i < TINT_TARGET_COUNT; i++) {
				const idx = Math.round(i * stepIdx);
				const luminance = aaaValidLuminances[idx];
				if (luminance !== undefined) picks.push(parseFloat(luminance.toFixed(Y_TARGET_DECIMALS)));
			}
			unifiedLuminances = Array.from(new Set(picks));
		} else {
			// Use all valid colors, ensure min gap from white
			unifiedLuminances = aaaValidLuminances.filter((luminanceTarget: number, idx: number) => {
				if (idx === 0) return (1.0 - luminanceTarget) >= MIN_DELTA_LUM_TINTS_FROM_WHITE;
				return true;
			});
		}

		// Split into lighter (higher Y) and light (lower Y)
		const N = unifiedLuminances.length;
		if (N === 0) return [];

		let bandLuminances: number[];
		if (N <= 5) {
			const take = Math.max(0, N - 1);
			if (band === 'lighter') {
				// lighter = highest luminances
				bandLuminances = unifiedLuminances.slice(Math.max(0, N - take));
			} else {
				// light = lowest luminances
				bandLuminances = unifiedLuminances.slice(0, take);
			}
		} else {
			const base = Math.max(0, Math.floor(N / 2) - 1);
			const overlap = Math.max(0, N - 2 * base);
			if (band === 'lighter') {
				// lighter = highest luminances (top half + overlap)
				bandLuminances = unifiedLuminances.slice(Math.max(0, N - (base + overlap)));
			} else {
				// light = lowest luminances (bottom half + overlap)
				bandLuminances = unifiedLuminances.slice(0, base + overlap);
			}
		}

		// Convert luminance targets to actual colors
		return bandLuminances.map((targetLuminance, ribbonIndex) => {
			const rgb = solveHslLightnessForY(baseRgb, targetLuminance);
			const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
			const actualLuminance = luminance(rgb.r, rgb.g, rgb.b);
			return { hex, y: actualLuminance, index: ribbonIndex };
		});

	} else {
		// SHADES: Generate from DARKER_MIN_Y to DARK_MAX_Y
		// Filter for AAA contrast with text-on-dark (near-white)
		const minY = DARKER_MIN_Y;
		const maxY = DARK_MAX_Y;

		// Sample at 0.005 granularity
		for (let luminanceValue = minY; luminanceValue <= maxY + 1e-9; luminanceValue += luminanceIncrement) {
			rawLuminanceValues.push(parseFloat(luminanceValue.toFixed(Y_TARGET_DECIMALS)));
		}

		// Filter for AAA contrast with textOnDark
		const aaaValidLuminances = rawLuminanceValues.filter((luminanceTarget: number) => {
			const rgb = solveHslLightnessForY(baseRgb, luminanceTarget);
			const contrast = getContrastRatio(rgb, textOnDarkRgb);
			return contrast >= AAA_MIN && contrast <= MAX_CONTRAST_SHADES;
		}).sort((a: number, b: number) => a - b);

		if (aaaValidLuminances.length === 0) {
			return []; // No valid colors - text-on-dark is invalid
		}

		// Sample evenly to get up to SHADE_TARGET_COUNT (15) colors
		let unifiedLuminances: number[] = [];
		if (aaaValidLuminances.length >= SHADE_TARGET_COUNT) {
			const picks: number[] = [];
			const stepIdx = (aaaValidLuminances.length - 1) / (SHADE_TARGET_COUNT - 1);
			for (let i = 0; i < SHADE_TARGET_COUNT; i++) {
				const idx = Math.round(i * stepIdx);
				const luminance = aaaValidLuminances[idx];
				if (luminance !== undefined) picks.push(parseFloat(luminance.toFixed(Y_TARGET_DECIMALS)));
			}
			unifiedLuminances = Array.from(new Set(picks));
		} else {
			unifiedLuminances = aaaValidLuminances;
		}

		// Split into darker (lower Y) and dark (higher Y)
		const N = unifiedLuminances.length;
		if (N === 0) return [];

		let bandLuminances: number[];
		if (N <= 5) {
			const take = Math.max(0, N - 1);
			if (band === 'darker') {
				// darker = lowest luminances
				bandLuminances = unifiedLuminances.slice(0, take);
			} else {
				// dark = highest luminances
				bandLuminances = unifiedLuminances.slice(Math.max(0, N - take));
			}
		} else {
			const base = Math.max(0, Math.floor(N / 2) - 1);
			const overlap = Math.max(0, N - 2 * base);
			if (band === 'darker') {
				// darker = lowest luminances (bottom half + overlap)
				bandLuminances = unifiedLuminances.slice(0, base + overlap);
			} else {
				// dark = highest luminances (top half + overlap)
				bandLuminances = unifiedLuminances.slice(Math.max(0, N - (base + overlap)));
			}
		}

		// Convert luminance targets to actual colors
		return bandLuminances.map((targetLuminance, ribbonIndex) => {
			const rgb = solveHslLightnessForY(baseRgb, targetLuminance);
			const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
			const actualLuminance = luminance(rgb.r, rgb.g, rgb.b);
			return { hex, y: actualLuminance, index: ribbonIndex };
		});
	}
}

/**
 * Validate that ribbons have enough colors.
 * Returns validation result with errors if any band has < 3 colors.
 */
export function validateRibbons(ribbons: Record<string, Record<string, RibbonColor[]>>): {
	valid: boolean;
	errors: string[];
	summary?: string;
} {
	const errors: string[] = [];
	let insufficientCount = 0;

	Object.entries(ribbons).forEach(([colorKey, bands]) => {
		Object.entries(bands).forEach(([band, colors]) => {
			if (colors.length < MIN_VARIATIONS_PER_BAND) {
				insufficientCount++;
				errors.push(`${colorKey}-${band}: ${colors.length} colors`);
			}
		});
	});

	// Create short summary for toast
	const result: { valid: boolean; errors: string[]; summary?: string } = {
		valid: errors.length === 0,
		errors
	};

	if (insufficientCount > 0) {
		result.summary = `Text colors invalid: ${insufficientCount} bands have too few colors. Click the color swatch to open HSL editor, then decrease L (lightness) for text-on-light or increase L for text-on-dark.`;
	}

	return result;
}
