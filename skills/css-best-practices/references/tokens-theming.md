# Tokens and theming

## Token structure and scope

- Reuse existing tokens for colours, typography, spacing, and shared dimensions.
- Separate primitive values, semantic roles, and component overrides when the design system needs those tiers.

  ```css
  :root {
    --grey-100: #f3f4f6;
    --surface: var(--grey-100);
  }
  .card {
    --card-surface: var(--surface);
    background: var(--card-surface);
  }
  ```

- Define every referenced custom property in the relevant scope.

  ```css
  :root { --color-bg: #fff; }
  .card { background: var(--color-bg); }
  ```

- Use fallbacks for optional properties. Do not hide a missing required token with an arbitrary fallback.

  ```css
  .card { display: grid; gap: var(--optional-gap, 1rem); }
  .card--compact { --optional-gap: 0.5rem; }
  ```

- Scope component variables to the component; keep shared theme roles at the theme boundary.

  ```css
  :root { --color-text: #111; }
  .card {
    --card-gap: 1rem;
    display: grid;
    gap: var(--card-gap);
    color: var(--color-text);
  }
  ```

## Themes and typed properties

- Preserve user theme selection and the repository's system-preference behaviour.
- Resolve changed foreground tokens against their actual backgrounds in each supported theme, including theme overrides and component scopes. Verify applicable contrast using [accessibility guidance](accessibility.md); check control and state cues separately from text.

  ```css
  :root { --color-bg: #f3f4f6; --color-text: #111827; }
  :root[data-theme="dark"] {
    --color-bg: #111827;
    --color-text: #f3f4f6;
  }
  .card { background: var(--color-bg); color: var(--color-text); }
  ```

- Use `@property` when typed values, inheritance control, or interpolation justify it and browser targets support it.

  ```css
  @property --progress {
    syntax: "<number>";
    inherits: false;
    initial-value: 0;
  }
  ```
