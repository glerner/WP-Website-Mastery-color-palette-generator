<?php
/**
 * File: theme-color-scheme-toggle.php
 *
 * Front-end helper to support a visitor-controlled light/dark toggle that plays
 * nicely with CSS color-scheme and light-dark() variables.
 *
 * What this does:
 * - Outputs a tiny inline bootstrap script in <head> to set an initial
 *   html[data-color-scheme] before first paint, preventing a flash.
 * - Enqueues a small JS file that manages the toggle button and persists choice
 *   to localStorage ('auto' | 'light' | 'dark').
 * - Adds an optional body class for convenience.
 *
 * Usage in your theme:
 * 1) Copy this file to your theme's inc/ directory and include it from functions.php
 *    require get_stylesheet_directory() . '/inc/theme-color-scheme-toggle.php';
 *    add_action( 'wp_enqueue_scripts', 'wpwm_enqueue_theme_color_scheme_toggle' );
 *    add_action( 'wp_head', 'wpwm_output_initial_color_scheme', 0 );
 *    add_filter( 'body_class', 'wpwm_body_class_color_scheme' );
 *
 * 2) Ensure your CSS defines:
 *    :root { color-scheme: light dark; }
 *    html[data-color-scheme="light"] { color-scheme: light; }
 *    html[data-color-scheme="dark"]  { color-scheme: dark; }
 *    // Your color tokens can still use light-dark(lightVal, darkVal)
 *
 * 3) Add a menu item (Appearance → Menus / Navigation) with class "js-theme-toggle".
 *    The JS will upgrade it into a toggle and keep its label in sync.
 *
 * @package WPWM_Color_Palette_Generator
 */

if ( ! function_exists( 'wpwm_output_initial_color_scheme' ) ) {
	/**
	 * Prints an inline bootstrap script in <head> to set html[data-color-scheme]
	 * as early as possible to prevent a flash-of-wrong-theme.
	 */
	function wpwm_output_initial_color_scheme() {
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo "\n<script>(function(){\n\ttry{\n\t\tvar LS_KEY='wpwm:color-scheme';\n\t\tvar pref=localStorage.getItem(LS_KEY)||'auto';\n\t\tvar mql=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)');\n\t\tvar darkPreferred=mql&&mql.matches;\n\t\tvar mode=pref==='auto'?(darkPreferred?'dark':'light'):pref;\n\t\tvar html=document.documentElement;\n\t\thtml.setAttribute('data-color-scheme', mode);\n\t\t// Optional: update a class for convenience hooks
\t\tvar clsLight='has-light-scheme', clsDark='has-dark-scheme';\n\t\tif(mode==='dark'){ html.classList.add(clsDark); html.classList.remove(clsLight);} else { html.classList.add(clsLight); html.classList.remove(clsDark);}\n\t}catch(e){}\n})();</script>\n";
	}
}

if ( ! function_exists( 'wpwm_enqueue_theme_color_scheme_toggle' ) ) {
	/**
	 * Enqueue the front-end toggle script.
	 */
	function wpwm_enqueue_theme_color_scheme_toggle() {
		$handle    = 'wpwm-color-scheme-toggle';
		$theme_dir = get_stylesheet_directory_uri();
		$path      = '/assets/js/color-scheme-toggle.js';

		// Allow themes to move the script; filter the URI if needed.
		$src = apply_filters( 'wpwm_color_scheme_toggle_src', $theme_dir . $path );

		// Set a version for cache-busting: use filemtime when available, fallback to theme version.
		$version     = null;
		$theme_path  = get_stylesheet_directory();
		$script_file = $theme_path . $path;
		if ( file_exists( $script_file ) ) {
			$version = (string) filemtime( $script_file );
		}
		if ( empty( $version ) ) {
			$theme   = wp_get_theme();
			$version = $theme && $theme->get( 'Version' ) ? $theme->get( 'Version' ) : null;
		}

		wp_enqueue_script( $handle, $src, array(), $version, true );

		// Pass initial i18n labels; themes can filter these.
		$labels = apply_filters(
			'wpwm_color_scheme_toggle_labels',
			array(
				'auto'  => __( 'Auto', 'default' ),
				'light' => __( 'Light', 'default' ),
				'dark'  => __( 'Dark', 'default' ),
			)
		);
		wp_localize_script( $handle, 'WPWM_TOGGLE_LABELS', $labels );
	}
}

if ( ! function_exists( 'wpwm_body_class_color_scheme' ) ) {
	/**
	 * Optional: add a body class reflecting the current scheme.
	 * The class is set client-side in the bootstrap, but this keeps parity on SSR-only pages.
	 * (It will be corrected on hydration by the bootstrap script.)
	 *
	 * @param array $classes Existing body classes.
	 * @return array Modified body classes including scheme placeholder.
	 */
	function wpwm_body_class_color_scheme( $classes ) {
		$classes[] = 'has-unknown-scheme';
		return $classes;
	}
}
