# Design System Specification: The Digital Printing House (Dark Mode)

## 1. Overview & Creative North Star
**Creative North Star: "The Intelligent Ledger"**

This design system is not a standard interface; it is a high-density, authoritative environment that bridges the gap between a 19th-century master printer’s ledger and a futuristic command terminal. It rejects the "floaty" nature of modern SaaS apps in favor of structural groundedness, precision, and tactile permanence.

The experience is defined by **intentional density**. We do not fear information; we organize it through rigorous archival logic. By utilizing a 1px "Ink-Line" grid and tonal layering, we create a UI that feels "stamped" into dark-stained wood rather than floating over a screen.

---

## 2. Colors & Surface Logic

The palette is derived from natural, aged materials: heavy carbon paper, oxidized steel, and tarnished brass.

### The Palette (Material Design Tokens)
*   **Surface (Background):** `#181213` (Deep Charcoal/Stained Wood)
*   **Primary (Ink):** `#fddbdb` / `#e0bfbf` (Aged Parchment)
*   **Secondary (Steel):** `#bdc7d6` (Muted Slate)
*   **Tertiary (Brass):** `#ffdeb2` (Muted Gold)

### The "Ink-Line" Rule
Unlike typical "soft" UIs, this system embraces the **1px hairline**. Sectioning is achieved through `outline_variant` (`#4f4444`) at 100% opacity for structural grids, or via background shifts. 
*   **Nesting:** To create depth, move from `surface` to `surface_container_low` for inset content, and `surface_container_high` for elevated technical panels.
*   **The Gradient Rule:** Use a subtle linear gradient on primary CTAs—transitioning from `primary` (#fddbdb) to `primary_container` (#e0bfbf)—to mimic the slight unevenness of physical ink on paper.

---

## 3. Typography
The pairing of **Newsreader** (Serif) and **Work Sans** (Sans-Serif) creates a dialogue between editorial heritage and functional clarity.

*   **Display & Headlines (Newsreader):** Use for storytelling and high-level data categories. The optical sizing of Newsreader should be leveraged to maintain a "stamped" look even at large scales.
*   **Body & Labels (Work Sans):** Use for technical data, ledger entries, and UI controls. The high x-height of Work Sans ensures legibility against the dark charcoal background.
*   **Hierarchy Note:** All "Labels" should be set in `label-md` or `label-sm` using `secondary` (Steel) to distinguish meta-data from primary content.

---

## 4. Elevation & Depth
In a "Digital Printing House," there are no floating shadows. Depth is achieved through **Tonal Stacking** and **Material Contrast**.

*   **The Layering Principle:** 
    *   Base Layer: `surface`
    *   Navigation/Sidebar: `surface_container_low`
    *   Active Work Area: `surface_container`
    *   Modals/Overlays: `surface_container_highest`
*   **The Ghost Border:** For high-density data cells, use `outline_variant` at 20% opacity. This creates a "Ghost Border" that guides the eye without cluttering the composition.
*   **Glassmorphism:** Reserved strictly for "HUD" style overlays. Use `surface_container_high` at 85% opacity with a `20px` backdrop blur to suggest a frosted lens placed over the ledger.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary` background with `on_primary` text. No rounded corners (`0px`).
*   **Secondary (Steel):** `outline` border (1px) with `secondary` text.
*   **Tertiary (Brass):** Ghost button with `tertiary` text, used exclusively for high-value "Gold" actions (e.g., Save, Publish).

### Input Fields
*   **Architecture:** Rectangular, 1px border using `outline`. 
*   **State:** When focused, the border shifts to `primary` (Ink). 
*   **Labeling:** Labels should be positioned *inside* the border at `label-sm` size, mimicking a pre-printed form.

### Cards & Ledger Rows
*   **Constraint:** Do not use shadows to define cards. Use a `1px` border of `outline_variant`.
*   **Lists:** Forbid divider lines between list items. Instead, use alternating row tints: `surface` and `surface_container_low`.

### Data Chips
*   **Style:** Small-caps `Work Sans`. Background is `secondary_container` with `on_secondary_container` text. These should look like metal slugs used in a printing press.

---

## 6. Do’s and Don’ts

### Do
*   **Use 0px Border Radius:** Everything must be sharp. The "Sovereign" feel comes from the precision of right angles.
*   **Embrace High Density:** This system thrives when screens are full of information, organized by strict 1px grids.
*   **Color for Function:** Use **Brass** only for final actions and **Steel** for technical/utilitarian data.

### Don’t
*   **No Vibrant Neons:** Never use pure #0000FF or #00FF00. Even errors must use the muted `error` token (#ffb4ab).
*   **No Rounding:** Do not use `8px` or even `2px` corners. It breaks the "Ledger" metaphor.
*   **No Standard Shadows:** If an element needs to feel "above" another, use a 1px border or a lighter surface tone. Standard drop shadows feel "cheap" in this context.

### Accessibility Note
Maintain a contrast ratio of at least 4.5:1 for all body text. The `primary` (Ink) on `surface` (Charcoal) provides a high-contrast, low-strain reading experience ideal for long-form technical work.