import React, { useMemo, useState } from 'react';
import styles from './LightDarkPreview.module.css';
import type { PaletteWithVariations } from '../helpers/types';

type Props = {
  palette: PaletteWithVariations;
  textOnLight: string; // hex
  textOnDark: string; // hex
  scheme?: 'auto' | 'light' | 'dark';
  onSchemeChange?: (s: 'auto' | 'light' | 'dark') => void;
  children?: React.ReactNode;
};

export const LightDarkPreview: React.FC<Props> = ({ palette, textOnLight, textOnDark, scheme: schemeProp, onSchemeChange, children }) => {
  const [internalScheme, setInternalScheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const scheme = schemeProp ?? internalScheme;
  const setScheme = (s: 'auto' | 'light' | 'dark') => {
    if (onSchemeChange) onSchemeChange(s);
    else setInternalScheme(s);
  };

  const findStep = (family: keyof PaletteWithVariations, step: 'lighter' | 'light' | 'dark' | 'darker') => {
    const v = palette[family].variations || [];
    const match = v.find((x) => {
      const n = x.name.toLowerCase();
      // match either "primary-light" or just "light"
      return n === `${family}-${step}` || n.endsWith(`-${step}`) || n === step;
    });
    return match?.hex || null;
  };

  const vars = useMemo(() => {
    // Prefer explicit light/dark variations; fall back to base hex
    const primaryLight = findStep('primary', 'light') || findStep('primary', 'lighter') || palette.primary.hex;
    const primaryDark = findStep('primary', 'dark') || findStep('primary', 'darker') || palette.primary.hex;
    const primaryDarker = findStep('primary', 'darker') || findStep('primary', 'dark') || palette.primary.hex;
    const primaryLighter = findStep('primary', 'lighter') || findStep('primary', 'light') || palette.primary.hex;
    const secondaryLight = findStep('secondary', 'light') || findStep('secondary', 'lighter') || palette.secondary.hex;
    const secondaryDark = findStep('secondary', 'dark') || findStep('secondary', 'darker') || palette.secondary.hex;
    const secondaryDarker = findStep('secondary', 'darker') || findStep('secondary', 'dark') || palette.secondary.hex;
    const secondaryLighter = findStep('secondary', 'lighter') || findStep('secondary', 'light') || palette.secondary.hex;
    const tertiaryLight = findStep('tertiary', 'light') || findStep('tertiary', 'lighter') || palette.tertiary.hex;
    const tertiaryDark = findStep('tertiary', 'dark') || findStep('tertiary', 'darker') || palette.tertiary.hex;
    const tertiaryDarker = findStep('tertiary', 'darker') || findStep('tertiary', 'dark') || palette.tertiary.hex;
    const tertiaryLighter = findStep('tertiary', 'lighter') || findStep('tertiary', 'light') || palette.tertiary.hex;
    const accentLight = findStep('accent', 'light') || findStep('accent', 'lighter') || palette.accent.hex;
    const accentDark = findStep('accent', 'dark') || findStep('accent', 'darker') || palette.accent.hex;
    const accentDarker = findStep('accent', 'darker') || findStep('accent', 'dark') || palette.accent.hex;
    const accentLighter = findStep('accent', 'lighter') || findStep('accent', 'light') || palette.accent.hex;

    return {
      // Provide explicit vars so swatches can reference real palette
      // Text variables come from generator state
      ['--text-on-light' as any]: textOnLight,
      ['--text-on-dark' as any]: textOnDark,
      // Primary set
      ['--ldp-primary-light' as any]: primaryLight,
      ['--ldp-primary-dark' as any]: primaryDark,
      ['--ldp-primary-darker' as any]: primaryDarker,
      ['--ldp-primary-lighter' as any]: primaryLighter,
      // Secondary set
      ['--ldp-secondary-light' as any]: secondaryLight,
      ['--ldp-secondary-dark' as any]: secondaryDark,
      ['--ldp-secondary-darker' as any]: secondaryDarker,
      ['--ldp-secondary-lighter' as any]: secondaryLighter,
      // Tertiary set
      ['--ldp-tertiary-light' as any]: tertiaryLight,
      ['--ldp-tertiary-dark' as any]: tertiaryDark,
      ['--ldp-tertiary-darker' as any]: tertiaryDarker,
      ['--ldp-tertiary-lighter' as any]: tertiaryLighter,
      // Accent set
      ['--ldp-accent-light' as any]: accentLight,
      ['--ldp-accent-dark' as any]: accentDark,
      ['--ldp-accent-darker' as any]: accentDarker,
      ['--ldp-accent-lighter' as any]: accentLighter,
    } as React.CSSProperties;
  }, [palette, textOnLight, textOnDark]);

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
              color: 'light-dark(var(--text-on-light), var(--text-on-dark))',
            }}
          >Primary Light</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-secondary-light), var(--ldp-secondary-dark))',
              color: 'light-dark(var(--text-on-light), var(--text-on-dark))',
            }}
          >Secondary Light</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-tertiary-light), var(--ldp-tertiary-dark))',
              color: 'light-dark(var(--text-on-light), var(--text-on-dark))',
            }}
          >Tertiary Light</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-accent-light), var(--ldp-accent-dark))',
              color: 'light-dark(var(--text-on-light), var(--text-on-dark))',
            }}
          >Accent Light</div>
        </div>

        <div className={styles.previewGrid}>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-primary-lighter), var(--ldp-primary-darker))',
              color: 'light-dark(var(--text-on-light), var(--text-on-dark))',
            }}
          >Primary Lighter</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-secondary-lighter), var(--ldp-secondary-darker))',
              color: 'light-dark(var(--text-on-light), var(--text-on-dark))',
            }}
          >Secondary Lighter</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-tertiary-lighter), var(--ldp-tertiary-darker))',
              color: 'light-dark(var(--text-on-light), var(--text-on-dark))',
            }}
          >Tertiary Lighter</div>
          <div
            className={styles.swatch}
            style={{
              background: 'light-dark(var(--ldp-accent-lighter), var(--ldp-accent-darker))',
              color: 'light-dark(var(--text-on-light), var(--text-on-dark))',
            }}
          >Accent Lighter</div>
        </div>
        {children}
      </div>
    </section>
  );
};

export default LightDarkPreview;
