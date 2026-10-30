# Display expressions accurately

## When to check

The change renders a formula, condition, query or other expression, or substitutes display names and bindings into one.

## What to check

- Compare the displayed expression with the authored form and the calculation that runs. Preserve operators, transforms, grouping, signs and units that affect its meaning.
- Trace each expression variant through the renderer. A display simplification must preserve meaning for the supported inputs, not only the example shown in the UI.
- Keep bindings and friendly labels separate when substituting them would change or obscure the expression. If substitution is required, preserve grouping and make the relationship to the authored expression clear.
- Use a concrete input to show a difference before reporting a problem. Check negative inputs for absolute values and nested operations for grouping errors. Formatting or alternate notation is not a defect when it describes the same calculation.

## Why it matters

Users rely on the displayed expression to understand and edit the calculation. Omitting a transform can make a correct result look wrong or lead them to change the wrong condition.

## Exceptions

A documented shorthand or preview can omit detail when it is clearly labelled and the complete expression remains available. Friendly names and equivalent mathematical notation are valid when they preserve meaning.

## Good and bad examples

Assume variable names are identifiers, numeric values are finite, and this is plain-text mathematical notation. Parentheses preserve grouping. For `x = -6`, `abs(x) > 5` is true while `x > 5` is false.

```typescript
type Expression =
  | { kind: "variable"; name: string }
  | { kind: "number"; value: number }
  | { kind: "abs"; input: Expression }
  | { kind: "greaterThan"; left: Expression; right: Expression };

// Bad: the absolute-value transform disappears from the displayed condition.
function renderBefore(expression: Expression): string {
  switch (expression.kind) {
    case "variable": return expression.name;
    case "number": return String(expression.value);
    case "abs": return renderBefore(expression.input);
    case "greaterThan":
      return `(${renderBefore(expression.left)} > ${renderBefore(expression.right)})`;
  }
}

// Good: the displayed expression retains every supported operation.
function render(expression: Expression): string {
  switch (expression.kind) {
    case "variable": return expression.name;
    case "number": return String(expression.value);
    case "abs": return `abs(${render(expression.input)})`;
    case "greaterThan":
      return `(${render(expression.left)} > ${render(expression.right)})`;
  }
}
```

A binding such as `x = -6` can be shown beside this expression without rewriting it. A renderer that emits HTML also needs appropriate text escaping.
