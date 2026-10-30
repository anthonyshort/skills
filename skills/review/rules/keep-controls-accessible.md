# Keep controls accessible

## When to check

The change adds or changes controls, keyboard interactions, focus handling, accessibility attributes or wrappers around rich content.

## What to check

- Follow each action with the keyboard. Check that users can reach it, recognise focus, activate it and leave it. Trace where focus goes after a dialog closes or its focused item disappears.
- Check the control’s accessible name and state. Inspect its ancestors too: `aria-hidden`, `inert` or hidden containers can make an otherwise labelled control unavailable to screen readers or keyboard users.
- Prefer native controls for their built-in keyboard behaviour. For custom widgets, check the relevant keyboard and focus behaviour rather than treating a role attribute as an implementation.
- Inspect the HTML produced by rich content and its wrappers. A paragraph cannot contain arbitrary block content, and interactive controls must not be nested inside one another.
- Support findings with the affected action and the behaviour that breaks. Reading markup can identify invalid nesting or a hidden action. It cannot establish that visual focus, screen-reader output or keyboard behaviour passed a browser check.

## Why it matters

A visible action may be unreachable or unnamed for users who rely on a keyboard or screen reader. Invalid HTML can also change the browser’s rendered structure and focus behaviour.

## Exceptions

Decorative content can be hidden from assistive technology when it contains no available action or essential information. Custom widgets can be appropriate when native elements cannot meet the interaction, provided their keyboard, naming and focus behaviour is implemented.

## Good and bad examples

Assume the icon is decorative and `onShow` opens the item. Both examples show the same action. The good example uses a native button and leaves only the icon hidden.

```tsx
type Props = { onShow: () => void };

// Bad: the click target has no keyboard behaviour and its ancestor hides it.
function ShowBefore({ onShow }: Props) {
  return (
    <div aria-hidden="true">
      <span onClick={onShow}>◉</span>
    </div>
  );
}

// Good: the action has a name and native keyboard activation.
function Show({ onShow }: Props) {
  return (
    <button type="button" onClick={onShow} aria-label="Show item">
      <span aria-hidden="true">◉</span>
    </button>
  );
}
```

This fixes the shown control structure. Check focus styling and the focus destination after opening the item in the actual UI before claiming those behaviours work.
