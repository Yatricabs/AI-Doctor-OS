# AI UPCHAR

AI UPCHAR is a clinician-controlled workspace for patient context, clinical documentation, reports, prescription safety, AI assistance, and follow-up workflows.

## Public routes

- `/` - Home and product overview
- `/product` - Product and AI capabilities
- `/workflow` - Connected clinical workflow
- `/for-doctors` - Doctor experience
- `/security` - Safety, privacy, and governance
- `/about` - About AI UPCHAR
- `/contact` - Clinic demo and contact form
- `/demo` - Interactive doctor workspace demo
- `/gemini-preview` - Isolated Gemini concept preview

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
