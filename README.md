# Lumiere — Smart Wardrobe Management System

A Context-Aware Smart Wardrobe Management System with Generative Virtual Try-On
and Recency Analytics.

Final Year Project. Next.js frontend, Django REST backend, PostgreSQL database.

---

## What makes this different from existing wardrobe apps

| Capability | Acloset / Whering / Stylebook | This system |
| --- | --- | --- |
| Digital closet with photos | Yes | Yes |
| Background removal on upload | Partly | Yes, automatic |
| **Physical storage location** (room → cabinet → drawer) | No | Yes |
| Weather-aware suggestions | Basic | Weather + occasion + recency scoring |
| **Wear-recency guardrail** (never repeat an outfit in the same circle) | No | Yes |
| **Generative virtual try-on** on your own photo | No | Yes |
| Find your own clothes from an inspiration photo | No | Yes, vector search |
| In-app resale with **digital ownership transfer** | No | Yes |
| Friend-to-friend borrowing | No | Yes |

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js 16, React 19, TypeScript | Industry standard, responsive on one codebase |
| UI | Tailwind CSS 4 + shadcn/ui | Owned components, premium look |
| Data fetching | TanStack Query | Caching and loading states for free |
| Backend | Django 5.2 + Django REST Framework | Clean API layer, fast to build |
| Auth | JWT (simplejwt), email-based login | Standard for a decoupled frontend |
| Database | PostgreSQL (Neon) + pgvector | Relational data *and* image embeddings in one place |
| Background removal | `rembg` | Phase 2 |
| Image tagging + similarity | Fashion-CLIP | Phase 4–5 |
| Virtual try-on | fal.ai (FASHN) | Phase 5 |
| Weather | OpenWeather API | Phase 3 |
| Image hosting | Cloudinary | Phase 2 |

---

## Repository layout

```
FYP/
├── backend/                  Django REST API (port 8000)
│   ├── config/               settings, root urls, wsgi
│   ├── apps/                 one folder per feature
│   │   ├── accounts/         users, JWT auth, profile
│   │   ├── wardrobe/         items, categories, storage locations
│   │   ├── outfits/          saved outfits, wear log
│   │   ├── planner/          events, calendar, weather
│   │   ├── intelligence/     suggestion engine, colour rules
│   │   ├── vision/           rembg, Fashion-CLIP, try-on
│   │   └── community/        marketplace + friend swaps
│   ├── requirements/         base.txt, dev.txt
│   └── manage.py
│
├── frontend/                 Next.js app (port 3000)
│   └── src/
│       ├── app/              routes
│       │   ├── (auth)/       login, register
│       │   └── (app)/        everything behind login
│       ├── components/ui/    shadcn components
│       ├── components/layout/ sidebar, topbar, mobile nav
│       ├── hooks/            useCurrentUser, useLogin, ...
│       ├── lib/              api client, token storage
│       └── types/            TypeScript mirrors of Django models
│
└── docs/                     diagrams and notes for the thesis
```

**Rule:** one Django app per feature, so two people can work at once without
editing the same file.

---

## Running it locally

You need **two terminals** — one for each server.

### Terminal 1 — backend

```bash
cd backend
venv/Scripts/activate          # Windows
python manage.py runserver
```

Runs at http://localhost:8000
API documentation at http://localhost:8000/api/docs/
Admin panel at http://localhost:8000/admin/

### Terminal 2 — frontend

```bash
cd frontend
npm run dev
```

Runs at http://localhost:3000

---

## First-time setup (for a new machine, or your teammate)

```bash
# 1. Backend
cd backend
python -m venv venv
venv/Scripts/activate
pip install -r requirements/dev.txt
cp .env.example .env           # then fill in the real values
python manage.py migrate
python manage.py createsuperuser

# 2. Frontend
cd ../frontend
npm install
cp .env.example .env.local
```

### Generating a new SECRET_KEY

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

---

## Environment variables

`backend/.env` — never committed.

| Key | Needed by | Phase |
| --- | --- | --- |
| `SECRET_KEY` | Django | 1 |
| `DEBUG` | Django | 1 |
| `DATABASE_URL` | Neon PostgreSQL | 1 |
| `CORS_ALLOWED_ORIGINS` | lets :3000 call :8000 | 1 |
| `CLOUDINARY_*` | image hosting | 2 |
| `OPENWEATHER_API_KEY` | weather | 3 |
| `FAL_KEY` | virtual try-on | 5 |

`frontend/.env.local`

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` locally |

---

## API endpoints

Full interactive list at `/api/docs/` while the backend runs.

### Phase 1 — Auth

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register/` | Create account, returns tokens + user |
| POST | `/api/auth/login/` | Sign in, returns tokens + user |
| POST | `/api/auth/refresh/` | Swap refresh token for a new access token |
| GET | `/api/auth/me/` | Current user |
| PATCH | `/api/auth/me/` | Update name, city, body photo |
| GET | `/api/health/` | Deployment health check |

---

## Build phases

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Foundation: auth, project structure, deployment | **in progress** |
| 2 | Wardrobe core: items, rembg, storage locations, search, laundry, cost-per-wear | planned |
| 3 | Planner: weather, events, wear log, "what I wore last time" | planned |
| 4 | Intelligence: outfit builder, colour rules, CLIP tagging, suggestion engine | planned |
| 5 | AI showpieces: Steal the Look (pgvector), virtual try-on | planned |
| 6 | Community: marketplace + friend swaps + ownership transfer | planned |
| 7 | Polish, demo data, evaluation | planned |

---

## Deliberately out of scope

Documented so the thesis can list them as future work rather than gaps:

- Instagram / social platform API integration — the platform does not expose
  post history or viewer data, so the recency feature uses the app's own event
  log instead.
- Online payment processing — the marketplace handles listing, purchase intent,
  and ownership transfer; settlement happens offline.
- Real-time AR try-on, 3D avatars, RFID hardware, smart-mirror hardware.
- Skin-tone colour-season analysis and wrinkle detection — both need labelled
  ground-truth data we cannot produce in the project window.
