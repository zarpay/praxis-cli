---
id: AX-a108ea
version: 1
status: active
mode: judgment
scope: file
severity: warning
grounded_in: src/services/README.md#behavior
introduced: 2026-09-02
---

Configuration data and domain constants that could vary or be maintained separately must be isolated in a single obvious place or injected via the Store, not hardcoded throughout the service. This prevents silent coupling and drift between code and data.

## Violating example

const ACTIVE_CODES = ['SUMMER25', 'WINTER30']; // Hardcoded in service module
if (!ACTIVE_CODES.includes(input.code)) return error;

## Compliant example

// Codes fetched from Store or isolated config
const activeCodes = await store.getActiveDiscountCodes();
// or
import { ACTIVE_DISCOUNT_CODES } from '../config/discounts';
