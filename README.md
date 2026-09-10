# AI Doctor OS — marketing site

A Next.js 14 (App Router) rebuild of the AI Doctor OS landing page, based on the provided Figma reference. Dark clinical theme, emerald/cyan/teal accents, sections for the hero workspace mockup, workflow, problem stats, feature grid, and closing CTA.

## Stack

- Next.js 14, React 18, TypeScript
- Tailwind CSS
- lucide-react icons

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
app/
  layout.tsx       root layout, fonts, metadata
  page.tsx          assembles all sections
  globals.css       Tailwind entry + base styles
components/
  Header.tsx           top navigation bar
  Hero.tsx             headline, CTAs, floating badges
  DashboardMockup.tsx  the browser-window workspace preview inside the hero
  WorkflowSection.tsx  "Workflow without friction" 3-step section
  ProblemsSection.tsx  stats + capability grid ("The real problems we solve")
  FeaturesGrid.tsx     "AI operating system" bento feature grid
  CTASection.tsx       closing call-to-action banner
  Footer.tsx           footer
```

## Customizing

- Copy: all copy lives inline in each component — edit directly.
- Colors: the palette is Tailwind's built-in emerald / cyan / teal / slate scales; adjust `tailwind.config.ts` to retheme.
- Icons: swap any `lucide-react` icon by importing a different one from the same package.

## Build for production

```bash
npm run build
npm start
```
