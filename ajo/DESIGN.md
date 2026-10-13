# DESIGN.md: Ajo

Source of truth for every visual decision in this repo. Read before touching UI.

## 1. Product context

- **Product:** Ajo, a rotating savings circle on Monad.
- **One-line job:** start or join a circle, see whose turn it is, and pay on time.
- **Audience:** urban Nigerian earners and small traders who already know ajo / esusu, on phones; plus hackathon judges who need the idea in five seconds.
- **Primary action:** "Start a circle".
- **Tone:** plain, warm, exact. It is NOT crypto-slick.
- **Vernacular that shapes visuals:** the organizer's notebook (a ledger of who paid in which round), the pot passing from hand to hand, market-trader signage, wrapper-cloth colour.

## 2. House style

Reference sites (https://drocsid.app/, https://normandyos.vercel.app/) could not be opened from the build environment, so the specifics below are NOT copied from them. Fill the comparison table once their real values are captured (screenshots or dev-tools CSS). Until then the quality bar is the checklist in section 9.

| Dimension | drocsid.app | normandyos.vercel.app | Ajo decision |
|---|---|---|---|
| Hero treatment | _to capture_ | _to capture_ | Live ring: the pot passes between members on a marigold field |
| Typefaces | _to capture_ | _to capture_ | Bricolage Grotesque (display) + Instrument Sans (body) |
| Surfaces | _to capture_ | _to capture_ | Periwinkle paper, white cards, marigold hero |
| Memorable element | _to capture_ | _to capture_ | The ledger grid, the organizer's notebook made on-chain |

## 3. Hard rule

**No dark or grey backgrounds.** Every page, section, card, and overlay scrim is light and chromatic. No black, near-black, charcoal, slate, or neutral grey surfaces; no dark mode. Dialog scrims are a pale cobalt tint with blur, not a dark overlay.

## 4. Tokens

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F2F4FF` | page background (periwinkle) |
| `--surface` | `#FFFFFF` | cards, inputs |
| `--marigold` | `#FFC933` | the pot: hero field, recipient marker |
| `--marigold-tint` | `#FFF1C2` | highlights, covered / late states |
| `--cobalt` | `#2540E8` | actions, links, focus |
| `--cobalt-tint` | `#DFE4FF` | selected, hover, scrim |
| `--ink` | `#101437` | text only (never a surface) |
| `--ink-soft` | `#4A4F7A` | secondary text |
| `--line` | `#D5DAFF` | borders, dividers |
| `--leaf` / tint | `#0B7A4D` / `#DDF5E9` | paid |
| `--coral` / tint | `#C7301F` / `#FFE3DF` | missed, danger |

Type: Bricolage Grotesque 800 / -0.035em for display, 700 for h2, Instrument Sans 400 / 500 / 600 for text. Body 17px / 1.6. Tabular figures for every amount, score, and timer. Spacing on a 4px base. Radii are by role: pills for actions (999), 24 for the hero panel, 16 for cards, 12 for inputs, 8 for chips.

Motion: 150-250ms ease-out for responses to actions. One non-user motion on the whole product: the ring on the landing page and circle page. `prefers-reduced-motion` gets a static ring.

## 5. Rules

- One typeface family for display, one for text. No single-word colour accent in headlines. No all-caps eyebrow labels. No `→` on links.
- Numbered markers appear only for the true sequence (how a circle works).
- Structure carries information: the ledger grid's rows are members and columns are cycles; borders appear only there and around inputs.
- State is never colour alone: every ledger cell has an icon and an accessible name.
- Buttons name the outcome ("Start a circle", "Pay $5", "Settle cycle 3"). Same action, same name everywhere.
- Errors say what happened and what to do. They never apologise.
- Modals only for irreversible actions (cancel circle). Everything else is inline or a polite toast.

## 6. Quality floor

Responsive 360-1920px, visible focus rings, 44px touch targets, AA contrast, reduced motion, labelled inputs above fields, inline validation on blur, empty / loading / error states designed.

## 7. Anti-patterns rejected

Cream + serif + terracotta; near-black + acid green; any dark or grey surface; identical rounded cards with one soft grey shadow; gradient washes; tracked ALL-CAPS eyebrows; stats strips under the hero; emoji icons.
