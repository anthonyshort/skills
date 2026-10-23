---
name: nominal-galaxy-backend
description: Use for Galaxy api-query adoption, generated backend contracts and tRPC integration helpers.
---

# Galaxy backend best practices

## Queries and procedures

- Verify the current `api-query` API and generated types before replacing a pass-through tRPC procedure.
- Prefer supported direct query APIs when the procedure only forwards a backend call with basic validation. Retain meaningful domain orchestration and permission checks.
- Remove schemas that exist solely for the replaced procedure. Preserve validation at remaining trust boundaries.
- Reuse current tRPC bases and tracing, logging and error-mapping middleware.
- Use `@nominal-io/trpc/errors` where adopted without weakening validation or authorisation.

## Contracts

- Locate shared utility types in their owning package.
- Check actual compiler settings and schema-factory conventions before recommending declaration changes.
- Verify API adoption on the reviewed branch rather than assuming a historical migration is complete.
