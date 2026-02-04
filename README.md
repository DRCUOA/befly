# Personal Writing Platform (Vendor-Neutral, Self-Hosted)

A calm, mobile-first writing platform designed for publishing, reading, and gently coalescing around shared themes.  
This project is **fully standalone**, **open**, and **self-hosted** — no proprietary builders, no SaaS lock-in.

Writing is the primary object.  
Interaction is intentional, lightweight, and humane.

---

## Core Principles

- **Ownership first** – you own the code, data, and deployment
- **Low cognitive load** – minimal UI, predictable navigation
- **Boring architecture** – explicit over clever
- **Fail loud and early** – no silent failures
- **Readable over optimal** – future-you must understand this at 2am
- **No dark patterns** – no feeds, no algorithms, no engagement traps

---

## Target Stack (Locked)

### Frontend
- Vue 3 (Composition API)
- Vite
- Tailwind CSS
- Markdown rendering
- Mobile-first, accessible design

### Backend
- Node.js
- TypeScript
- Express
- REST API
- MVC architecture
- Stateless

### Database
- PostgreSQL
- SQL migrations
- Thin repository / DAO layer (no ORM magic)

### Deployment
- Local dev first
- Containerisable later (Docker-ready layout)
- No cloud dependency assumptions

---

## High-Level Architecture

```

Client (Vue)
↓ REST
Server (Express)
↓ SQL
PostgreSQL

```

Explicit, inspectable, debuggable.

---

## Project Layout

```

writing-platform/
├── client/                 # Vue 3 frontend
├── server/                 # Node + TypeScript backend
├── shared/                 # Shared types/contracts
├── scripts/                # Dev & admin scripts
├── docs/                   # Architecture & design notes
├── docker/                 # (future) container config
├── .env.example
└── README.md

```

---

## Frontend (`client/`)

```

client/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── src/
│   ├── main.ts
│   ├── App.vue
│   ├── index.css
│   ├── router/
│   │   └── index.ts
│   ├── api/
│   │   └── client.ts          # Plain fetch wrapper
│   ├── domain/
│   │   ├── WritingBlock.ts
│   │   ├── Theme.ts
│   │   └── Appreciation.ts
│   ├── components/
│   │   ├── ui/                # Reusable UI primitives
│   │   └── writing/
│   │       ├── WritingCard.vue
│   │       ├── MarkdownRenderer.vue
│   │       ├── ThemeTag.vue
│   │       └── AppreciationButton.vue
│   ├── pages/
│   │   ├── Home.vue
│   │   ├── Read.vue
│   │   ├── Write.vue
│   │   ├── Themes.vue
│   │   └── Profile.vue
│   ├── layouts/
│   │   └── DefaultLayout.vue
│   ├── stores/               # Pinia (optional)
│   ├── utils/
│   │   └── markdown.ts
│   └── assets/
└── README.md

```

### Frontend Rules

- No proprietary clients or SDKs
- All network calls go through `api/client.ts`
- Domain models live in `domain/`
- Components are presentation-first, logic-light
- Accessibility is non-optional

---

## Backend (`server/`)

```

server/
├── package.json
├── tsconfig.json
├── nodemon.json
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express app setup
│   ├── config/
│   │   ├── env.ts
│   │   ├── db.ts
│   │   └── security.ts
│   ├── routes/
│   │   ├── writing.routes.ts
│   │   ├── theme.routes.ts
│   │   └── appreciation.routes.ts
│   ├── controllers/
│   │   ├── writing.controller.ts
│   │   ├── theme.controller.ts
│   │   └── appreciation.controller.ts
│   ├── services/
│   │   ├── writing.service.ts
│   │   ├── theme.service.ts
│   │   └── appreciation.service.ts
│   ├── repositories/
│   │   ├── writing.repo.ts
│   │   ├── theme.repo.ts
│   │   └── appreciation.repo.ts
│   ├── models/
│   │   ├── WritingBlock.ts
│   │   ├── Theme.ts
│   │   └── Appreciation.ts
│   ├── middleware/
│   │   ├── error.middleware.ts
│   │   ├── validate.middleware.ts
│   │   └── auth.middleware.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── sanitize.ts
│   └── db/
│       ├── migrations/
│       │   ├── 001_init.sql
│       │   ├── 002_themes.sql
│       │   └── 003_appreciations.sql
│       └── seed.sql
└── README.md

```

### Backend Flow

```

Route → Controller → Service → Repository → PostgreSQL

```

No shortcuts.  
No implicit behaviour.  
Everything testable in isolation.

---

## Shared Contracts (`shared/`)

Shared types prevent frontend/backend drift.

```

shared/
├── WritingBlock.ts
├── Theme.ts
├── Appreciation.ts
└── ApiResponses.ts

```

Example:

```ts
export interface WritingBlock {
  id: string
  title: string
  body: string
  themeIds: string[]
  createdAt: string
}
```

Both client and server import from here.

---

## Database (PostgreSQL)

### Core Tables

* `users`
* `writing_blocks`
* `themes`
* `writing_themes` (many-to-many)
* `appreciations`

### Characteristics

* Explicit schemas
* Explicit migrations
* No runtime schema mutation
* No ORM auto-magic

---

## Environment Configuration

```
.env.example
```

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://user:pass@localhost:5432/writing
CORS_ORIGIN=http://localhost:5173
```

No secrets committed. Ever.

---

## Scripts (`scripts/`)

```
scripts/
├── dev.sh        # start client + server
├── migrate.sh    # run SQL migrations
├── seed.sh       # seed dev data
└── reset-db.sh   # destructive local reset
```

Simple shell scripts > clever tooling.

---

## Non-Goals (Explicit)

* No infinite scroll
* No recommendation algorithms
* No engagement optimisation
* No real-time chat
* No growth hacking
* No proprietary dependencies

This is **not** social media.

---

## Future (Intentionally Deferred)

* Docker containerisation
* Auth hardening (JWT / sessions)
* Moderation tooling
* Public theming / federation

These are additive — not architectural rewrites.

---

## Philosophy (Why This Exists)

This project exists to:

* Centre writing over performance
* Encourage reflection over reaction
* Preserve author agency
* Avoid extractive design patterns

The architecture reflects those values.

---

## Status

* Architecture locked
* Vendor-neutral
* Ready for incremental build
* Safe to pause and resume without penalty

---

## License

TBD (MIT recommended if open-sourcing)

