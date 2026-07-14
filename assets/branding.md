
# workspace.json — Brand & Style Guide

Reference doc for keeping every page, deck, and prototype in this project visually and verbally consistent. Source of truth: the bound **workspace.json Design System** (`_ds/workspace-json-design-system-b8d83ce8-fa46-4b07-8519-19c3ef0a739e/`). This file summarizes it for quick use — the linked tokens/components are canonical if anything here drifts.

## 1. What it is

workspace.json is the open spec for a machine-readable `.agents/workspace.json` file that gives AI coding agents structured facts about a codebase (fragility, co-change clusters, framework manifest, health signals). It is the **descriptive** counterpart to AGENTS.md's **prescriptive** layer. Apache 2.0, RFC-governed, authored by Vreko. Reference CLI: `agents-audit`.

## 2. Voice & tone

- **Register:** technical, precise, RFC-style. Use RFC 2119 keywords in caps where a rule is being stated — MUST, MAY, SHOULD.
- **Person:** third-person / implied "you," imperative for instructions ("Run `npx agents-audit`..."). Never chatty, no "we" marketing voice outside governance copy.
- **Casing:** product name is always lowercase, even at sentence start — `workspace.json`. Same for `agents-audit`, `AGENTS.md`. Headings use sentence case, not Title Case.
- **Punctuation:** no em dashes. Use colons, commas, or parentheses.
- **Framing:** explain concepts as binary contrasts (descriptive vs. prescriptive, stable vs. experimental, manual vs. generated). Comparison tables are a signature device.
- **Emoji:** none, ever.
- **Numbers & code:** file paths, field names, versions always in mono (`.agents/workspace.json`, `generated.specVersion`, `v0.4`). Annotate stability inline with `[stable]` / `[experimental]`.
- **Vibe:** infrastructure for machines, documented for humans — confident, spare, short declarative sentences.

## 3. Color

One accent hue (emerald → aqua), a cool green-gray neutral ramp, four status colors. No secondary brand hue, no purple. Dark is the primary theme.

**Brand accent**
- `--wj-accent-low` `#003628` — deep shadow / accent surface
- `--wj-accent` `#00c896` — primary emerald (buttons, links, focus rings)
- `--wj-accent-high` `#86f7d0` — bright aqua highlight (hover states)
- `--wj-aqua` `#7fffd4` — gradient terminus

**Status**
- Stable/success `#00c896` · Experimental/warning `#f59e0b` · Danger `#f2545b` · Info `#38bdf8`

**Dark theme (default)**
- Canvas `--wj-bg` `#07100e` · Elevated card `#0b1714` · Code surface `#0c1915` · Sidebar `#08120f`
- Hairline border `#173028` · Body text `#edf7f3` · Heading `#f0f7f4` · Muted `#8da69c` · Faint `#5d7a70`

**Light theme (inverse)**
- Canvas `#fbfdfc` · Elevated `#ffffff` · Hairline `#d7ebe4` · Body `#0d1f1a` · Link `#008667`

Rule: never invent a new hue. Tint via `color-mix(in srgb, var(--wj-accent) N%, transparent)` for washes (badges, hover, selection) — see `--accent-wash-4/6/15/25`.

## 4. Typography

- **UI + display:** Plus Jakarta Sans, 400–800.
- **Code, data, paths, eyebrows, labels:** Geist Mono.
- Display text is 800 weight, `-0.05em` tracking, clipped with `--gradient-brand` (135deg, `#00c896` → `#7fffd4`) — this is the *only* fill gradient in the system.
- Prose line-height 1.65. Eyebrow labels: mono, uppercase, `0.28em` tracking.
- Scale (rem): caption 0.6875 · xs 0.75 · sm 0.875 · base 1 · md 1.0625 (lead/pull-quote) · lg 1.25 · xl 1.5 (h3) · 2xl 2 (h2) · 3xl 2.75 (h1) · 4xl 3.75 (hero display).

## 5. Layout & spacing

- Spacing scale steps in rem: 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6.
- Prose column `56rem` · wide splash container `72rem` · docs sidebar `18rem` · sticky header `3.75rem`.
- Minimum tap target `44px`.
- Radii: small controls 6–10px · cards & code frames `14px` · hero panel / brand tile `34px` · buttons & badges fully pill (`999px`).

## 6. Surfaces & atmosphere

- Signature background: two soft emerald radial glows (top-right + left) over the dark canvas, plus a faint horizontal scanline grid (1px lines every 3rem, `rgba(255,255,255,0.015)`), masked to fade downward. Never use photography or illustration.
- Cards: raised surface `#0b1714`, 1px hairline `#173028`, 14px radius, ambient shadow `0 20px 50px rgba(0,0,0,0.08)`. Link/hover cards lift `-2px` and warm border toward accent.
- Code frames: 14px radius, hairline border, deeper shadow `0 16px 40px rgba(0,0,0,0.12)`, one-dark-pro syntax palette, title bar with traffic dots + filename + language + copy button.
- Shadows are always soft, low-opacity, large-radius, colorless. No hard or colored shadows.
- Borders are always a single low-contrast hairline. Sidebar/TOC active state = 2px **left border** in accent, never a fill.
- Header uses `backdrop-filter: blur(18px)` over an 82%-opaque nav background.

## 7. Motion

- Fast and minimal: `120–200ms` ease transitions on color/border/background only.
- One reveal animation, `wj-fade-in` (opacity + 4px rise, 160ms), for accordions/`<details>`.
- No bounces, no parallax, no infinite decorative loops.
- Hover: text/links brighten toward `--wj-accent-high`; secondary surfaces gain accent wash + stronger border; cards lift.
- Press: buttons nudge `translateY(1px)`, never shrink.
- Focus: always a 2px solid accent outline, 2px offset.

## 8. Iconography

- **Primary mark (compact): `w.json`.** Superseded the plain `.json` mark as of the Codex work — it reads better standalone and at small sizes. Markup/CSS:
  ```html
  <span class="wj-mark">w<span class="dot">.</span>json</span>
  ```
  ```css
  .wj-mark { font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; letter-spacing:-0.02em; color:#f5faf8; white-space:nowrap; display:inline-flex; align-items:baseline; }
  .wj-mark .dot { color:#00c896; }
  ```
  Use `w.json` anywhere space is tight or the mark stands alone: nav bars, footers, favicons/app icons, compact lockups, badges.
  - **Two variants, chosen by route:** bare `w.json` on the root site and spec/docs routes (`/`, `/spec`, `/getting-started`, etc.) — nothing about those pages is integration-specific. Append `<span class="mono">/ Codex</span>` (or another integration name) only on that integration's own routes, e.g. `/implementations/codex` — the suffix names *which* consumer of the standard the page is about. Never show a suffix on a page that isn't scoped to that integration, and never mix two suffixes in one lockup.
  - See Brand Lockup.html frames 5 (bare) and 6 (suffixed) for both at nav scale.
- **Full wordmark: `workspace.json`.** Still correct for wide lockups — hero sections, deck title/closing slides, OG images, anywhere there's room to spell it out. This is `assets/logo.png` (the `.json` glyph) prefixed with lowercase `workspace` in text, `.json` accent-tinted. Don't shrink the full wordmark below ~28px; switch to `w.json` instead.
- `assets/mark.svg` (four-point sparkle) is the favicon only — never substitute it for either wordmark in headers or hero lockups.
- Icon-light overall. Use simple inline SVGs or Unicode glyphs (`⌕` search, `→` arrow, `+`/`−` accordion, `✦` tip) over an icon library. If a broader set is unavoidable, use Lucide (thin, rounded stroke).
- No icon font, no emoji, no decorative stat icons.

## 9. Components

Consume from the bundle, don't rebuild by hand:
`const { Button, Badge, Card, Callout, CodeBlock, ComparisonTable, Hero, TrustBar } = window.WorkspaceJsonDesignSystem_b8d83c;`

- **Button** — pill CTA, `primary`/`secondary`/`ghost`, three sizes, optional icon.
- **Badge** — uppercase status pill: `stable`/`experimental`/`danger`/`info`/`neutral`.
- **Card** — feature/blog surface, optional link + hover-lift.
- **Callout** — Starlight-style asides (`note`/`tip`/`caution`/`danger`) + italic pull-quote.
- **CodeBlock** — framed code, title bar, copy button, JSON/shell highlighting.
- **ComparisonTable** — feature matrix, emerald final column, check/dash cells.
- **Hero** — splash hero: ambient glow, scanline grid, gradient display title.
- **TrustBar** — "key facts" strip of label/value pairs.

## 9a. Patterns proven out on the Codex implementation page

The Codex page/deck work (`codex-page/`, `codex-deck/`) stayed inside every token above but combined them into a few reusable patterns worth canonizing project-wide:

- **Numbered step badge (`.stepnum`).** A 44–52px circle, pill-adjacent: `border-radius:50%`, `background:color-mix(in srgb,#00c896 15%,transparent)`, 1px border `color-mix(in srgb,#00c896 35%,transparent)`, Geist Mono bold numeral in `#00c896`. Use for ordered install/setup steps instead of a plain numbered list.
- **Status pill (`.pending`).** Uppercase Geist Mono label, pill radius, amber (`#f59e0b`) text/border/8% wash background, with a small solid dot before the text. This is the fourth badge state alongside stable/experimental/danger/info — use it for "not final yet / recorded later" callouts, not just the four existing Badge variants.
- **Diff-style codeframe.** Inside the standard `.codeframe` (14–16px radius, hairline border, title bar with traffic dots + filename), color diff lines directly: added `#98c379`, removed/blocked `#f2545b` (bold for a hard denial line), untouched/comment `#5c6370`, string values `#98c379`, keys `#e06c75` — the existing one-dark-pro palette, applied line-by-line rather than only via a syntax highlighter. Good for before/after proof panels.
- **Architecture/flow diagram card.** A vertical stack of full-width cards (`Source` → parallel channel cards in a 2-col grid → `Boundary`), connected only by position and a label column, no drawn arrows or lines. The "active/enforcing" card in the stack gets the accent border + subtle accent-to-surface gradient background that Card already uses for hover — apply it at rest to mark the card that matters most.

All four are compositions of existing tokens/components, not new primitives — reach for them before inventing a new visual device.

## 9b. Astro handoff note

This project's pages are static HTML prototypes; the real site is Astro (Starlight). Nothing above changes for that move:

- The five token stylesheets (`fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`) plus `styles.css` map directly to a global stylesheet import in `src/layouts/` or `astro.config.mjs` — no rewrite, just relocate the `<link>`s into the layout's `<head>`.
- `Button`, `Badge`, `Card`, `Callout`, `CodeBlock`, `ComparisonTable`, `Hero`, `TrustBar` are the components to port to `.astro`/framework-agnostic components (or keep as islands) — same props, same markup shape used here.
- The four Codex patterns above (stepnum, pending pill, diff codeframe, architecture card) are plain CSS classes over ordinary markup, so they drop into `.astro` files unchanged; no client-side JS involved in any of them.
- Keep `w.json` / `workspace.json` usage rules (9, above) identical in Astro: compact mark in the site header/nav partial, full wordmark on the homepage hero and any OG image generation.

## 10. Guardrails

- No em dashes, no emoji, no Title Case headings, no secondary brand hue.
- No hard/colored shadows, no rounded-rect-with-left-accent-border card cliché (the *only* left-border accent is sidebar/TOC active state).
- No stock photography or illustration; no decorative icon clutter next to stats.
- Every interactive element gets the 2px accent focus ring — don't drop it for aesthetics.
- Every new page loads the design system bundle + all five token stylesheets + `styles.css` before writing custom CSS; style against the `var(--*)` tokens above, never hardcoded hex.

---
*Full component APIs, prompts, and demo cards live under `_ds/workspace-json-design-system-b8d83ce8-fa46-4b07-8519-19c3ef0a739e/`. This file is a working summary, not a replacement.*
