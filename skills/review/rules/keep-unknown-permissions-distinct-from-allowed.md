# Keep unknown permission distinct from allowed

## When to check

Changed code affects permission metadata, permissive defaults, cached decisions, resource scope or token lifetime.

## What to check

- Trace the authoritative permission decision, its user/resource/workspace scope and its lifetime. Missing metadata, loading state and expired decisions must not silently become permission.
- Inspect every affected protected entry point. UI visibility or a frontend permission hook does not establish server authorisation. Check scope before returning a resource or revealing its existence.
- Verify that reused decisions still belong to the current identity and resource. If authorisation expires, obtain a renewed decision according to the contract rather than inventing a grace period.
- Distinguish an explicitly public operation from an operation whose policy is unavailable. Support a concern with the actual access path, not just an unanswered reviewer question.

## Why it matters

A permissive fallback or stale decision can grant access that the policy never authorised. A resource lookup outside its authorised scope can disclose data or existence even if later UI controls are disabled.

## Exceptions

Explicitly public operations and documented cache/lifetime semantics can allow access. Some UI permissions derive entirely from frontend-owned state and do not need a network request. Keep their decision owner while checking the independent server boundary for protected operations.

## Good and bad examples

Assume a validated permission record belongs to the current authenticated user and applies to one workspace until `expiresAt`. The operation may proceed only for `allowed`. An expired decision needs refresh, so it is unknown rather than a permanent denial.

```typescript
type Permission = { workspace: string; allowed: boolean; expiresAt: number };
type Decision = "allowed" | "denied" | "unknown";

// Bad: absent policy becomes access, without checking scope or expiry.
function canEditBefore(permission: Permission | undefined): boolean {
  return permission?.allowed ?? true;
}

// Good: the caller can distinguish missing policy from a real decision.
function editDecision(
  permission: Permission | undefined,
  workspace: string,
  now: number,
): Decision {
  if (!permission || permission.expiresAt <= now) {
    return "unknown";
  }
  if (permission.workspace !== workspace) {
    return "denied";
  }
  return permission.allowed ? "allowed" : "denied";
}
```

This example illustrates a scoped decision. It does not implement authentication, trusted record validation or server enforcement. Trace those owners before claiming the operation is protected.
