# Use download URLs for large files

## When to check

Next.js proxies large backend or object-storage payloads.

## What to check

Use a dedicated download URL where supported. Preserve authorisation, URL lifetime and required browser behaviour.

## Why it matters

Proxying bytes ties frontend server capacity to large transfers.

## Exceptions

Required transformation or security policy may justify a proxy. Signed URLs need suitable scope and expiry.

## Good and bad examples

**Bad for this case**

```typescript
const bytes = await storage.readAll(fileId);
return new Response(bytes);
```

**Good for this case**

```typescript
const url = await getAuthorisedDownloadUrl(user, fileId);
return Response.json({ url });
```

The consumer must use the returned URL. This is an intentional contract change, not a drop-in response replacement.
