# Design System Strategy: The Intelligent Ledger

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Intelligent Ledger."** 

Unlike generic "dashboard" UIs, this system treats information as a high-value asset. It moves away from the "boxy" nature of standard SaaS tools in favor of an editorial, high-density environment that feels like a premium workspace for thought. We achieve this through **Intentional Asymmetry**—where the sidebar and main utility panels use distinct surface weights to ground the user—and **Tonal Depth**, replacing harsh lines with soft transitions in slate and indigo. The aesthetic isn't just "minimalist"; it is "purposeful," using high-contrast typography scales to guide the eye through complex RAG (Retrieval-Augmented Generation) data without cognitive overload.

---

## 2. Colors: Slate, Indigo, and Atmospheric Depth
Our palette is rooted in the depth of a late-night terminal session, elevated by the sophistication of violet accents.

### The "No-Line" Rule
To achieve a high-end feel, **1px solid borders for sectioning are strictly prohibited.** Do not use lines to separate the sidebar from the main content or the header from the body. Instead, define boundaries through background color shifts:
*   **Navigation/Sidebar:** Use `surface_container_low` (#131b2e).
*   **Main Workspace:** Use `surface` (#0b1326).
*   **Contextual Panels:** Use `surface_container_high` (#222a3d).

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. A code snippet should not be a "box" with a border; it should be a "recessed" area using `surface_container_lowest` (#060e20) to look as if it's carved into the interface. Conversely, active modals or popovers should use `surface_bright` (#31394d) to appear physically closer to the user.

### The "Glass & Gradient" Rule
Standard buttons are too "flat" for a premium tool. Use **Signature Textures**:
*   **Primary Actions:** Apply a subtle linear gradient from `primary` (#bdc2ff) to `primary_container` (#7c87f3) at a 135-degree angle.
*   **Floating Elements:** For command palettes or hovering tooltips, use `surface_container_highest` with a 20px backdrop-blur to create a "frosted slate" effect, allowing the deep indigo tones of the background to bleed through.

---

## 3. Typography: The Editorial Engine
The system uses a dual-typeface approach to balance human-centric readability with developer-focused precision.

*   **Display & Headlines (Manrope):** Use `display-sm` through `headline-lg` for high-level concepts and section titles. The wide apertures of Manrope convey intelligence and modernity.
*   **UI & Body (Inter):** All functional UI elements use Inter. Use `body-md` for standard text and `label-sm` for metadata.
*   **The Intelligence Layer (Mono):** For citations, RAG sources, and code blocks, use a high-quality Monospace font (e.g., JetBrains Mono). This signals "data integrity" to the user.
*   **Hierarchy Tip:** Never use bold for everything. Use `on_surface_variant` (#c7c4d7) in `body-sm` for secondary labels to create a sophisticated "muted" hierarchy that emphasizes the primary `on_surface` content.

---

## 4. Elevation & Depth: Tonal Layering
In "The Intelligent Ledger," shadows are rare; light is ambient.

*   **The Layering Principle:** Depth is achieved by stacking. Place a `surface_container_highest` card onto a `surface` background. The delta in luminance provides enough contrast for the eye to perceive elevation without visual clutter.
*   **Ambient Shadows:** If a floating element (like a context menu) requires a shadow, use a blur of 32px or higher. The shadow color must be a tinted version of the background (e.g., `rgba(6, 14, 32, 0.5)`), never pure black.
*   **The "Ghost Border" Fallback:** If accessibility requires a container boundary, use `outline_variant` (#464554) at **15% opacity**. This creates a "ghost" edge that defines the space without breaking the atmospheric flow of the slate backgrounds.

---

## 5. Components: Modern Utility

### Buttons & Chips
*   **Primary Button:** 8px roundness (`lg` scale). Uses the signature Indigo gradient. Text is `on_primary_fixed` (#000767) for maximum legibility.
*   **Chips:** Use `secondary_container` (#3c4a5e) with `label-md` typography. For "Source" chips in RAG results, use a leading icon and no border.

### Input Fields
*   **Search/Prompt Bar:** The heart of the app. Use `surface_container_highest`. Avoid a border; instead, use a 2px `primary` bottom-glow only when focused. Ensure the internal padding uses the `4` (0.9rem) spacing token.

### Cards & Lists
*   **The No-Divider Rule:** Forbid 1px dividers between list items. Use the spacing scale (`2` or `3`) to create "breathing room." Group items using a subtle background hover state of `surface_variant`.
*   **RAG Citations:** Displayed as side-car cards. Use `surface_container_low` with a `primary` left-accent bar (4px width) to denote "Source Material."

### New: The "Breadcrumb Ledger"
Instead of standard breadcrumbs, use a "Path" component in the header that uses Mono type for folder structures, separated by `outline_variant` slashes. This reinforces the local-first, file-system-friendly nature of the tool.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `surface_container_lowest` for code blocks to make them feel "embedded."
*   **Do** use `letter-spacing: -0.01em` on headlines to give them a premium, tight editorial look.
*   **Do** embrace density. Developers prefer seeing more data at once, provided the typography hierarchy is clear.

### Don't
*   **Don't** use pure black (#000000). The deepest tone should be `surface_container_lowest` (#060e20).
*   **Don't** use standard blue for links. Use `tertiary` (#ddb8ff) for a sophisticated violet-toned interactive state.
*   **Don't** use "Card" containers for everything. Let content float on the surface backgrounds and use whitespace to define "grouping."