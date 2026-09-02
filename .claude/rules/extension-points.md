---
description: What belongs in a domain's providers/ and plugins/ directories
paths:
  - cli/src/*/providers/**
  - cli/src/*/plugins/**
---

# Extension points

**These are the two places a third party plugs into Praxis**, and the only
directories in a domain whose contents are classes by default: `eval/providers/`
implements `ReviewProvider` (where a review is executed), `spec/plugins/`
implements `CompilerPlugin` (what a compiled profile is written as).

- **They are not services, which is why they do not live under `services/`.** A
  service is one function Praxis calls; these are interfaces someone else
  implements, and the whole point is that ours is only one implementation.
  `openrouter.ts` and `claude-code.ts` are examples of a contract, not the
  contract itself.
- **Named for the thing they integrate with**, with no type suffix —
  `openrouter.ts`, `claude-code.ts`. The directory already states the kind, and
  the filename has to match what a user writes in `.praxis/config.json`
  (`"claude-code"`, `provider: "openrouter"`).
- **The exported class is the filename in PascalCase plus its role**:
  `OpenRouterProvider`, `ClaudeCodePlugin`. It implements the interface declared
  in the domain's `types.ts` and adds nothing to it that a caller depends on.
- **Selecting one is a service's job, not theirs.** `resolve-provider-service.ts`
  and `resolve-plugins-service.ts` map a config value to an instance, including
  loading a user's `./relative` module. Those are services and live with the
  services.
- A provider takes rendered prompts and returns a normalized verdict. It never
  reads a spec, resolves a path, or touches the cache — everything it needs
  arrives in the request.
