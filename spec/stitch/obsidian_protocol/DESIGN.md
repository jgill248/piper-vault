```markdown
# Design System Strategy: The Intelligent Ledger

## 1. Overview & Creative North Star
**Creative North Star: "The Sovereign Console"**

This design system is engineered to feel like a high-fidelity instrument for local intelligence. It rejects the "bubbly" consumer web in favor of a **Sovereign Console** aesthetic: a high-density, technical environment that communicates precision, security, and raw computing power. 

We break the standard "SaaS dashboard" template by utilizing **monolithic layouts** and **asymmetric data density**. The experience should feel like looking at a high-end physical hardware interface—think CNC-machined aluminum and phosphor-glow CRT displays—reimagined with modern, ultra-sharp digital clarity. We use extreme contrast between utilitarian monospace data and sophisticated editorial typography to signal a tool that is both "under-the-hood" technical and "Director-level" authoritative.

---

## 2. Colors & Surface Architecture
The palette is rooted in the "Deepest Obsidian" (#05070A), providing a void-like backdrop that makes technical data "pop" with phosphor-like intensity.

### Surface Hierarchy & Nesting
Instead of using shadows to create depth, we use **Tonal Recess**. We treat the screen as a single block of material where sections are "milled" out.
*   **Base Layer:** `surface` (#111417) for the primary application frame.
*   **The Inset:** Use `surface_container_lowest` (#0c0e12) for the main data ledger area to create a "sunken" feel, signaling where the heavy processing happens.
*   **The Raised:** Use `surface_container_high` (#282a2e) only for ephemeral overlays or hovering command palettes.

### The "No-Line" Rule & Signature Textures
*   **Prohibit 1px solid borders for sectioning.** Structural boundaries must be defined by shifts from `surface` to `surface_container_low`. 
*   **The Phosphor Glow:** Main CTAs should use a subtle glow effect rather than a flat fill. Use `primary` (#abd600) with a 4px blur of the same color at 30% opacity to mimic a glowing terminal screen.
*   **Scanline Overlay:** Apply a global, fixed position `::after` element with a repeating linear gradient (0.5px lines) at 3% opacity to provide a "technical glass" texture over the entire UI.

---

## 3. Typography: The High-Contrast Mix
The typographic soul of this system lies in the friction between the human-readable (Manrope/Inter) and the machine-executable (JetBrains Mono).

*   **The Narrative (Manrope):** Use for `display` and `headline` levels. This provides a premium, editorial feel that balances the technical density.
*   **The Interface (Inter):** Use for `title` and `body` levels. It is the invisible workhorse for navigation and general UI instructions.
*   **The Data (JetBrains Mono):** Use for all `label` scales and any numerical/technical values. *Crucial:* All data within tables must be Monospace to ensure columns align perfectly, reinforcing the "Ledger" aesthetic.

---

## 4. Elevation & Depth
In this system, "Elevation" is a misnomer; we prefer **"Luminance Layering."**

*   **Tonal Layering:** To separate a sidebar from a content area, do not use a line. Transition from `surface_dim` to `surface_container`.
*   **The Ghost Border:** If a visual anchor is required (e.g., in a high-density data table), use `outline_variant` (#45474a) at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism:** For floating modals, use `surface_container_highest` at 80% opacity with a `backdrop-blur: 12px`. This creates a "frosted terminal" effect that maintains the technical mood while providing necessary focus.

---

## 5. Components

### Buttons: The "Active Terminal" Variant
*   **Primary:** Solid `primary` (#abd600) background, `on_primary` text. `0px` border-radius. On hover, add a `primary_container` outer glow.
*   **Secondary:** `0px` radius, `outline` border at 20% opacity. Text in `primary`.
*   **Tertiary:** Text-only, JetBrains Mono, all-caps, with a `_` (underscore) suffix to mimic a command prompt.

### Data-Dense Tables (The Ledger)
*   **Header:** `surface_container_low` background, `label-sm` (Monospace) text in `on_surface_variant`.
*   **Rows:** No horizontal dividers. Use a `2px` vertical margin between rows. On hover, change the background to `surface_container_high`.
*   **Cell Alignment:** Use the **Spacing Scale `2` (0.4rem)** for cell padding to maintain extreme density without sacrificing legibility.

### Input Fields: "Command Line" Style
*   **Default:** `surface_container_lowest` background, `0px` radius, bottom-border only using `outline_variant`.
*   **Active:** Bottom-border shifts to `primary`. Add a subtle scanline texture inside the input area.
*   **Labels:** Always use `label-sm` (Monospace) positioned *above* the input, never floating inside.

### Chips: "Status Indicators"
*   Rectangular (`0px` radius). 
*   Use `secondary_container` for neutral tags and `tertiary` for high-priority intelligence flags.
*   Font: `label-sm` (Monospace).

---

## 6. Do's and Don'ts

### Do:
*   **Use Asymmetry:** Allow one column to be significantly denser than others to create a "pro-tool" layout.
*   **Embrace the Grid:** Align every element to the `0.2rem` (Spacing 1) base unit. Precision is the brand.
*   **Monospace for Numbers:** Always use JetBrains Mono for timestamps, file sizes, and coordinates.

### Don't:
*   **No Rounded Corners:** `0px` is the absolute rule. Any radius breaks the "machined" aesthetic.
*   **No Drop Shadows:** Avoid standard black shadows. Use background color shifts or very soft, tinted ambient glows.
*   **No "Fluff" Padding:** While whitespace is important for editorial layouts, this tool is "High-Density." Avoid excessive padding that forces unnecessary scrolling.

---

## 7. Implementation Note for Junior Designers
When building a new view, ask yourself: *"Does this look like a consumer app or a specialized instrument?"* If it feels too friendly, sharpen the edges, switch the labels to Monospace, and reduce the background luminance. We are building for the user who finds beauty in the machine.```