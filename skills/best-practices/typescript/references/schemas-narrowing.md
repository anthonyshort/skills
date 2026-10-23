# Schemas and narrowing

## Schemas and boundary checks

- Use lazy or memoised schema factories only for recursion, initialisation, or allocation needs; follow established naming such as a `z` prefix.
- Local declaration constraints do not imply a general ban on schema-derived types.
- Parse at the trust boundary and derive types from the canonical schema; use meaningful `.max()` limits for input arrays.

  ```typescript
  const inputSchema = z.object({ ids: z.array(z.string()).max(100) });
  type Input = z.infer<typeof inputSchema>;
  const input = inputSchema.parse(requestBody);
  ```

## Narrowing and errors

- Narrow with predicates or `instanceof` rather than asserting unchecked assumptions. Custom guards must validate every property their claimed type requires. Avoid `any` and unchecked casts.

- Treat caught values as `unknown`; JavaScript can throw strings, objects, or null.

  ```typescript
  const message = error instanceof Error
    ? error.message
    : typeof error === "string" ? error : "Internal error";
  ```

## Verification

- Check changed schemas and guards with valid and relevant invalid inputs.
