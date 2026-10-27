# Use registries for real extension needs

## When to check

A change introduces a registry, plugin system or dynamic lookup.

## What to check

Check for actual independently registered extensions. Prefer direct wiring for fixed capabilities. For real plugins, check narrow host capabilities, lifecycle ownership, repeated start/stop and cleanup after failed setup.

## Why it matters

Registries can hide construction order and missing dependencies.

## Exceptions

Keep plugin infrastructure when supported extensions need it. Do not add discovery, priorities or dependency resolution without a demonstrated need. Preserve cleanup and original setup errors.

## Good and bad examples

This comparison illustrates the trade-off. Check the actual requirements and callers before recommending a change.

For one fixed feature, a registry can hide construction order and missing dependencies without enabling a real extension use case.

```typescript
type Stop = () => void;
declare function startAutosave(): Stop;

// Bad for this case: dynamic lookup for a single statically known operation.
const registry = new Map<string, () => Stop>([["autosave", startAutosave]]);
function startBefore(): Stop {
  const start = registry.get("autosave");
  if (!start) throw new Error("Missing autosave");
  return start();
}

// Good for this case: construction fails at typecheck if the capability disappears.
function startAfter(): Stop {
  return startAutosave();
}
```

When independent optional extensions really register and release resources, expose only the capabilities they need and a clear stop handle.

```typescript
type Stop = () => void;
type Host = {
  onSave(listener: () => void): Stop;
  addCommand(name: string, run: () => void): Stop;
};
type Plugin = { start(host: Host): Stop };

function savePlugin(showSaved: () => void, save: () => void): Plugin {
  return {
    start(host) {
      const stopSave = host.onSave(showSaved);
      let removeCommand: Stop;
      try {
        removeCommand = host.addCommand("save", save);
      } catch (error) {
        stopSave();
        throw error;
      }
      return () => {
        try { removeCommand(); } finally { stopSave(); }
      };
    },
  };
}
```

Here host stop handles are non-throwing and idempotent, and failed registration leaves no resource behind. Verify those guarantees. Otherwise preserve the system's cleanup-error policy without losing the original setup error. The pair does not justify dependency resolvers, priorities, dynamic discovery, or a registry unless supported plugins need them. Keep one lifecycle owner and define what repeated start/stop means.
