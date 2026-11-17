# v2 per-seat rollout switch (B10)

v2 §3: one seat at a time — Employee, then Manager, then Admin. Old screens stay until that seat is proven.

`GET /api/v1/auth/me` adds:

| field | meaning |
|---|---|
| `seat` | caller's seat: `admin` (ADMINISTRATOR role), `manager` (HIRING_MANAGER role or has active direct reports), else `employee` |
| `v2Seats` | seats that get the v2 UI |
| `v2Enabled` | `v2Seats.includes(seat)` |
| `flags.v2Seats` | same list (shape promised in FRONTEND_GAP F4) |

## Where `v2Seats` comes from (first valid wins)
1. **Org config:** `integrations` row with `name = 'ROLLOUT_SEATS'`, `configJson = {"v2Seats": ["employee","manager"]}`. `[]` = nobody. No migration; same pattern as `RLS_ACCESS_POLICY`.
2. **Env `RF_V2_SEATS`:** e.g. `employee,manager`; `none` = nobody.
3. **Default:** `["employee", "manager", "admin"]` (100% full organization cutover).

Unknown seat names are ignored. A level whose values are all invalid falls through to the next level. Values come back in rollout order (employee, manager, admin).

## Emergency Rollback & 14-Day Bake Guard (Choice A)
- **Instant Rollback**: Set `RF_V2_SEATS=none` in the environment, or set `{"v2Seats": []}` in the organization's `ROLLOUT_SEATS` configuration. No database migration or redeployment is required.
- **14-Day Zero-Rollback Bake Guard (Choice A)**: Legacy V1 wrappers in `apps/web/src/pages/`, classic routing paths in `App.tsx`, and `classic-in-shell.css` remain preserved during a mandatory 14-day production bake under live traffic before legacy code decommissioning.

