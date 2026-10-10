# POST /offers/:offerId/versions/:versionId/decision (B7, B2-15)

Body is FLAT. A nested `pay: {...}` object is rejected.

```json
{ "decision": "Approve", "basePay": 15000, "currency": "AED", "allowances": [{ "name": "Housing", "amount": 2000, "frequency": "Monthly" }] }
{ "decision": "Reject", "reason": "Role on hold" }
{ "decision": "RequestChanges", "reason": "Lower the base" }
```

- `decision`: `Approve` | `Reject` | `RequestChanges`. `reason` is required for Reject and RequestChanges.
- Pay (`basePay`, `currency`, `allowances[]`) only with `Approve`, and only if the caller has `OFFER_PAY_VIEW` (else 403 `OFFER_PAY_VIEW_REQUIRED`).
  `basePay` is the monthly base. The band check runs on `basePay` only. `currency` is 3 letters. `allowances[].frequency` is `Monthly` | `Annual` | `Once` (default `Monthly`).
- Pay figures replace the version's live pay rows. The rows that were submitted are kept as superseded history.

Errors: 400 bodies carry `code` and `field` (the first offending input, as a dotted path) plus `fields` (path -> messages).

| Case | status | code | field |
|---|---|---|---|
| nested `pay:{}` or another unknown property | 400 | VALIDATION_ERROR | `pay` |
| bad type/range, e.g. `basePay: -1` | 400 | VALIDATION_ERROR | `basePay` |
| bad allowance | 400 | VALIDATION_ERROR | `allowances.0.amount` |
| pay with Reject/RequestChanges | 400 | VALIDATION_ERROR | `basePay` |
| pay without basePay / currency | 400 | VALIDATION_ERROR | `basePay` / `currency` |
| missing reason | 400 | DECISION_REASON_REQUIRED | `reason` |
| no OFFER_PAY_VIEW | 403 | OFFER_PAY_VIEW_REQUIRED | |
| outside band / no band | 409 | OFFER_PAY_OUTSIDE_BAND / GRADE_BAND_MISSING | |
| already decided | 409 | OFFER_NOT_PENDING_APPROVAL | |
