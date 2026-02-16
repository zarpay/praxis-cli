---
title: Responsibilities
type: framework
framework: true
description: Defines the Responsibilities primitive in Praxis
---

# Responsibilities

> **"This is what you own."**

A Responsibility is a discrete piece of work that gets delegated to a Role. It answers:
- What needs to be done?
- What does success look like?
- What resources are available?

## Important Distinction

Responsibilities are **owned, not just executed**.

When you delegate a responsibility, you're saying: "This is yours — figure it out, deliver it, be accountable for it."

## Responsibility Document Structure

```yaml
---
title: Responsibility Name
type: responsibility
owner: role-that-owns-this
schedule: daily | weekly | triggered | one-time
refs:
  - content/reference/relevant-reference.md
---
```

### Sections

1. **Objective**: What this responsibility achieves
2. **Inputs**: What information or resources are needed
3. **Outputs**: What deliverables are expected
4. **Process**: How to accomplish this (high-level)
5. **Criteria**: How success is measured

## Example

See [_template.md](./_template.md) for a starter template.
