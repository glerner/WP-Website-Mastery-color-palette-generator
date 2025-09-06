# Making Color Palette entries get used in WordPress Block Editor

I generate theme.json files, with all the permutations of primary, secondary, tertiary colors, e.g. with initial colors 005546-584a00-47515b-981066, it generates:
- teal-mustard-psta.json
- teal-mustard-ptsa.json
- teal-mustard-spta.json
- teal-mustard-stpa.json
- teal-mustard-tpsa.json
- teal-mustard-tspa.json

These show as Palettes in the Site Editor. The user can select which has their site look best (hopefully thinking from their ideal client's perspective).

## Problem

The elements where I never set a color, change with the Palette of the Theme Variation.

The elements where I picked a color from the palette, in the Block Editor, apparently the hex color number is inserted in the code, not the palette slug; the color doesn't change with changing the palette.

Is there a way to have the Editor put the palette's color slug in the element, not the hex color number, so changing palettes changes the selected color?



Yes, there's a way to have the WordPress block editor use the color slug instead of the hex code when a user selects a color from the palette, but it's not a standard, out-of-the-box feature. The current behavior you're experiencing, where the hex code is hardcoded into the block's attributes, is how the editor is designed to work by default.

To achieve what you want, you need to extend the editor's functionality using custom JavaScript. This involves intercepting the color selection event and modifying the block's attributes to save the palette slug instead of the hex value.

The Technical Approach
Register a Custom Block Style or Variation: This is a key step. You can't change the default behavior for core blocks, but you can create your own custom block variations that use your theme's color slugs.

Use theme.json to Define a Custom Palette: You are already doing this. Your theme.json file defines the color palette with slugs like primary, secondary, etc. This is essential for the editor to recognize and use these named colors.

Use a Custom JavaScript Hook: You would write a script that runs in the block editor. This script would listen for changes in the color picker.

Listen for onChange: When a user picks a color from your custom palette, the color picker component triggers an onChange event.

Intercept the Hex Code: In your script, you would get the hex code of the selected color.

Match to a Slug: You would then compare that hex code to the hex codes in your theme.json palette.

Update the Block Attribute: If a match is found, you would programmatically update the block's attributes to save the corresponding color slug (e.g., primary) instead of the hex code.

Use CSS Variables on the Front End: On the front end, your theme would need a stylesheet that uses CSS variables derived from your theme.json colors. When the user selects a new theme variation (palette), the CSS variables would update, and any block using a color slug would automatically update as well.

## Example Code Snippet (Conceptual)

This is a simplified, conceptual example to illustrate the process. It's not a complete, production-ready solution, as implementing this correctly requires deep knowledge of the WordPress block editor's JavaScript APIs (e.g., @wordpress/block-editor, @wordpress/data).

```JavaScript

// A custom script to run in the block editor
wp.domReady(() => {
    // Get the block editor's data store
    const { select, dispatch } = wp.data;

    // Listen for block changes
    const unsubscribe = select('core/block-editor').subscribe(() => {
        const blocks = select('core/block-editor').getBlocks();
        blocks.forEach(block => {
            // Check if the block has a color setting
            if (block.attributes.backgroundColor) {
                const colorHex = block.attributes.backgroundColor;
                const palette = select('core/block-editor').getSettings().colors;

                // Find the color slug that matches the selected hex code
                const matchingColor = palette.find(color => color.color === colorHex);

                if (matchingColor && block.attributes.backgroundColor !== `var(--wp--preset--color--${matchingColor.slug})`) {
                    // Update the block's attribute to use the slug
                    dispatch('core/block-editor').updateBlockAttributes(
                        block.clientId,
                        { backgroundColor: `var(--wp--preset--color--${matchingColor.slug})` }
                    );
                }
            }
        });
    });
});
```

## Why It's Not the Default
The reason the editor hardcodes the hex value is to provide a reliable, predictable result regardless of the active theme or palette. This prevents a block's appearance from changing unexpectedly if a user switches themes and a color slug no longer exists or points to a different color. Your approach, however, is a valid and powerful way to build a cohesive design system within this constraint.
