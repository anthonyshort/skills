# Do not allow access when permission is unknown

## When to check

The change affects permission checks, defaults that allow access, saved permission results, which records a user can access or when tokens expire.

## What to check

- Find the code that decides whether an action is allowed. Check that its answer applies to the signed-in user, the requested record and workspace, and the current time. Missing permission data, a result still loading or an expired answer must not silently allow access.
- Follow each way of reaching the protected operation. Hiding a button or checking permission in a frontend hook does not prove that the server blocks the request. Check access before returning a record or revealing that it exists.
- When reusing a permission result, check that the user and record have not changed. When it expires, obtain a new answer using the existing permission rules rather than adding an unagreed grace period.
- Keep deliberately public operations separate from operations whose permission is unknown. Show the code path that allows access before reporting a problem. An unanswered review question alone is not evidence that access is unsafe.

## Why it matters

A default that allows access, or a permission result that no longer applies, can grant access the user should not have. Looking up records outside the user’s allowed workspace can reveal data even if the UI later disables editing.

## Exceptions

Public operations can allow access by design. Saved permission results and token lifetimes can follow an agreed policy. Some UI permission checks use only frontend state and do not need a network request. Test those checks where they are implemented, and check the server separately for protected operations.

## Good and bad examples

Assume the permission record has been validated, belongs to the signed-in user and applies to one workspace until `expiresAt`. Only `allowed` lets the operation proceed. An expired answer needs refreshing, so it is unknown rather than a permanent denial.

```typescript
type Permission = { workspace: string; allowed: boolean; expiresAt: number };
type Decision = "allowed" | "denied" | "unknown";

// Bad: missing permission allows access, without checking workspace or expiry.
function canEditBefore(permission: Permission | undefined): boolean {
  return permission?.allowed ?? true;
}

// Good: the caller can tell unknown permission from an allowed or denied result.
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

This example checks workspace and expiry. It does not sign in the user, validate the record or enforce access on the server. Check that code too before saying the operation is protected.
