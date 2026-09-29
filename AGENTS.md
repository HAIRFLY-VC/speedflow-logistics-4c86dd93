<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Sidebar items live in src/lib/menu-items.ts; per-user overrides in user_menu_access (row __custom__ = customized). Why: single source for menu, users screen and screen guard.
- App version lives in src/config/version.ts (single source, also feeds vite's __APP_VERSION__); every relevant change bumps it and adds a CHANGELOG.md entry. Why: versioning policy.
- Large lists read from the central DB must paginate (PostgREST returns at most 1000 rows by default). Why: silent truncation broke lookups like tipo/PIX.
- The pending-route card and the unassigned-orders screen share `pedidosSemRotaQueryOptions`. Why: their totals and filters must always match.
- Grouped tables remain collapsed by default; screens that need immediate detail opt in through `defaultGroupsExpanded`. Why: preserve existing behavior elsewhere.
