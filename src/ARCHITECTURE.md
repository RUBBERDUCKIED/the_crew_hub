# The Crew Hub — Architecture

## Overview

The Crew Hub is a **hybrid React + legacy-JS** single-page app for managing a window cleaning business. It runs entirely in the browser; all data is persisted in **Supabase** (primary) with a **localStorage read-cache** for fast startup.

The app is served as a standard Vite build: `index.html` → `src/main.jsx` (React entry) + `src/legacy.js` (legacy orchestrator).

---

## Rendering Model

### Legacy Tab (Quotes form)
- Rendered entirely by `legacy.js` DOM manipulation
- HTML structure lives in `index.html` — never touched by React
- Tab visibility controlled by `switchTab()` in `legacy.js`

### React Tabs (Today, Pipeline, CRM, Reports, Leads, Timesheets, Team)
- Each tab panel in `index.html` contains an empty `<div id="xxx-react-root">`
- `src/App.jsx` mounts a `createPortal` into each root div
- `switchTab()` still controls CSS visibility (`.active` class), but React renders all portals at startup and keeps them alive — no unmount/remount on tab switch
- Data flows: Supabase → legacy.js state → `syncDataToStore()` / `syncAllToStore()` → Zustand store → React components

---

## File Map

```
index.html              Static shell: tab buttons, Quotes form HTML, modal skeletons,
                        CDN scripts (Google Maps, Leaflet, EmailJS, Supabase CDN)

src/
├── main.jsx            React entry point — renders <App /> into #react-root
├── App.jsx             Mounts all React tab portals; wraps in ErrorBoundary
├── legacy.js           Legacy orchestrator (see CODE MAP inside initLegacyApp)
├── config.js           Reads import.meta.env → exports CONFIG object
│
├── db/                 Supabase CRUD modules (one file per table)
│   ├── supabaseClient.js   Shared client singleton
│   ├── auth.js             Sign-in, session, team membership RPC calls
│   ├── customers.js        customers table (save, delete, load)
│   ├── jobs.js             jobs table (quotes + scheduled jobs)
│   ├── notes.js            crm_notes table
│   ├── leads.js            leads table (commercial leads)
│   ├── neighborhoods.js    neighborhoods table
│   ├── team.js             team_members, business_info tables
│   └── timeEntries.js      time_entries table (clock in/out)
│
├── helpers/            Pure functions — no side effects, no imports from db/
│   ├── formatting.js       safeGet, esc, escHtml, formatPhone
│   ├── pricing.js          conditionMultipliers, planDiscounts, planNotes, etc.
│   ├── quoteHelpers.js     parseQuoteDate, getAgingBadge
│   ├── leadHelpers.js      Lead scoring / formatting utilities
│   └── weather.js          Weather API fetch helper
│
├── services/           External API integrations
│   ├── emailService.js     EmailJS wrapper (sendEmail)
│   ├── googleCalendar.js   Google Calendar event creation
│   └── googleDrive.js      Google Drive upload/download/delete
│
├── state/
│   ├── useAppStore.js      Zustand store — single source of truth for React
│   └── legacyBridge.js     syncAuthToStore, clearAuthInStore,
│                           syncDataToStore, syncAllToStore
│                           (push legacy state → store after mutations)
│
└── pages/              React tab components (rendered via createPortal)
    ├── TodayTab.jsx        Today's jobs, weather, map, clock-in/out
    ├── PipelineTab.jsx     Saved quotes pipeline (kanban-style)
    ├── CrmTab.jsx          Customer CRM, notes, tags, contact history
    ├── ReportsTab.jsx      Revenue charts, aging, review requests
    ├── LeadsTab.jsx        Lead Finder (import JSON, rate, send to CRM)
    ├── TimesheetsTab.jsx   Time entry management
    └── TeamTab.jsx         Team members, roles, business settings
```

---

## Data Flow

```
User action (React)
  → window.dbSaveCustomer(obj)       ← window bridge in legacy.js
    → _dbSaveCustomer(obj)           ← src/db/customers.js
      → Supabase upsert
    → customers[id] = obj            ← update legacy in-memory state
    → syncDataToStore()              ← push to Zustand
      → React re-renders             ← store subscribers update
```

```
App startup
  → onAuthStateChange fires
    → afterSignIn()
      → load all tables from Supabase into legacy vars
      → syncAllToStore()             ← all data into Zustand at once
      → React tabs render with fresh data
```

---

## Window Bridge

`legacy.js` exposes ~50 functions to `window` via `Object.assign(window, {...})` near the bottom of `initLegacyApp`. This lets:
- `index.html` `onclick="fn()"` handlers call legacy functions
- React components call `window.dbSaveCustomer()`, `window.quoteFromLead()`, etc.

Only genuinely-defined functions appear in the bridge. Optional functions use `typeof` guards.

---

## Auth

- **Provider**: Google OAuth via Supabase Auth
- **Flow**: `handleSignIn()` → Google popup → `onAuthStateChange` → `afterSignIn()` → load data
- **Multi-business**: If a user belongs to multiple businesses, `_authMemberships` is populated and `selectBusiness()` lets them pick
- **Invite flow**: `?invite=UUID` URL param → claim invite → join business as crew/dispatcher

---

## Supabase Tables

| Table | Purpose |
|-------|---------|
| `businesses` | Business info, name, logo URL |
| `team_members` | User ↔ business membership, role |
| `jobs` | Quotes + scheduled jobs (unified) |
| `customers` | Customer CRM records |
| `crm_notes` | Notes attached to customers |
| `leads` | Commercial window cleaning leads |
| `neighborhoods` | Residential targeting areas |
| `time_entries` | Clock in/out records per member |

Row-level security (RLS) enforces that each user can only read/write rows belonging to their `business_id`.

---

## Key Patterns

### `canAccess(role)`
Permission gate — `owner > dispatcher > crew`. Used to hide admin UI from crew members.

### `syncDataToStore()` / `syncAllToStore()`
After any mutation to legacy in-memory state (savedQuotes, customers, leads, etc.), call one of these to push the change to Zustand so React components re-render.

### `safeGet(key, default)`
localStorage wrapper with JSON.parse and fallback — used for the read-cache layer.

### `escHtml(str)`
XSS-safe HTML escaping — always use when injecting user data into `innerHTML`.

---

## Build & Dev

```bash
# Dev server
cd C:\Users\Amadeus\Desktop\the-crew-hub
node node_modules\vite\bin\vite.js

# Production build
node node_modules\vite\bin\vite.js build

# Preview production build
node node_modules\vite\bin\vite.js preview
```

Output: `dist/` — deploy as static files (GitHub Pages, Netlify, etc.)

---

## Environment Variables

Stored in `.env` at project root (never committed):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_CLIENT_ID=
VITE_EMAILJS_SERVICE_ID=
VITE_EMAILJS_TEMPLATE_ID=
VITE_EMAILJS_USER_ID=
VITE_GOOGLE_MAPS_KEY=
```

Read in `src/config.js` → exported as `CONFIG` object.
