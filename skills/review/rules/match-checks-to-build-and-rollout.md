# Match checks to what is built and deployed

## When to check

The change skips CI checks based on changed files, changes build dependencies, or enables a caller of a service that may not yet be deployed.

## What to check

- Compare CI selection and ignore rules with the actual build inputs and affected targets. Files called documentation or configuration can still generate code or change the build. Avoid separate handwritten lists that can drift apart.
- Check what the relevant job actually built or tested. A passing check from another revision or a skipped target does not prove the changed code was checked.
- Identify when the new service or API is available in each target environment. Keep callers behind the existing rollout control until the service they need is ready there.
- Check defaults, disabled states and the rollback path. Do not infer production readiness from a working preview or a frontend flag alone.

## Why it matters

CI can appear green while skipping the code that changed. A deployed caller can also start making requests before the service it needs exists.

## Exceptions

Documentation-only changes can skip runtime checks when the build confirms they have no effect on runtime code. A coordinated deployment may not need a new flag. Use the existing release process rather than adding rollout machinery for every change.

## Good and bad examples

Assume the existing flag is set per environment and is enabled only after the new service is deployed there. The two reads are existing operations with the same result type.

```typescript
type Reads = { oldService(): Promise<string>; newService(): Promise<string> };

// Bad during rollout: every environment immediately calls the new service.
async function loadBefore(reads: Reads): Promise<string> {
  return reads.newService();
}

// Good: keep the old route until the existing rollout control enables the new one.
async function load(reads: Reads, newServiceEnabled: boolean): Promise<string> {
  if (!newServiceEnabled) {
    return reads.oldService();
  }
  return reads.newService();
}
```

The flag alone does not prove readiness. Verify who enables it and which deployment it depends on. Likewise, deriving CI checks from the build only helps if the chosen targets include all inputs that can affect them.
