---
name: css-best-practices
description: Write, refactor, or review CSS for predictable scope, cascade, layout, responsive behaviour, theming, accessibility, and rendering performance.
---

# CSS

## Goal

Keep styling predictable across scopes, themes, layouts, browser targets, and user preferences.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Scope and cascade**

- [ ] **Local styles** - Follow repository scoping; keep component styles local.
- [ ] **Explicit variants** - Avoid variants that depend on incidental ancestors.
- [ ] **Specificity** - Keep selectors and nesting predictable and low-specificity.
- [ ] **Native nesting** - Write class suffixes explicitly; & cannot concatenate them.
- [ ] **Layer order** - Account for unlayered and third-party styles.
- [ ] **Important overrides** - Justify !important; do not use it by default.
- [ ] **Stylesheet imports** - Keep @import top-level; account for loading or bundling.
- [ ] **File responsibilities** - Keep component rules together; separate tokens, resets, and utilities.

**Tokens and themes**

- [ ] **Token definitions** - Define every custom property in its relevant scope.
- [ ] **Token reuse** - Reuse recurring tokens; avoid tokenising every one-off dimension.
- [ ] **Optional fallbacks** - Use fallbacks only for optional tokens.
- [ ] **Theme selection** - Preserve user selection and system preferences.
- [ ] **Theme pairs** - Verify actual foreground/background token pairs and contrast in every theme.

**Layout and compatibility**

- [ ] **Normal layout** - Prefer flow, Grid, or Flexbox over unnecessary positioning hacks.
- [ ] **Child spacing** - Use gap for flex or grid spacing where suitable.
- [ ] **Layout direction** - Use logical properties where direction matters.
- [ ] **Responsive sizing** - Match sizing to the intended container or viewport.
- [ ] **Sticky positioning** - Check the scroll container and ancestor overflow.
- [ ] **Content extremes** - Test narrow containers, long content, and empty states for overflow or clipping.
- [ ] **Reset defaults** - Preserve useful defaults; include pseudo-elements in box sizing.
- [ ] **Browser support** - Check supported browsers and embedded runtimes; add usable fallbacks.

**Accessibility**

- [ ] **Visible focus** - Keep keyboard focus and control affordances visible.
- [ ] **Text contrast** - Verify at least 4.5:1 for normal text and 3:1 for large text.
- [ ] **Reduced motion** - Preserve final states and required interactions.
- [ ] **Contrast preferences** - Check forced colours and increased contrast where supported.
- [ ] **State cues** - Convey state through more than colour.
- [ ] **Text reflow** - Check zoom, larger text, and translations for clipping.
- [ ] **Hidden content** - Keep meaningful hidden content accessible to assistive technology.

**Rendering costs**

- [ ] **Measured costs** - Require measurements for performance-driven complexity, not selector syntax.
- [ ] **Animation costs** - Check repeated layout work and relevant compositing.
- [ ] **Rendering hints** - Verify traces justify will-change and its lifetime follows the work.
- [ ] **Containment** - Preserve intended layout, sizing, and painting.

- [ ] **Fonts and stability** - Keep text available, match font payloads to actual use and check layout shifts.

## Guidance

### Scope and cascade

Inspect selectors where they are used, including third-party and unlayered styles.

Read [CSS architecture](references/architecture.md) for naming, specificity, layers, imports, nesting, and file organisation.

### Tokens and themes

Trace custom properties through their definition, scope, and theme overrides to distinguish missing required tokens from optional values.

Read [tokens and theming](references/tokens-theming.md) for token tiers, component scope, theme pairs, fallbacks, and typed properties.

### Layout and compatibility

Test layout in its actual component container and scroll hierarchy, including supported embedded runtimes.

Read [layout and responsiveness](references/layout-responsive.md) for flow, spacing, logical properties, sticky positioning, and bounded fluid sizing. Read [reset and compatibility](references/reset-compatibility.md) when resets, native defaults, browser support, or fallbacks change. For presentation-only scripting and font loading, read [CSS performance](references/performance.md). For markup and browser interaction, use [HTML guidance](../html-best-practices/SKILL.md).

### Accessibility

Read [CSS accessibility](references/accessibility.md) for focus, motion, contrast, forced colours, reflow, and visually hidden content.

### Rendering costs

Use rendering traces to distinguish selector, layout, paint, and compositing costs before accepting more complex code.

Read [CSS performance](references/performance.md) for selectors, animation, containment, and presentation choices. Load [TypeScript performance guidance](../typescript-best-practices/SKILL.md#performance-and-resources) for wider computation, I/O, or resource concerns.
