---
name: http-api-best-practices
description: Use when writing, refactoring or reviewing HTTP endpoints, request validation and limits, authentication, resource permissions, credentials, response fields or HTTP error handling.
---

# HTTP API best practices

## Goal

Build APIs that enforce access, handle untrusted requests safely and return clear, intentional responses.

## Verification checklist

- [ ] **Authentication**: Trace protected operations to the shared authentication mechanism.
- [ ] **Resource access**: Check permission for the requested resource, not just whether the caller is signed in.
- [ ] **Public exceptions**: Make intentionally public access explicit.
- [ ] **Other entry points**: Check equivalent operations through affected WebSocket or other transports enforce the same protection.
- [ ] **Credentials**: Use supported credential mechanisms. Do not treat localhost binding alone as access protection.
- [ ] **Input validation**: Validate external values before trusted use with canonical schemas.
- [ ] **Request limits**: Enforce body or message size limits before parsing. Bound input arrays and expensive processing.
- [ ] **Response fields**: Return intentional public fields instead of serialising internal objects or configuration.
- [ ] **Error responses**: Keep server diagnostics out of responses and preserve useful caller-visible error distinctions.
- [ ] **Compatibility and retries**: Check affected callers and realistic duplicate-request paths using the relevant review rules.

Record evidence and distinguish source inspection from executed checks. Explain checks that do not apply and checks that could not be verified.

## Guidance

### Access and credentials

- Trace the requested resource identifier through its permission check before reading or changing protected data. Reuse shared authentication and permission helpers.
- Follow sensitive operations through every affected entry point. A protected HTTP route does not make an equivalent WebSocket operation safe.
- Inspect actual access paths and credential handling. A local service may still need protection from requests initiated by other applications or web pages.

### Requests and limits

- Follow untrusted values to their first trusted use. Use [TypeScript validation guidance](../typescript-best-practices/SKILL.md#schemas-and-narrowing) for schema parsing and input limits.
- Apply size limits before parsing or buffering the full payload. Check streaming and alternate content types where supported.
- Trace how requests allocate buffers, connections and expensive work. Enforce actual limits rather than only documenting them. Use [resource guidance](../typescript-best-practices/SKILL.md#performance-and-resources) for concurrency and cleanup.

### Responses and errors

- Select response fields explicitly. Exclude secrets, credentials, internal endpoints and configuration objects.
- Return safe messages for unexpected server failures. Keep detailed causes available at the responsible server boundary without exposing sensitive values. Use [error-handling guidance](../error-handling-best-practices/SKILL.md#logging-and-diagnostics) for diagnostics.
- Keep failures distinguishable when callers rely on them. Use [caller compatibility](../review/rules/keep-api-changes-compatible.md) for changed contracts.
- For operations with side effects and realistic retry paths, use [retry checks](../review/rules/check-retries-for-repeated-effects.md). Do not require idempotency infrastructure for every endpoint.
