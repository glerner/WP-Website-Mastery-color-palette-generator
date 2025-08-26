import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Button } from '../components/Button';
import { ArrowRight, Bot, Brush, Code } from 'lucide-react';
import styles from './_index.module.css';

const IndexPage = () => {
  const [previewScheme, setPreviewScheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const wrapperStyle =
    previewScheme === 'auto'
      ? undefined
      : ({ colorScheme: previewScheme } as React.CSSProperties);
  return (
    <>
      <Helmet>
        <title>GL Color Palette Generator | AI-Powered Branding</title>
        <meta
          name="description"
          content="Instantly generate beautiful, professional color palettes for your brand with AI. Export directly to WordPress theme.json. Get started for free."
        />
      </Helmet>
      <div className={styles.pageContainer}>
        <main className={styles.mainContent}>
          <section className={styles.hero}>
            <div className={styles.heroContent}>
              <h1 className={styles.heroTitle}>
                Craft your brand's perfect color story.
              </h1>
              <p className={styles.heroSubtitle}>
                Generate stunning, accessible color palettes with AI, fine-tune
                every shade, and export directly to your WordPress theme.
              </p>
              <div className={styles.heroActions}>
                <Button asChild size="lg">
                  <Link to="/generator">
                    Start Generating <ArrowRight size={20} />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <a href="#features">Learn More</a>
                </Button>
              </div>
            </div>
            <div className={styles.heroImageContainer}>
              <div className={styles.heroImage}></div>
            </div>
          </section>

          <section id="features" className={styles.features}>
            <h2 className={styles.sectionTitle}>
              A smarter way to design color systems.
            </h2>
            <p className={styles.sectionSubtitle}>
              From initial idea to production-ready code, our tool streamlines your
              entire color workflow.
            </p>
            <div className={styles.featuresGrid}>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <Bot size={24} />
                </div>
                <h3 className={styles.featureTitle} >AI-Assisted Generation</h3>
                <p className={styles.featureDescription}>
                  Describe your brand's vibe, industry, and target audience. Our
                  AI will generate unique, context-aware color palettes in
                  seconds.
                </p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <Brush size={24} />
                </div>
                <h3 className={styles.featureTitle}>Manual Control</h3>
                <p className={styles.featureDescription}>
                  Have specific colors in mind? Input your primary, secondary,
                  tertiary, and accent colors to build your palette from the
                  ground up.
                </p>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  <Code size={24} />
                </div>
                <h3 className={styles.featureTitle}>WordPress Integration</h3>
                <p className={styles.featureDescription}>
                  Export your entire palette, including shades and variations,
                  as a ready-to-use `theme.json` file for seamless WordPress
                  Block Theme integration.
                </p>
              </div>
            </div>
          </section>

          {/* Light/Dark Preview */}
          <section className={styles.previewSection} aria-labelledby="preview-title">
            <h2 id="preview-title" className={styles.sectionTitle}>
              Example Component Preview (light/dark)
            </h2>
            <div className={styles.sectionSubtitle}>
              Toggle to see how CSS <code>light-dark()</code> resolves under different schemes.
            </div>

            <div className={styles.previewControls} role="group" aria-label="Preview color scheme">
              <button
                type="button"
                className={[
                  styles.previewButton,
                  previewScheme === 'auto' ? styles.previewButtonActive : '',
                ].join(' ')}
                onClick={() => setPreviewScheme('auto')}
              >
                Auto
              </button>
              <button
                type="button"
                className={[
                  styles.previewButton,
                  previewScheme === 'light' ? styles.previewButtonActive : '',
                ].join(' ')}
                onClick={() => setPreviewScheme('light')}
              >
                Light
              </button>
              <button
                type="button"
                className={[
                  styles.previewButton,
                  previewScheme === 'dark' ? styles.previewButtonActive : '',
                ].join(' ')}
                onClick={() => setPreviewScheme('dark')}
              >
                Dark
              </button>
            </div>

            <div className={styles.previewWrapper} style={wrapperStyle}>
              <div className={styles.previewGrid}>
                {/* Primary swatch uses derived lighter/darker via color-mix */}
                <div
                  className={styles.swatch}
                  style={{
                    background:
                      'light-dark(color-mix(in srgb, var(--primary) 85%, white), color-mix(in srgb, var(--primary) 70%, black))',
                    color: 'light-dark(var(--text-on-light), var(--text-on-dark))',
                  }}
                >
                  <strong>Primary</strong>
                </div>
                {/* Surface swatch using foreground/surface pair */}
                <div
                  className={styles.swatch}
                  style={{
                    background: 'light-dark(var(--surface), var(--foreground))',
                    color: 'light-dark(var(--surface-foreground), var(--surface))',
                  }}
                >
                  <strong>Surface</strong>
                </div>
                {/* Accent (fallbacks to primary if missing) */}
                <div
                  className={styles.swatch}
                  style={{
                    background:
                      'light-dark(color-mix(in srgb, var(--accent, var(--primary)) 85%, white), color-mix(in srgb, var(--accent, var(--primary)) 70%, black))',
                    color: 'light-dark(var(--text-on-light), var(--text-on-dark))',
                  }}
                >
                  <strong>Accent</strong>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </>
  );
};

export default IndexPage;
