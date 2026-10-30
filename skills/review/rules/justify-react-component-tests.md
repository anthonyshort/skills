# Make React component tests earn their cost

## When to check

A change adds or expands component tests, puts substantial logic in a component, or prompts a request for UI coverage.

## What to check

Default against broad test suites for simple product components. Rendering labels, forwarding props and composing existing components usually do not need dedicated tests. Judge each suite by the behaviour it protects:

- **Failure caught:** Name a plausible mistake and the assertion that would fail. “It renders” and coverage percentages are weak reasons.
- **Right layer:** Test calculations in functions and domain rules in stores or clients. Use hook tests for React subscriptions and lifecycle behaviour. Keep component tests for interactions, focus, wiring or rendered states those tests cannot prove.
- **Real owner:** Check whether mocks replace the owner of the claimed behaviour. A mocked client call cannot prove that client's request, persistence or recovery contract. Exercise the real client with a controlled external boundary when that is the claim. Frontend-owned decisions can be tested without a network request.
- **Extra protection:** Check existing tests. Explain what the component test catches that they miss.
- **Reach and impact:** Find actual consumers and explain what a failure would break. Shared components often justify more coverage, but product interactions can also be important.
- **Cost:** Inspect providers, fixtures, mocks, timing controls and assertions tied to internal details. Use runtime or flake history when available. Do not assume a long test is expensive or a short one is useful.
- **Logic ownership:** Move complex logic out of a component when that improves its design. Name the logic and its natural owner. Do not add hooks, export private helpers or move local state into a store solely for testing.
- **Recommendation:** Identify cases to remove, combine or move, and say what useful coverage remains. For missing coverage, name the failure and the smallest useful test. Test counts, file length and coverage percentages are not pass/fail thresholds.

## Why it matters

Elaborate component tests can repeat tests of the underlying logic and make routine product changes harder. Testing logic where it belongs usually needs less setup and makes failures easier to understand.

## Exceptions

- Complex shared components, such as nested menus, can warrant tests for keyboard navigation, focus, dismissal and disabled items. Test what they add beyond the underlying primitives.
- Product components can need focused tests for wiring failures, such as submitting the wrong record or losing edits after a failed save.
- Mounting, rerendering and cleanup bugs can need React tests even when domain logic is covered. Use a real browser when the runner cannot reproduce the behaviour.
- Keep existing useful tests. Suggest simplification when there is concrete waste, rather than treating every component test as a defect or requesting unrelated deletion.

## Good and bad examples

Assume `RecordSummary` only displays a label and count from a store whose counting rules are already tested. This adds little protection:

```tsx
mockUseRecordSummary.mockReturnValue({ label: "Ready", count: 3 });
render(<RecordSummary />);
expect(screen.getByText("Ready")).toBeVisible();
expect(screen.getByText("3")).toBeVisible();
```

Usually omit this suite. Test changes to counting through the store.

A shared nested menu can justify a component test. This example assumes opening the menu focuses “Export”, ArrowRight opens its submenu, and Escape returns focus to the parent item:

```tsx
const user = userEvent.setup();
render(<NestedMenuExample />);
await user.click(screen.getByRole("button", { name: "Actions" }));
await user.keyboard("{ArrowRight}");
expect(screen.getByRole("menuitem", { name: "Export CSV" })).toHaveFocus();
await user.keyboard("{Escape}");
expect(screen.getByRole("menuitem", { name: "Export" })).toHaveFocus();
```

Keep the real menu behaviour in this test. Use the component’s actual keyboard contract.
