# Design Check

Validates frontend code against the Obsidian Protocol design system.

## Instructions

When the user invokes this skill, review the specified files (or all frontend code) against the Obsidian Protocol design system defined in `spec/stitch/obsidian_protocol/DESIGN.md`.

### Checklist

1. **Corners:** All components must use `0px` border-radius — no rounded corners
2. **Shadows:** No drop shadows allowed — use background color shifts or tinted ambient glows
3. **Surfaces:** Correct tonal recess hierarchy:
   - Base: `#111417`
   - Inset (data areas): `#0c0e12`
   - Raised (overlays): `#282a2e`
   - Deepest background: `#05070A`
4. **Typography:**
   - Display/headline: Manrope
   - Title/body/UI: Inter
   - Labels/data/numbers/tables: JetBrains Mono
5. **Borders:** No 1px solid borders for sectioning — use surface color shifts instead
6. **CTAs:** Primary buttons use `#abd600` with 4px phosphor glow at 30% opacity
7. **Inputs:** Command-line style — bottom-border only, `0px` radius
8. **Chips/tags:** Rectangular, monospace labels
9. **Density:** High-density layouts — avoid excessive padding
10. **Hover states:** Use `surface_container_high` (#282a2e) background shifts

Report violations with file path, line number, and the specific design rule being broken.
