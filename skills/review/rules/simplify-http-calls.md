# Simplify HTTP calls without changing their meaning

## When to check

An HTTP API introduces command envelopes or unnecessary response unpacking.

## What to check

Compare real requests and response usage. Consider resource endpoints when they simplify the supported task. Preserve authorisation, pagination, validation, errors, caching and retries.

## Why it matters

Transport shapes can create unnecessary work for callers.

## Exceptions

Keep genuine commands as commands. POST and GET are not automatically equivalent. Do not migrate a transport for naming alone.

## Good and bad examples

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

A resource-shaped endpoint may remove command envelopes and caller unpacking when it fits the existing HTTP contract.

```typescript
// Bad for this case: listing requires a command envelope.
async function before(): Promise<unknown> {
  const response = await fetch("/commands", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "listInvoices", accountId: "account-7" }),
  });
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

// Good for this case: the resource URL expresses the same supported task.
async function after(): Promise<unknown> {
  const response = await fetch("/accounts/account-7/invoices");
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}
```

These calls deliberately leave the payload untrusted. Use the existing boundary schema and error decoder in production. Show the actual response use in a real proposal. Preserve authorisation, pagination, failure distinctions, caching and retry semantics. Changing POST to GET is not automatically equivalent. Keep command endpoints for genuine commands, and avoid a transport migration for naming alone.
