---
id: AX-ed98ff
version: 1
status: proposed
mode: judgment
severity: error
introduced: 2026-09-09
---

A service must implement its complete responsibility as implied by its name and purpose. If a service's name promises an action with business consequences (apply-discount, redeem-coupon), it must perform all the work that action entails: checking preconditions, enforcing business rules, and recording state changes. Returning a computed value without validating eligibility or tracking usage is incomplete.

## Violating example

A service named `redeem-coupon.ts` returns a discount fraction but does not mark the coupon as used or track redemption history in the Store, allowing unlimited reuse. Or `apply-discount.ts` returns a discount value without checking if the member exists or is eligible.

## Compliant example

A service named `redeem-coupon.ts` validates the coupon exists and is unused, returns the discount value, and records the redemption in the Store to prevent reuse. Or `apply-discount.ts` checks member existence and eligibility rules before computing and returning the discount.
