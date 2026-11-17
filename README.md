# COS101 Exam Practice — Client-Side CBT Platform

A 100% browser-only Computer-Based Test (CBT) practice application for **COS101: Introduction to Computing Science** (National Open University of Nigeria). No backend, database, login, API keys, or environment variables are required.

---

## Project Structure

- `app/` — Next.js App Router pages (`/`, `/test`, `/results`, `/history`)
- `components/` — Reusable UI components (`TopNav`, `QuestionStem`, `NavigatorGrid`)
- `config/test-config.ts` — Test length (`70`), optional timer duration, and optional module weights
- `data/taxonomy.json` — 6 modules, 16 units, and 59 topics mapped to NOUN course material sections & page numbers
- `data/questions/<unit-id>.json` — Verified per-unit question JSON banks (`m1-u1.json` through `m6-u2.json`)
- `data/review-needed.md` & `data/duplicates-removed.md` — Build-time import audit reports
- `raw-questions/` — Untouched raw question files extracted from `COS101_Exam_summary.pdf`
- `scripts/` — CLI utilities (`import-questions.ts`, `validate.ts`, `stats.ts`, `suggest-topic.ts`)
- `lib/` — Pure TypeScript test generator, answer normaliser, scorer, taxonomy loader, and `localStorage` persistence
- `tests/` — Vitest unit tests

---

## Running Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Other Useful Commands

```bash
npm test              # Run Vitest unit tests
npm run lint          # Type-check with TypeScript
npm run stats         # Print question counts per module, unit, and topic (< 8 flagged)
npm run build         # Runs prebuild validation (scripts/validate.ts) then Next.js production build
```

---

## Adding or Updating Questions

1. **Place raw questions in `raw-questions/`** as `.txt` files formatted as:
   ```text
   IPv6 uses a ________-bit address format.
   Answer: 128

   Which protocol translates domain names into IP addresses?
   A. DHCP
   B. DNS
   C. NAT
   D. TCP
   Answer: B. DNS
   ```
2. **Import and classify questions at build time:**
   ```bash
   npm run import-questions
   ```
   This normalises blanks (`________` -> `____`), deduplicates exact matches into `data/duplicates-removed.md`, classifies every question into `data/questions/<unit-id>.json`, and logs any ambiguous or low-confidence items in `data/review-needed.md`.
3. **Check suggested topics for any individual question:**
   ```bash
   npm run suggest-topic -- "The Pascaline was invented by Blaise Pascal in 1642"
   ```
4. **Inspect coverage & validate before building:**
   ```bash
   npm run stats
   npx tsx scripts/validate.ts
   ```
   `scripts/validate.ts` is wired to `"prebuild"` in `package.json`, so `npm run build` automatically rejects duplicate IDs, missing answers, invalid blanks, or unknown taxonomy references.

---

## Configuring Test Length, Timing & Module Weights

Edit `config/test-config.ts`:

- `QUESTIONS_PER_TEST`: Default `70` (falls back gracefully if the pool is smaller).
- `TEST_DURATION_MINUTES`: Default `null` (untimed, elapsed timer tracked). Set to a positive number (e.g., `45`) to enable a countdown timer with auto-submit.
- `MODULE_WEIGHTS`: Default `null` (proportional allocation by each unit's bank size with a minimum of 1 question per non-empty unit). Set a map such as `{ m1: 1, m2: 1, m3: 2, m4: 1, m5: 1, m6: 1 }` to emphasise specific modules.

---

## Deploying to Vercel

1. Push this repository to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Keep the default Next.js build settings (`npm run build`). No environment variables or external services are needed.
4. Click **Deploy**.
