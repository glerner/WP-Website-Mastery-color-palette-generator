import { hexToRgb, getContrastRatio } from './colorUtils';
import {
  AAA_MIN,
  NEAR_BLACK_HEX,
  NEAR_WHITE_HEX,
  NEAR_BLACK_RGB,
  NEAR_WHITE_RGB,
} from './config';

// Overlay colors to be applied on the background to enhance contrast (should never be needed, used for error trapping)
const DARK_OVERLAY = 'rgba(0, 0, 0, 0.55)'; // For light backgrounds
const LIGHT_OVERLAY = 'rgba(255, 255, 255, 0.55)'; // For dark backgrounds

export interface ContrastSolution {
  textColor: string;
  overlayColor?: string;
}

/**
 * Ensures text has AAA contrast (≥7:1) against a given background color.
 * It checks both black and white text, and if neither meets the standard,
 * it returns the better of the two along with a recommended overlay color
 * to be applied to the background to boost contrast.
 *
 * @param backgroundColor - The background color in hex format (e.g., "#RRGGBB").
 * @returns An object containing the optimal `textColor` ('#000000' or '#FFFFFF')
 *          and an optional `overlayColor` if AAA contrast isn't met directly.
 */
export const ensureAAAContrast = (backgroundColor: string): ContrastSolution => {
  const backgroundRgb = hexToRgb(backgroundColor);

  const contrastWithNearWhite = getContrastRatio(backgroundRgb, NEAR_WHITE_RGB);
  const contrastWithNearBlack = getContrastRatio(backgroundRgb, NEAR_BLACK_RGB);

  // Prefer the text color that meets its required threshold
  if (contrastWithNearWhite >= AAA_MIN) {
    return { textColor: NEAR_WHITE_HEX };
  }

  if (contrastWithNearBlack >= AAA_MIN) {
    return { textColor: NEAR_BLACK_HEX };
  }

  // Neither meets AAA. Return better option and suggest an overlay to push background
  if (contrastWithNearBlack > contrastWithNearWhite) {
    // Near-black text is better. Suggest light overlay to lighten background further.
    return {
      textColor: NEAR_BLACK_HEX,
      overlayColor: LIGHT_OVERLAY,
    };
  } else {
    // Near-white text is better. Suggest dark overlay to darken background.
    return {
      textColor: NEAR_WHITE_HEX,
      overlayColor: DARK_OVERLAY,
    };
  }
};
