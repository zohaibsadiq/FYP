# Closette: An AI-Assisted Smart Wardrobe Management System

Everything this project is made of, why each piece was chosen, and how the
parts fit together.

---

## 1. What Closette is

A smart wardrobe web app. A person photographs the clothes they own, and the
app then answers questions a wardrobe cannot answer by itself:

- **Where is my blue shirt?** It remembers the room, the cupboard and the shelf.
- **What have I not worn for months?** It keeps a wear log.
- **Is this on sale anywhere?** It reads real shop catalogues twice a day.
- **Can I sell this?** A marketplace between users of the app.
- **Can I borrow one for Saturday?** Lending between friends.

It runs in a browser on a phone or a laptop.

### Where the name comes from

**Closette** is **closet** plus **-ette**, the ending that means small or
portable, as in kitchenette. It reads as "a little closet": a wardrobe small
enough to carry.

*Closet* is American English for what British English calls a *wardrobe* and
Urdu calls an *almari*, so the name and the subtitle say the same thing twice,
once memorably and once plainly.

"Wardrobe" itself carries two meanings, and the app uses both: the clothes a
person owns, and the furniture those clothes live in. `GarmentItem` is the
first, `StorageLocation` is the second.

### Where the AI is

One trained model does real work here. Background removal runs **U-2-Net**, a
deep convolutional network for salient object detection, with roughly 176 MB of
learned weights. A photograph taken against any background comes back as a
clean cutout.

Everything else is deliberately conventional. Colour naming is CIE L\*a\*b\*
colour science, shop classification is rule-based pattern matching, and weather
advice is a set of thresholds. Those choices are explained where they appear.
Calling them AI would overstate them.

---

## 2. The big picture

```
   Browser (phone or laptop)
            |
            |  HTTPS, JSON
            v
   Next.js frontend  ........ hosted on Vercel
            |
            |  HTTPS, JSON + a token
            v
   Django REST API   ........ hosted on Render
            |
    +-------+--------+-----------------+----------------+
    |                |                 |                |
 Postgres        Cloudinary       OpenWeather     Shopify shops
  (Neon)          (photos)         (weather)       (prices)
```

Two separate programs. The frontend knows nothing about the database; the
backend knows nothing about buttons. They speak only through a JSON API.

**Why split them?** Three reasons worth saying out loud:

1. The same API can serve a phone app later without rewriting anything.
2. They scale and deploy independently. A frontend change needs no server restart.
3. It is the standard shape of a modern web product, so the work is transferable.

---

## 3. Folder structure

```
FYP/
|-- backend/                 Django project (the API)
|   |-- config/              project-wide settings, URL map, WSGI entry point
|   |-- apps/                one folder per area of the product
|   |-- requirements/        pinned package lists
|   |-- tests/               the automated test suite
|   |-- manage.py            Django's command-line entry point
|   `-- pytest.ini           test runner configuration
|
|-- frontend/                Next.js project (what people see)
|   |-- src/app/             one folder per page (URL)
|   |-- src/components/      reusable pieces of interface
|   |-- src/hooks/           the code that talks to the API
|   |-- src/lib/             small helpers with no React in them
|   |-- src/types/           TypeScript shapes mirroring the API
|   `-- public/              images served as-is
|
|-- docs/                    this guide
|-- render.yaml              describes the backend hosting
|-- README.md                how to run it locally
`-- CONTRIBUTING.md          coding conventions
```

---

# PART ONE: THE BACKEND

---

## 4. Why Django and Django REST Framework

**Django** is a Python web framework. It was chosen because it brings four
things that would otherwise take months to build:

| What Django gives              | Why it matters here                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| ORM (Object Relational Mapper) | Write `GarmentItem.objects.filter(owner=user)` instead of SQL. It also blocks SQL injection automatically. |
| Migrations                     | Changing a model writes a versioned script that updates the real database safely.                          |
| Admin site                     | A ready-made back office at `/admin/` to inspect data while developing.                                    |
| Auth system                    | Password hashing, validators and permissions, already audited by thousands of projects.                    |

**Django REST Framework (DRF)** sits on top and turns Django into a JSON API:
serializers, viewsets, permissions, pagination, filtering, throttling.

**What is an ORM, with an example.** Without one:

```sql
SELECT * FROM garment_items WHERE owner_id = 7 AND status = 'IN_WARDROBE';
```

With Django:

```python
GarmentItem.objects.filter(owner=request.user, status="IN_WARDROBE")
```

The second is shorter, works on any database, and cannot be tricked by a user
typing `'; DROP TABLE --` into a search box, because the value is always sent
separately from the query text.

---

## 5. Every backend package, and why

From `backend/requirements/core.txt` - these are installed in production:

| Package                         | Version | What it does          | Why it is here                                                        |
| ------------------------------- | ------- | --------------------- | --------------------------------------------------------------------- |
| `Django`                        | 5.2.6   | The web framework     | ORM, migrations, auth, admin                                          |
| `djangorestframework`           | 3.16.1  | JSON API layer        | Serializers, viewsets, permissions                                    |
| `djangorestframework-simplejwt` | 5.5.1   | Token login           | Stateless auth; no server-side sessions                               |
| `django-cors-headers`           | 4.9.0   | Cross-origin rules    | The frontend is on a different domain; browsers block that by default |
| `django-environ`                | 0.12.0  | Reads `.env`          | Keeps passwords and keys out of the code                              |
| `psycopg[binary]`               | 3.2.10  | Postgres driver       | How Python talks to Postgres                                          |
| `dj-database-url`               | 3.0.1   | Parses `DATABASE_URL` | Hosts give one connection string; this splits it up                   |
| `django-filter`                 | 25.1    | Query-string filters  | `?slot=TOP&color=Blue` without hand-written code                      |
| `drf-spectacular`               | 0.28.0  | OpenAPI schema        | Auto-generates the live API documentation at `/api/docs/`             |
| `Pillow`                        | 12.3.0  | Image handling        | Reads, crops and resizes uploaded photos                              |
| `cloudinary`                    | 1.44.1  | Image hosting         | Stores photos off the server                                          |
| `requests`                      | 2.34.2  | HTTP client           | Calls OpenWeather and shop catalogues                                 |
| `whitenoise`                    | 6.11.0  | Static file serving   | Serves the admin's CSS without a separate web server                  |
| `gunicorn`                      | 23.0.0  | Production server     | `runserver` is for development only; gunicorn handles real traffic    |

Extra, used only where needed:

- `rembg[cpu]` 2.0.84 - removes the background from a garment photo. Only the
  web service installs it; the price job does not need it.
- `pytest`, `pytest-django`, `pytest-cov` - the test runner.
- `django-extensions` - handy development commands.

**Why pin exact versions?** `Django==5.2.6`, not `Django>=5.2`. A new release
could change behaviour and break the deployment silently. Pinning means the
server runs exactly what was tested.

---

## 6. The `config/` folder

| File            | Purpose                                                              |
| --------------- | -------------------------------------------------------------------- |
| `settings.py`   | Every setting: database, apps, security, auth, pagination            |
| `urls.py`       | The top-level URL map; sends `/api/wardrobe/...` to the wardrobe app |
| `pagination.py` | Page size rules for list endpoints                                   |
| `wsgi.py`       | The handle gunicorn grabs to run the app                             |
| `asgi.py`       | The async equivalent, unused for now                                 |

### Settings worth knowing

**Database** - PostgreSQL on Neon:

```
Engine : django.db.backends.postgresql
Name   : neondb
Host   : ep-spring-art-b3wz0995-pooler.c-4.ap-southeast-1.aws.neon.tech
```

Three settings exist because of how Neon behaves:

- `CONN_MAX_AGE = 120` with `CONN_HEALTH_CHECKS = True`. Neon suspends an idle
  database after 300 seconds. A connection held longer is dead on next use, so
  Django checks it is alive before reusing it.
- `DISABLE_SERVER_SIDE_CURSORS = True` when the host contains `-pooler`. That
  endpoint is PgBouncer in transaction mode, where server-side cursors do not
  survive between statements.
- `sslmode=require` - Neon refuses unencrypted connections.

**Timezone** is `Asia/Karachi`, with `USE_TZ = True`. Times are stored in UTC
and converted on the way out, which is the only way that stays correct across
daylight saving and travel.

**Pagination** is 24 per page. The wardrobe grid is 2, 3 or 4 columns depending
on screen width, and 24 divides evenly by all three, so the last row is never
ragged.

**Secret key guard**:

```python
SECRET_KEY = env("SECRET_KEY", default="insecure-development-key")
if not DEBUG and SECRET_KEY == "insecure-development-key":
    raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG is off.")
```

A fresh checkout runs without configuration, but a production deploy with a
known signing key refuses to start. That key signs the login tokens; if it
leaked, anybody could forge one.

---

## 7. The apps, one by one

Django splits a project into **apps** - self-contained folders, each owning one
area. Inside each you will find the same files:

| File             | Job                                                  |
| ---------------- | ---------------------------------------------------- |
| `models.py`      | The database tables, as Python classes               |
| `serializers.py` | Converts a model to JSON and validates incoming JSON |
| `views.py`       | Handles a request and returns a response             |
| `urls.py`        | Maps a URL to a view                                 |
| `filters.py`     | Defines the query-string filters                     |
| `admin.py`       | Registers models in the admin site                   |
| `migrations/`    | Versioned database change scripts                    |

### 7.1 `accounts`: who the user is

**Model: `User`** - replaces Django's built-in user so that **email is the
login**, not a username.

> This has to be done on day one. Django does not allow swapping the user model
> after the first migration has run.

Fields beyond the standard ones:

- `full_name`, `city`, `country_code` - city drives the weather lookup
- `shopping_for` - Women / Men / Kids / Everything; decides which tab a page opens on
- `phone` - never listed publicly; handed to exactly one person when a sale is agreed
- `body_photo_url` - for the Try-On feature (not finished)
- `friend_code` - the private 8-character code used to add friends
- `shares_closet` - off by default; gates every friend-facing read

**Endpoints**

| Method    | Path                  | Purpose                                |
| --------- | --------------------- | -------------------------------------- |
| POST      | `/api/auth/register/` | Create an account                      |
| POST      | `/api/auth/login/`    | Exchange email and password for tokens |
| POST      | `/api/auth/refresh/`  | Get a new access token                 |
| GET/PATCH | `/api/auth/me/`       | Read or update your own profile        |
| GET       | `/api/auth/waiting/`  | Counts for the notification badges     |

### 7.2 `wardrobe`: the core of the app

**Three models.**

**`StorageLocation`** - where things are kept, as a tree:

```
Bedroom (Room)
`-- Wardrobe
    `-- Top drawer (Drawer)
        `-- Left side (Shelf)
```

Nesting is capped at 4 levels (`MAX_DEPTH = 4`). Without a cap a user could
nest forever and every path lookup would get slower.

**`Category`** - the kind of garment (Shirt, Jeans, Kurta, Boots...). Each
belongs to a **slot**: `TOP`, `BOTTOM`, `FULL_BODY`, `OUTERWEAR`, `FOOTWEAR`,
`ACCESSORY`, `HEADWEAR`, `OTHER`. Built-in categories have `owner = NULL`, so
everybody shares them; a user can add their own.

**`GarmentItem`** - one piece of clothing. Fields include `name`, `brand`,
`size`, `material`, `pattern`, `primary_color_hex`, `warmth_level`,
`is_waterproof`, `storage_location`, two image URLs, and `status`.

**Status is the most important field.** It has six values:

| Status        | Meaning                   |
| ------------- | ------------------------- |
| `IN_WARDROBE` | Normal                    |
| `IN_LAUNDRY`  | In the wash               |
| `LENT_OUT`    | A friend has it           |
| `FOR_SALE`    | Listed on the marketplace |
| `SOLD`        | Gone to a buyer           |
| `ARCHIVED`    | Put away for the season   |

Three groups are defined on the model and used everywhere:

```python
WEARABLE_STATUSES = [IN_WARDROBE]
GONE_STATUSES     = [SOLD, ARCHIVED]           # no longer owned
AWAY_STATUSES     = [SOLD, ARCHIVED, LENT_OUT] # not in your hands
```

> **Why the difference?** A lent coat is still yours, so it counts in your
> totals - but you cannot wear it, wash it or sell it while a friend has it.
> A sold coat is not yours at all, so it leaves the totals entirely.

**`WearEvent`** - one row per item per day worn, with a database constraint
preventing two rows for the same item on the same day. A double tap on "I wore
this" is far more likely than a genuine second wearing, and each extra row
would quietly halve the cost-per-wear figure.

**Endpoints** (selection)

| Method   | Path                                       | Purpose                               |
| -------- | ------------------------------------------ | ------------------------------------- |
| GET/POST | `/api/wardrobe/items/`                     | List or create garments               |
| GET      | `/api/wardrobe/items/stats/`               | Dashboard counts                      |
| POST     | `/api/wardrobe/items/{id}/mark-worn/`      | Record a wearing                      |
| POST     | `/api/wardrobe/items/{id}/toggle-laundry/` | In or out of the wash                 |
| POST     | `/api/wardrobe/items/bulk-move/`           | Move many items to one place          |
| GET      | `/api/wardrobe/storage/tree/`              | The whole nested storage hierarchy    |
| POST     | `/api/wardrobe/upload/`                    | Upload a photo, remove its background |

### 7.3 `vision`: photographs

Three small modules, no models:

- `uploads.py` - what counts as an acceptable photo (type, size, dimensions).
  Every endpoint that takes an image validates here, so a file refused by one
  is refused by all with the same message.
- `background.py` - runs **rembg**, which cuts the garment out of its
  background with **U-2-Net**, a deep convolutional neural network trained for
  salient object detection. This is the one piece of genuine machine learning
  in the project.
- `storage.py` - the only module that talks to Cloudinary. One choke point
  means credentials and folder naming live in one file.

**Both the original and the cutout are kept.** If background removal gets it
wrong, the original is still there.

### 7.4 `intelligence`: colour naming

`colors.py` turns a hex colour into a human word ("Navy", "Blue", "Off-white").

A naive version compares RGB numbers. That does not match how eyes work: pure
red `#FF0000` and pure green `#00FF00` are the same RGB distance apart as two
blues a person could not tell apart.

So the code converts to **CIE L\*a\*b\***, a colour space designed so that
equal numeric distance means equal _visible_ difference. The conversion is
cached with `@lru_cache(maxsize=2048)` because the same few hundred colours
come back constantly.

### 7.5 `planner`: weather and outfit plans

**`weather.py`** calls **OpenWeather** twice - current conditions and the
forecast - and caches both together. The free plan allows 60 calls a minute,
and an uncached dashboard would spend one on every page load.

It turns raw numbers into advice: a headline, a sentence, which warmth levels
suit, the season, and whether to take an umbrella.

**`PlannedOutfit`** - clothes chosen for a future day, with `confirm_worn()`
writing them all into the wear log at once.

Two rules learned from real bugs:

- A plan cannot be confirmed before the day has happened.
- Anything sold or put away between making the plan and confirming it is
  **skipped**, so confirming never records somebody wearing a thing they no
  longer own.

### 7.6 `shopping`: real shop prices

Four models: `Shop`, `Deal`, `PriceChange`, `SyncRun`.

**How prices are collected.** Almost every clothing shop in this market runs on
**Shopify**, and a Shopify storefront publishes its own catalogue as JSON at
`/products.json`. It is the shop's own address, needs no key, and carries
`compare_at_price` - the price a thing was cut from, which is exactly what makes
something a sale.

Eight shops are read: **Outfitters, Limelight, Gul Ahmed, Bonanza Satrangi,
Beechtree, Generation, Junaid Jamshed, Almirah.** Each was checked by hand
first: the address answers, and the shop's own `robots.txt` allows it.
Beechtree asks for ten seconds between requests, which is honoured.

> **No scraping, no Selenium.** The app reads a public JSON file the shop
> publishes for this purpose. That is faster, more reliable, and does not break
> when a shop changes its page design.

**`classify.py`** translates shop wording into something the app understands.
Real `product_type` values coming back include `"BTK-EAST"`, `"Women Fabric"`,
`"Heartilicious"`, `"PRET"` and `"3 Piece"`. None can be shown as a filter, so
each product is read for three things: is it clothing at all, where on the body
is it worn, and what colour is it.

Matching uses **word boundaries**, not plain substring search. An early version
checked `if "fabric" in text`, which wrongly rejected real clothes whose tags
mentioned fabric. Accuracy went from **48.5% to 89.8%** after the fix.

**Nothing is fetched while a user waits.** A scheduled job writes these tables;
the API only reads them. A shop being down costs a stale timestamp, not a
broken page. If a refresh fails, the stored rows keep the timestamp of the last
_successful_ read, so the freshness shown on screen stays truthful.

### 7.7 `community`: Buy and Sell

Four models: `Listing`, `Enquiry`, `Block`, `Report`.

**No money passes through the app.** A buyer asks, a seller agrees, and they
settle it between themselves. That keeps card data out of the project entirely
and out of scope for PCI DSS.

**Two privacy decisions worth explaining.**

1. **A separate serializer for a garment.** The closet already has one, but it
   carries what the item cost, cost-per-wear, how often it was worn, and which
   drawer it lives in. None of that belongs in front of a stranger, so
   `GarmentForSaleSerializer` describes the garment again from scratch with only
   what a buyer needs. Subclassing would have inherited all four - and would
   re-inherit whatever is added next.

2. **Contact details are refused in free text.** A regular expression rejects
   phone numbers, emails and social handles in a listing note. Facebook
   Marketplace does the same thing. Numbers are exchanged automatically, and
   only once both sides agree.

### 7.8 `circle`: Borrow from Friends

Three models: `FriendRequest`, `Friend`, `Loan`.

**Friends are added by a private code, never by searching a name.**

> A name search cannot tell a real person from somebody copying their name -
> you get five rows all saying "Ali Khan" and no way to know which is your
> friend. Searching by email would tell anybody holding an address whether it
> is registered here. A code can only be used by somebody you handed it to, and
> it can be replaced if it leaks.

The code is 8 characters from an alphabet that excludes `O/0` and `I/1/L`,
because codes get read down a phone.

**Two friends with the same name.** `Friend` is one row per _direction_, so
each side keeps its own private label for the other. A database constraint
makes `(owner, nickname)` unique, so two friends cannot share one label. When
you accept a request the app asks what to call them, and refuses a name already
taken. If you do not type one, it falls back to their name, then their name
plus their city.

**Lending.** The garment row never changes owner - only its `status` moves to
`LENT_OUT`. That keeps it inside the lender's totals while blocking wear,
laundry, planning and sale until it comes back. A partial unique constraint
allows only one open loan per item, so two friends cannot both be promised the
same jacket.

### 7.9 `tryon`: Virtual Try-On

Draws a garment onto a photograph of the person wearing it.

**The model is not run here.** It runs on the supplier's hardware, and this
project sends two URLs and receives one back. That is why Try-On works on the
free Render plan while background removal does not: `rembg` loads 176 MB into
this server's own memory, and a try-on request costs almost none.

**Two things had to be settled before anything else.**

A photograph of somebody's body leaves the project to be processed, so
`User.body_photo_consent_at` records that they were told and agreed. Clearing
it withdraws the permission. Deleting the photo deletes every picture made
from it, in one transaction, and that is said on screen before the second
press confirms it.

**Generation takes two to four minutes**, far longer than a request can be
held open. So `providers.py` exposes `submit` and `check` rather than one
blocking call:

```
POST /api/try-on/        queues the work, answers at once with "working on it"
GET  /api/try-on/{id}/   asks the supplier only while the row is still waiting
```

The page re-reads every six seconds while anything is pending, and stops once
nothing is. No Celery, no worker process, no second server.

**Where the garment comes from decides what gets asked.**

| Source            | Who picks the body part                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| The closet        | The app. `TOP`/`OUTERWEAR` to `upper_input`, `BOTTOM` to `lower_input`, `FULL_BODY` to `dress_input` |
| An uploaded photo | The person, and it is required                                                                   |

A bare photograph says nothing about itself. Sent as the wrong one, a kurta is
drawn onto the legs. A closet garment already carries a category, so asking
would be a question the app can answer itself.

Slots with no equivalent on the supplier's side are refused before anything is
spent, and the closet grid hides them, so a watch cannot be sent off to be
drawn onto a torso.

**Every picture keeps a snapshot** of the garment name, image and slot, and the
link to the closet item is optional. A picture is of a person, so it survives
the garment being renamed, re-photographed, deleted, or never saved at all.

**Cost is bounded twice.** `TRYON_DAILY_LIMIT` is counted in the database,
because a cache-based throttle resets; the throttle on top of it only slows a
burst down.

**Endpoints**

| Method          | Path                      | Purpose                                              |
| --------------- | ------------------------- | ---------------------------------------------------- |
| GET/POST/DELETE | `/api/try-on/body-photo/` | Save, check or delete the body photo                 |
| GET/POST        | `/api/try-on/`            | List pictures, or ask for a new one                  |
| GET/DELETE      | `/api/try-on/{id}/`       | Open one, or delete it                               |
| GET             | `/api/try-on/status/`     | Whether it is switched on, and how many are left today |

**One trap recorded in the code.** The supplier documents `batch_size` as
optional with a default of 1. It is required. Omitting it is rejected with a
bare "Invalid input" that names no field.

---

## 8. How a request actually flows

Pressing **"I wore this"** on a blue shirt:

```
1. Browser  POST /api/wardrobe/items/42/mark-worn/
            Authorization: Bearer eyJhbGci...

2. Django   urls.py          -> wardrobe app -> GarmentItemViewSet.mark_worn
3. DRF      authentication   -> decodes the token, finds user 7
4. DRF      permission       -> IsAuthenticated: pass
5. DRF      throttle         -> under the rate limit: pass
6. View     get_object()     -> GarmentItem.objects.filter(owner=user 7)
                                item 42 is not user 7's -> 404
                                it is -> continue
7. View     status check     -> sold / archived / lent out -> 400 with a reason
8. Model    mark_worn()      -> writes a WearEvent, recalculates totals
9. Response 200 with the updated item as JSON
10. Browser TanStack Query refreshes the closet and the dashboard counts
```

**Step 6 is the security.** The queryset is filtered by owner _before_ the id
is looked up, so asking for somebody else's item returns "not found" rather
than "forbidden" - which also avoids confirming that the id exists.

---

## 9. Authentication explained

**JWT - JSON Web Token.** On login the server returns two tokens:

| Token   | Lifetime   | Used for                   |
| ------- | ---------- | -------------------------- |
| Access  | 60 minutes | Sent with every request    |
| Refresh | 7 days     | Getting a new access token |

A token is three parts: a header, the data (`user_id`), and a **signature**
made with the server's `SECRET_KEY`. Change one character of the data and the
signature no longer matches, so the server rejects it. The server stores
nothing - it just verifies the signature. That is what "stateless" means.

**Rotation with blacklisting.** Each refresh issues a new refresh token and
**blacklists the old one**. Without blacklisting, a stolen refresh token would
stay valid for its full seven days even after the real user had rotated it.

**Why not cookies and sessions?** Sessions need server-side storage and make
cross-domain requests harder, and the frontend is on a different domain to the
API. Tokens suit a separated frontend and a future phone app.

---

## 10. Security

Django's own `manage.py check --deploy` reports **zero warnings**. What is in
place:

| Area          | Measure                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| Transport     | HTTPS redirect, HSTS for one year, proxy header for Render                |
| Cookies       | Secure, HttpOnly, SameSite                                                |
| Headers       | `X-Frame-Options: DENY`, nosniff, referrer policy                         |
| Passwords     | PBKDF2 hashing, minimum 8 characters, four validators                     |
| Authorisation | Every queryset filtered by owner; default permission is `IsAuthenticated` |
| Brute force   | Login 10/min, sign-up 10/hour, friend codes 20/hour                       |
| Tokens        | Short-lived access, rotation with blacklisting                            |
| Uploads       | 20 MB cap, type and dimension checks                                      |
| Injection     | The ORM parameterises every query                                         |
| Enumeration   | A wrong password and an unknown email give the identical answer           |
| Body photos   | Consent recorded with a timestamp; deleting one removes every picture made from it |
| Supplier keys | Held in `.env` and the host's secret store, never in the repository or the browser |

**One subtlety worth mentioning in a viva.** `NUM_PROXIES = 1` is set because
DRF otherwise builds the rate-limit key from the whole `X-Forwarded-For`
header - which the caller controls, and could rotate to sidestep the limit.

---

## 11. Tests

`backend/tests/`, run with **pytest**. Each run builds a **throwaway database**,
so tests never touch development or production data.

```bash
cd backend
pytest
```

| File               | Tests | Covers                                                                                                         |
| ------------------ | ----- | -------------------------------------------------------------------------------------------------------------- |
| `test_tryon.py`    | 62    | Consent, uploads, body-part choice, submit and poll, cost limits, privacy                                       |
| `test_contract.py` | 54    | The TypeScript the browser trusts matches the schema the API publishes, field by field                         |
| `test_security.py` | 49    | Attacks: forged tokens, reading another user's data, privilege escalation, injection, enumeration, brute force |
| `test_wardrobe.py` | 27    | Counts, statuses, bringing things back                                                                         |
| `test_circle.py`   | 45    | Friend codes, same-name handling, sharing, lending                                                             |

**237 backend tests, all passing.** Plus **360 frontend tests**.

Nothing in the suite reaches the internet. The supplier and the image host
are both replaced in the test, so a run costs nothing and cannot be broken
by somebody else's outage.

**The contract test is the one that guards the seam.** TypeScript checks the
frontend against itself, and Django checks the backend against itself, but
nothing checks one against the other. A field the frontend declares that the
API no longer sends compiles cleanly and is `undefined` in the browser.
`test_contract.py` reads the TypeScript interfaces and compares them against
the schema the API publishes, in both directions, so that mismatch fails in
the test run instead of in a judge's browser.

---

# PART TWO: THE FRONTEND

---

## 12. Why Next.js

**React** builds interfaces from components. **Next.js** is the framework
around React that adds routing, server rendering, image optimisation and a
build system.

| Feature            | Benefit here                                                  |
| ------------------ | ------------------------------------------------------------- |
| File-based routing | A folder is a URL. `src/app/closet/page.tsx` serves `/closet` |
| Server components  | Pages that need no interactivity ship no JavaScript           |
| Image optimisation | `next/image` resizes and lazy-loads automatically             |
| One-command deploy | Vercel (who make Next.js) builds straight from GitHub         |

Version **16.3.4**, with **React 19** and **TypeScript**.

**Why TypeScript?** It catches mistakes before the code runs. If the API sends
`wear_count` as a number and the code treats it as text, the build fails rather
than the page breaking in front of a judge.

---

## 13. Every frontend package, and why

| Package                             | What it does          | Why                                                                      |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| `next` 16.3.4                       | Framework             | Routing, building, image handling                                        |
| `react` / `react-dom` 19.2.8        | UI library            | Component model                                                          |
| `typescript` 5                      | Typed JavaScript      | Catches errors at build time                                             |
| `@tanstack/react-query` 5           | Server state          | Caching, refetching, loading and error states                            |
| `axios` 1.20                        | HTTP client           | Interceptors attach the token and refresh it automatically               |
| `@base-ui/react` 1.8                | Accessible primitives | Dialogs, tabs and menus with keyboard and screen-reader support built in |
| `shadcn`                            | Component generator   | Copies components into the project so they can be edited                 |
| `tailwindcss` 4                     | Styling               | Utility classes; no separate CSS files to drift                          |
| `react-hook-form` 7                 | Forms                 | Few re-renders, clean validation                                         |
| `zod` 4                             | Validation            | Describes a form's shape once and checks against it                      |
| `lucide-react`                      | Icons                 | Consistent, tree-shaken icon set                                         |
| `sonner`                            | Toasts                | The small "Saved." messages                                              |
| `date-fns` 4                        | Dates                 | Formatting and arithmetic                                                |
| `next-themes`                       | Dark mode             | Remembers the choice, no flash on load                                   |
| `vitest` + `@testing-library/react` | Tests                 | Fast, and tests what a user sees rather than internals                   |

---

## 14. Frontend structure

```
src/
|-- app/
|   |-- (auth)/              login and register, with their own layout
|   |   |-- login/
|   |   `-- register/
|   |-- (app)/               every page behind a login
|   |   |-- dashboard/
|   |   |-- closet/          list, add, and one item
|   |   |-- storage/         where things are kept
|   |   |-- plan/            the day planner
|   |   |-- shop/            Sales
|   |   |-- marketplace/     Buy and Sell
|   |   |-- friends/         Borrow from Friends
|   |-- try-on/          Virtual Try-On
|   |   `-- profile/
|   `-- page.tsx             the public landing page
|
|-- components/
|   |-- ui/                  generated building blocks (button, dialog, input)
|   |-- form/                field wrappers used across forms
|   |-- layout/              sidebar, mobile bar, top bar
|   |-- wardrobe/            item cards, photo guide, wear history
|   |-- planner/             weather card, day plan, month grid
|   |-- shop/                deal cards, filters, price history
|   |-- market/              listings, sell dialog, enquiries
|   |-- friends/             friend list, borrow dialog, loan cards
|   `-- tryon/               body photo, upload dialog, result cards
|
|-- hooks/                   one file per API area
|-- lib/                     helpers with no React: api, dates, money, images
|-- types/                   TypeScript shapes mirroring the API
`-- providers/               React Query and theme setup
```

> **What do the brackets mean?** `(auth)` and `(app)` are _route groups_. They
> let two sets of pages have different layouts without appearing in the URL.
> `/login` stays `/login`, not `/auth/login`.

---

## 15. How the frontend talks to the backend

**`lib/api.ts`** is an axios instance that:

- points at `NEXT_PUBLIC_API_URL`
- attaches the access token to every request
- catches a `401`, silently fetches a new token with the refresh token, and
  retries the original request
- sends the user to the login page if that also fails

> **One real bug worth knowing.** A default `Content-Type` must never be set on
> the axios instance. Axios serialises `FormData` to JSON when one is present,
> and photo uploads arrive empty with no error.

**`hooks/use-*.ts`** wrap TanStack Query. Instead of each page managing
loading flags and errors by hand:

```ts
const { data, isPending, isError } = useGarments({ slot: 'TOP' });
```

TanStack Query handles caching, deduplication and refetching. Query keys are
hierarchical, so after marking something sold, invalidating `["wardrobe"]`
refreshes the closet grid, the dashboard counts and the storage page in one go.

**The one polling query.** `useWaiting()` calls `/api/auth/waiting/` every
minute and on window focus. It is counts only - no names - because it runs for
every signed-in session and almost always answers zero. It drives the red
badges in the menu.

---

## 16. Interface rules followed throughout

These came from accessibility guidance and are worth naming in a viva:

- **Every icon has a visible text label.** Hover-only labels do not exist on a touchscreen.
- **Minimum tap target 44x44 pixels** - the WCAG recommendation.
- **Meaning never depends on colour alone.** A red badge always carries text too, for colour-blind users.
- **Empty states say what to do next** and link to it.
- **Reduced motion is respected.** Animations switch off for anyone whose system asks for less motion.

---

# PART THREE: INFRASTRUCTURE

---

## 17. The database

**PostgreSQL**, hosted on **Neon** (serverless Postgres). Database name `neondb`, region `ap-southeast-1` (Singapore), reached through
Neon's pooled endpoint `ep-spring-art-b3wz0995-pooler`.

**Why Postgres over MySQL or SQLite?**

- SQLite is a single file with no real concurrency - fine for development, not for a deployed app.
- Postgres supports **partial unique constraints**, used in three places here:

```python
UniqueConstraint(fields=["item"],
                 condition=Q(status__in=["ASKED", "AGREED"]),
                 name="one_open_loan_per_item")
```

That says: an item may appear in many loan rows, but only **one open** loan at
a time. The database enforces it, so even two simultaneous requests cannot both
succeed. MySQL cannot express this.

- `ArrayField` for seasons and occasions, and full-text search helpers.

**Why Neon?** A free tier, it suspends when idle so it costs nothing while
unused, and it gives a plain connection string.

**The tables** (30 in total, including Django's own and the token blacklist):

| App       | Tables                                                                   |
| --------- | ------------------------------------------------------------------------ |
| accounts  | `users`                                                                  |
| wardrobe  | `storage_locations`, `categories`, `garment_items`, `wear_events`        |
| planner   | `planned_outfits`, `planned_outfits_items`                               |
| shopping  | `shops`, `deals`, `deal_price_changes`, `deal_sync_runs`                 |
| community | `listings`, `listing_enquiries`, `marketplace_blocks`, `listing_reports` |
| circle    | `friend_requests`, `friends`, `loans`                                    |
| tryon    | `try_ons`                                  |

---

## 18. Outside services

| Service                 | Used for                     | Why                                                                          | Cost                  |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------------- | --------------------- |
| **Neon**                | Postgres database            | Free tier, suspends when idle                                                | Free                  |
| **Cloudinary**          | Photo storage and delivery   | Serves resized images from a CDN; a server disk would lose files on redeploy | Free tier             |
| **OpenWeather**         | Current weather and forecast | Free plan, 60 calls/minute, covers Pakistani cities                          | Free                  |
| **Shopify storefronts** | Shop prices                  | Each shop publishes `/products.json` itself                                  | Free                  |
| **PiAPI (Kling)** | Virtual try-on | Runs the model on their hardware, so this server needs no GPU | $0.07 per picture |
| **Render**              | Backend hosting              | Free tier, deploys from GitHub                                               | Free web, ~$1/mo cron |
| **Vercel**              | Frontend hosting             | Made by the Next.js team                                                     | Free                  |

**Why Cloudinary and not the server's disk?** Render's filesystem is wiped on
every deploy. Photos stored there would vanish. Cloudinary also resizes on the
fly, so a phone gets a small image and a laptop a large one from one upload.

---

## 19. Hosting and deployment

### Backend: Render

Described in `render.yaml`, so the setup is in version control rather than
clicked into a dashboard.

**Two services:**

1. **`closette-api`** - the web service. Free plan. Built with
   `pip install -r requirements/base.txt`, started with
   `gunicorn config.wsgi:application`. Health check at `/api/health/`.

2. **`closette-prices`** - a cron job. Runs `python manage.py sync_deals` at
   **01:00 and 13:00 UTC** (06:00 and 18:00 Pakistan time). It installs
   `core.txt`, not `base.txt`, because it never touches an image and does not
   need the 176 MB background-removal model.

> **Free tier limitation, stated honestly.** A free Render service sleeps after
> 15 minutes idle and takes about 50 seconds to wake. The frontend handles this:
> it pings the API on load and shows "Waking the server up..." rather than
> looking broken.

### Frontend: Vercel

Connected to GitHub. Every push to `master` builds and deploys automatically.
Live at **`fyp-bice-three.vercel.app`**.

Two settings had to be set by hand because the Next.js app is in a
subdirectory: **Root Directory = `frontend`** and **Framework Preset = Next.js**.

`NEXT_PUBLIC_API_URL` points at the Render backend. The `NEXT_PUBLIC_` prefix
means it is baked into the JavaScript at build time - so it must never hold a
secret.

### Environment variables

Nothing secret is in the repository. `backend/.env` is gitignored; only
`.env.example` is committed, listing the names without the values.

| Variable               | Holds                           |
| ---------------------- | ------------------------------- |
| `SECRET_KEY`           | Signs the login tokens          |
| `DATABASE_URL`         | The Neon connection string      |
| `CLOUDINARY_URL`       | Image hosting credentials       |
| `OPENWEATHER_API_KEY`  | Weather access                  |
| `ALLOWED_HOSTS`        | Which domains may serve the API |
| `CORS_ALLOWED_ORIGINS` | Which websites may call it      |

---

## 20. What is finished

| Feature                                                                       | State |
| ----------------------------------------------------------------------------- | ----- |
| Sign up, sign in, profile                                                     | Done  |
| My Clothes - add, photo, colour, search, filter, favourite, laundry, wear log | Done  |
| Sold and put away                                                             | Done  |
| Where Things Are - storage tree, bulk move                                    | Done  |
| My Plans - plan a day, calendar, confirm worn                                 | Done  |
| Weather - temperature, rain, wind, advice                                     | Done  |
| Sales - 8 shops, live prices, filters, price history                          | Done  |
| Buy and Sell - list, browse, ask, accept, block, report                       | Done  |
| Borrow from Friends - codes, sharing, lending, returns                        | Done  |
| Notification badges                                                           | Done  |
| **Try It On** - body photo, consent, closet or uploaded garment, waiting state | Done |

**A finding worth keeping in the report.** Published work shows virtual try-on
models are trained on Western datasets, and that one of them alters a shalwar
kameez into a Western-style garment when used without retraining. Several
candidates were tested against a real kurta before one was chosen; the model in
use handled a mandarin collar, button placket and long sleeves correctly. The
alternatives were rejected on evidence, not on convenience.

**Not finished, and why:**

- **Background removal in production** - measured at **1006 MB** of memory with
  the model loaded. Render's free and Starter plans both give 512 MB, so it
  cannot run there. It works locally. Options: move it into the browser, or pay
  for a larger server.

---

## 21. Common questions, answered

**Why Django and not Node.js or Laravel?**
Python is strong for the image and colour work, and Django's ORM, migrations,
admin and auth remove months of groundwork. DRF makes the API layer standard
rather than hand-rolled.

**Why separate the frontend and backend?**
The same API can serve a phone app later; each side deploys independently; and
it matches how the industry builds products.

**How do you stop one user seeing another's clothes?**
Every database query is filtered by the signed-in user _before_ an id is looked
up. Asking for somebody else's item returns 404, not 403, so it does not even
confirm the id exists. There are 49 automated tests that try to break this.

**How are passwords stored?**
Never in plain text. Django hashes them with PBKDF2 and a random salt. Hashing
is one-way; even with database access the passwords cannot be read back.

**How do you get shop prices? Is it scraping?**
No scraping. Shopify shops publish their own catalogue as JSON at
`/products.json`. The app reads that public file twice a day, honouring each
shop's `robots.txt` and crawl delay.

**What happens if a shop is down?**
Nothing breaks. Stored prices stay as they were, still stamped with the last
successful check, and the screen shows how old the data is.

**What is the hardest problem you solved?**
Two friends with the same name. The app never confuses them internally because
each is a different account, but a user would. The answer was three layers: a
private label chosen when you accept, a database constraint making labels
unique per account, and a colour derived from the account id so two "Ali Khan"
rows never look alike.

**How do you know it works?**
237 backend tests and 360 frontend tests, all automated and committed. The
backend tests include a suite that actively attacks the app, and one that
checks the frontend's types against the API's published schema.

**Does Try-On run on your server?**
No. The model runs on the supplier's hardware. This server sends two image
URLs and receives one back, which is why it works on a free plan while
background removal does not: `rembg` needs about 1006 MB of local memory and a
try-on request needs almost none.

**Why does it ask where an uploaded garment is worn, but not a closet one?**
A closet garment carries a category, and the category carries a slot, so the
app already knows. A bare photograph says nothing about itself, and sending a
kurta as the lower-body input draws it onto the legs.

**What stops somebody running up a bill?**
A per-account daily limit counted in the database, plus a rate limit on top.
Garments the supplier cannot draw are refused before any request is sent.

**What happens to the photo of the person?**
It is kept on the project's image host, sent to the supplier to be drawn on,
and shown to nobody else. Agreement is recorded with a timestamp, and deleting
the photo deletes every picture made from it in the same transaction.

**What would you do next?**
Move background removal into the browser so photos work on the free tier;
finish Try-On; add email or push notifications, since the badge only updates
while the app is open.

---

## 22. Running it locally

```bash
# Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements/dev.txt
copy .env.example .env          # then fill in the values
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev                     # http://localhost:3000
```

Checks before committing:

```bash
cd backend  && pytest && python manage.py check --deploy
cd frontend && npm run lint && npx tsc --noEmit && npm test && npm run build
```
