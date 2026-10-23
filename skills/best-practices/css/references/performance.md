# CSS performance

## Measurement and selectors

- Measure a rendering problem before replacing readable CSS with a more complex strategy.
- Keep selectors direct for maintainability; do not assume selector syntax alone proves a bottleneck.

## Animation and rendering

- Prefer transform and opacity animations when appropriate; verify compositing rather than assuming GPU acceleration.
- Avoid repeated layout work from animated dimensions or position properties on hot paths.

  ```css
  .indicator { transition: transform 150ms; }
  .indicator--active { transform: translateX(1rem); }
  @media (prefers-reduced-motion: reduce) {
    .indicator { transition: none; }
  }
  ```

- For `will-change`, identify the animated property and inspect a rendering trace showing why preparation helps. Verify activation and removal follow the animation's lifetime; not every animation needs a hint.
- Use containment only when its layout, sizing, and paint boundaries preserve intended behaviour.
- Prefer CSS for presentation that does not need application state or script coordination. Consider layout, scroll snapping, `:has()` and container queries before adding presentation-only TypeScript. Check target browser support and required fallbacks.

  ```css
  .button { background: #fff; color: #111; }
  .button:hover { background: #eee; }
  ```

## Fonts and page stability

Keep text readable while fonts load. Choose font loading behaviour for the actual page.

```css
@font-face {
  font-family: "Body";
  src: url("/fonts/body.woff2") format("woff2");
  font-display: swap;
}
```

- Download only the weights and character sets needed.
- Compare variable fonts with individual files for the weights actually used.
- Check layout shift and responsiveness alongside loading time.
