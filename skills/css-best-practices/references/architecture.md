# CSS architecture

## Scope and organisation

- Follow the repository's scoping model: CSS Modules, scoped styles, BEM, or another established system.

  ```jsx
  import styles from "./Card.module.css";

  export function Card({ children }) {
    return <section className={styles.card}>{children}</section>;
  }
  ```

- Keep component styles local. Prefer an explicit variant over styles that happen to depend on ancestors.

  ```css
  .card { padding: 1rem; }
  .card--compact { padding: 0.5rem; }
  ```

- Use domain names for components and state names for variants. Keep global class names descriptive and unlikely to clash.

  ```css
  .invoice-card { border: 1px solid #666; }
  .invoice-card--overdue { border-width: 2px; }
  ```

- Keep selectors shallow. Avoid qualifying a class with an element type unless the element constraint matters.

  ```css
  .card__title { font-size: 1.25rem; }
  ```

- Keep component rules together; separate shared tokens, resets, and utilities by their responsibility.
- Do not force each class to set only one property. Keep related component styles together.

  ```css
  .card {
    padding: 1rem;
    border: 1px solid #666;
    background: #fff;
  }
  ```

- Keep specificity low: `.card` is `(0,1,0)`; `div.card` is `(0,1,1)`.

  ```css
  .card { padding: 1rem; } /* Specificity: (0,1,0). */
  ```

- Keep reusable rules independent of a parent selector.

  ```css
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  ```

## Layers

- Declare layer order once. Later layers win for normal declarations; important declarations reverse layer priority.

  ```css
  @layer reset, theme, components, utilities;

  @layer components {
    .card { padding: 1rem; }
  }
  ```

- Account for unlayered styles and third-party styles when choosing an override strategy.

  ```css
  @layer vendor, components;
  @import url("./vendor.css") layer(vendor);

  @layer components {
    .vendor-card { border-radius: 0.5rem; }
  }
  ```

- Use `!important` only for a justified override, not as the default cascade strategy.
- Keep native imports at the stylesheet's top level. Account for import loading costs or let the build pipeline bundle them.

  ```css
  @layer reset, theme, components, utilities;
  @import url("./reset.css") layer(reset);
  @import url("./theme.css") layer(theme);
  @import url("./components.css") layer(components);
  ```

## Nesting

- Use native nesting for related child rules, states, and responsive queries.

  ```css
  .button {
    padding: 0.5rem 1rem;
    &:focus-visible { outline: 2px solid currentColor; }
  }
  ```

- Keep nesting shallow. Check specificity when nesting under selector lists.

  ```css
  .card {
    & > .card__title { font-size: 1.25rem; } /* Specificity: (0,2,0). */
  }
  ```

- Write BEM suffix classes explicitly; native `&` does not concatenate class names.

  ```css
  .card__title { font-size: 1.25rem; }
  .card__title--large { font-size: 1.5rem; }
  ```

- For wider ownership or abstraction changes, load [shared architecture](../../architecture-best-practices/SKILL.md).
