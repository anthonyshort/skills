---
name: security-best-practices
description: Write, refactor, or review code changing authentication, resource authorisation, untrusted input, filesystem access, credentials, data exposure, or resource-exhaustion paths.
---

# Security

## Goal

Preserve changed trust boundaries and prevent concrete unauthorised access, disclosure, or resource exhaustion.

## Checklist

Track checks in task notes, not here. Mark done only after verifying; explain N/A and report blocked or unverified checks. Run independent checks in parallel where useful.

**Access and credentials**

- [ ] **Sensitive operations** - Use shared protection across affected transports.
- [ ] **Public exceptions** - Make public access exceptions explicit.
- [ ] **Resource permissions** - Check the requested resource beyond authentication.
- [ ] **Credential handling** - Use the repository’s supported mechanism.
- [ ] **Local exposure** - Do not rely on localhost binding alone.

**Untrusted input and storage**

- [ ] **Input validation** - Validate untrusted boundary values with established schemas.
- [ ] **Resource limits** - Bound affected arrays, buffers, connections, and expensive operations.
- [ ] **Message limits** - Enforce size limits before parsing.
- [ ] **Query values** - Bind values using the driver’s parameter syntax.
- [ ] **Query identifiers** - Allowlist dynamic identifiers such as sort columns.
- [ ] **Path containment** - Keep resolved paths within the permitted base using path-aware checks.
- [ ] **Filesystem races** - Account for symlinks and concurrent changes invalidating containment.

**Disclosure and resource lifecycle**

- [ ] **Response fields** - Select safe fields; exclude secrets and internal objects.
- [ ] **Error responses** - Return safe server-error messages.
- [ ] **Diagnostic logs** - Retain diagnostics without leaking tokens or sensitive data.
- [ ] **Telemetry privacy** - Exclude PII from analytics and telemetry.
- [ ] **Failure cleanup** - Release or bound unfinished work, concurrency slots, and retained resources.
- [ ] **Finding evidence** - Identify the changed boundary and concrete violating input or failure.

## Guidance

### Access and credentials

- Trace sensitive operations through every affected transport, including HTTP and WebSocket paths. Confirm they reach the shared protection mechanism and identify any intentional public exceptions.
- Follow the requested resource identifier to its permission check. A signed-in caller still needs permission for that resource. Use the project's shared authentication and permission helpers.

  ```typescript
  const user = await requireAuthenticatedUser(request);
  await requireProjectPermission(user.id, projectId, "read");
  const project = await projectRepository.get(projectId);
  ```

- Compare credential handling with the repository's supported mechanism. Inspect actual access paths instead of treating localhost binding as proof of safe exposure.

### Untrusted input and storage

- Follow external values to their first trusted use. Apply the established schemas there and check limits before expensive processing; enforce message-size limits before parsing.

  ```typescript
  import { z } from "zod";
  import { MAX_PROJECT_IDS } from "./limits";

  const projectLookupSchema = z.object({
    projectIds: z.array(z.string().uuid()).max(MAX_PROJECT_IDS),
  });

  const input = projectLookupSchema.parse(untrustedInput);
  ```

- Trace how changed inputs grow arrays, buffers, connections, and expensive operations. Check applicable limits are enforced, not just documented.
- Inspect query construction and the driver's binding syntax. Bind values and allowlist identifiers that cannot be bound as values.
- Resolve paths within the permitted base and use path-aware containment checks. Trace symlink resolution and concurrent changes between checking and using a path; a successful earlier check may no longer protect the operation.

### Disclosure and resource lifecycle

- Trace returned data to the response boundary. Select public fields explicitly; exclude secrets, credentials, internal endpoints, and configuration objects.

  ```typescript
  const response = {
    id: account.id,
    displayName: account.displayName,
  };
  ```

- Trace error details separately through responses and server logs. Keep diagnostics available on the server while excluding credentials, tokens, and sensitive data from both responses and logs.
- Inspect analytics events and telemetry payloads as well as logs. Never send personally identifiable information to analytics or telemetry; inspect nested payloads and attached error context.
- Follow changed cancellation and failures through cleanup. Identify work that continues, held concurrency slots, or retained resources that could exhaust capacity; release or bound them.
