# V2 rollout switch: current implementation and release limitation

> **Release blocker (19 November 2026): the per-seat V1 fallback is NOT implemented in the signed-in web app.**
> See [the production release playbook](../operations/release-playbook.md) and
> [the full replacement programme](../v2-complete-replacement-programme.md).

`GET /api/v1/auth/me` currently returns:

| field | value |
| --- | --- |
| `seat` | `admin` for ADMINISTRATOR, `manager` for HIRING_MANAGER / direct reports, else `employee` |
| `v2Seats` | configured seat list |
| `v2Enabled` | whether caller's seat is in `v2Seats` |
| `flags.v2Seats` | same configured list |

The values resolve from organization `integrations` row
`ROLLOUT_SEATS = { "v2Seats": ["employee","manager"] }`, then
`RF_V2_SEATS` (including `none`), then all-seat default.

**Actual web behavior:** `apps/web/src/layout/V2Shell.tsx` always invokes
`applyUiVersion('v2')` and renders `AppShellV2`, irrespective of
`v2Enabled` or `v2Seats`. The code/tests deliberately ignore
`?ui=v1`, localStorage toggles and legacy environment switches.
`RF_V2_SEATS=none` therefore **does not restore the V1 UI**.

Do not instruct operations to use these values as a rollback mechanism until
a genuine legacy route/shell switch has been implemented and its browser,
permissions, deep-link and persisted-data tests pass.

**Required before production:** choose either a genuine per-seat web UI switch
or a rehearsed blue/green deployment rollback of compatible immutable releases.
Keep V1 code and the 14-day zero-rollback bake guard, and prohibit legacy
decommissioning until full release acceptance is evidenced.
