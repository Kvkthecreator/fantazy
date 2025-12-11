# Fantazy

**Cozy Companion - AI Characters That Remember Your Story**

Fantazy is an AI companion platform where anime-inspired, "next door" characters remember your shared story over time. Step into a cozy romcom world with persistent relationships, episodic conversations, and characters who genuinely care about your day.

## Vision

> Not just an AI assistant with a cute avatar. Yes: an interactive slice-of-life / romcom series where you're the main character and AI characters remember every chapter of your story together.

## Core Features (Coming Soon)

- **Persistent Memory**: Characters remember your conversations, events, and feelings over time
- **Episodic Conversations**: Each session feels like a chapter in your ongoing story
- **Distinct Personalities**: Each character has consistent traits, language style, and boundaries
- **Cozy Archetypes**: Barista, neighbor, coworker - familiar, comforting character types
- **Relationship Progression**: Relationships deepen naturally through meaningful interactions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 15)                     │
│                         /web                                 │
│                       Vercel                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (FastAPI)                        │
│                  /substrate-api/api                          │
│                       Render                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │Characters│ │ Episodes │ │ Memory   │ │Relationships │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Database (PostgreSQL)                        │
│                      Supabase                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Core: users, characters, worlds                       │  │
│  │ Conversations: episodes, messages                     │  │
│  │ Memory: memory_events, hooks                          │  │
│  │ Progression: relationships, relationship_stages       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Model (From Canon)

| Entity | Description |
|--------|-------------|
| `Character` | AI companion with personality, backstory, boundaries |
| `World` | Setting context (cafe, apartment, office) |
| `Episode` | Single conversation session/chapter |
| `MemoryEvent` | Facts, preferences, events extracted from conversations |
| `Relationship` | User-character bond with progression stages |
| `Hook` | Future conversation hooks and reminders |

## Technology Stack

- **Frontend**: Next.js 15 + Tailwind CSS + shadcn/ui (Vercel)
- **Backend**: FastAPI + Python (Render)
- **Database**: PostgreSQL (Supabase)
- **Auth**: Supabase Auth with Google OAuth
- **AI**: OpenAI GPT-4 for character conversations

## Repository Structure

```
fantazy/
├── web/                      # Next.js frontend (Vercel)
│   └── src/
│       ├── app/              # App router pages
│       ├── components/       # React components
│       └── lib/              # Supabase client, utilities
├── substrate-api/
│   └── api/                  # FastAPI backend (Render)
│       └── src/
│           ├── app/          # Application code
│           │   ├── routes/   # API endpoints
│           │   ├── deps.py   # Database connections
│           │   └── main.py   # FastAPI app
│           ├── auth/         # JWT verification
│           ├── middleware/   # Auth middleware
│           └── worker/       # Background jobs
├── scripts/
│   └── dump_schema.sh        # Database utilities
└── docs/
    └── FANTAZY_CANON.md      # Product specification
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account
- OpenAI API key

### Environment Setup

1. Copy environment template:
```bash
cp .env.example .env
```

2. Configure credentials in `.env` (see `.env.example` for all variables)

### Start Development

**Frontend:**
```bash
cd web
npm install
npm run dev
```

**Backend:**
```bash
cd substrate-api/api
pip install -r requirements.txt
cd src && uvicorn app.main:app --reload --port 10000
```

### Database Scripts

```bash
# Set password
export FANTAZY_DB_PASSWORD="your-password"

# Test connection
./scripts/dump_schema.sh test

# List tables
./scripts/dump_schema.sh tables

# Run SQL
./scripts/dump_schema.sh sql "SELECT * FROM users LIMIT 5"

# Run migration
./scripts/dump_schema.sh migrate supabase/migrations/001_initial.sql
```

## API Endpoints

### Health
- `GET /health` - API health check
- `GET /health/db` - Database connectivity

### Coming Soon
- Characters API
- Episodes API
- Memory API
- Relationships API

## Deployments

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | TBD |
| Backend | Render | https://fantazy.onrender.com |
| Database | Supabase | (managed) |

## Documentation

- [Product Canon](docs/FANTAZY_CANON.md) - Product specification and vision

## License

MIT License
