# RecruitFlow Frontend Enhancement Pass

## What changed

### Global visual system
- Refined the light-mode canvas, brand blue, borders, radii, shadows, and shell dimensions in `src/styles/tokens.css`.
- Added `src/styles/polish.css` as a final presentation layer for consistent surfaces, responsive behavior, reduced-motion support, scrollbars, page entry polish, and the redesigned application shell.
- Kept the existing Tailwind v4 + shadcn/Radix architecture rather than adding a second UI framework.

### Navigation and application shell
- Redesigned the desktop sidebar with clearer icon containers, active states, section rhythm, workspace context, and a cleaner footer.
- Added a real mobile navigation drawer and backdrop. Previously the sidebar moved off-screen at tablet/mobile widths without a replacement navigation control.
- Persisted desktop collapsed-sidebar preference in `localStorage`.
- Added a mobile menu button and accessible close behavior.
- Updated the header/search/action/notification treatment.
- Added an inline route-loading fallback inside the shell so lazy page navigation no longer needs to visually replace the entire application shell.

### Icons
- `src/components/Icon.tsx` now maps the existing RecruitFlow icon names to `lucide-react` icons.
- Existing `<Icon name="..." />` calls remain compatible.
- No extra icon package is required because `lucide-react` is already in `package.json`.

### Shared UI primitives
Updated shared primitives so the improvements propagate across the app:
- Button
- Input
- Select
- FormField
- Card
- MetricCard
- DataTable
- PageFrame
- Alert
- Badge
- PriorityChip
- FilterChip
- Toast / AlertBanner
- Modal
- Drawer
- Spinner / loading fallbacks
- AtmosphericBackground

### Accessibility and UX
- Modal and drawer focus trapping improved.
- Modal/drawer body scrolling is locked while open and restored when closed.
- Focus returns to the previously focused control after closing.
- Filter chips with click behavior are now keyboard operable.
- Mobile drawer supports Escape-to-close.
- Reduced-motion preferences are respected globally.

### Performance
- Notification unread polling pauses while the browser tab is hidden.
- Notification popover data uses a short cache window to avoid repeated requests when reopened quickly.
- Atmospheric background was reduced to one static compositing layer instead of multiple fixed full-screen layers.
- Existing page-level `React.lazy()` route splitting was retained.
- Added a shell-level Suspense fallback for better perceived navigation performance.
- Named Lucide imports are used rather than loading a dynamic icon registry.

## Dependencies
No new dependency is required for this enhancement pass.

The existing project already includes:
- `lucide-react`
- `tailwindcss`
- `radix-ui`
- `shadcn`
- `tw-animate-css`

I intentionally did not add Motion/Framer Motion. The current app does not need another animation dependency for the interaction level implemented here. If future requirements include complex shared-layout transitions, gesture-driven UI, or sophisticated animated charts, `motion` can be considered then.

## Validation performed
- Parsed/transpiled all 76 `.ts` / `.tsx` source files with TypeScript: **0 syntax errors**.
- A complete production build could not be reproduced from this frontend-only archive because `package.json` references monorepo workspace packages (`@recruitflow/contracts` and `@recruitflow/validation`) that are not included in this ZIP.
- Run the normal project build from the full monorepo root to validate workspace resolution:

```bash
npm install
npm run build
```

If the monorepo uses a root-level package manager command, use the existing root workflow instead.
