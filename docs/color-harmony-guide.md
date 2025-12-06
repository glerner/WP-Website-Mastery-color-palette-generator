# Understanding Color Harmonies

Color harmonies are combinations of colors that work well together based on their positions on the color wheel. Understanding these relationships helps create visually appealing and balanced designs.

## Common Color Harmonies

### Analogous
Colors that are next to each other on the color wheel. Creates a harmonious, comfortable design.
- Example: Yellow, Yellow-Green, Green
- Best for: Creating a cohesive, unified look
- Use when: You want a gentle, soothing design

### Complementary
Colors opposite each other on the color wheel. Creates high contrast and visual impact.
- Example: Blue and Orange
- Best for: Making elements stand out
- Use when: You need strong emphasis or call-to-action elements

### Analogous with Complement
A base color, its analogous colors, and its complement. Perfect for WordPress themes needing both harmony and contrast.
- Example: Blue (base), Blue-Purple and Blue-Green (analogous), Orange (complement)
- Best for: WordPress themes needing primary, secondary, and accent colors
- Use when: You want both harmony and contrast
- Theme Usage:
  - Primary: Base color
  - Secondary: one of the Analogous colors
  - Accent: Complement color

### Triadic
Three colors equally spaced on the color wheel. Creates vibrant, balanced designs.
- Example: Red, Yellow, Blue
- Best for: Creating dynamic, energetic layouts
- Use when: You want variety while maintaining balance

### Monochromatic
Different shades and tints of the same color. Creates a cohesive, sophisticated look.
- Example: Light Blue, Blue, Dark Blue
- Best for: Clean, professional designs
- Use when: You want elegance and simplicity

### Split-Complementary
A base color and two colors adjacent to its complement. Provides high contrast while being easier to balance than complementary colors.
- Example: Blue with Yellow-Orange and Red-Orange
- Best for: Beginners wanting high contrast
- Use when: Complementary feels too intense

### Tetradic (Double Complementary)
Two pairs of complementary colors. Creates a rich, dynamic color scheme best used with one dominant color.
- Example: Blue and Orange with Yellow and Purple
- Best for: Complex, vibrant designs
- Use when: You need a full range of colors

### Square
Four colors evenly spaced on the color wheel. Creates a balanced, vibrant design when used with varying intensities.
- Example: Red, Yellow-Green, Blue, and Purple-Red
- Best for: Rich, varied designs
- Use when: You need multiple colors with equal emphasis

## Common WordPress Theme Harmonies

### Analogous with Complement
A base color, its analogous colors, and its complement. Perfect for WordPress themes needing both harmony and contrast.
- Example: Blue (base), Blue-Purple and Blue-Green (analogous), Orange (complement)
- Best for: WordPress themes needing primary, secondary, and accent colors
- Use when: You want both harmony and contrast
- Theme Usage:
  - Primary: Base color
  - Secondary: one of the Analogous colors
  - Accent: Complement color

### Monochromatic with Accent
A single color in different shades plus one contrasting accent. Popular in minimalist WordPress themes.
- Example: Different shades of blue with orange accent
- Best for: Clean, focused designs that need a pop of color
- Use when: You want simplicity with impact
- Theme Usage:
  - Primary: Base color
  - Secondary: Lighter/darker variations
  - Accent: Contrasting color for Calls to Action (CTAs)

### Dual Tone
Two main colors with neutral grays. Common in modern WordPress themes.
- Example: Deep blue and teal with gray text/backgrounds
- Best for: Modern, professional designs
- Use when: You want a strong brand presence
- Theme Usage:
  - Primary: First main color
  - Secondary: Second main color
  - Text/Backgrounds: Grays for balance

### Neutral with Pop
Neutral base colors with one vibrant accent. Popular in business and portfolio themes.
- Example: Grays/beiges with vibrant blue accent
- Best for: Professional sites needing subtle branding
- Use when: Content should be the focus
- Theme Usage:
  - Primary/Secondary: Neutral colors
  - Accent: Single vibrant color
  - Text/Backgrounds: Neutral grays

## Special Generation Methods

### AI-Generated Palettes
Let artificial intelligence create custom color palettes optimized for your needs:

1. **From Themes or Moods**
   - "Valentine's Day romance"
   - "Arizona desert at sunset"
   - "Tropical beach paradise"
   - "Cozy winter cabin"

2. **From Business Goals**
   - "Professional consulting firm targeting Fortune 500"
   - "Eco-friendly organic food brand"
   - "Tech startup focused on AI innovation"
   - "Luxury spa and wellness center"

3. **From Website Screenshots**
   - "Extract the main theme colors from this website screenshot"
   - "Create a palette similar to this website but more modern"
   - "Match this website's style but make it more energetic"
   - AI understands layout context (headers, buttons, etc.)

4. **From Inspiration Photos**
   - Upload photos that match your vision
   - Corrects white balance and exposure
   - AI adjusts colors for optimal web usage
   - Maintains mood while ensuring accessibility

Best for:
- Creating mood-specific designs
- While matching business objectives
- Replicating successful website designs
- Ensuring colors work well together, regardless of source

### From Image (Direct)
Extract colors directly from an image without AI adjustment.
- Best for: Exactly matching existing theme designs
- Consider: Colors may need manual adjustment for web usage
- Simple "most used colors" approach, won't work well if image background colors don't match site mood
- Try AI-Generated method instead for better results with website screenshots

## Using Color Harmonies in WordPress Themes

1. **Choose Your Base**
   - Start with your primary brand color
   - Use it as the foundation for your harmony

2. **Apply the 60-30-10 Rule**
   - 60% dominant color (Primary)
   - 30% secondary colors (Secondary and analogous)
   - 10% accent color (Complement)

3. **Consider Context**
   - Headers and footers: Use your dominant color
   - Call-to-action buttons: Use complementary colors
   - Text and backgrounds: Ensure good contrast

4. **Test Accessibility**
   - This plugin will *always* check WCAG contrast ratios
   - Only WCAG AAA contrast, or better, with either near-black or near-white text
   - Test with different types of content
   - Verify readability in all color combinations

## Page Background and Text Colors

### Light/Dark Mode Implementation

For light/dark mode support:

1. **Light Mode (Default)**:
   - Page background: `text-on-dark` (near-white)
   - Text color: `text-on-light` (near-black)

2. **Dark Mode**:
   - Page background: `text-on-light` (near-black)
   - Text color: `text-on-dark` (near-white)

The generator creates both light and dark mode colors automatically. When you use `primary-light` in light mode, it automatically switches to `primary-dark` in dark mode, ensuring proper contrast in both color schemes.

### Internal Color Structure

In our internal color structure, we use semantic naming that clearly indicates the purpose of each color:

- **'text-on-light'**: Text color for light backgrounds (dark text)
  - Light mode: Used as default text color (usually near-black, e.g., #111111, #333333)
  - Dark mode: Used as page background (usually soft black, e.g., #111111, #1a1a1a)

- **'text-on-dark'**: Text color for dark backgrounds (light text)
  - Light mode: Used as page background (usually white or off-white, e.g., #ffffff, #f9f9f9)
  - Dark mode: Used as text color (usually near-white, e.g., #f5f5f5, #e0e0e0)


#### CSS `light-dark()` Function

The generator uses the CSS `light-dark()` function to automatically adapt colors between light and dark modes:

```css
/* Light mode uses lighter tints, dark mode uses darker shades */
background-color: light-dark(var(--primary-lighter), var(--primary-darker));
color: light-dark(var(--text-on-light), var(--text-on-dark));
```

**How it works:**
- In **light mode**: Uses lighter palette colors (primary-light, primary-lighter) with dark text
- In **dark mode**: Uses darker palette colors (primary-dark, primary-darker) with light text
- Automatically switches based on user's system preferences

**Manual Toggle:** Users can manually switch between light and dark modes using a toggle button:

1. Download the [wpwm-color-scheme-toggle plugin](https://github.com/glerner/wpwm-color-scheme-toggle) from GitHub
2. Upload the plugin to your WordPress `/wp-content/plugins/` folder
3. Activate the plugin in WordPress Admin > Plugins
4. Create a menu link and add the CSS class `js-theme-toggle` to it
5. Users can now click the menu link to toggle between light and dark modes

#### CSS Variables and Fallbacks

**Why use CSS variables?** When you define colors using CSS variables in your color palette, you can change your entire site's colors by editing just one file—no need to update every page!

```css
/* Define once in your palette */
:root {
  --primary-light: #7AD1FF;
  --primary-dark: #005581;
  --text-on-light: #462F01;
  --text-on-dark: #F8F7F7;
  etc.
}

/* Use everywhere in your site */
.button {
  background-color: var(--primary-dark);
  color: var(--text-on-dark);
}
```

**Change once, update everywhere:** Modify the color values in `:root` and all elements using those variables automatically update across your entire site.

This Color Palette Generator makes Theme Variation files that include the CSS variables for the colors.

**Block Editor Integration:** When you use the WordPress Block Editor's color picker and select a color from your predefined palette (not the "pick any color" grid), the editor inserts a CSS variable reference—not a hard-coded color value. This means if you later change your palette colors, all blocks using those palette colors automatically update!

#### Recommended Utilities CSS Approach

The generator creates a `<name>-utilities.css` file with ready-to-use CSS classes. Copy the classes you need into your theme's `style.css`:

```css
/* Example from generated utilities file */
.bg-primary-lighter, .has-primary-lighter-background-color, .has-text-on-light-background-color  {
  /* Fallback for browsers without light-dark(): */
  background-color: var(--primary-lighter) !important;
  color: var(--text-on-light) !important;
  @supports (color: light-dark(black, white)) {
    /* Modern color scheme aware version: */
    background-color: light-dark(var(--primary-lighter), var(--primary-darker)) !important;
    color: light-dark(var(--text-on-light), var(--text-on-dark)) !important;
  }
}

.bg-primary-dark, .has-primary-dark-background-color, .has-primary-background-color {
  /* Fallback for browsers without light-dark(): */
  background-color: var(--primary-dark) !important;
  color: var(--text-on-dark) !important;
  @supports (color: light-dark(black, white)) {
    /* Modern color scheme aware version: */
    background-color: light-dark(var(--primary-dark), var(--primary-light)) !important;
    color: light-dark(var(--text-on-dark), var(--text-on-light)) !important;
  }
}
```

**How to use:**
1. Generate your palette and export the utilities CSS file
2. Copy the classes you need into your theme's `style.css`
3. Apply classes to your HTML elements: `<div class="bg-primary-lighter">Content</div>`. Many blocks have, in their Settings panel, an Advanced section where you can add a class to the block; in this case you would add `bg-primary-lighter` to the block.
3a. Or, use the Color Palette picker in the Block's settings panel, select Primary Lighter (abbreviated to P Lighter in the hover tooltip).
4. Colors automatically adapt between light and dark modes, because the CSS classes are set up for that.

**Benefits:**
- ✅ **Automatic dark mode** - Colors switch based on user preference
- ✅ **AAA contrast** - All combinations meet accessibility standards
- ✅ **Browser fallbacks** - Works in older browsers without `light-dark()`
- ✅ **WordPress compatible** - Includes `.has-*-background-color` classes

### WordPress Theme Integration

**Using the generated utilities CSS:**

1. **Generate your palette** in the generator
2. **Export the utilities CSS file** (e.g., `yoursite-utilities.css`)
3. **Copy CSS classes** from the utilities file into your theme's `style.css`
4. **Apply classes** to your WordPress theme elements

**Mapping to WordPress conventions:**

The utilities CSS includes WordPress-compatible class names:
- `.has-primary-background-color` - WordPress block editor class
- `.bg-primary-dark` - Shorthand utility class
- `.has-text-on-light-background-color` - Text color class

**Color palette variables:**
- `--primary-lighter`, `--primary-light`, `--primary-dark`, `--primary-darker`
- `--secondary-lighter`, `--secondary-light`, `--secondary-dark`, `--secondary-darker`
- `--tertiary-lighter`, `--tertiary-light`, `--tertiary-dark`, `--tertiary-darker`
- `--accent-lighter`, `--accent-light`, `--accent-dark`, `--accent-darker`
- `--error-light`, `--error-dark`
- `--notice-light`, `--notice-dark`
- `--success-light`, `--success-dark`
- `--text-on-light`, `--text-on-dark`

For detailed information about color roles and their uses in WordPress themes, see [Color Roles and Their Uses](THEME-COLOR-GUIDE.md#color-roles-and-their-uses)

## Working with Vibrant Brand Palettes

Vibrant, high-saturation color palettes create energetic, attention-grabbing designs perfect for youth brands, sports teams, food marketing, and festive applications. However, they require careful handling to maintain usability and accessibility.

### Understanding Saturation in Vibrant Palettes

**Saturation** (S in HSL) controls color intensity:
- **0%** = Grayscale (no color)
- **50%** = Moderate color
- **100%** = Maximum intensity

Vibrant palettes typically use **60-100% saturation** for brand colors, creating bold, memorable designs.

### The Challenge: Semantic Colors in Vibrant Palettes

When your brand palette is highly saturated, using the same colors for semantic purposes (error, notice, success) creates problems:

#### ❌ Problems with Reusing Vibrant Brand Colors:

1. **Visual Confusion**: Users can't distinguish between "this is our brand red" vs "this is an error"
2. **Overwhelming Alerts**: High-saturation error messages cause visual fatigue
3. **Accessibility Issues**: Vibrant colors may fail contrast requirements
4. **Emotional Mismatch**: Brand excitement ≠ error severity

#### ✅ Solution: Differentiate Through Lightness (L)

The key insight: **Adjust Lightness (L) in HSL to create distinct semantic colors while maintaining color relationships.**

### Strategy: The Lightness Ladder

Create visual separation by adjusting the L (lightness) value in HSL:

```
Brand Colors (High Saturation):
├─ Primary:   HSL(200, 100%, 50%)  ← Vibrant blue
├─ Secondary: HSL(40,  97%,  64%)  ← Bright gold
├─ Tertiary:  HSL(30,  100%, 48%)  ← Vivid orange
└─ Accent:    HSL(0,   69%,  50%)  ← Bold red

Semantic Colors (Adjusted Lightness):
├─ Error:   HSL(0,   47%, 47%)  ← Darker, muted red
├─ Notice:  HSL(47,  100%, 72%)  ← Lighter yellow (distinct from Secondary)
└─ Success: HSL(148, 50%, 18%)  ← Darker green
```

### Practical Example: "Fiery Ice Cream Delight" Palette

Based on a Coolors.co vibrant palette, here's how to create distinct semantic colors:

#### Starting Palette from Coolors.co:
```json
{
  "primary": "#003049",    // Deep Space Blue (H=201, S=100%, L=14%)
  "secondary": "#FCBF49",  // Sunflower Gold (H=40, S=97%, L=64%)
  "tertiary": "#F77F00",   // Princeton Orange (H=31, S=100%, L=48%)
  "accent": "#D62828"      // Flag Red (H=0, S=69%, L=50%)
}
```

#### Critical Insight: Don't Blindly Trust Palette Generators

**Palette generators like Coolors.co are starting points, not gospel.** They create aesthetically pleasing combinations but don't consider:
- Your specific use case (WordPress themes need semantic colors)
- Accessibility requirements (AAA contrast)
- Visual hierarchy (brand vs semantic distinction)
- Saturation consistency across your palette

**Think critically about the generated palette:**

1. **Question Saturation Inconsistencies**
   - Notice Accent has S=69% while Primary/Secondary/Tertiary have S=97-100%
   - ❌ Problem: Accent feels less vibrant, doesn't match brand energy
   - ✅ Solution: Increase Accent to S=100% for consistency

2. **Identify Missing Semantic Colors**
   - Coolors gave you 4 brand colors (blue, gold, orange, red)
   - ❌ Problem: No Notice, Error, or Success colors
   - ✅ Solution: You need to create these yourself

3. **Recognize Color Overlap Issues**
   - Secondary (gold) and Tertiary (orange) are both yellow-orange (H=40° and H=31°)
   - ❌ Problem: Where does Notice (yellow) fit? It will clash with both!
   - ✅ Solution: Adjust brand colors to create space for semantics

#### Problems with Using Coolors Palette Directly:

1. **Accent Saturation Too Low**:
   - Coolors: S=69% (muted compared to other brand colors)
   - Should be: S=100% (match the vibrant energy)

2. **No Semantic Color Strategy**:
   - ❌ Error = Accent (both at H=0° red) → Hue conflict, users will confuse them
   - ❌ Notice = Secondary (both bright yellow) → No distinction
   - ❌ Need to find empty hue areas for semantic colors

3. **Yellow-Orange Cluster**:
   - Secondary (H=40°) and Tertiary (H=31°) are too close
   - Accent (H=0°) conflicts with Error
   - Need to check color wheel for empty hue areas

#### Solution: Strategic Adjustments for Functionality

**Step 1: Make Tertiary Lighter**
```
Tertiary: HSL(30, 100%, 48%) → HSL(30, 100%, 86%)
Result: Lighter orange, creates space for Notice
```

**Step 2: Make Secondary Darker**
```
Secondary: HSL(40, 97%, 64%) → HSL(39, 97%, 15%)
Result: Darker gold, distinct from Notice
```

**Step 3: Move Error to Empty Hue Area (Avoid Conflict with Accent)**
```
Error: HSL(0, 47%, 47%) → HSL(325, 48%, 49%)
Result: Muted magenta fills empty hue area, avoids red conflict with Accent
```

**Step 4: Mute Notice to Match Error Saturation**
```
Notice: HSL(47, 100%, 72%) → HSL(47, 47%, 51%)
Result: Muted gold, matches Error saturation for semantic consistency
```

**Step 5: Use Color Wheel to Find Empty Hue Areas**

When choosing semantic colors, check the color wheel in the Palette Generator to find empty hue areas:

```
Brand colors occupy:
- H=0° (Accent - red)
- H=31° (Tertiary - orange)
- H=40° (Secondary - gold)
- H=201° (Primary - blue)

Empty areas for semantic colors:
- H=325° (magenta) ← Perfect for Error!
- H=47° (gold) ← Works for Notice (between Secondary and Tertiary)
- H=148° (green) ← Perfect for Success
```

**Why This Strategy Works:**
- ✅ **Error at H=325°**: Fills empty magenta area, avoids conflict with Accent (H=0°)
- ✅ **Notice at H=47°**: Positioned between brand colors, muted saturation distinguishes it
- ✅ **Both S=47-48%**: Consistent saturation for all semantic colors creates visual hierarchy
- ✅ **Distinct from brand**: Lower saturation (47-48% vs 97-100%) signals "information" not "brand"

**Step 6: Increase Accent Saturation for Brand Consistency**
```
Accent: HSL(0, 69%, 50%) → HSL(0, 100%, 50%)
Result: Matches the vibrancy of other brand colors (S=97-100%)
```

### How to Think About Adjusting Generated Palettes

When you get a palette from Coolors, Adobe Color, or any generator:

#### 1. **Check Saturation Consistency**
   - Are all brand colors similarly vibrant?
   - If one color has S=60% and others have S=100%, ask: "Is this intentional?"
   - **Action**: Adjust outliers to match the overall energy level

#### 2. **Map Out Hue Distribution**
   - Plot your colors on a mental color wheel
   - Look for gaps (opportunities) and clusters (conflicts)
   - **Action**: Spread colors to create distinct zones

#### 3. **Plan for Semantic Colors**
   - You need Error (red), Notice (yellow), Success (green)
   - Check if any brand colors occupy these hues
   - **Action**: Either adjust brand colors or choose different semantic hues

#### 4. **Use Complementary Colors Strategically**
   - If your brand is warm (red, orange, yellow), consider cool semantics (blue, purple, green)
   - If your brand is cool (blue, green), consider warm semantics (orange, yellow)
   - **Action**: Find complementary hues for Notice to make it stand out

#### 5. **Test in Your Generator**
   - Don't guess - use the HSL editor to experiment
   - Watch the validation messages
   - **Action**: Iterate until all bands generate successfully

### Real-World Decision Process

**Scenario**: You have Coolors palette with warm brand colors (blue, gold, orange, red)

**Question 1**: "Should I keep Accent at S=69%?"
- **Think**: Other brand colors are S=97-100%
- **Decide**: No, increase to S=100% for consistency
- **Why**: Vibrant palettes need uniform energy

**Question 2**: "Should Notice be the same as Secondary? Where should Notice go?"
- **Think**: Secondary (H=40°) and Tertiary (H=31°) are yellow-orange
- **Decide**: Use complementary - purple at H=270°
- **Why**: Maximum distinction from brand colors, no confusion

### Final Recommended Configuration

After applying all strategic adjustments:

```json
{
  // Brand Colors (High Saturation, Varied Lightness)
  "primary": "#003049",     // Deep Space Blue (H=201, S=100%, L=14%)
  "secondary": "#FCBF49",   // Sunflower Gold (H=40, S=97%, L=64%)
  "tertiary": "#F77F00",    // Princeton Orange (H=31, S=100%, L=48%)
  "accent": "#D62828",      // Flag Red (H=0, S=100%, L=50%) ← Increased from S=69%

  // Semantic Colors (Strategic Placement)
  "error": "#B84086",       // Muted Magenta (H=325, S=48%, L=49%) ← Fills empty hue area!
  "notice": "#C6A73D",      // Muted Gold (H=47, S=47%, L=51%) ← Matches Error saturation
  "success": "#2D8659"      // Muted Green (H=148, S=50%, L=35%)
}
```

**Key Changes from Coolors Original**:
1. ✅ **Accent S: 69% → 100%** (matches brand energy)
2. ✅ **Error: Changed from H=0° to H=325°** (magenta fills empty hue area, avoids conflict with Accent)
3. ✅ **Notice: Muted to S=47%** (matches Error saturation for semantic consistency)
4. ✅ **Error & Notice: Both S=47-48%** (serious tone, distinct from vibrant brand colors)

### Visual Hierarchy Guidelines

For vibrant brand palettes, follow this saturation hierarchy:

| Color Type | Saturation Range | Lightness Range | Purpose |
|------------|------------------|-----------------|----------|
| **Brand Colors** | 60-100% | 40-60% | Attract attention, express personality |
| **Semantic Colors** | 40-60% | 35-75% | Inform without overwhelming |
| **Text Colors** | 0-20% | 10-20% (light) or 90-97% (dark) | Maximum readability |
| **Backgrounds** | 0-10% | 95-100% (light) or 5-15% (dark) | Neutral canvas |

### Testing Your Palette

Use the generator's validation to ensure:

1. **Text Colors Pass AAA Contrast**:
   - text-on-light: Y ≤ 0.20 (dark enough)
   - text-on-dark: Y ≥ 0.85 (light enough)

2. **All Bands Generate Successfully**:
   - Each color should produce 3+ variations per band (lighter, light, dark, darker)
   - If validation fails, adjust L (lightness) in HSL editor

3. **Visual Distinction Test**:
   - View all colors side-by-side
   - Semantic colors should be clearly different from brand colors
   - No two colors should look identical at small sizes

### Common Mistakes to Avoid

❌ **Using Maximum Saturation Everywhere**
```json
// Too intense - everything screams for attention
{
  "error": "#FF0000",    // S=100%
  "notice": "#FFFF00",   // S=100%
  "success": "#00FF00"   // S=100%
}
```

✅ **Balanced Saturation Hierarchy**
```json
// Better - semantic colors are muted
{
  "error": "#B84040",    // S=50%
  "notice": "#D4A800",   // S=100% but darker L
  "success": "#2D8659"   // S=50%
}
```

❌ **Ignoring Lightness Differences**
```json
// All mid-range lightness - no hierarchy
{
  "primary": "HSL(200, 100%, 50%)",
  "secondary": "HSL(40, 100%, 50%)",
  "tertiary": "HSL(30, 100%, 50%)"
}
```

✅ **Strategic Lightness Variation**
```json
// Creates visual hierarchy through L values
{
  "primary": "HSL(200, 100%, 14%)",    // Very dark
  "secondary": "HSL(40, 97%, 64%)",    // Bright
  "tertiary": "HSL(30, 100%, 48%)"     // Medium
}
```

### HSL Editor Tips

When adjusting colors in the generator:

1. **Click the color swatch** to open the HSL editor
2. **Use up/down arrows** or **type numbers** to adjust values:
   - **H (Hue)**: 0-360° - Changes the color (red → orange → yellow → green → blue → purple)
   - **S (Saturation)**: 0-100% - Controls color intensity (0% = gray, 100% = vivid)
   - **L (Lightness)**: 0-100% - Controls brightness (0% = black, 50% = pure color, 100% = white)

3. **Quick adjustments**:
   - **To darken**: Decrease L (lightness)
   - **To lighten**: Increase L (lightness)
   - **To mute**: Decrease S (saturation)
   - **To shift hue**: Adjust H (hue)

**Pro Tip**: For semantic colors, adjust L first, then S if needed. Small L changes (5-10%) create noticeable differences.

### Psychology of Vibrant Palettes

Vibrant, high-saturation palettes evoke:
- **Energy** and **excitement**
- **Youth** and **playfulness**
- **Confidence** and **boldness**
- **Creativity** and **innovation**

Best for:
- Food and beverage brands
- Sports teams and athletic wear
- Youth-oriented products
- Festival and event marketing
- Creative agencies
- Entertainment and gaming

Avoid for:
- Financial services (needs trust/stability)
- Healthcare (needs calm/professionalism)
- Legal services (needs authority/seriousness)
- Luxury brands (needs sophistication/restraint)

### Real-World Example: Your Palette

Your successful configuration shows the strategy in action:

**Brand Colors** (Vibrant, High Saturation):
- Primary Lighter: HSL(260.8, 100%, 84.7%) - Bright blue
- Secondary Light: HSL(39.5, 96.9%, 62.2%) - Vibrant gold
- Tertiary Light: HSL(30.9, 100%, 86.7%) - Bright orange
- Accent Light: HSL(0.0, 68.2%, 91.4%) - Soft red

**Semantic Colors** (Muted, Adjusted Lightness):
- Notice Light: HSL(47.5, 100%, 72.7%) - Positioned between Secondary and Tertiary
- Error Light: HSL(0.0, 47.1%, 86.7%) - Lower saturation than Accent
- Success Light: HSL(150.0, 48.9%, 81.6%) - Distinct green

This creates a **cohesive yet functional** palette where brand colors attract attention while semantic colors inform without overwhelming.

### Summary: The Vibrant Palette Formula

1. **Brand colors**: High saturation (60-100%), varied lightness
2. **Semantic colors**: Moderate saturation (40-60%), strategic lightness placement
3. **Text colors**: Low saturation (0-20%), extreme lightness (very dark or very light)
4. **Use HSL editor**: Adjust L to create distinction, S to control intensity
5. **Test thoroughly**: Ensure AAA contrast and visual distinction

### Quick Reference: Critical Thinking Checklist

When you import a palette from Coolors, Adobe Color, or any generator, ask yourself:

#### ✅ Saturation Check
- [ ] Are all brand colors at similar saturation levels (within 10%)?
- [ ] If not, is the variation intentional or an oversight?
- [ ] Should I adjust outliers to match the overall energy?

#### ✅ Hue Distribution Check
- [ ] Are my brand colors spread across the color wheel?
- [ ] Do I have any hue clusters (colors within 20° of each other)?
- [ ] Where will my semantic colors (Error, Notice, Success) fit?

#### ✅ Semantic Color Planning
- [ ] Does any brand color occupy red (Error), yellow (Notice), or green (Success)?
- [ ] If yes, how will I differentiate semantic from brand?
- [ ] What hue should Notice be? (Hint: Use complementary to your dominant brand hue)

#### ✅ Complementary Strategy
- [ ] What's the average hue of my warm brand colors?
- [ ] What's the complementary hue (add 180°)?
- [ ] Can I use this for Notice to create maximum distinction?

#### ✅ Accessibility Validation
- [ ] Do my text colors pass AAA contrast (Y ≤ 0.20 for dark, Y ≥ 0.85 for light)?
- [ ] Does each color generate 3+ variations per band?
- [ ] Are semantic colors visually distinct at small sizes?

### Remember: You're the Designer

**Palette generators are tools, not authorities.** They don't know:
- Your WordPress theme needs semantic colors
- Your brand needs consistent saturation
- Your users need clear visual hierarchy
- Your accessibility requirements (AAA contrast)

**Trust your judgment:**
- If Accent feels less vibrant than Primary, increase its saturation
- If Notice looks too similar to Secondary, choose a complementary hue
- If the generator gives you 4 warm colors, add a cool semantic color
- If validation fails, adjust L (lightness) in the HSL editor

**The generator validates your choices** - use it to experiment and iterate until you have a palette that's both beautiful and functional.

By following these guidelines, you can create vibrant, energetic palettes that are both visually striking and functionally sound.
