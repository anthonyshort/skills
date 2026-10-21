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
- Prefer CSS for presentation that does not need application state or JavaScript coordination.

  ```css
  .button { background: #fff; color: #111; }
  .button:hover { background: #eee; }
  ```

- For wider computation, I/O, or resource concerns, load [shared performance](../../performance-best-practices/SKILL.md).
