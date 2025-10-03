<?php

function fse_child_styles()
{
    wp_enqueue_style('fse-child-style', get_stylesheet_uri());
}
add_action('wp_enqueue_scripts', 'fse_child_styles');

/**
 * Ensure the Block Editor sidebar (admin chrome, outside the canvas iframe) can resolve
 * CSS variables from the ACTIVE theme/style variation without hardcoding.
 *
 * - Includes WP resolved globals (variables + presets) via wp_get_global_stylesheet().
 * - Includes the theme's own theme.json styles.css (emitted by your exporter).
 * - Bridges --wp--preset--color--<slug> to your --<slug> alias so both resolve.
 */
require_once get_stylesheet_directory() . '/inc/fse-editor-chrome-styles.php';
add_action('enqueue_block_editor_assets', 'fse_enqueue_block_editor_admin_chrome_styles', 20);
