# Closette

A wardrobe app that tracks what you own and where it is physically kept, then
uses the weather, your plans and what you wore recently to suggest what to put
on. Photos are cut out from their background on upload and tagged by colour.

Next.js frontend, Django REST backend, Postgres.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/ui |
| Data fetching | TanStack Query |
| Backend | Django 5.2, Django REST Framework |
| Auth | JWT via djangorestframework-simplejwt, email as the login field |
| Database | Postgres with pgvector |
| Background removal | rembg (U2-Net, runs locally on CPU) |
| Image hosting | Cloudinary |
| Weather | OpenWeather |

## Layout

```
backend/
  config/          settings, root urls, wsgi
  apps/
    accounts/      users, auth, profile
    wardrobe/      items, categories, storage locations
    outfits/       saved outfits and wear history
    planner/       events, weather
    intelligence/  colour rules, outfit scoring
    vision/        background removal, Cloudinary, try-on
    community/     marketplace and lending
  requirements/

frontend/src/
  app/             routes; (auth) is public, (app) is behind login
  components/ui/   shadcn primitives, overwritten by `shadcn add`
  components/      feature components
  hooks/
  lib/             api client, token storage
  types/           mirrors of the DRF serializers
```

One Django app per feature area, so parallel work rarely touches the same file.

## Prerequisites

Python 3.13, Node 22 or newer, and a Postgres connection string. Any Postgres
works; the project is developed against Neon.

## Setup

```bash
# backend
cd backend
python -m venv venv
venv/Scripts/activate          # source venv/bin/activate on macOS and Linux
pip install -r requirements/dev.txt
cp .env.example .env           # fill in DATABASE_URL and the API keys
python manage.py migrate
python manage.py createsuperuser

# frontend
cd ../frontend
npm install
cp .env.example .env.local
```

The first image upload downloads the 176 MB U2-Net model and caches it in
`~/.rembg`. That request takes around 30 seconds; later ones take about 1.5.

## Running

Two terminals.

```bash
cd backend && venv/Scripts/activate && python manage.py runserver
cd frontend && npm run dev
```

| URL | |
| --- | --- |
| http://localhost:3000 | app |
| http://localhost:8000/api/docs/ | interactive API reference |
| http://localhost:8000/admin/ | Django admin |

## Environment

`backend/.env`, copied from `.env.example` and never committed.

| Key | Required | Notes |
| --- | --- | --- |
| `SECRET_KEY` | in production | Startup fails without it when `DEBUG` is off |
| `DEBUG` | | Defaults to off |
| `DATABASE_URL` | in production | Empty falls back to SQLite, which lacks the ArrayField columns |
| `CONN_MAX_AGE` | | Defaults to 120, below Neon's 300s idle suspend |
| `CORS_ALLOWED_ORIGINS` | | Defaults to `http://localhost:3000` |
| `CLOUDINARY_CLOUD_NAME` | | |
| `CLOUDINARY_API_KEY` | | |
| `CLOUDINARY_API_SECRET` | | |
| `OPENWEATHER_API_KEY` | | |
| `FAL_KEY` | | Virtual try-on |

`frontend/.env.local` needs `NEXT_PUBLIC_API_URL`, pointing at the backend.

If `DATABASE_URL` contains `-pooler`, Django disables server-side cursors,
because the pooled endpoint runs PgBouncer in transaction mode. Schema
migrations and index builds should use the direct endpoint.

## API

Full reference at `/api/docs/`, generated from the serializers by
drf-spectacular. Every endpoint except register, login and refresh requires a
bearer token, and every queryset is scoped to the requesting account.

| | |
| --- | --- |
| `/api/auth/` | register, login, refresh, verify, me |
| `/api/wardrobe/items/` | garments, plus mark-worn, toggle-laundry, bulk-move, stats |
| `/api/wardrobe/storage/` | storage locations, plus a nested tree |
| `/api/wardrobe/categories/` | built-in and account-specific categories |
| `/api/wardrobe/upload/` | image in, background-removed image and detected colour out |

## Checks

```bash
cd backend  && python manage.py check && python manage.py spectacular --file /dev/null
cd frontend && npm run lint && npm run build
```

## Conventions

See `AGENTS.md` for the comment policy, copy rules and the stack-specific
pitfalls that have already caused bugs here.
