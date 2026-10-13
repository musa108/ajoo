# Landing page prompt kit

Use these in order, one per message. Do not merge them: asking for everything at once is what produces generic output.
Before starting, make sure `DESIGN.md` is filled in and sitting in the repo root.

Stack assumption: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui. Swap if the project differs.

---

## Layer 0: Brief and plan (no code yet)

```
Read DESIGN.md in full before doing anything.

Project: <<name>>
What it does: <<one sentence>>
Audience: <<who>>
Primary action: <<CTA>>
Context: <<hackathon name + track, or product launch, etc.>>
Real content I have: <<tagline, features, numbers, screenshots, repo link>>

Hard constraint: no dark or grey backgrounds anywhere (page, sections, cards). Light, chromatic surfaces only.

Do not write code yet. Produce a design plan:
1. Confirm the subject, audience, and primary job of the page in 3 lines.
2. Token system: 4-6 named hex colors, typefaces and their roles, type scale, spacing unit.
3. Layout concept in one-sentence prose per section, plus an ASCII wireframe of the hero and one other section. State the alignment for each.
4. The ONE memorable element, and why it comes from this product's world.
5. What you rejected as a generic default and why.

Then review your own plan against DESIGN.md section 11 (anti-patterns). If any part reads like what you would produce for any similar page, revise it and tell me what you changed.
Stop and wait for my approval.
```

## Layer 1: Structure only

```
Plan approved. Build the page structure only.

- Semantic HTML, all sections from DESIGN.md section 10, real copy (no lorem ipsum), written per section 8.
- Tailwind utilities for layout and spacing only. Use grayscale placeholders for color.
- No motion, no decoration, no gradients.
- Mobile-first, then check at 768px and 1280px.

Output complete files, not diffs. List the files you created.
```

## Layer 2: Visual system

```
Apply the visual system from DESIGN.md and the approved plan.

- Wire tokens into the Tailwind theme and CSS variables. No hard-coded hex values in components.
- Load fonts with next/font, correct weights only, display: swap.
- Restyle every shadcn component used so none look default.
- Differentiate hierarchy: not every block gets the same radius, border, or shadow.
- Spend the accent color in one or two places only.

Output complete files. Then screenshot-check at 360px and 1440px if you can run the app, and list what looks weakest.
```

## Layer 3: Motion

```
Add motion following DESIGN.md section 6.

- One signature moment: <<describe, e.g. hero sequence on load / live demo loop / scroll-linked diagram>>.
- Interaction feedback only elsewhere (hover, focus, expand, confirm), 150-250ms, using --ease-out.
- No scroll-triggered fade-ups on every section. No hover lift on every card.
- Respect prefers-reduced-motion with a real static fallback.

Explain in two lines what the motion communicates. If you cannot, remove it.
```

## Layer 4: Content and conversion polish

```
Polish pass on copy and conversion.

- Headline states what the product does, in plain words.
- Every CTA names the outcome. Same action, same label everywhere.
- Replace any vague claim with a concrete noun, number, or example.
- Add the demo video slot, repo link, and "Built for <<hackathon>>" line.
- Set metadata: title, description, OG image, favicon, canonical.
- Write empty/loading/error states for any interactive element.
```

## Layer 5: Critique and quality floor

```
Audit the page against DESIGN.md sections 9 and 11. Be harsh.

1. Run the build, lint, and type-check. Fix failures.
2. Check each item in the quality floor and mark pass/fail with evidence.
3. Name the three weakest design decisions and fix them.
4. Remove one decorative element (the "Chanel rule").
5. Report anything you could not verify instead of claiming it passes.

Output complete updated files.
```

---

## Iteration prompts (use with a screenshot attached)

Name the problem precisely. Examples:

- "Headline weight is too even across all three lines. Make the first line heavier and the rest lighter, keep size."
- "Hero spacing is cramped under the CTA. Increase to --space-16 and align the demo card to the grid."
- "These four cards are identical. Make the first twice as wide and drop the border on the others."
- "The accent appears five times. Keep it only on the primary CTA."
- "On 360px the nav wraps. Collapse to a menu with visible focus and 44px targets."

## When output still feels generic

Paste this:

```
This reads as a template. Compare it to DESIGN.md section 2 (house style table) and section 11. Identify the 3 places it drifts toward defaults, propose a specific replacement for each drawn from this product's subject matter, and apply them. Do not touch anything else.
```

## Hackathon shortcut

For a 48-hour sprint, run Layers 0, 1, 2, then 4, and skip 3 unless the signature moment is the demo itself. Run Layer 5 the evening before submission.
