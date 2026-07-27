# UX heuristic audit

The audit uses Nielsen's ten usability heuristics as the primary framework and
checks the proposal's supporting UI laws. The goal is to make system behaviour
visible, reversible and understandable.

## Nielsen's heuristics

| Heuristic | Implementation evidence |
|---|---|
| 1. Visibility of system status | Loading/progress controls, ticket/booking/payment badges, verification state, price lock, cash reference and success/error announcements expose current state. |
| 2. Match with the real world | NPR prices, pickup landmarks, “cash received”, “mark returned” and role-specific language mirror rentals. Demo wallet and SOS boundaries use literal language. |
| 3. User control and freedom | Back/cancel actions, cancellation preview, rescheduling, logout, theme choice and recoverable errors provide exits. Account deletion needs explicit confirmation. |
| 4. Consistency and standards | Shared shadcn/Base UI controls, status vocabulary, navigation, error styling and date/currency formatting remain consistent. |
| 5. Error prevention | Strict schemas reject extra fields; overlap/access checks precede mutations; totals are server-owned; cash cannot self-confirm; support/admin transitions are one-way. |
| 6. Recognition rather than recall | Persistent role navigation, active-page state, filters, itemised prices, booking references and contextual actions keep choices visible. |
| 7. Flexibility and efficiency | Guest browsing defers authentication, filters reduce results, owners get quick actions, admins get a priority queue and sessions restore securely. |
| 8. Aesthetic and minimalist design | Clear hierarchy, restrained blue/amber color, grouped forms and progressive steps foreground the current decision. |
| 9. Error recognition, diagnosis and recovery | Task-level API messages, alert semantics, retry/start-over actions and visible password rules explain recovery. |
| 10. Help and documentation | Searchable FAQ, support tickets, receipt evidence, setup guides and sprint/test documentation explain capabilities and limitations. |

## Core UI laws

- **Fitts's law:** primary mobile actions and portal navigation use comfortable
  targets; the ride SOS control remains prominent.
- **Hick's law:** onboarding/booking use focused stages, while support and admin
  workflows offer only valid next states.
- **Miller's law:** comparison is capped at three; information is grouped into
  price, specifications, location and trust evidence.
- **Jakob's law:** the portal uses a conventional sidebar, header, tables and
  familiar authentication vocabulary.
- **Gestalt proximity/common region:** cards and labelled sections group related
  controls; record actions stay beside their record.
- **Tesler's law:** totals, overlap, security and access complexity stay on the
  server rather than being transferred to the user.
- **Doherty threshold:** feedback appears immediately and controls disable
  during network operations to prevent duplicate actions.

## Accessibility checks

- Semantic headings, labels, tables, links and buttons.
- Skip link, visible keyboard focus and `aria-current` navigation.
- Drawer controls expose expanded state.
- Status/errors use live semantics where feedback matters.
- Responsive layouts support phone through large-screen widths.
- Theme tokens provide dark contrast and system preference initializes theme.
- Reduced-motion preference shortens animation and transitions.

## Remaining evaluative work

Automated checks do not replace user testing. Representative renter, owner and
admin participants should measure task completion, errors, confidence and
SUS-style feedback, especially for cost comprehension, cash handover, condition
evidence, support expectations and keyboard-only portal use.
