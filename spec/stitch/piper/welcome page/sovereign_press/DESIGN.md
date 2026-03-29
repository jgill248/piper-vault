# Editorial Design System: The Digital Printing House

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Sovereign Press."** 

This system moves away from the sterile, fleeting nature of modern SaaS and toward the permanence of a 19th-century printing house. It is designed to feel authoritative, secure, and curated. We achieve this by blending the industrial weight of slab-serif typography with a sophisticated, layered color palette that mimics antique parchment and heavy ink. 

To break the "template" look, layouts must embrace **Intentional Asymmetry**. Instead of perfectly centered grids, we use weighted content blocks, overlapping "paper" layers, and hero elements that break the container boundaries (as seen in the character illustration overlapping the background). This creates a sense of depth and physical presence—as if the software is being "pressed" onto the screen.

---

## 2. Colors
Our palette is rooted in high-contrast editorial tones. We use deep saturations for "ink" and warm, desaturated tones for "paper."

### Color Tokens
*   **Primary (Ink):** `#570013` (Deep Burgundy) - Used for primary actions and key branding.
*   **Secondary (Steel):** `#4f6073` (Navy Blue) - Used for navigation backgrounds and technical UI elements.
*   **Background (Parchment):** `#fff9ee` - The base layer for all views.
*   **Tertiary (Brass/Gold):** `#362400` - Used for premium highlights and industrial accents.

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for sectioning. To define a new content area, you must use **Background Color Shifts**. 
*   Place a `surface_container` (`#f5edd9`) block over a `surface` (`#fff9ee`) background.
*   The transition between these two tones is the boundary. This creates a more natural, sophisticated separation than a harsh digital line.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. 
1.  **Base Layer:** `surface` (The desk).
2.  **Mid Layer:** `surface_container_low` (The document folder).
3.  **Top Layer:** `surface_container_highest` (The active sheet of paper).
Use these shifts to guide the eye toward the most important information without adding visual clutter.

### Signature Textures
Apply a subtle gradient to main CTAs transitioning from `primary` (#570013) to `primary_container` (#800020). This provides a "stamped ink" feel rather than a flat digital fill.

---

## 3. Typography
The typography system is a dialogue between the industrial past and the technical present.

*   **Headings (Newsreader):** Use for `display` and `headline` levels. This slab-serif has an authoritative, technical weight. It should be used in high-contrast sizes (e.g., `display-lg` at 3.5rem) to establish a "Front Page" hierarchy.
*   **Body & Labels (Work Sans):** Use for all functional text. This sans-serif is clean and highly readable, providing the "Modern SaaS" counter-balance to the vintage headings.

**Editorial Tip:** Use `letter-spacing: -0.02em` on large headlines to mimic the tight kerning of vintage lead-type printing.

---

## 4. Elevation & Depth
In this system, depth is conveyed through **Tonal Layering** rather than drop shadows.

*   **The Layering Principle:** A "floating" card should be achieved by placing a `surface_container_lowest` (#ffffff) card on a `surface_container_low` (#fbf3df) section. This creates a soft, natural lift.
*   **Ambient Shadows:** If a shadow is required for a floating "Vault Door" or "File Cabinet" card, use a large blur radius (20px+) with only 5% opacity. The shadow color must be a tinted version of the surface—never pure grey.
*   **The Ghost Border Fallback:** If a border is required for accessibility, use the `outline_variant` (#e0bfbf) at 20% opacity. It should feel like a faint indentation in the paper, not a stroke.
*   **Glassmorphism:** For the navigation bar or floating tooltips, use `surface_container` with a `backdrop-filter: blur(12px)`. This allows the "parchment" background to bleed through, maintaining the warm tone of the system.

---

## 5. Components

### Buttons (The Stamped Effect)
*   **Primary:** Solid `primary` (#570013) fill. On hover, apply a `primary_container` (#800020) gradient. Use `roundedness-sm` (0.125rem) to maintain a sharp, industrial edge.
*   **Secondary:** Solid `secondary` (#4f6073).
*   **States:** Use a 1px inner shadow on `active` (click) states to simulate a physical "press" into the paper.

### Cards & Lists (The Editorial Block)
*   **Cards:** Strictly forbid divider lines. Use `spacing-6` (2rem) of vertical white space to separate items.
*   **Icons:** Use vintage technical engravings (monochrome, high-detail). These should look like assets from a 1920s patent filing.
*   **Layout:** Use asymmetrical padding—for example, more padding at the bottom of a card than the top—to give a "hand-laid" feel.

### Input Fields (The Ledger)
*   **Style:** Text inputs should not be boxes. Use a solid `outline_variant` bottom-border ONLY, mimicking a line on a ledger or a typewriter sheet.
*   **Focus:** On focus, the bottom border transitions to `primary` (Burgundy) with a subtle `surface_variant` background fill.

### Additional Component: The "Seal" (Premium Badge)
*   For premium tiers or "Sovereign" features, use a circular component with a `tertiary_fixed` (Gold) background and a `tertiary` (Dark Brass) thin ghost border. Use the `headline-sm` font for its label.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use large amounts of white space (Parchment) to let the typography breathe.
*   **Do** overlap elements. Let an icon or an illustration "break" out of its container to create depth.
*   **Do** use `newsreader` for numbers and data points to make them feel like "intelligence" rather than just data.

### Don't:
*   **Don't** use 100% opaque, high-contrast borders. It breaks the organic paper feel.
*   **Don't** use vibrant, neon "tech" colors. Stick to the muted, ink-based palette.
*   **Don't** use large border-radii. Keep corners at `sm` or `md` (max 0.375rem) to maintain the industrial, "cut paper" aesthetic.
*   **Don't** use standard "Material" icons. Always opt for the custom engraving style to maintain brand authority.