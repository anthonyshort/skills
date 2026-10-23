---
name: css
description: Write, refactor, or review CSS for predictable scope, cascade, layout, responsive behaviour, theming, accessibility, and rendering performance.
---

# CSS

## Goal

Keep styling predictable across scopes, themes, layouts, browser targets, and user preferences.

## Guidance

### Scope and cascade

Inspect selectors where they are used, including third-party and unlayered styles.

Read [CSS architecture](references/architecture.md) for naming, specificity, layers, imports, nesting, and file organisation.

### Tokens and themes

Trace custom properties through their definition, scope, and theme overrides to distinguish missing required tokens from optional values.

Read [tokens and theming](references/tokens-theming.md) for token tiers, component scope, theme pairs, fallbacks, and typed properties.

### Layout and compatibility

Test layout in its actual component container and scroll hierarchy, including supported embedded runtimes.

Read [layout and responsiveness](references/layout-responsive.md) for flow, spacing, logical properties, sticky positioning, and bounded fluid sizing. Read [reset and compatibility](references/reset-compatibility.md) when resets, native defaults, browser support, or fallbacks change. For presentation-only scripting and font loading, read [CSS performance](references/performance.md). For markup and browser interaction, use [HTML guidance](../html/SKILL.md).

### Accessibility

Read [CSS accessibility](references/accessibility.md) for focus, motion, contrast, forced colours, reflow, and visually hidden content.

### Rendering costs

Use rendering traces to distinguish selector, layout, paint, and compositing costs before accepting more complex code.

Read [CSS performance](references/performance.md) for selectors, animation, containment, and presentation choices. Load [TypeScript performance guidance](../typescript/SKILL.md#performance-and-resources) for wider computation, I/O, or resource concerns.
