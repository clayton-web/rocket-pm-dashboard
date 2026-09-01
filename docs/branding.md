# Branding — Rocket PM Dashboard

How Rocket corporate identity enters this repository, what this product decides for itself, and where the
line between the two sits.

Scope note: "Master PM Portal" is the project/program description. The registered product name is **Rocket PM
Dashboard**; the UI shorthand is **Rocket PM**. Use those two in code and copy.

## Authority

Rocket corporate identity originates **only** from the `rocket-logic-brand` repository. That repository is the
canonical Rocket Logic brand authority. Nothing in this repository defines a corporate value.

Currently vendored: **brand version 0.1.0 (pre-release)**.

Corporate primitives ratified at that version, and the only ones that exist:

| Token | Value | Ratified in |
|---|---|---|
| `--rl-color-brand-red` | `#e10613` | D-001 |
| `--rl-color-brand-dark` | `#050506` | D-002 |
| `--rl-color-brand-navy` | `#10172f` | D-003 |
| `--rl-font-family-sans` | Inter + fallback chain | D-004 |

There is deliberately no corporate grey scale, no corporate status palette, no corporate focus colour and no
corporate monospace face. If a value is not in the table above, **it is not corporate** — it is this product's
decision, and it belongs in the portal semantic layer, not in the vendored file.

### The one-direction rule

```
Rocket corporate primitive  ->  portal semantic token  ->  Tailwind utility  ->  component
   --rl-color-brand-red          --portal-brand            --color-brand         text-brand
```

Dependencies run left to right and never right to left. A portal semantic token may consume a corporate
primitive. A corporate primitive must never be edited, aliased or re-pointed to serve a portal need. If the
portal wants a value the brand does not define, the portal defines it as its own semantic token — it does not
promote it into corporate canon.

### Files

| File | Layer | Editable here |
|---|---|---|
| `app/brand/rocket-logic.tokens.css` | Corporate primitives, vendored | **No** |
| `app/globals.css` | Portal semantic theme | Yes |
| `components/portal/ui.tsx` | Shared surfaces, page header, form scaffolding, notices | Yes |
| `components/portal/button.tsx` | Shared action treatment | Yes |
| `components/portal/status-badge.tsx` | Shared status-chip treatment | Yes |
| `components/portal/form-control.tsx` | Shared native form-control treatment | Yes |
| `components/portal/summary-pill.tsx` | Shared count-and-label jump target | Yes |
| `components/portal/focus.ts` | The single keyboard-focus class contract | Yes |

### Updating the vendored tokens

`app/brand/rocket-logic.tokens.css` is a byte-for-byte copy of the upstream generated file, preceded by a
provenance header. There is no build step, no package and no generator in this repository — the corporate
repository already owns generation, and duplicating it here would create a second place for a value to drift.

To refresh it (with `BRAND` pointing at a clean checkout of `rocket-logic-brand`):

```bash
BRAND=~/rocket-logic-brand

# 1. Prove the upstream generated file is current with its own source of truth.
(cd "$BRAND" && node tokens/build.mjs --check)

# 2. Record the upstream hash — this goes into the vendored header.
shasum -a 256 "$BRAND/tokens/build/rocket-logic.tokens.css"

# 3. Replace everything from the first bare `/*` line onward with the upstream file,
#    keeping the vendoring header, and update brand version / commit / hash / date in it.

# 4. Verify the copy is exact. Must print nothing.
diff <(awk '/^\/\*$/{f=1} f' app/brand/rocket-logic.tokens.css) \
     "$BRAND/tokens/build/rocket-logic.tokens.css"
```

Step 4 is the guard that matters: the header is prose and can rot, but the diff cannot.

**Do not edit the `rocket-logic-brand` repository** to make something work here. A new corporate value
requires an Owner-ratified decision in that repository first.

## Corporate versus product

### CORPORATE — inherited, not decided here

- **Rocket red `#e10613`** — the corporate identity colour and the corporate default primary-action colour.
- **Rocket dark `#050506`** — the corporate reference foundation value. Available as ink; see below.
- **Rocket navy `#10172f`** — supporting only. Not currently used in this product's UI, and not required to be.
- **Inter** — the corporate and product typeface (D-004).
- **Naming and attribution** — product naming follows `guide/02-naming-architecture.md`. The corporate mark
  and its prohibitions follow `guide/05-logos-and-wordmarks.md`.
- **Semantic rules that bind regardless of palette** — colour never carries meaning alone; one primary action
  per screen; destructive is visually distinct from primary; success is claimed only when confirmed; the brand
  colour is not overloaded with a status meaning.

### ROCKET PM DASHBOARD — this product's decisions

- **Light canvas.** Master PM Portal is a light application. The primary canvas is `--portal-background`
  (neutral-50). There is no dark shell, no dark token set and no theme toggle. Rocket dark may appear as
  high-contrast ink; it is not an application background here.
- **Surface hierarchy.** `background` (canvas) → `surface` (white panels, cards, sidebar, header) →
  `surface-muted` (recessed strips, dashed drop zones, sticky footers). There is deliberately **no**
  `surface-elevated` token: card elevation in this product is carried by `shadow-sm`, not by a distinct fill,
  and a token whose value is identical to `surface` would be decoration rather than architecture. Add it when
  a genuinely different fill exists.
- **Border hierarchy.** `border` (neutral-200) is the default separator. `border-strong` (neutral-300) marks
  interactive edges — inputs, unselected option tiles — so they read as operable rather than decorative.
- **Ink hierarchy.** `foreground` (neutral-900) for content, `foreground-muted` (neutral-600) for supporting
  prose, `foreground-subtle` (neutral-500) for eyebrows, metadata and section labels.
- **Status colours.** Emerald success, amber warning/review, sky information/waiting, red danger/emergency —
  each with a `-surface`, `-border` and `-foreground` companion, plus `-border-strong` and
  `-foreground-strong` for the attention-carrying cases (overdue, emergency, blocking review) that the
  product already distinguished by hand. No corporate hue exists for any of these (corporate
  `07 § What is not defined`), so they are ours. They reproduce what the product already shipped.
- **Density and radius.** Unchanged by the theme work: `rounded-xl` for panels and cards, `rounded-lg` for
  inline notices and tiles, `rounded-md` for shell controls.
- **Dark filled primary action.** See D-011 exception below.
- **Selected state.** `selected` surface plus a Rocket-red leading indicator plus a weight change, and
  `aria-current` in markup. Never colour alone.
- **Focus.** `--portal-focus` is high-contrast ink, not red, so a focus ring is never mistaken for an error
  state. `FOCUS_RING` in `components/portal/focus.ts` is the single focus contract for the whole portal;
  primitives and migrated pages import it rather than repeating the utility string.
- **List conventions.** Rows separate with `border` and hover raises to `surface-muted`. There is no shared
  table primitive: the repository contains two `<table>` elements in total, which is not enough repetition to
  justify one. Operational data is presented as card lists, and those compose the primitives below.

## Shared operational primitives

The primitives under `components/portal/` are where semantic tokens become reusable treatment. They are
deliberately small — class contracts and thin elements, not a configurable component framework — because the
portal's controls are driven by server actions, refs and per-field handlers that a wrapper would have to
re-expose.

| Primitive | Owns | Does not own |
|---|---|---|
| `buttonClasses` / `Button` | Action treatment: 4 variants × 3 densities | What the action does, or its label |
| `statusBadgeClasses` / `StatusBadge` | `tone -> visual treatment` | Which business status maps to which tone |
| `formControlClasses` | Native control treatment: 3 densities, invalid border | Validation logic, submission, `aria-invalid` |
| `FormField` | Label, helper text, error region | The control element itself |
| `SummaryPill` | Compact count-and-label jump target | What is counted, or where it links |
| `noticeClasses` / `InlineNotice` / `InlineAlert` | System-state strips: 5 tones × 2 densities | What the message says, or when to show it |

`formControlClasses` and `buttonClasses` share the same `xs`/`sm`/`lg` density names on purpose, so an `xs`
select and an `xs` button placed in the same row line up without per-site adjustment.

Notices reuse the `StatusTone` vocabulary rather than defining a parallel one, so the portal has a single
answer to "what does a warning look like" whether it is rendered as a chip or as a strip. Tone and size are
props rather than appended `className` overrides because border, radius and background cannot be reliably
overridden by class order in Tailwind — the winner depends on generated CSS order, not on the class string.

### The status-badge boundary

This is the boundary most likely to erode, so it is worth stating plainly:

```
domain code        business status  ->  tone + label     e.g. "Emergency" -> danger, "Emergency"
design system      tone             ->  visual treatment      danger      -> danger-surface / -border / ink
```

`StatusBadge` knows five tones (`neutral`, `success`, `warning`, `danger`, `info`) and two emphases (`soft`
for routine status, `strong` for attention-carrying status). It must **not** grow a registry of business
statuses. Maintenance, leasing, briefing and inbox each keep their own vocabulary and their own mapping,
because those distinctions are product meaning, not styling.

Meaning never rests on colour: the badge always renders its label as text, and the optional `icon` slot is
`aria-hidden` reinforcement rather than the signal itself.

### Action variants

`primary` is the dark filled action (see D-011 below). `secondary` is the light outline. `ghost` is the
low-emphasis action. `danger` is a filled red, deliberately not a shade of primary, so a destructive control
can never be mistaken for the ordinary next step.

All four share the same box model — every variant carries a border, including `ghost` with a transparent one
— so mixed action rows align. All four carry the same focus and disabled contract.

There is no outline-danger variant: the repository has two such controls, which is not enough evidence.

## D-011 product exception — primary filled actions stay dark

Corporate D-007 makes red the default primary-action colour, and corporate
[D-011](../../rocket-logic-brand/DECISIONS.md) explicitly allows a product to establish a different
primary/accent colour where the choice is deliberate, documented and communicative.

**Rocket PM Dashboard's primary filled actions are high-contrast dark ink (`--portal-primary`, neutral-900),
not Rocket red.**

Rationale: this product's core surfaces are operational queues — inbox triage, maintenance, leasing pipelines,
property health. Red already carries load-bearing operational meaning throughout them: danger, emergency,
overdue, missing, and destructive confirmation. Making every Save/Continue button red would put the corporate
accent on the most repeated, least significant control on the screen, directly next to red used as a warning.
That overloads the accent and weakens semantic clarity in exactly the workflows where a misread is expensive.
It also collides with corporate semantic rules 3 and 5 (destructive must be distinguishable from primary; the
brand colour must not double as a status meaning).

Rocket red is therefore reserved in this product for:

- corporate identity (the wordmark),
- active navigation,
- selected emphasis,
- restrained accent.

Meeting the three corporate conditions for an exception:

- **Deliberate** — an explicit product decision, not a component-library default.
- **Documented** — this section, plus the token comments in `app/globals.css`.
- **Communicative** — the split keeps red meaning "identity or attention" and never "this is the ordinary
  next step", so a red control in an operational queue retains its signal.

**Outstanding:** this exception is documented in the product but is **not yet registered** in
`rocket-logic-brand` `DECISIONS.md § 2 Registered product exceptions` alongside E-002 and E-003. That
registration requires an Owner-ratified entry in the corporate repository, which this product may not write.
Until it lands, the exception is documented-but-unregistered.

## Logo treatment

The staff shell uses the **compact text wordmark** — "Rocket" with the product qualifier, set in Rocket
typography, no glyph. This is the approved fallback under corporate D-005 and is the correct treatment here,
not a placeholder for want of effort.

No canonical transparent Rocket master asset exists (corporate O-001). The only Generation B corporate
reference is an opaque JPEG on a black field, which is unusable on this product's light canvas.

Prohibited, per corporate `guide/05-logos-and-wordmarks.md`:

- placing the opaque Generation B bitmap on the light shell,
- keying, knocking out or otherwise removing its background,
- reconstructing, redrawing, tracing or vectorizing the mark,
- inventing a new Rocket mark or a light-background variant,
- deriving favicons or other assets from the reference file.

When the Owner supplies a real transparent master, an image treatment can be evaluated. Until then the text
wordmark is the intentional answer, and it is also the graceful-degradation floor: a Rocket surface can always
identify itself in text.

## Product-source boundaries

Rocket Inspections, Rocket Communicator and the Rocket Logic marketing site are **product implementations**.
They are not corporate authorities, and their `BRANDING.md` files are not inputs to this product.

This portal must not inherit application chrome, palettes, component conventions or layout simply because
they exist in one of those products. Concretely:

- Rocket Inspections' near-black application shell and its emerald tenant-action convention (corporate E-002)
  are that product's ratified decisions. Do not port either here, and do not "correct" them there.
- Rocket Communicator's teal accent (corporate E-003) is that product's ratified decision. It has no standing
  here.
- The marketing site's dark canvas, `--rl-success`, and its other implementation-derived values are not
  corporate and are not portal defaults.

Those products are legitimate **implementation references** — worth reading for how a problem was solved. They
do not define Rocket PM Dashboard UX. The only thing this product inherits from outside itself is what is in
the vendored corporate token file and the corporate guide.
