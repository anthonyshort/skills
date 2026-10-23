---
name: html-best-practices
description: Write, refactor or review HTML and JSX for semantic structure, accessible controls, forms, images, focus behaviour and browser resource loading.
---

# HTML best practices

## Goal

Use markup that communicates meaning and preserves expected browser behaviour. Apply this guidance to JSX as well as HTML.

## Verification checklist

- [ ] **Structure**: Use headings, landmarks, lists and tables that match the content.
- [ ] **Navigation and actions**: Use links with real destinations for navigation and buttons for actions.
- [ ] **Forms**: Label controls, group related inputs and preserve standard submission behaviour.
- [ ] **Errors**: Associate validation messages with the affected controls.
- [ ] **Images**: Provide appropriate alternative text, dimensions and loading attributes.
- [ ] **Interaction**: Check keyboard access, accessible names, focus and dismissal.
- [ ] **Enhancement**: Keep essential content and navigation usable when enhancement fails.
- [ ] **Resource hints**: Check that preloads match actual requests and connection hints serve important origins.
- [ ] **Browser checks**: Verify changed interactions and fallbacks in supported browsers.

Record evidence and explain checks that do not apply or could not be verified.

## Structure and controls

Choose elements by their meaning and behaviour.

```html
<!-- Avoid: a generic element acting as a control. -->
<div onclick="expand()">Expand</div>

<!-- Prefer: native action and navigation elements. -->
<button type="button">Expand</button>
<a href="/invoices">Invoices</a>
```

Use headings to express hierarchy. Use lists for related items and tables for tabular relationships.

## Forms and errors

- Associate every control with a label.
- Use `fieldset` and `legend` for related groups.
- Use submit buttons and preserve Enter-key submission where supported.
- Connect errors to their controls. Set `aria-invalid` when the value is invalid.
- Treat client validation as user feedback. Validate untrusted input on the server too.

```html
<label for="email">Email</label>
<input
  id="email"
  name="email"
  type="email"
  aria-invalid="true"
  aria-describedby="email-error"
>
<p id="email-error">Enter a valid email address.</p>
```

Use [TypeScript validation](../typescript-best-practices/SKILL.md#schemas-and-narrowing) for untrusted values and [HTTP API guidance](../http-api-best-practices/SKILL.md) for server limits and access checks.

## Images

- Describe meaningful images. Use empty `alt` for decoration.
- Set intrinsic dimensions to reserve space.
- Match `srcset` and `sizes` to the rendered size.
- Lazy-load off-screen images. Avoid lazy-loading the important image users see first.

## Interactive elements

Use native elements such as `<details>` and `<dialog>` when they fit the task.

Check:

- Accessible names.
- Keyboard operation.
- Focus when opening and closing.
- Dismissal behaviour.

Native popover presentation does not provide complete tab, menu or other widget semantics. Check the behaviour required by the actual interaction.

## Progressive enhancement

Preserve real destinations for navigation, even when scripts add previews or client routing.

```html
<a href="/items/104" data-preview="104">View item 104</a>
```

For interactions that require scripts, define the supported loading and failure behaviour. Do not assume the whole application must work without TypeScript.

## Resource hints

Preloads must match the eventual request's URL, resource type and credentials mode. A mismatch can cause duplicate downloads.

```html
<link
  rel="preload"
  href="/fonts/body.woff2"
  as="font"
  type="font/woff2"
  crossorigin
>
```

Use preconnect only for important remote origins. Add hints for demonstrated loading needs.

## Verification

Use focused browser checks for changed forms, keyboard interactions, focus and failure paths. Record what was verified and what remains untested. Check relevant feature support in the target browsers.
