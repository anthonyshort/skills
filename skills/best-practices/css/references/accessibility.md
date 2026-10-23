# CSS accessibility

## Focus, motion, and state

- Preserve visible keyboard focus. Use `:focus-visible` without removing the only usable indicator.

  ```css
  .button:focus-visible {
    outline: 2px solid currentColor;
    outline-offset: 2px;
  }
  ```

- Respect reduced-motion preferences. Preserve the final state and any behaviour tied to animation completion.
- Check forced-colour mode and increased-contrast preferences where supported.

  ```css
  @media (forced-colors: active) {
    .button { border: 1px solid ButtonText; }
  }
  @media (prefers-contrast: more) {
    .button { border-width: 2px; }
  }
  ```

- Do not show state through colour alone; add text, symbols, or another perceptible cue.

  ```html
  <label for="email">Email</label>
  <input id="email" type="email" aria-invalid="true" aria-describedby="email-error">
  <p id="email-error">Enter a valid email address.</p>
  ```

## Text and reflow

- Check text contrast: at least 4.5:1 for normal text and 3:1 for large text.
- Use font sizing and layout that respect browser preferences and zoom.

  ```css
  .body-text { font-size: 1rem; line-height: 1.5; }
  ```

- Allow text reflow. Avoid clipping translated text, labels, or content at increased text sizes.

  ```css
  .button { white-space: normal; overflow-wrap: anywhere; }
  ```

- Keep visually hidden content available to assistive technology when it still conveys meaning.

  ```html
  <button type="button">
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor"><path d="M2 8h12M8 2v12" /></svg>
    <span class="visually-hidden">Add item</span>
  </button>
  ```
