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

- Follow untrusted values to their first trusted use. Parse them with canonical schemas and enforce input limits.
- Apply size limits before parsing or buffering the full payload. Check streaming and alternate content types where supported.
- Trace how requests allocate buffers, connections and expensive work. Enforce actual limits rather than only documenting them. Bound concurrency and release resources on failure or cancellation.

### Responses and errors

- Select response fields explicitly. Exclude secrets, credentials, internal endpoints and configuration objects.
- Return safe messages for unexpected server failures. Keep detailed causes available at the responsible server boundary without exposing sensitive values.
- Keep failures distinguishable when callers rely on them. Trace changed contracts through supported callers and their recovery paths.
- For operations with side effects and realistic retry paths, check lost responses and concurrent duplicates. Verify any idempotency guarantees at the effect boundary. Do not require idempotency infrastructure for every endpoint.
