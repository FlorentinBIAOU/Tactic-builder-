# TACTIC Admin — UI guidelines

Rules for every screen of the admin. The goal: a professional tool that
keeps the TACTIC identity (deep teal + gold) and is clear for a pedagogy
team, not only for developers.

## Stack

- Tailwind CSS with the tokens in `src/styles/app.css` (`bg-surface`,
  `text-muted`, `border-border`, `bg-primary`, `text-brand`, `text-danger`…).
  No hard-coded colours, no new CSS modules.
- Components in `src/components/ui/` (Button, IconButton, Input, Textarea,
  NativeSelect, Field, Badge, Dialog/SheetContent, ConfirmDialog, Menu,
  Tabs, Tooltip, Switch, Checkbox, Skeleton, EmptyState, Notice, Kbd,
  PageHeader, Panel, Stat, chart helpers). Radix underneath: focus trap,
  keyboard and ARIA come for free.
- Icons: `lucide-react` only. Emojis are content (a lesson's emoji), never
  interface icons.
- Text: every visible string goes through `react-i18next`
  (`useTranslation('<namespace>')`), French and English, one JSON file per
  area in `src/i18n/locales/{fr,en}/<namespace>.json`. Dates and numbers
  with `locale()` / the `fmt*` helpers in `components/ui/chart.tsx`.
- Charts: Recharts with `ChartBox`, `axis`, `grid`, `tooltipStyle`,
  `SERIES` from `components/ui/chart.tsx`.

## Layout

- Every page starts with `PageHeader` (title, one-line description,
  primary action on the right). One primary (gold) button per screen.
- Content width is handled by the shell. Use CSS grid / flex with `gap`.
- Use `Panel` only for real groups. Do not wrap every block in a card.
- Lists with several attributes per row → a table (`<table>` with
  `text-sm`, sticky header, row hover `hover:bg-surface-2/50`), wrapped in
  `overflow-x-auto`. Simple lists → rows separated by `divide-y divide-border`.
- Phones (≥ 360 px): no horizontal page scroll; tables scroll inside their
  wrapper; touch targets ≥ 40 px; secondary actions go in a `Menu` (⋯).

## Words

- Sentence case everywhere. No ALL CAPS labels, no `·`-joined meta strings,
  no `→` in buttons, no ✨ on AI buttons.
- Same word for the same thing: Domaine, Module, Leçon, Bloc, Quiz,
  Brouillon, Publiée, Ressource, Programme (syllabus), Agent, Rapport.
- Buttons say what happens ("Enregistrer la leçon", "Publier"), the toast
  repeats the verb ("Leçon enregistrée").
- Errors say what went wrong and what to do, in plain language. Never show
  technical messages (SQL, Supabase, Edge Function) without a readable
  sentence first.

## States

- Loading: `Skeleton` shaped like the content. Never a full-screen spinner.
- Empty: `EmptyState` with what is missing and the action to fix it.
- Error: `Notice tone="danger"` with a Retry action.
- Destructive actions (delete, role change, overwrite): `ConfirmDialog`.
- Unsaved changes in a form: confirm before closing.
- Demo data: `Notice tone="warning"` when `admin_demo_status` reports demo rows.

## Accessibility

- Every control has a visible label (`Field`) or an `aria-label`
  (`IconButton` requires `label`).
- Focus is always visible (global ring). Keyboard reaches every action.
- Contrast: use `text-muted` for secondary text, never lower opacity.
- Status is never colour-only: badge text + colour.
