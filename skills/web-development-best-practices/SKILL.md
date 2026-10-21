---
name: web-development-best-practices
description: Write, refactor, or review web interfaces using semantic HTML, native browser APIs, progressive enhancement, accessible interactions, and appropriate tooling.
---

# Web development

## Goal

Build usable, accessible web interfaces. Choose suitable platform features and verify loading and failure behaviour.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Platform choices**

- [ ] **Native features** - Compare supported features and existing abstractions before adding dependencies.
- [ ] **Library replacement** - Preserve errors, retries, compatibility, and integration behaviour.
- [ ] **CSS presentation** - Use CSS when no application state or JavaScript coordination is needed.
- [ ] **Clone support** - Check structuredClone supports the copied value types.
- [ ] **Existing tooling** - Follow the current framework and build pipeline.
- [ ] **Tooling additions** - Justify new builds, frameworks, or plugins with concrete needs.

**Structure and forms**

- [ ] **Document structure** - Match headings, landmarks, lists, and tables to content.
- [ ] **Links and actions** - Use real href links for navigation and buttons for actions.
- [ ] **Control labels** - Label every control; group related controls where appropriate.
- [ ] **Form submission** - Use submit controls and preserve supported standard behaviour.
- [ ] **Validation errors** - Make errors accessible to users.
- [ ] **Server validation** - Validate untrusted form input on the server.

**Images**

- [ ] **Alternative text** - Describe meaningful images; use empty alt for decoration.
- [ ] **Image dimensions** - Set intrinsic dimensions to reduce layout shift.
- [ ] **Responsive sources** - Match sources to rendered sizes where used.
- [ ] **Image priority** - Lazy-load off-screen media; prioritise important visible images.

**Interaction and safety**

- [ ] **Keyboard access** - Verify changed interactions and accessible names.
- [ ] **Dynamic focus** - Verify focus movement, opening, and dismissal.
- [ ] **Interaction semantics** - Check complete popover and tab semantics beyond native presentation.
- [ ] **Enhancement failure** - Keep essential content and navigation usable.
- [ ] **JavaScript fallbacks** - Define supported fallbacks for required JavaScript interactions.
- [ ] **DOM safety** - Trace untrusted values into DOM writes, including templates.
- [ ] **UI guidance** - Apply CSS or React checks to affected styling, state, effects, and rendering.
- [ ] **HTTP boundaries** - Check changed contracts and credentials with shared guidance.

**Loading and performance**

- [ ] **Performance evidence** - Measure affected rendering or interactions before making claims.
- [ ] **Bundle output** - Inspect bundles for unused code and large dependencies.
- [ ] **Deferred loading** - Defer scripts or split optional features when loading improves.
- [ ] **Critical preloads** - Match critical resources by URL, type, and credentials mode.
- [ ] **Connection hints** - Restrict preconnect to important remote origins.
- [ ] **Font availability** - Keep text available while fonts load.
- [ ] **Font payloads** - Match font downloads to weights actually used.
- [ ] **Page stability** - Check layout stability and responsiveness alongside load time.

**Verification**

- [ ] **Runtime evidence** - Verify changed interactions and failures with applicable tests or runtime checks.
- [ ] **Browser verification** - Verify changed features and fallbacks in supported browsers.

## Guidance

### Platform choices

#### Platform and tooling

- Compare supported browser features with existing abstractions. Replacing a library must retain its error, retry, compatibility, and integration behaviour.
- Use `fetch`, `URL`/`URLSearchParams`, and `Intl` when they meet the required request, URL, and formatting contracts.
- Check copied value types: `structuredClone` supports values such as dates but cannot copy functions or DOM nodes.
- Consider CSS layout, scroll snapping, `:has()`, and container queries before JavaScript used solely for presentation. Load [CSS](../css-best-practices/SKILL.md) for implementation and browser support.

#### Tooling

- Add build steps for concrete transforms, bundling, hashing, optimisation, or developer-tooling needs. Native modules may be enough when deployment and browser targets support them.
- Compare framework and configuration costs with required state, rendering, routing, and maintenance behaviour. Avoid preprocessors or plugins for supported native features.

### Structure and forms

- Choose elements by content and behaviour: headings and landmarks show document structure; lists and tables show relationships. Buttons perform actions; real links preserve navigation.

  ```html
  <button type="button">Expand</button>
  <a href="/invoices">Invoices</a>
  ```

- Associate labels and errors with controls; use `fieldset` and `legend` for related groups. Combine native validation and submit behaviour with accessible server-side errors. Client validation does not replace server validation.

  ```html
  <form action="/subscriptions" method="post">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required
           aria-invalid="true" aria-describedby="email-error">
    <p id="email-error">Enter a valid email address.</p>
    <button type="submit">Subscribe</button>
  </form>
  ```

Load [security](../security-best-practices/SKILL.md) when form validation or input trust boundaries change.

### Images

- Match alternative text to the image's meaning; decorative images use empty `alt`. Match intrinsic dimensions and responsive sources to the rendered size to avoid layout shift and unnecessary downloads.

  ```html
  <img src="/backpack-800.jpg" alt="Green backpack with two front pockets"
       width="800" height="600" loading="lazy"
       srcset="/backpack-400.jpg 400w, /backpack-800.jpg 800w"
       sizes="(max-width: 40rem) 100vw, 40rem">
  ```

- Reserve lazy loading for off-screen media. Prioritise important visible images, including the likely largest visible image.

### Interaction and safety

- Use `<details>` or `<dialog>` where their interaction fits. Verify labelling, focus, opening, and dismissal; native popover presentation alone does not supply complete tab or popover semantics and keyboard behaviour.
- Write untrusted text through safe DOM APIs. A `<template>` does not make unsafe markup safe.

  ```js
  function createMessage(untrustedText) {
    const message = document.createElement("p");
    message.textContent = untrustedText;
    return message;
  }
  ```

- Enhance working markup so essential content and navigation survive enhancement failure. Define a supported fallback for interactions requiring JavaScript, while preserving keyboard operation, focus management, and accessible names.

  ```html
  <a href="/items/104" data-preview="104">View item 104</a>
  ```

Load [CSS](../css-best-practices/SKILL.md) for affected styling and [React](../react-best-practices/SKILL.md) for affected state, effects, or rendering. Load [API design](../api-design-best-practices/SKILL.md) for changed HTTP contracts and [security](../security-best-practices/SKILL.md) for DOM injection, untrusted input, or credential boundaries.

### Loading and performance

#### Measurement and delivery

- Measure critical rendering and interaction paths with browser tools. Inspect actual bundles; import syntax does not prove tree shaking. Reduce code, requests, or dependencies without losing required behaviour.
- Defer non-critical scripts or split optional features when this improves loading. Restrict preconnect hints to important remote origins.

#### Resource hints and fonts

- Match critical preloads to the eventual request's URL, type, and credentials mode; mismatches can cause duplicate downloads.

  ```html
  <link rel="preload" href="/fonts/body.woff2" as="font" type="font/woff2" crossorigin>
  ```

- Choose font-display and subsets to keep text available. Compare variable and individual font downloads for the weights actually used.

  ```css
  @font-face {
    font-family: "Body";
    src: url("/fonts/body.woff2") format("woff2");
    font-display: swap;
  }
  ```

- Include layout stability and responsiveness in measurements. For repeated work, I/O, memory, or concurrency, load [performance](../performance-best-practices/SKILL.md).

### Verification

Load [testing](../testing-best-practices/SKILL.md) for interaction, failure, and fallback coverage. For browser-feature changes, use [CSS compatibility guidance](../css-best-practices/references/reset-compatibility.md#browser-support) and verify relevant platform support in the project's supported browsers.
