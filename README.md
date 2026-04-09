# ULTISchoolPulse

A smart school-to-home communication bridge that extracts homework, classwork, and exam information from school PDFs and delivers organized daily digests to parents, kids, and tutors.

## Tech Stack

- **Frontend:** Next.js 16 (App Router) + Tailwind CSS v4
- **Backend:** Convex (real-time database, file storage, scheduled jobs)
- **Auth:** Clerk
- **AI:** OpenAI GPT-4o / Anthropic Claude (PDF extraction)
- **Email:** Resend (daily digests)

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Convex account (convex.dev)
- Clerk account (clerk.com)

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=              # From Convex dashboard

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=   # From Clerk dashboard
CLERK_SECRET_KEY=                     # From Clerk dashboard
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

Set these in the **Convex dashboard** environment variables:

```
CLERK_JWT_ISSUER_DOMAIN=             # From Clerk dashboard
```

### Running Locally

```bash
# Install dependencies
npm install

# Start Convex dev server (in a separate terminal)
npx convex dev

# Start Next.js dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Deployment

### Vercel (Frontend)

1. Connect the GitHub repo to Vercel
2. Add environment variables: `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
3. Push to main — Vercel auto-deploys

### Convex (Backend)

1. Add environment variables in Convex dashboard: `CLERK_JWT_ISSUER_DOMAIN`
2. Deploy: `npx convex deploy`

## Project Structure

```
src/
  app/                    # Next.js App Router pages
    (dashboard)/          # Authenticated route group
    sign-in/              # Clerk sign-in
    sign-up/              # Clerk sign-up
  components/
    ui/                   # Design system primitives
    features/             # Feature-specific components
  lib/                    # Utilities
convex/
  schema.ts               # Database schema
  users.ts                # User queries & mutations
  auth.config.ts          # Clerk auth config
```
