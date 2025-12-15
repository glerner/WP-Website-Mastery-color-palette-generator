<?php
/**
 * File: fse-editor-chrome-styles.php
 *
 * Provides `fse_enqueue_block_editor_admin_chrome_styles()` to ensure the Block Editor
 * sidebar (admin chrome, outside the canvas iframe) can resolve CSS variables from the
 * ACTIVE theme/style variation without hardcoding.
 *
 * - Includes WP resolved globals (variables + presets) via wp_get_global_stylesheet().
 * - Includes the theme's own theme.json styles.css (emitted by your exporter).
 * - Bridges --wp--preset--color--<slug> to your --<slug> alias so both resolve.
 *
 * @package WPWM_Color_Palette_Generator
 */

/**
 * Enqueues inline CSS so the Block Editor admin chrome resolves theme variables.
 *
 * @return void
 */
function fse_enqueue_block_editor_admin_chrome_styles() {
	// 1) Resolved variables + presets from the active theme/variation/user global styles
	$globals_css = '';
	if ( function_exists( 'wp_get_global_stylesheet' ) ) {
		// Include variables + presets; reflects the ACTIVE style variation and user styles.
		try {
			$result = wp_get_global_stylesheet( array( 'variables', 'presets' ) );
			if ( is_string( $result ) ) {
				$globals_css = $result;
			}
		} catch ( Exception $e ) {
			// Silently fail if global styles are corrupted.
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Intentional logging for debugging.
			error_log( 'FSE Editor Chrome Styles: wp_get_global_stylesheet failed - ' . $e->getMessage() );
		}
	}

	// 2) Theme's own inline CSS from theme.json (your exporter's styles.css)
	$inline_css      = '';
	$theme_json_path = get_stylesheet_directory() . '/theme.json'; // Supports child themes.
	if ( file_exists( $theme_json_path ) ) {
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local file read.
		$json_raw = file_get_contents( $theme_json_path );
		if ( false !== $json_raw ) {
			$json = json_decode( $json_raw, true );
			if ( ! is_array( $json ) || json_last_error() !== JSON_ERROR_NONE ) {
				// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Intentional logging for debugging.
				error_log( 'FSE Editor Chrome Styles: Invalid theme.json - ' . json_last_error_msg() );
				return; // Abort if theme.json is malformed.
			}
			if ( isset( $json['styles']['css'] ) && is_string( $json['styles']['css'] ) ) {
				// Your exporter already scopes to :root,.editor-styles-wrapper{ ... }.
				$inline_css .= $json['styles']['css'];
			}

			// 3) Bridge preset variables to your aliases so both forms resolve in admin chrome.
			if ( isset( $json['settings']['color']['palette'] ) && is_array( $json['settings']['color']['palette'] ) ) {
				$map_rules = array();
				foreach ( $json['settings']['color']['palette'] as $entry ) {
					// Defensive: ensure $entry is an array and has a slug.
					if ( ! is_array( $entry ) || empty( $entry['slug'] ) ) {
						continue;
					}
					$slug = sanitize_title( $entry['slug'] );
					// --wp--preset--color--<slug>: var(--<slug>).
					$map_rules[] = "--wp--preset--color--{$slug}: var(--{$slug})";
				}
				if ( $map_rules ) {
					// Use :root for the admin document (sidebar chrome).
					$inline_css .= ':root{' . implode( ';', $map_rules ) . ';}';
				}
			}
		}
	}

	// 4) Inject into the editor admin document (not the canvas iframe)
	$final_css = trim( ( $globals_css ? $globals_css : '' ) . "\n" . ( $inline_css ? $inline_css : '' ) );
	if ( '' !== $final_css ) {
		// Check if style handles are registered before adding inline styles.
		if ( wp_style_is( 'wp-edit-blocks', 'registered' ) ) {
			wp_add_inline_style( 'wp-edit-blocks', $final_css );
		}
		if ( wp_style_is( 'wp-block-editor', 'registered' ) ) {
			wp_add_inline_style( 'wp-block-editor', $final_css );
		}
		// Fallback: if neither handle exists, log warning.
		if ( ! wp_style_is( 'wp-edit-blocks', 'registered' ) && ! wp_style_is( 'wp-block-editor', 'registered' ) ) {
			// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Intentional logging for debugging.
			error_log( 'FSE Editor Chrome Styles: Neither wp-edit-blocks nor wp-block-editor handles are registered' );
		}
	}
}
