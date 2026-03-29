# Design System Document

## 1. Overview & Creative North Star: The Sovereign Press
This design system is built upon the "Sovereign Press" aesthetic—a digital interpretation of a 19th-century printing house. The **Creative North Star** is **"The Digital Curator."** It rejects the sterile, symmetrical patterns of modern SaaS in favor of a layout that feels heavy, authoritative, and physically manifested. 

We achieve this through **Intentional Asymmetry**. Large-scale headlines are offset, imagery is rarely centered, and white space is treated as "the margins of a broadsheet." The user should feel they are not just looking at data, but reviewing a curated ledger of intelligence. Every pixel must feel like it was struck by a heavy iron press.

---

## 2. Colors: Ink, Steel, and Parchment
The palette is rooted in high-contrast, historical tones. It prioritizes legibility and a sense of archival permanence.

- **Primary (#570013):** "Ink." Used for headers, primary actions, and brand-critical moments. It carries the weight of a fresh stamp.
- **Secondary (#4f6073):** "Steel." Represents the industrial machinery. Used for functional elements, secondary highlights, and technical details.
- **Background (#fff9ee):** "Parchment." A warm, off-white base that prevents the digital fatigue associated with pure white screens.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through **Background Color Shifts**. 
- To separate a section, shift from `surface` (#fff9ee) to `surface-container-low` (#f9f3e8) or `surface-container` (#f3ede2).
- This creates a "stacked paper" effect, where hierarchy is felt through tonal weight rather than artificial wires.

### Glass & Gradient Rules
For floating elements or hero states, use **Glassmorphism** with a backdrop-blur (12px–20px) and a semi-transparent `surface-container` fill. To add "soul" to primary CTAs, apply a subtle linear gradient from `primary` (#300007) to `primary_container` (#570013) at a 45-degree angle, simulating the uneven distribution of ink on a metal plate.

---

## 3. Typography: Authority in Print
The typographic pairing is a dialogue between industrial power and functional clarity.

- **Headings (Newsreader):** An authoritative, industrial slab-serif. It is the voice of the Press.
    - *Usage:* `display-lg` to `headline-sm`.
    - *Style:* Use tight tracking (-2%) for large displays to mimic manual typesetting.
- **Body & Functional (Work Sans):** A clean, modern sans-serif that ensures the technical nature of the "Vault" remains accessible.
    - *Usage:* `title-lg` to `label-sm`.
    - *Style:* Increased line-height (1.6) for body text to maintain the "ledger" feel.

---

## 4. Elevation & Depth: Tonal Layering
In this system, depth is a physical property of stacked material, not a digital shadow.

- **The Layering Principle:** Stacking follows the Material 3 surface tiers. A card should be `surface-container-lowest` placed upon a `surface-container-low` background. This creates a natural "lift."
- **Ambient Shadows:** Standard drop shadows are forbidden. When an element must float (e.g., a modal), use an ultra-diffused shadow: `box-shadow: 0 20px 40px rgba(29, 28, 21, 0.06)`. The shadow color must be a tint of `on-surface` (#1d1c15), never pure grey.
- **The "Ghost Border" Fallback:** If a boundary is strictly required for accessibility, use the `outline-variant` token at 15% opacity. It should be felt, not seen.

---

## 5. Components: The Stamped Ledger
Every component must look like a physical object from a 19th-century bureau.

- **Buttons (The "Stamped" Effect):**
    - **Primary:** Solid `primary_container` with `on_primary` text. No rounded corners (`0px`). On hover, use a slight inner shadow to simulate the button being "pressed" into the parchment.
    - **Secondary:** `secondary` fill with a "Ghost Border."
- **Input Fields (The Ledger):** Remove the bounding box. Inputs are defined by a single 1px line at the bottom (`outline` token). Labels (`label-md`) sit above the line in `secondary` color.
- **Cards:** No borders. Cards are defined by a `surface-container-highest` background shift. Use intentional asymmetry by offsetting the content padding (e.g., `padding-left: 2.75rem`, `padding-right: 1.4rem`).
- **Icons:** Icons must be **Vintage Technical Engravings**. They should be thin-line, high-detail illustrations (e.g., a vault wheel, a mechanical press, or a fountain pen nib).
- **Checkboxes & Radios:** Sharp `0px` corners. Checked states should look like an "X" struck by a typewriter.
- **Lists:** Forbid divider lines. Use `spacing-4` (1.4rem) of vertical white space to separate items.

---

## 6. Do's and Don'ts

### Do
- **Do** use `0.5px` noise overlays on large background areas to simulate paper grain.
- **Do** align large headlines to the left while keeping body text in narrower, offset columns to create "Intentional Asymmetry."
- **Do** use the `primary_fixed` color for subtle text highlights within long-form copy.

### Don't
- **Don't** use border-radius. All corners must be `0px` (sharp).
- **Don't** use standard blue for links. Use `primary` (#570013) with a `secondary` underline.
- **Don't** center-align long blocks of text. The "Sovereign Press" is structured like a newspaper; it is columnar and left-justified.
- **Don't** use vibrant, neon "success" colors. Use a deep forest green or the `secondary` navy to indicate status.