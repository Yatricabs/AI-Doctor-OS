# AI Doctor OS

AI Doctor OS is a clinician-controlled workspace for patient context, clinical documentation, reports, prescription safety, AI assistance, and follow-up workflows.

## Routes

- `/` - informative product landing page
- `/demo` - interactive doctor workspace demo
- `/gemini-preview` - isolated preview of the Gemini-generated landing concept

## Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- lucide-react icons

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Product principles

AI assists. Doctors decide. Structured clinical data remains the source of truth.

AI-generated suggestions in the demo are illustrative and require human review before any clinical action.

## Documentation

- [Architecture and system flows](docs/ARCHITECTURE.md)
- [Interactive doctor workspace](app/demo/page.tsx)
- [Landing page](app/page.tsx)

## Production build

```bash
npm run build
npm start
```
