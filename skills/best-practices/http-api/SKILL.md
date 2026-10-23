---
name: http-api
description: Use when writing, refactoring or reviewing HTTP endpoints, request validation and limits, authentication, resource permissions, credentials, response fields or HTTP error handling.
---

# HTTP API best practices

## Goal

Build APIs that enforce access, handle untrusted requests safely and return clear, intentional responses.

## Guidance

### Access and credentials

- Trace protected operations to shared authentication and resource-permission checks. Make intentional public exceptions explicit.

- Trace the requested resource identifier through its permission check before reading or changing protected data. Reuse shared authentication and permission helpers.
- Follow sensitive operations through every affected entry point. A protected HTTP route does not make an equivalent WebSocket operation safe.
- Inspect actual access paths and credential handling. A local service may still need protection from requests initiated by other applications or web pages.

### Requests and limits

- Follow untrusted values to their first trusted use. Use [TypeScript validation guidance](../typescript/SKILL.md#schemas-and-narrowing) for schema parsing and input limits.
- Apply size limits before parsing or buffering the full payload. Check streaming and alternate content types where supported.
- Trace how requests allocate buffers, connections and expensive work. Enforce actual limits rather than only documenting them. Use [resource guidance](../typescript/SKILL.md#performance-and-resources) for concurrency and cleanup.

### Responses and errors

- Select response fields explicitly. Exclude secrets, credentials, internal endpoints and configuration objects.
- Return safe messages for unexpected server failures. Keep detailed causes available at the responsible server boundary without exposing sensitive values. Use [error-handling guidance](../error-handling/SKILL.md#logging-and-diagnostics) for diagnostics.
- Keep failures distinguishable when callers rely on them. Use [caller compatibility](../../review/rules/keep-api-changes-compatible.md) for changed contracts.
- For operations with side effects and realistic retry paths, use [retry checks](../../review/rules/check-retries-for-repeated-effects.md). Do not require idempotency infrastructure for every endpoint.
