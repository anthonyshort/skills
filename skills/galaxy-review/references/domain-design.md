# Galaxy domain design

## Checklist

**Simplicity and reuse**

- [ ] **Existing solutions** - Search shared components, hooks, libraries, and utilities first.
- [ ] **Supported replacements** - Identify replacements for unsuitable APIs and explain migration cost.
- [ ] **Simpler UX** - Look for interactions that remove state, branches, or synchronisation.
- [ ] **Shared behaviour** - Check reused components preserve defaults and existing interactions.
- [ ] **Intentional divergence** - Check whether different product behaviour justifies separate implementations.

**Domain and host ownership**

- [ ] **Domain owner** - Check types, helpers, and mutations live with their owning domain.
- [ ] **Client boundary** - Check workbook and report operations use the supported client API.
- [ ] **UI independence** - Check shared domain operations do not require mounted UI stores.
- [ ] **Panel capabilities** - Check panels use host capabilities rather than workbook internals.
- [ ] **Time ownership** - Check panel time behaviour matches the host's contract.
- [ ] **Honest context** - Check shared contexts do not require fake values from consumers.

**Workbook data ownership**

- [ ] **Request derivation** - Keep workbook-to-compute domain rules and combined state derivation in workbook-store.
- [ ] **State manipulation** - Keep transformations enforcing workbook invariants in store methods.
- [ ] **Series state** - Never put series data in stores or pass it to store methods.

**Migrations and direction**

- [ ] **Current adoption** - Verify which APIs and boundaries are available in the reviewed branch.
- [ ] **Saved behaviour** - Check migrations against representative saved workbook and report fixtures.
- [ ] **Load behaviour** - Check repeated loading does not recreate removed inputs or add duplicates.
- [ ] **Staged changes** - Separate defects from follow-up work in an agreed migration.

## Guidance

### Simplicity and reuse

- Keep frontend code as DRY as possible. Compare existing components, hooks, libraries, and utilities with the required behaviour before accepting a custom implementation. Check defaults, action order, and mounting behaviour when changing a shared component.
- Prefer reuse when behaviour and ownership match. Separate implementations can be appropriate when products are expected to diverge; ask for that intent rather than forcing a shared abstraction.
- For deprecated or less suitable APIs, identify a supported replacement and the work needed to adopt it.
- Trace state, branching, configuration, and synchronisation to the interaction that requires them. For a simpler UX proposal, name the mechanism removed and verify the same supported user tasks remain possible.

### Domain and host ownership

- Search for the package that owns the schema, contract, or operation before adding another type, helper, or mutation. Check current exports and import restrictions; historical package names may have changed.
- Use supported `WorkbookClient` and `ReportClient` operations rather than rebuilding creation, copying, or layout changes in consumers. Verify the API exists in the reviewed branch.
- Keep reusable domain mutations callable without constructing editor stores or mounting React. UI stores should coordinate these operations rather than own duplicate implementations.
- Check whether settings, layout, actions, and time policy belong to the host. Prefer a narrow capability such as opening settings over direct access to the workbook inspector store. A separate panel time model needs a supported product reason.
- Narrow context is useful for genuine host-owned capabilities needed by deep consumers. Do not force consumers to invent asset, run, or other domain values to satisfy an unrelated context.

### Workbook data ownership

- Keep workbook-to-compute derivation in workbook-store when it applies domain rules or combines workbook state: selecting sources, resolving domain defaults, or maintaining relationships.
- Put transformations enforcing workbook invariants or coordinating persisted fields in store methods. Simple UI projections, such as formatting a display label, can remain in components.
- Never add series data to the store or pass it through store method arguments. Apply the store coverage and harness checks in [testing](testing.md) for changed methods.

### Migrations and direction

- Verify adoption in the reviewed branch before recommending an API from a merged or open PR. Distinguish available APIs from pending rollout.
- Use representative saved workbook and report fixtures to check behaviour during migrations. Keep version migrations distinct from normalisation on load; loading repeatedly must not add duplicates or recreate intentionally removed inputs.
- Check follow-up discussion and reversions before treating a past change as a convention. Preserve agreed intermediate boundaries unless this change introduces a defect; describe remaining migration work separately.
