# Simplicity

Cases for "Is this the simplest solution?". The assessment should count concepts, not lines, and keep complexity that a requirement justifies.

## plugin-framework-for-one-feature: Send a welcome email

A plugin system with discovery and priorities is built for one fixed behaviour.

### Requirements

Send a welcome email when a user signs up.

### Before

```ts file=src/signup.ts
import { db } from './db';

export async function signUp(email: string): Promise<{ id: string }> {
  return db.users.insert({ email });
}
```

```ts file=src/email.ts
export async function sendEmail(to: string, template: string): Promise<void> {
  await fetch('/api/email', { method: 'POST', body: JSON.stringify({ to, template }) });
}
```

### After

```ts file=src/hooks/registry.ts
export type SignupHook = { name: string; priority: number; run(user: { id: string; email: string }): Promise<void> };

const hooks: SignupHook[] = [];

export function registerSignupHook(hook: SignupHook): void {
  hooks.push(hook);
  hooks.sort((a, b) => a.priority - b.priority);
}

export async function runSignupHooks(user: { id: string; email: string }): Promise<void> {
  for (const hook of hooks) await hook.run(user);
}
```

```ts file=src/hooks/welcomeEmail.ts
import { registerSignupHook } from './registry';
import { sendEmail } from '../email';

registerSignupHook({ name: 'welcome-email', priority: 10, run: user => sendEmail(user.email, 'welcome') });
```

```ts file=src/hooks/index.ts
import './welcomeEmail';
```

```ts file=src/signup.ts
import { db } from './db';
import { runSignupHooks } from './hooks/registry';
import './hooks';

export async function signUp(email: string): Promise<{ id: string }> {
  const user = await db.users.insert({ email });
  await runSignupHooks({ id: user.id, email });
  return user;
}
```

### Must find

- The hook registry, priorities and side-effect import add three files and several concepts for one fixed behaviour with no other registered hooks. Recommends calling `sendEmail(email, 'welcome')` directly from `signUp`.
- Says what the simpler version must preserve, such as when the email is sent and how a failure to send affects sign-up.

## justified-complexity: Retry uploads with backoff

A control case. The retry logic looks complex, but the requirements need it.

### Requirements

Large uploads fail on flaky mobile networks. Retry failed chunk uploads up to 5 times with exponential backoff and jitter, give up on 4xx responses, and let the user cancel.

### Before

```ts file=src/upload.ts
export async function uploadChunk(url: string, chunk: Blob): Promise<Response> {
  return fetch(url, { method: 'PUT', body: chunk });
}
```

### After

```ts file=src/upload.ts
export async function uploadChunk(url: string, chunk: Blob, signal?: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { method: 'PUT', body: chunk, signal });
      if (response.ok || (response.status >= 400 && response.status < 500) || attempt === 4) return response;
    } catch (error) {
      if (signal?.aborted || attempt === 4) throw error;
    }
    const delay = 2 ** attempt * 250 + Math.random() * 250;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, delay);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
      }, { once: true });
    });
  }
}
```

### Must not flag

- Recommends removing the backoff, jitter, 4xx handling or cancellation as unnecessary complexity. Each one is a stated requirement.
