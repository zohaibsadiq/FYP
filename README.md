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
    shopping/      shop catalogues, sale prices, price history
    intelligence/  colour rules, colour naming
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
| `/api/planner/` | today's weather, what suits it, and the day planner |
| `/api/shopping/deals/` | what is on sale, filtered, with a closet verdict on each row |
| `/api/shopping/freshness/` | how old the prices are, and which shops answered |
| `/api/shopping/filters/` | the choices the filter panel offers, each with a count |

## Keeping the sale prices current

Nothing is fetched from a shop while a request is being answered. A command
reads each shop's published catalogue, writes it into our own tables, and the
page reads the tables. So the page stays fast, a shop being down breaks
nothing, and every price on screen carries the moment it was really checked.

```bash
cd backend
python manage.py seed_shops          # once, to add the shops
python manage.py sync_deals          # the refresh itself
python manage.py sync_deals --shop outfitters   # one shop, when one misbehaves
```

A full run reads about seven and a half thousand products in under two
minutes, and honours each shop's requested gap between requests. Twice a day
is plenty for clothing, where a sale runs for weeks.

The refresh is shared. It is one job for the whole app, not one per person,
so the number of accounts changes nothing about how often the shops are read.

### In production

`render.yaml` at the repository root declares two services: the API, and a
separate `closette-prices` cron service that runs `sync_deals --quiet` at
01:00 and 13:00 UTC, which is six in the morning and six in the evening in
Pakistan. Hosted schedulers run on UTC, so the times are written that way.

Keeping the schedule as its own service is the point of it. It wakes, works
for two minutes and stops, whether or not anybody has opened the site. A timer
living inside the web service would sleep whenever the web service sleeps, and
the prices would quietly go stale.

Every other host has the same feature under a different name: Railway cron,
Heroku Scheduler, PythonAnywhere scheduled tasks, DigitalOcean App Platform
scheduled jobs. Only the few lines of configuration differ.

### While developing

```bash
python manage.py sync_deals --quiet
```

Or on a plain server, through cron:

```
0 1,13 * * *  cd /srv/closette/backend && venv/bin/python manage.py sync_deals --quiet
```

### What a scheduler sees

`sync_deals` exits 0 when at least one shop was read and 1 when none were, so
a total outage is reported as a failed run rather than a quiet success. One
shop failing out of eight is an ordinary day: it exits 0, and the app says so
on the page instead.

`/api/shopping/freshness/` reports the age of the oldest working shop, and the
page says so out loud once it passes `STALE_AFTER_HOURS`. A failed refresh
leaves the stored prices and their timestamps untouched, so a shop that cannot
be reached never makes the data look newer than it is.

## Checks

```bash
cd backend  && python manage.py check && python manage.py spectacular --file /dev/null
cd frontend && npm run lint && npm run build
```

## Conventions

See `CONTRIBUTING.md` for the comment policy, copy rules and the
stack-specific pitfalls that have already caused bugs here.
