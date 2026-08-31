# M2-G2 — Shared Operational Page Patterns

Goal: close design-system behavior needed by later screens, using existing architecture and components.

Read first: `AGENTS.md`, master plan M2, blueprint sections 6–8, current tokens/theme/shared components/forms/tables/dialogs/drawers/tests, and planning records. References: Radix Dialog/Tooltip and Tailwind responsive/dark-mode links in blueprint, only where compatible with existing stack.

Implement or repair shared PageFrame, action bar, filters, responsive data table, pagination, badge/status, loading, empty, error, permission-denied/not-found, form validation, confirmation, dialog, drawer, and toast patterns. Operational tables must support accessible labelled controls and narrow-width action menus. Overlays must portal, trap focus, restore trigger focus, support safe Escape, stay within viewport, and scroll internally. Define light/dark semantic tokens; remove hard-coded colors that break one theme. Respect reduced motion and WCAG 2.1 AA.

Do not redesign unrelated pages, introduce a second component library, make fake status cards, or alter business rules. Verify component consumers, keyboard paths, validation announcement, contrast, browser widths/themes, and existing tests. Record components changed, compatibility risks, executed commands, and remaining work.

