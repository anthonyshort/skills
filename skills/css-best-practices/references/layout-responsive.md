# Layout and responsiveness

## Flow and spacing

- Use Flexbox for one-dimensional flow and Grid for two-dimensional layout.

  ```css
  .actions { display: flex; }
  .dashboard { display: grid; grid-template-columns: 1fr 2fr; }
  ```

- Prefer `gap` for spacing among flex or grid children.

  ```css
  .actions { display: flex; gap: 1rem; }
  ```

- Use `aspect-ratio` for media frames instead of padding hacks.

  ```css
  .video-frame { aspect-ratio: 16 / 9; }
  ```

- Prefer normal flow over unnecessary absolute positioning. Reserve floats for text wrapping when needed.
- Avoid redundant widths and layout tricks such as zeroing font size to remove inline spacing.
- Use logical properties where direction-independent layout matters.

  ```css
  .label { margin-inline-start: 0.5rem; }
  ```

## Responsive behaviour

- Use container queries for component sizing and media queries for viewport or user preferences.

  ```css
  .card-wrapper { container-type: inline-size; }
  .card { display: grid; }
  @container (min-width: 30rem) {
    .card { grid-template-columns: 1fr 2fr; }
  }
  ```

- Check sticky positioning against the actual scroll container, ancestor overflow, and available space.
- Test narrow containers, long content, zoom, and empty states.

## Fluid sizing

- Use `clamp()` for bounded fluid type or spacing; keep text responsive to user settings.

  ```css
  .heading { font-size: clamp(1rem, 0.9rem + 0.5vw, 1.5rem); }
  ```

- Use `min()` and `max()` according to whether the value is an upper or lower bound.

  ```css
  .content {
    width: min(100%, 60rem);
    min-height: max(10rem, 20vh);
  }
  ```

- Allow grid items to shrink to the container when a fixed minimum would overflow.

  ```css
  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 17.5rem), 1fr));
    gap: 1rem;
  }
  ```

- Use existing tokens for recurring spacing and dimensions. Do not tokenise every one-off structural value.
