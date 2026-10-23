# Reset and compatibility

## Reset behaviour

- Reuse the existing reset. Add a small reset only when the project needs one.
- Keep resets in the intended cascade layer. Preserve useful browser defaults unless replacing them deliberately.

  ```css
  @layer reset {
    body { margin: 0; }
    /* Article lists retain their browser-provided markers. */
  }
  ```

- Include pseudo-elements when applying shared box sizing.

  ```css
  @layer reset {
    *, *::before, *::after { box-sizing: border-box; }
  }
  ```

- Make media responsive and form controls inherit typography where appropriate.

  ```css
  @layer reset {
    img, video { max-width: 100%; height: auto; }
    input, button, textarea, select { font: inherit; }
  }
  ```

- Do not remove focus indicators or native cues for using controls without accessible replacements.

## Browser support

- Check features against the project's supported browsers and embedded runtimes.
- Verify current compatibility before using nesting, scope, container queries, anchor positioning, or view transitions.
- Use `@supports` and a usable fallback where support is incomplete. Do not maintain fixed browser-version claims here.

  ```css
  .cards { display: flex; flex-wrap: wrap; }
  @supports (display: grid) {
    .cards { display: grid; grid-template-columns: repeat(2, 1fr); }
  }
  ```
