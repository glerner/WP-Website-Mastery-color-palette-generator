import React, { useMemo, useState } from 'react';
import styles from './LightDarkPreview.module.css';
import type { PaletteWithVariations } from '../helpers/types';
import { ensureAAAContrast } from '../helpers/ensureAAAContrast';
import { chooseForeground } from '../helpers/themeRuntime';

type Props = {
  palette: PaletteWithVariations;
  textOnLight: string; // hex
  textOnDark: string; // hex
  scheme?: 'auto' | 'light' | 'dark';
  onSchemeChange?: (s: 'auto' | 'light' | 'dark') => void;
  semanticBandSelection?: {
    error: { light: 'lighter' | 'light' | 'dark' | 'darker'; dark: 'lighter' | 'light' | 'dark' | 'darker' };
    warning: { light: 'lighter' | 'light' | 'dark' | 'darker'; dark: 'lighter' | 'light' | 'dark' | 'darker' };
    success: { light: 'lighter' | 'light' | 'dark' | 'darker'; dark: 'lighter' | 'light' | 'dark' | 'darker' };
  };
  children?: React.ReactNode;
};

export const LightDarkPreview: React.FC<Props> = ({ palette, textOnLight, textOnDark, scheme: schemeProp, onSchemeChange, semanticBandSelection, children }) => {
  const [internalScheme, setInternalScheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const scheme = schemeProp ?? internalScheme;
  const setScheme = (s: 'auto' | 'light' | 'dark') => {
    if (onSchemeChange) onSchemeChange(s);
    else setInternalScheme(s);
  };

  // Find variation by step property (not by name matching)
  const findStep = (family: keyof PaletteWithVariations, step: 'lighter' | 'light' | 'dark' | 'darker') => {
    const v = palette[family].variations || [];
    const match = v.find((x) => x.step === step);
    return match?.hex || null;
  };

  const vars = useMemo(() => {
    // Get colors from actual palette variations using step property
    const primaryLight = findStep('primary', 'light') || palette.primary.hex;
    const primaryDark = findStep('primary', 'dark') || palette.primary.hex;
    const primaryDarker = findStep('primary', 'darker') || palette.primary.hex;
    const primaryLighter = findStep('primary', 'lighter') || palette.primary.hex;
    const secondaryLight = findStep('secondary', 'light') || palette.secondary.hex;
    const secondaryDark = findStep('secondary', 'dark') || palette.secondary.hex;
    const secondaryDarker = findStep('secondary', 'darker') || palette.secondary.hex;
    const secondaryLighter = findStep('secondary', 'lighter') || palette.secondary.hex;
    const tertiaryLight = findStep('tertiary', 'light') || palette.tertiary.hex;
    const tertiaryDark = findStep('tertiary', 'dark') || palette.tertiary.hex;
    const tertiaryDarker = findStep('tertiary', 'darker') || palette.tertiary.hex;
    const tertiaryLighter = findStep('tertiary', 'lighter') || palette.tertiary.hex;
    const accentLight = findStep('accent', 'light') || palette.accent.hex;
    const accentDark = findStep('accent', 'dark') || palette.accent.hex;
    const accentDarker = findStep('accent', 'darker') || palette.accent.hex;
    const accentLighter = findStep('accent', 'lighter') || palette.accent.hex;

    const SEMANTIC_DEFAULTS = {
      error: { light: 'light' as const, dark: 'dark' as const },
      warning: { light: 'light' as const, dark: 'dark' as const },
      success: { light: 'light' as const, dark: 'dark' as const },
    };
    const sem = semanticBandSelection ?? SEMANTIC_DEFAULTS;
    const errorLight = findStep('error', sem.error.light) || palette.error.hex;
    const errorDark = findStep('error', sem.error.dark) || palette.error.hex;
    const noticeLight = findStep('warning', sem.warning.light) || palette.warning.hex;
    const noticeDark = findStep('warning', sem.warning.dark) || palette.warning.hex;
    const successLight = findStep('success', sem.success.light) || palette.success.hex;
    const successDark = findStep('success', sem.success.dark) || palette.success.hex;

    // Calculate text colors for each background color
    const primaryLightText = ensureAAAContrast(primaryLight).textColor;
    const primaryDarkText = ensureAAAContrast(primaryDark).textColor;
    const primaryDarkerText = ensureAAAContrast(primaryDarker).textColor;
    const primaryLighterText = ensureAAAContrast(primaryLighter).textColor;
    const secondaryLightText = ensureAAAContrast(secondaryLight).textColor;
    const secondaryDarkText = ensureAAAContrast(secondaryDark).textColor;
    const secondaryDarkerText = ensureAAAContrast(secondaryDarker).textColor;
    const secondaryLighterText = ensureAAAContrast(secondaryLighter).textColor;
    const tertiaryLightText = ensureAAAContrast(tertiaryLight).textColor;
    const tertiaryDarkText = ensureAAAContrast(tertiaryDark).textColor;
    const tertiaryDarkerText = ensureAAAContrast(tertiaryDarker).textColor;
    const tertiaryLighterText = ensureAAAContrast(tertiaryLighter).textColor;
    const accentLightText = ensureAAAContrast(accentLight).textColor;
    const accentDarkText = ensureAAAContrast(accentDark).textColor;
    const accentDarkerText = ensureAAAContrast(accentDarker).textColor;
    const accentLighterText = ensureAAAContrast(accentLighter).textColor;

    const errorLightText = ensureAAAContrast(errorLight).textColor;
    const errorDarkText = ensureAAAContrast(errorDark).textColor;
    const noticeLightText = ensureAAAContrast(noticeLight).textColor;
    const noticeDarkText = ensureAAAContrast(noticeDark).textColor;
    const successLightText = ensureAAAContrast(successLight).textColor;
    const successDarkText = ensureAAAContrast(successDark).textColor;

    const errorLightStatusText = chooseForeground(errorLight, textOnLight, textOnDark);
    const errorDarkStatusText = chooseForeground(errorDark, textOnLight, textOnDark);
    const noticeLightStatusText = chooseForeground(noticeLight, textOnLight, textOnDark);
    const noticeDarkStatusText = chooseForeground(noticeDark, textOnLight, textOnDark);
    const successLightStatusText = chooseForeground(successLight, textOnLight, textOnDark);
    const successDarkStatusText = chooseForeground(successDark, textOnLight, textOnDark);

    return {
      // Global text variables from generator state
      ['--text-on-light' as any]: textOnLight,
      ['--text-on-dark' as any]: textOnDark,
      // Primary colors and their calculated text colors
      ['--ldp-primary-light' as any]: primaryLight,
      ['--ldp-primary-light-text' as any]: primaryLightText,
      ['--ldp-primary-dark' as any]: primaryDark,
      ['--ldp-primary-dark-text' as any]: primaryDarkText,
      ['--ldp-primary-darker' as any]: primaryDarker,
      ['--ldp-primary-darker-text' as any]: primaryDarkerText,
      ['--ldp-primary-lighter' as any]: primaryLighter,
      ['--ldp-primary-lighter-text' as any]: primaryLighterText,
      // Secondary colors and their calculated text colors
      ['--ldp-secondary-light' as any]: secondaryLight,
      ['--ldp-secondary-light-text' as any]: secondaryLightText,
      ['--ldp-secondary-dark' as any]: secondaryDark,
      ['--ldp-secondary-dark-text' as any]: secondaryDarkText,
      ['--ldp-secondary-darker' as any]: secondaryDarker,
      ['--ldp-secondary-darker-text' as any]: secondaryDarkerText,
      ['--ldp-secondary-lighter' as any]: secondaryLighter,
      ['--ldp-secondary-lighter-text' as any]: secondaryLighterText,
      // Tertiary colors and their calculated text colors
      ['--ldp-tertiary-light' as any]: tertiaryLight,
      ['--ldp-tertiary-light-text' as any]: tertiaryLightText,
      ['--ldp-tertiary-dark' as any]: tertiaryDark,
      ['--ldp-tertiary-dark-text' as any]: tertiaryDarkText,
      ['--ldp-tertiary-darker' as any]: tertiaryDarker,
      ['--ldp-tertiary-darker-text' as any]: tertiaryDarkerText,
      ['--ldp-tertiary-lighter' as any]: tertiaryLighter,
      ['--ldp-tertiary-lighter-text' as any]: tertiaryLighterText,
      // Accent colors and their calculated text colors
      ['--ldp-accent-light' as any]: accentLight,
      ['--ldp-accent-light-text' as any]: accentLightText,
      ['--ldp-accent-dark' as any]: accentDark,
      ['--ldp-accent-dark-text' as any]: accentDarkText,
      ['--ldp-accent-darker' as any]: accentDarker,
      ['--ldp-accent-darker-text' as any]: accentDarkerText,
      ['--ldp-accent-lighter' as any]: accentLighter,
      ['--ldp-accent-lighter-text' as any]: accentLighterText,

      // Semantic colors (follow Palette tab semantic band selections)
      ['--ldp-error-light' as any]: errorLight,
      ['--ldp-error-light-text' as any]: errorLightText,
      ['--ldp-error-light-status-text' as any]: errorLightStatusText,
      ['--ldp-error-dark' as any]: errorDark,
      ['--ldp-error-dark-text' as any]: errorDarkText,
      ['--ldp-error-dark-status-text' as any]: errorDarkStatusText,

      ['--ldp-notice-light' as any]: noticeLight,
      ['--ldp-notice-light-text' as any]: noticeLightText,
      ['--ldp-notice-light-status-text' as any]: noticeLightStatusText,
      ['--ldp-notice-dark' as any]: noticeDark,
      ['--ldp-notice-dark-text' as any]: noticeDarkText,
      ['--ldp-notice-dark-status-text' as any]: noticeDarkStatusText,

      ['--ldp-success-light' as any]: successLight,
      ['--ldp-success-light-text' as any]: successLightText,
      ['--ldp-success-light-status-text' as any]: successLightStatusText,
      ['--ldp-success-dark' as any]: successDark,
      ['--ldp-success-dark-text' as any]: successDarkText,
      ['--ldp-success-dark-status-text' as any]: successDarkStatusText,
    } as React.CSSProperties;
  }, [palette, semanticBandSelection, textOnLight, textOnDark]);

  const containerStyle = useMemo(() => {
    const base: React.CSSProperties = {
      ...vars,
      // In demo, map core tokens so everything under the controls respects light-dark()
      // Background/foreground
      ['--background' as any]: 'light-dark(white, #111111)',
      ['--foreground' as any]: 'light-dark(var(--text-on-light), var(--text-on-dark))',
      // Card surface
      ['--card' as any]: 'light-dark(white, #111111)',
      ['--card-foreground' as any]: 'light-dark(var(--text-on-light), var(--text-on-dark))',
      // Generic surface (used by inputs/list odd rows)
      ['--surface' as any]: 'light-dark(color-mix(in oklab, var(--ldp-secondary-lighter) 85%, white), color-mix(in oklab, var(--ldp-secondary-darker) 70%, black))',
      ['--surface-foreground' as any]: 'light-dark(var(--text-on-light), var(--text-on-dark))',
      // Border
      ['--border' as any]: 'light-dark(color-mix(in oklab, var(--ldp-primary-light) 25%, black), color-mix(in oklab, var(--text-on-light) 30%, white))',
      // Paint the header area with scheme tokens to avoid light text on light bg
      background: 'var(--background)',
      color: 'var(--foreground)',
    };
    if (scheme !== 'auto') base.colorScheme = scheme;
    return base;
  }, [scheme, vars]);

  const wrapperStyle = useMemo(() => {
    const base: React.CSSProperties = {
      ...containerStyle,
      // Container paint uses these tokens
      background: 'var(--background)',
      color: 'var(--foreground)',
      // Bridge variables: map the Light/Dark Preview palette vars to the
      // core tokens that `PreviewSection.module.css` consumes.
      // This keeps the Demo preview scoped and in sync with the current palette.
      ['--primary' as any]: 'light-dark(var(--ldp-primary-light), var(--ldp-primary-dark))',
      ['--primary-foreground' as any]: 'light-dark(var(--text-on-light), var(--text-on-dark))',
      ['--accent' as any]: 'light-dark(var(--ldp-accent-light), var(--ldp-accent-dark))',
      ['--accent-foreground' as any]: 'light-dark(var(--text-on-light), var(--text-on-dark))',
    };
    return base;
  }, [containerStyle]);

  return (
    <section className={styles.previewSection} aria-labelledby="ldp-title" style={containerStyle}>
      <h3 id="ldp-title" className={styles.sectionTitle}>Demo: light-dark() preview</h3>
      <div className={styles.sectionSubtitle}>
        Toggle to see how CSS <code>light-dark()</code> resolves.
        <br />
        Auto follows your browser’s preferred color scheme (typically your OS setting) when supported.
      </div>

      <div className={styles.previewControls} role="group" aria-label="Demo color scheme">
        <button
          type="button"
          className={[styles.previewButton, scheme === 'auto' ? styles.previewButtonActive : ''].join(' ')}
          onClick={() => setScheme('auto')}
        >Auto</button>
        <button
          type="button"
          className={[styles.previewButton, scheme === 'light' ? styles.previewButtonActive : ''].join(' ')}
          onClick={() => setScheme('light')}
        >Light</button>
        <button
          type="button"
          className={[styles.previewButton, scheme === 'dark' ? styles.previewButtonActive : ''].join(' ')}
          onClick={() => setScheme('dark')}
        >Dark</button>
      </div>

      <div className={styles.previewWrapper} style={wrapperStyle}>
        <div className={styles.previewGrid}>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-primary-light), var(--ldp-primary-dark))',
              color: 'light-dark(var(--ldp-primary-light-text), var(--ldp-primary-dark-text))',
            }}
          >Primary Light</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-secondary-light), var(--ldp-secondary-dark))',
              color: 'light-dark(var(--ldp-secondary-light-text), var(--ldp-secondary-dark-text))',
            }}
          >Secondary Light</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-tertiary-light), var(--ldp-tertiary-dark))',
              color: 'light-dark(var(--ldp-tertiary-light-text), var(--ldp-tertiary-dark-text))',
            }}
          >Tertiary Light</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-accent-light), var(--ldp-accent-dark))',
              color: 'light-dark(var(--ldp-accent-light-text), var(--ldp-accent-dark-text))',
            }}
          >Accent Light</div>
        </div>

        <div className={styles.previewGrid}>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-primary-lighter), var(--ldp-primary-darker))',
              color: 'light-dark(var(--ldp-primary-lighter-text), var(--ldp-primary-darker-text))',
            }}
          >Primary Lighter</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-secondary-lighter), var(--ldp-secondary-darker))',
              color: 'light-dark(var(--ldp-secondary-lighter-text), var(--ldp-secondary-darker-text))',
            }}
          >Secondary Lighter</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-tertiary-lighter), var(--ldp-tertiary-darker))',
              color: 'light-dark(var(--ldp-tertiary-lighter-text), var(--ldp-tertiary-darker-text))',
            }}
          >Tertiary Lighter</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-accent-lighter), var(--ldp-accent-darker))',
              color: 'light-dark(var(--ldp-accent-lighter-text), var(--ldp-accent-darker-text))',
            }}
          >Accent Lighter</div>
        </div>
        {children}
      </div>
    </section>
  );
};

export default LightDarkPreview;
