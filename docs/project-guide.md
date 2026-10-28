# My Closette: An AI-Assisted Smart Wardrobe Management System

Everything this project is made of, why each piece was chosen, and how the
parts fit together. Part Four, at the end, explains every backend word used
here in plain language: what it is, why it is used, and where it is in the
code.

---

## 1. What My Closette is

A smart wardrobe web app. A person photographs the clothes they own, and the
app then answers questions a wardrobe cannot answer by itself:

- **Where is my blue shirt?** It remembers the room, the cupboard and the shelf.
- **What have I not worn for months?** It keeps a wear log.
- **Is this on sale anywhere?** It reads real shop catalogues twice a day.
- **Can I sell this?** A marketplace between users of the app.
- **Can I borrow one for Saturday?** Lending between friends.
- **How would this look on me?** Virtual try-on draws a garment onto a photo of the person.

It runs in a browser on a phone or a laptop.

### Where the name comes from

**My Closette** is **my** plus **closet** plus **-ette**, the ending that
means small or portable, as in kitchenette. It reads as "my little closet": a
person's own wardrobe, small enough to carry.

*Closet* is American English for what British English calls a *wardrobe* and
Urdu calls an *almari*, so the name and the subtitle say the same thing twice,
once memorably and once plainly.

"Wardrobe" itself carries two meanings, and the app uses both: the clothes a
person owns, and the furniture those clothes live in. `GarmentItem` is the
first, `StorageLocation` is the second.

### Where the AI is

Two trained models do real work here. Background removal runs **U-2-Net**, a
deep convolutional network for salient object detection, with roughly 176 MB of
learned weights. A photograph taken against any background comes back as a
clean cutout. Virtual try-on uses **Kling**, run on a supplier's hardware
(section 7.9): two pictures go out, one comes back.

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
    +-------+--------+-----------------+----------------+--------------+
    |                |                 |                |              |
 Postgres        Cloudinary       OpenWeather     Shopify shops      PiAPI
  (Neon)          (photos)         (weather)       (prices)         (try-on)
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

**Pagination** is 24 per page. The wardrobe grid is 2, 3 or 4 columns on a
phone, a tablet and a laptop, and 24 divides evenly by all three, so the last
row is rarely ragged. (A very wide screen adds a fifth column, where the last
row can be short.) The Sales and Buy and Sell grids fetch the next page on a
"Show more" button.

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
- `body_photo_url`, `body_photo_consent_at` - for Try It On
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
| Uploads       | 12 MB per photo, 20 MB per request, type checks                           |
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

**237 backend tests, all passing.** Plus **433 frontend tests** in 48 files.

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
| `lucide-react`                      | Icons                 | Consistent, tree-shaken icon set                                         |
| `sonner`                            | Toasts                | The small "Saved." messages                                              |
| `tw-animate-css`                    | Animation classes     | The short easing-in of sections, and the shimmer on a waiting try-on     |
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
|   |   |-- try-on/          Virtual Try-On
|   |   `-- profile/         My details
|   `-- page.tsx             the public landing page
|
|-- components/
|   |-- ui/                  generated building blocks (button, dialog, input)
|   |-- form/                field wrappers used across forms
|   |-- layout/              sidebar, mobile bar, top bar
|   |-- wardrobe/            item cards, slot picker, photo field, wear history, week strip
|   |-- planner/             weather card, month grid, day plan, item picker
|   |-- shop/                deal cards, tabs, freshness bar, filters, price history
|   |-- market/              listing cards, sell dialog, ask dialog, request cards
|   |-- friends/             add-friend dialog, request cards, borrow dialog, loan cards
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

- **Icons never stand alone.** Each sits next to a text label or carries a hidden one for screen readers. Nothing relies on hover, which does not exist on a touchscreen.
- **Tap targets are made for thumbs.** Main buttons are 44 pixels tall; the smallest round icon buttons are 36, above the 24-pixel minimum WCAG 2.2 asks for.
- **Meaning never depends on colour alone.** A red badge always carries text too, for colour-blind users.
- **Empty states say what to do next** and link to it.
- **Reduced motion is respected.** Animations switch off for anyone whose system asks for less motion.

### The look

One design runs through every page, and it lives in two files.
`src/app/globals.css` holds the colour tokens. The theme is called "Linen and
plum": a warm off-white ground instead of pure white, ink that leans warm
rather than blue-black, a deep plum for anything that can be pressed, and
teal, olive, amber and terracotta for the small charts. `src/app/layout.tsx`
loads three typefaces through `next/font`: Outfit for text, Fraunces for
headings (the `font-display` class), and JetBrains Mono for small labels such
as "Step 1".

Every page follows the same pattern: a short line in plum above the heading
that says where you are, a large heading, rounded cards (`rounded-2xl`),
pill-shaped choice buttons that fill in plum when chosen, counts in small
rounded chips, and a soft lift with a plum shadow when a card is hovered.
Sections ease in as a page loads (`animate-in` from `tw-animate-css`, with
small delays so they arrive one after another; `fill-mode-both` stops a
delayed section from showing before its turn). Side panels that belong with
a long page, such as the add-item preview, the Try It On body photo and the
Sales filters, stay in view while the rest scrolls (`lg:sticky`). The
reduced-motion rule at the bottom of `globals.css` turns every animation and
transition off for anybody whose system asks for less motion.

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
| `CLOUDINARY_*`         | Image hosting credentials (three values) |
| `TRYON_API_KEY`        | Virtual try-on supplier key     |
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
| Sales - 8 shops, prices refreshed twice a day, tabs, filters, price changes recorded | Done  |
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
237 backend tests and 433 frontend tests, all automated and committed. The
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
build the outfit suggester that warmth_level was added for; add email or push
notifications, since the badge only updates while the app is open.

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

---

# PART FOUR: BACKEND WORDS, EXPLAINED

---

## 23. How to use this part

This part is for somebody who is learning backend development and has to
defend this project. Every backend word that appears in the code or in the
earlier parts of this guide is explained here in the same way:

- **What** it is, in plain words.
- **Why** this project uses it.
- **Where** it is in My Closette, with the file name.
- **Example**, usually a few real lines from the code.

Read it in order the first time. The sections build on each other: how the
web works, then Django, then the database, then Django REST Framework, then
login, security, hosting, Python itself, and testing. Section 33 at the end
is a self-test.

A good way to learn: open the file named under "Where" and find the example
lines in it. Seeing the word in its real place is what makes it stick.

---

## 24. How the web works

### Client and server

**What.** The *client* is the program asking for something, here the
person's browser running our Next.js site. The *server* is the program
answering, here Django running on Render. The server is often just called
"the backend".

**Why.** The data has to live in one place that every phone and laptop can
reach. That place is the server.

**Where.** The client is everything under `frontend/`. The server is
everything under `backend/`.

### Request and response

**What.** A *request* is one message from the client to the server: "give
me my clothes", "mark item 42 worn". A *response* is the server's one
answer. Every action in the app is one or more request-response pairs.

**Why.** It is the only way the two programs can talk. The server never
contacts the browser on its own; it only answers.

**Example.** Request: `GET /api/wardrobe/items/42/`. Response: the garment
as JSON, with status 200.

### HTTP and HTTPS

**What.** *HTTP* is the set of rules for how requests and responses are
written. *HTTPS* is HTTP with encryption, so nobody between the browser and
the server can read or change the messages.

**Why.** Tokens and personal data travel in every request. Without
encryption, anybody on the same wifi could read them.

**Where.** `config/settings.py`: `SECURE_SSL_REDIRECT = True` sends every
plain HTTP request to HTTPS when `DEBUG` is off.

### URL, path, endpoint, route

**What.** A *URL* is a full web address:
`https://closette-api.onrender.com/api/wardrobe/items/42/`. The *path* is
the part after the domain: `/api/wardrobe/items/42/`. An *endpoint* is one
path the server answers, and a *route* is the rule that connects a path to
the code that handles it. People use these three words loosely.

**Why.** Every feature needs an address the client can ask.

**Where.** `config/urls.py` holds the top-level routes; each app's `urls.py`
holds its own.

**Example.** From `config/urls.py`:

```python
path("api/wardrobe/", include("apps.wardrobe.urls")),
```

"Anything starting with `api/wardrobe/` is handled by the wardrobe app's
address book."

### Methods: GET, POST, PATCH, PUT, DELETE

**What.** Every request has a *method*, a verb saying what kind of action
it is:

| Method | Meaning                     | My Closette example                                 |
| ------ | --------------------------- | ------------------------------------------------ |
| GET    | Read. Changes nothing.      | `GET /api/wardrobe/items/` lists the closet      |
| POST   | Create, or do an action.    | `POST /api/wardrobe/items/` adds a garment; `POST .../42/mark-worn/` records a wearing |
| PATCH  | Change some fields.         | `PATCH /api/wardrobe/items/42/` with `{"status": "ARCHIVED"}` |
| PUT    | Replace every field.        | Allowed, but the frontend always uses PATCH      |
| DELETE | Remove.                     | `DELETE /api/wardrobe/items/42/`                 |

**Why.** The same path can mean different things with different methods,
and the rules are shared by every web program in the world.

**Where.** DRF decides the method automatically: a `ModelViewSet` answers
GET for list and retrieve, POST for create, PATCH for partial_update, DELETE
for destroy. In `apps/community/views.py`, `MyListingViewSet` limits itself:

```python
http_method_names = ["get", "post", "patch", "delete", "head", "options"]
```

so a PUT is refused there.

### Headers

**What.** Small labelled facts attached to a request or response, outside
the main content. The one that matters most here is `Authorization`, which
carries the login token.

**Example.** Every signed-in request from the frontend carries:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Where.** Added in `frontend/src/lib/api.ts`, read by DRF's
`JWTAuthentication` on the server.

### Body and JSON

**What.** The *body* is the main content of a request or response. *JSON*
(JavaScript Object Notation) is the text format it is written in: names and
values in curly brackets, lists in square brackets.

```json
{ "name": "Blue Kurta", "wear_count": 3, "seasons": ["SUMMER"] }
```

**Why.** Both JavaScript (the browser) and Python (the server) can read and
write JSON easily, and a person can read it too.

**Where.** DRF turns Python data into JSON on the way out and JSON into
Python on the way in. The serializer (section 27) does the translating.

### multipart/form-data

**What.** A second way of sending a request body, used when a file is
inside it. JSON cannot carry a photo; multipart can.

**Where.** `apps/wardrobe/views.py`, `GarmentImageUploadView`:

```python
parser_classes = [MultiPartParser, FormParser]
```

"This view expects a form with a file in it, not JSON."

### Status codes

**What.** Every response starts with a three-digit number saying how it
went. The ones My Closette uses:

| Code | Name                  | When My Closette sends it                                                   |
| ---- | --------------------- | ------------------------------------------------------------------------ |
| 200  | OK                    | A successful read or change                                              |
| 201  | Created               | Something new was made: an item, a listing, a friend request             |
| 204  | No Content            | Deleted, nothing to send back                                            |
| 400  | Bad Request           | The data was wrong or a rule refused it: "That day has not happened yet." |
| 401  | Unauthorized          | No token, or an expired or forged one. Means "not signed in."            |
| 403  | Forbidden             | Signed in but not allowed. My Closette almost never sends this; see 404    |
| 404  | Not Found             | No such thing *for this person*. Another person's item answers 404, not 403, so the id is not even confirmed to exist |
| 429  | Too Many Requests     | The rate limit was hit: too many login tries                             |
| 500  | Server Error          | A bug. The tests exist so this never happens in front of a judge         |
| 503  | Service Unavailable   | An outside service could not be reached, such as the try-on supplier     |

**Where.** Views choose them through DRF's `status` module:

```python
return Response(TryOnSerializer(attempt).data, status=status.HTTP_201_CREATED)
```

### API

**What.** *Application Programming Interface*: a server built to be used by
programs, not by people. It answers with data (JSON), not with web pages.
Our backend is an API.

**Why.** One API can serve a website today and a phone app tomorrow.

**Where.** Everything under `/api/`. The live, clickable list of every
endpoint is at `/api/docs/`.

### Stateless

**What.** The server keeps no memory of who is "currently signed in". Every
request proves who it is from by itself, with its token.

**Why.** Any server can answer any request, nothing has to be shared
between servers, and the server can restart without signing anybody out.

**Where.** This is what tokens give us; see section 28.

---

## 25. Django words

### Framework

**What.** A large set of ready-made parts for building a server, with a
fixed way of arranging a project. Django is the framework; our code fills
in the parts that are specific to clothes.

**Why.** Accounts, passwords, the admin site, database migrations and
protection against common attacks come ready. Building them by hand would
take months and would be less safe.

### Project and app

**What.** A Django *project* is the whole server: one settings file, one
top-level address book. An *app* is one folder inside it that owns one area
of the product. A project has many apps.

**Where.** The project is `backend/config/`. The apps are the folders under
`backend/apps/`: accounts, wardrobe, vision, intelligence, planner,
shopping, community, circle, tryon.

**Example.** The list of apps that are switched on, in `config/settings.py`:

```python
LOCAL_APPS = [
    "apps.accounts",
    "apps.wardrobe",
    ...
    "apps.tryon",
]
```

An app not in this list does not exist as far as Django is concerned.

### settings.py

**What.** The one file that holds every setting: which database, which
apps, security rules, token lifetimes, page size, rate limits, where the
secret keys come from.

**Why.** One place to look. Nothing is scattered.

**Where.** `backend/config/settings.py`.

**Example.** Reading a secret from the environment rather than writing it
in the file:

```python
TRYON_API_KEY = env("TRYON_API_KEY", default="")
```

### urls.py, path(), include(), router

**What.** `urls.py` is an address book. `path()` connects one address to
one view. `include()` hands a whole prefix to another `urls.py`. A *router*
writes the standard addresses for a viewset automatically (list, detail,
and every action).

**Where.** `config/urls.py` and every `apps/*/urls.py`.

**Example.** From `apps/wardrobe/urls.py`:

```python
router = DefaultRouter()
router.register("items", GarmentItemViewSet, basename="item")

urlpatterns = [
    path("upload/", GarmentImageUploadView.as_view(), name="upload"),
    path("", include(router.urls)),
]
```

The one `register` line creates `/items/`, `/items/42/`, `/items/stats/`,
`/items/42/mark-worn/` and the rest.

### View

**What.** The function or class that handles one kind of request: checks
who is asking and whether they may, does the work, builds the response.

**Why.** It is where the rules of the app live.

**Where.** Every `apps/*/views.py`.

### APIView, ViewSet, ModelViewSet, mixins

**What.** Four shapes a view can take.

- `APIView`: the simplest. One class, with a method per HTTP method
  (`get`, `post`, `delete`). Used when there is no table behind it.
- `ViewSet`: a class that groups list, retrieve, create, update and destroy
  for one table.
- `ModelViewSet`: a ViewSet with all five already written. Our closet,
  storage, categories and plans use it.
- `mixins`: the five pieces separately, so a view can pick only some.
  `ReadOnlyModelViewSet` is list and retrieve only; the Sales page uses it
  because nobody creates a deal through the API.

**Example.** `apps/accounts/views.py` uses an `APIView` for the badge
counts because there is no table of badges:

```python
class WaitingView(APIView):
    def get(self, request):
        ...
        return Response(waiting)
```

`apps/tryon/views.py` picks three of the five pieces, because a picture can
be listed, opened and deleted but never edited:

```python
class TryOnViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin,
                   mixins.DestroyModelMixin, viewsets.GenericViewSet):
```

### @action

**What.** A decorator (section 31) that adds an extra address to a viewset
beyond the standard five. `detail=True` means it works on one row
(`/items/42/mark-worn/`); `detail=False` means on the whole list
(`/items/stats/`).

**Example.** `apps/wardrobe/views.py`:

```python
@action(detail=True, methods=["post"], url_path="mark-worn")
def mark_worn(self, request, pk=None):
```

### request.user, request.data, request.query_params, request.FILES

**What.** The parts of a request a view reads.

| Name                   | Holds                                            | Example                                  |
| ---------------------- | ------------------------------------------------ | ---------------------------------------- |
| `request.user`         | The account the token belongs to                 | `owner=request.user`                     |
| `request.data`         | The body (JSON or form), already parsed          | `request.data["nickname"]`               |
| `request.query_params` | The `?name=value` part of the address            | `?slot=TOP&search=kurta`                 |
| `request.FILES`        | Uploaded files                                   | `request.FILES["image"]`                 |

**Where.** Everywhere. `request.user` is the most important: it is set by
the token and cannot be chosen by the caller.

### Response

**What.** DRF's object for an answer: data plus a status code. DRF turns
the data into JSON.

```python
return Response({"updated": updated}, status=status.HTTP_200_OK)
```

### Model

**What.** A Python class that describes one database table. Each
attribute is one column. Django creates and changes the real table from
it.

**Why.** The table is described once, in Python, and the ORM, the admin
site, the migrations and the serializers all read that one description.

**Where.** Every `apps/*/models.py`.

**Example.** A shortened `GarmentItem` from `apps/wardrobe/models.py`:

```python
class GarmentItem(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="garments")
    name = models.CharField(max_length=120)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="items")
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_WARDROBE)
    wear_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
```

### Field types

**What.** The kind of value a column holds.

| Field                     | Holds                              | My Closette example                        |
| ------------------------- | ---------------------------------- | --------------------------------------- |
| `CharField`               | Short text, with a maximum length  | `name`, `brand`, `status`               |
| `TextField`               | Long text                          | `notes`                                 |
| `EmailField`, `URLField`  | Text that must look like an email or a web address | `email`, `result_url`  |
| `BooleanField`            | True or false                      | `is_favorite`, `shares_closet`          |
| `PositiveIntegerField`    | A whole number, zero or more       | `wear_count`                            |
| `PositiveSmallIntegerField` | A small whole number             | `warmth_level` (1 to 5)                 |
| `DecimalField`            | Money, exact to the paisa          | `purchase_price`, `asking_price`        |
| `DateField`               | A day                              | `worn_on`, `planned_for`                |
| `DateTimeField`           | A day and time                     | `created_at`, `completed_at`            |
| `ArrayField`              | A list in one column (Postgres only) | `seasons`, `occasions`, `sizes`       |
| `ForeignKey`              | A link to one row of another table | `owner`, `category`, `storage_location` |
| `ManyToManyField`         | Links to many rows of another table | `PlannedOutfit.items`                  |

### Field options: max_length, null, blank, default, choices, unique, help_text

| Option        | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `max_length`  | The longest text allowed                                                |
| `null=True`   | The database may hold "no value" here                                   |
| `blank=True`  | A form may leave it empty                                               |
| `default`     | The value used when none is given                                       |
| `choices`     | Only these values are allowed (see TextChoices below)                   |
| `unique=True` | No two rows may share this value                                        |
| `help_text`   | A sentence shown in the admin site and the API docs                     |

**null vs blank** confuses everybody. `null` is about the database, `blank`
is about forms. Text fields use `blank=True` and store `""`, not NULL.
Dates and numbers use both: `null=True, blank=True`.

**Example.** `apps/accounts/models.py`:

```python
friend_code = models.CharField(max_length=16, unique=True, null=True, blank=True, default=None)
```

Unique, but allowed to be empty, because every existing account cannot be
given the same starting value in a unique column.

### ForeignKey, related_name, on_delete

**What.** A *ForeignKey* is a link from a row in one table to a row in
another: a garment points at its owner, its category and its place.

`related_name` is the name of the link seen from the other side:
`user.garments` lists a user's clothes because the garment's owner field
says `related_name="garments"`.

`on_delete` says what happens to this row when the row it points at is
deleted:

| on_delete   | Meaning                                         | My Closette example                                             |
| ----------- | ----------------------------------------------- | ------------------------------------------------------------ |
| `CASCADE`   | Delete this row too                             | Delete an account, its garments go with it                   |
| `SET_NULL`  | Keep this row, clear the link                   | Delete a drawer, the garments survive with no place           |
| `PROTECT`   | Refuse the delete while this row exists         | A category still holding items cannot be deleted             |

**Where.** `apps/wardrobe/models.py` has all three on one model.

### ManyToManyField

**What.** A link where each side can have many of the other. One plan has
many garments; one garment can be in many plans. Django makes a hidden
join table (`planned_outfits_items`) to hold the pairs.

**Where.** `apps/planner/models.py`:

```python
items = models.ManyToManyField(GarmentItem, related_name="planned_in", blank=True)
```

### TextChoices

**What.** A fixed list of allowed values for a text column, each with a
code the database stores and a label people see.

**Why.** The code cannot misspell a status, and the label is in one place.

**Example.** `apps/wardrobe/models.py`:

```python
class Status(models.TextChoices):
    IN_WARDROBE = "IN_WARDROBE", "In wardrobe"
    IN_LAUNDRY = "IN_LAUNDRY", "In the wash"
    ARCHIVED = "ARCHIVED", "Put away"
```

`item.status` is `"ARCHIVED"`; `item.get_status_display()` is `"Put away"`.

### Meta: db_table, ordering, constraints, indexes

**What.** A class inside a model holding settings about the table rather
than about one column.

| Setting       | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| `db_table`    | The table's real name in the database (`garment_items`)          |
| `ordering`    | The default order of rows (`["-created_at"]` = newest first)     |
| `constraints` | Rules the database enforces (section 26)                         |
| `indexes`     | Speed-up structures (section 26)                                 |

### Migration

**What.** A small script, written by Django, that changes the real
database to match a change in a model: add a column, add a table, add a
rule. They are numbered and run in order. `makemigrations` writes one,
`migrate` runs the ones not yet applied.

**Why.** The database on a laptop, on the test runner and on Render all
end up with the same shape, step by step, without anybody typing database
commands by hand.

**Where.** `apps/*/migrations/`. Render runs `python manage.py migrate` on
every deploy.

**Example.** `0005_user_body_photo_consent_at_user_body_photo_public_id.py`
in `apps/accounts/migrations/` added the two try-on columns to the users
table. The built-in categories were created by
`apps/wardrobe/migrations/0002_seed_categories.py`.

### ORM and QuerySet

**What.** The *ORM* (Object-Relational Mapper) lets Python code ask the
database questions without writing SQL. A *QuerySet* is one such question,
built up step by step and only sent to the database when the rows are
really needed.

**Why.** Shorter, works on any database, and values are always sent
separately from the question text, which is what makes SQL injection
impossible.

**Example.** From `apps/wardrobe/views.py`:

```python
GarmentItem.objects.filter(owner=self.request.user).exclude(status__in=GarmentItem.GONE_STATUSES)
```

In SQL that would be:

```sql
SELECT * FROM garment_items WHERE owner_id = 7 AND status NOT IN ('SOLD', 'ARCHIVED');
```

The QuerySet words used in this project:

| Word                    | Meaning                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `.objects`              | The door into the table                                       |
| `.filter(...)`          | Keep rows matching                                            |
| `.exclude(...)`         | Drop rows matching                                            |
| `.get(...)`             | Exactly one row, or an error                                  |
| `.first()`              | The first row, or None                                        |
| `.exists()`             | True if any row matches, cheaply                              |
| `.count()`              | How many rows match                                           |
| `.order_by("-worn_on")` | Sort; a minus sign means newest first                         |
| `.values("slot")`       | Only these columns, as plain dictionaries                     |
| `.annotate(n=Count("id"))` | Add a calculated column to each row                        |
| `.aggregate(total=Count("id"))` | One calculated answer for the whole set               |
| `.update(status=...)`   | Change matching rows in one statement, without loading them  |
| `.delete()`             | Remove matching rows                                          |
| `.create(...)`          | Insert one row                                                |
| `.get_or_create(...)`   | Find it, or insert it if missing                              |
| `.select_related("category")` | Load a linked row in the same query (see below)        |
| `.prefetch_related("items")` | Load linked lists in one extra query (see below)        |

Lookups go after a double underscore: `status__in=[...]`,
`name__iexact="kurta"` (ignore case), `last_worn_date__lt=cutoff` (less
than), `owner__isnull=True`, `category__slot="TOP"` (follow a link).

### The N+1 problem, select_related, prefetch_related

**What.** Showing 24 garments with their category names the naive way
costs 1 query for the garments plus 24 more, one per category: 25 queries
for one page. That is the "N+1 problem". `select_related` joins the linked
row into the first query (good for ForeignKey). `prefetch_related` fetches
all the linked lists in one second query (good for lists and
ManyToMany).

**Why.** Each query is a round trip to Neon in Singapore. 25 round trips
would make the closet page slow.

**Where.** Nearly every `get_queryset` in the project:

```python
.select_related("category", "storage_location", "storage_location__parent")
```

### Q objects

**What.** A way to write "or" and "not" in a filter. A plain `filter(a=1,
b=2)` means "a and b".

**Example.** `apps/wardrobe/filters.py`, seasons:

```python
queryset.filter(Q(seasons__contains=[value.upper()]) | Q(seasons=[]))
```

"Matches the season, or has no season set at all." The `|` is "or"; `~Q`
is "not".

### Subquery and OuterRef

**What.** A question inside a question. Used once, to attach the note from
each garment's most recent wearing without one query per garment.

**Where.** `apps/wardrobe/models.py`, `with_last_occasion()`.

### transaction.atomic

**What.** A *transaction* is a group of database changes that either all
happen or none happen. `with transaction.atomic():` marks such a group.

**Why.** Two changes that belong together must not be split by a crash in
the middle. Deleting a body photo deletes every try-on row and clears the
account's photo fields; half of that would be worse than none.

**Where.** `apps/tryon/views.py`, `BodyPhotoView.delete`; `apps/circle/models.py`,
`Loan.agree` (as a decorator).

### IntegrityError

**What.** The error the database raises when a rule is broken: a second
wearing on the same day, a second open loan on one garment.

**Why.** Two requests can arrive at the same instant. Both pass the
Python checks; the database stops the second. The code catches the error
and answers with the same readable sentence a single request would get.

**Example.** `apps/wardrobe/models.py`, `mark_worn`:

```python
try:
    with transaction.atomic():
        event = WearEvent.objects.create(owner_id=self.owner_id, item=self, worn_on=day, note=note)
except IntegrityError:
    return WearEvent.objects.get(item=self, worn_on=day), False
```

### ValidationError

**What.** An error that means "the data is wrong" and becomes a 400
response with a sentence. Django has one (used in models) and DRF has one
(used in serializers and views); they look alike.

**Example.** `apps/wardrobe/views.py`:

```python
raise ValidationError(f"{item.name} is {item.get_status_display().lower()}, so wearing it cannot be recorded.")
```

### Admin site

**What.** A ready-made website at `/admin/` where a staff account can see
and edit every table.

**Why.** Looking at real data while developing, and reading listing
reports, without writing any pages for it.

**Where.** Every `apps/*/admin.py` registers its tables. `apps/community/admin.py`
adds a "mark as looked at" action for reports.

### Management command

**What.** A job run from the command line with `python manage.py <name>`,
written as a class with a `handle` method.

**Why.** Work that is not a web request: refreshing shop prices, adding the
shop list, cleaning up pictures.

**Where.** `apps/shopping/management/commands/sync_deals.py`,
`seed_shops.py`; `apps/wardrobe/management/commands/prune_images.py`.

```python
class Command(BaseCommand):
    help = "Reads every active shop's published catalogue and records what changed."

    def handle(self, *args, **options):
        ...
```

### Middleware

**What.** A chain of small steps every request passes through before
reaching a view and every response passes through on the way out: adding
security headers, handling CORS, reading the session, protecting against
clickjacking.

**Where.** `MIDDLEWARE` in `config/settings.py`. Order matters: the CORS
one must be above `CommonMiddleware`.

### Cache

**What.** A remembered answer, kept for a while and reused instead of
asking again.

**Where.** `apps/planner/weather.py`:

```python
cached = cache.get(key)
if cached is not None:
    return cached
...
cache.set(key, reading, settings.WEATHER_CACHE_SECONDS)
```

The weather for one city is kept for 30 minutes.

### Logging

**What.** Writing a line about what happened to a log the developer can
read later, without showing it to the person.

**Where.** `logger = logging.getLogger(__name__)` at the top of several
files; then `logger.warning(...)`, `logger.exception(...)`.

### Time zones

**What.** `USE_TZ = True` stores every time in UTC and converts on the way
out. `TIME_ZONE = "Asia/Karachi"` is the local zone. `timezone.localdate()`
is "today in Pakistan", `timezone.now()` is the exact moment.

**Why.** "Today" must mean the same thing for the server in the USA (Render)
and the person in Lahore.

---

## 26. Database words

### Database, table, row, column

**What.** The *database* is the whole store. A *table* is one kind of
thing (`garment_items`). A *row* is one of them (one kurta). A *column* is
one fact about every row (`wear_count`).

**Where.** The database is `neondb` on Neon. The tables are listed in
section 17.

### Primary key

**What.** The column that identifies one row for ever: `id`. Django adds
it to every table automatically. The `42` in `/api/wardrobe/items/42/` is
a primary key.

### Foreign key

**What.** A column holding another row's primary key, making a link.
`garment_items.owner_id` holds a `users.id`.

### Join table

**What.** A hidden table holding pairs, used for many-to-many links.
`planned_outfits_items` holds (plan id, garment id) pairs.

### NULL

**What.** "No value" in a column. Different from zero and from empty text.
A garment with no price has `purchase_price` NULL, and the app shows no
cost per wear rather than a made-up number.

### Index

**What.** A structure the database keeps beside a table so that finding
rows by one column is fast, like the index at the back of a book. Without
one, the database reads every row.

**Why.** The closet list asks "this owner, newest first" on every page
load. An index on `(owner, -created_at)` answers it without sorting the
whole table.

**Where.** `Meta.indexes` in `apps/wardrobe/models.py`:

```python
models.Index(fields=["owner", "-created_at"], name="garment_owner_recent"),
GinIndex(fields=["name"], name="garment_name_trgm", opclasses=["gin_trgm_ops"]),
```

The second is a *GIN trigram index*, which makes the misspelling-tolerant
search fast. Trigram means "three letters in a row"; "kurta" is kur, urt,
rta. Two words that share many trigrams are probably the same word
misspelled.

### Constraint

**What.** A rule the database itself enforces. It cannot be bypassed by a
bug in the Python code or by two requests arriving at once.

| Kind                 | Meaning                                       | My Closette example                                   |
| -------------------- | --------------------------------------------- | -------------------------------------------------- |
| Unique constraint    | No two rows share these values                | One wearing per garment per day                    |
| Partial unique       | Unique, but only among rows matching a condition | One *open* loan per garment                    |
| Check constraint     | A row must satisfy a condition                 | A price is not negative; nobody borrows from themselves |

**Example.** `apps/circle/models.py`:

```python
models.UniqueConstraint(
    fields=["item"],
    condition=models.Q(status__in=["ASKED", "AGREED"]),
    name="one_open_loan_per_item",
),
```

Only Postgres can do the partial kind, which is one reason it was chosen.

### Transaction

See `transaction.atomic` in section 25. All-or-nothing.

### SQL and SQL injection

**What.** *SQL* is the language databases speak. *SQL injection* is an
attack where typed text becomes part of a command: typing `'; DROP TABLE
users; --` into a search box. The ORM makes it impossible because the typed
value is always sent separately from the command text.

**Where.** No raw SQL is written anywhere in this project. Everything goes
through the ORM.

### Postgres vs SQLite

**What.** *SQLite* is a database in one file, built into Python. Good for
a laptop, not for a live site: no real concurrency, no array columns, no
partial unique constraints. *PostgreSQL* is a full database server with all
of those.

**Where.** `config/settings.py` uses Postgres when `DATABASE_URL` is set
and refuses to start in production without it.

### Connection, pooling

**What.** A *connection* is an open line between Django and the database.
Opening one costs time, so Django keeps them for a while
(`CONN_MAX_AGE = 120`). Neon's *pooler* address shares a small number of
real connections between many callers.

**Why.** Neon sleeps after 5 minutes idle; a kept connection older than
that is dead, so Django checks it before reuse (`CONN_HEALTH_CHECKS`).

---

## 27. Django REST Framework words

### Serializer

**What.** The translator between a database row and JSON. On the way
out, it picks which columns to send and adds calculated ones. On the way
in, it checks every value and refuses bad data with a sentence.

**Why.** The browser must never see columns it should not (a buyer must
not see what the seller paid), and bad data must never reach the database.

**Where.** Every `apps/*/serializers.py`.

**Example.** `apps/community/serializers.py`, the garment as a buyer sees
it. Only these fields exist for a buyer:

```python
class GarmentForSaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = GarmentItem
        fields = ["name", "brand", "size", "material", "pattern", "pattern_label",
                  "category_name", "category_slot",
                  "display_image_url", "primary_color_hex", "primary_color_name"]
        read_only_fields = fields
```

### ModelSerializer, fields, read_only, write_only

**What.** A `ModelSerializer` builds itself from a model, so each column
becomes a field automatically; `fields` lists which ones. `read_only`
fields are sent out but never accepted in (`wear_count`). `write_only`
fields are accepted in but never sent out (`password`, the picture ids).

### validate_<field>() and validate()

**What.** Extra checks. `validate_item(self, item)` checks one field;
`validate(self, attrs)` checks the whole thing when fields depend on each
other. Returning the value means "fine"; raising `ValidationError` means
"refuse, with this sentence".

**Example.** `apps/circle/serializers.py`, borrowing dates:

```python
def validate(self, attrs):
    start, end = attrs["borrow_from"], attrs["borrow_until"]
    if end < start:
        raise serializers.ValidationError(
            {"borrow_until": "The day you give it back cannot be before the day you get it."}
        )
    if (end - start).days > 90:
        raise serializers.ValidationError(
            {"borrow_until": "Three months is the longest a thing can be borrowed for."}
        )
    return attrs
```

### SerializerMethodField and source

**What.** `source="category.name"` sends a value from a linked row under
a simpler name (`category_name`). A `SerializerMethodField` calls a method
`get_<name>` to work a value out.

**Example.** `apps/tryon/serializers.py`:

```python
garment_slot_label = serializers.SerializerMethodField()

def get_garment_slot_label(self, attempt):
    return dict(SLOT_CHOICES).get(attempt.garment_slot, attempt.garment_slot)
```

### get_queryset(), get_object(), perform_create(), perform_destroy()

**What.** The methods a viewset lets us override.

| Method              | When it runs                               | What My Closette does in it                               |
| ------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `get_queryset()`    | Before any list or detail                  | Limits rows to `owner=self.request.user`. The security of the app. |
| `get_object()`      | For one row by id                          | Looks the id up *inside* `get_queryset()`, so another person's id answers 404 |
| `perform_create()`  | When saving a new row                      | Sets `owner=self.request.user`, so the caller cannot choose the owner |
| `perform_destroy()` | When deleting                              | Deletes the Cloudinary pictures first                  |
| `get_serializer_class()` | Choosing the translator               | A short serializer for lists, a full one for detail    |

**Example.** `apps/wardrobe/views.py`:

```python
def perform_create(self, serializer):
    serializer.save(owner=self.request.user)
```

### queryset = Model.objects.none()

**What.** A line on every viewset that looks odd: "the rows are nothing".
It is never used to answer a request; `get_queryset()` does that. It exists
so the API docs generator can tell which table the view is about.

### Permission

**What.** The rule "who may call this at all". Checked before the view
runs.

**Where.** `config/settings.py` sets the default for the whole API:

```python
"DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
```

Everything needs a token unless a view says otherwise. Sign-up and login
say otherwise:

```python
permission_classes = [permissions.AllowAny]
```

### Authentication class

**What.** The code that reads the `Authorization` header, checks the
token, and sets `request.user`.

**Where.** `config/settings.py`:

```python
"DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
```

### Throttle (rate limit), throttle_scope

**What.** A cap on how many requests one caller may make in a period.
DRF counts them in memory and answers 429 past the cap. A *scope* is a
named limit a view can opt into.

**Where.** `config/settings.py`:

```python
"login": env("THROTTLE_LOGIN", default="2000/hour" if DEBUG else "10/min"),
```

and `apps/accounts/views.py`:

```python
class LoginView(TokenObtainPairView):
    throttle_scope = "login"
```

### Pagination

**What.** Sending a long list in pages instead of all at once. Every list
answer has `count`, `next`, `previous` and `results`.

**Where.** `config/pagination.py`, page size 24 in `config/settings.py`.

### Filter backends and FilterSet

**What.** Three helpers that read `?name=value` from the address and
narrow the list: `DjangoFilterBackend` for named filters, `SearchFilter`
for `?search=`, `OrderingFilter` for `?ordering=`. A `FilterSet` class
lists the named filters.

**Where.** `apps/wardrobe/filters.py`:

```python
class GarmentItemFilter(filters.FilterSet):
    category = filters.NumberFilter(field_name="category_id")
    unworn_days = filters.NumberFilter(method="filter_unworn_days", ...)
```

`?unworn_days=90` calls `filter_unworn_days`.

### Parsers

**What.** The code that reads a request body. `JSONParser` for JSON,
`MultiPartParser` and `FormParser` for forms with files.

**Where.** `apps/tryon/views.py` accepts both, because a try-on can be
asked for with JSON (a closet item) or with a form (an uploaded photo):

```python
parser_classes = [JSONParser, MultiPartParser, FormParser]
```

### Schema, OpenAPI, drf-spectacular, @extend_schema

**What.** A *schema* is a machine-readable description of every endpoint:
its address, method, inputs and outputs. *OpenAPI* is the standard format.
*drf-spectacular* writes it from our code, and serves a clickable page at
`/api/docs/`. `@extend_schema(...)` adds a summary or a correction to one
view.

**Why.** Judges can see every endpoint live. And `tests/test_contract.py`
reads this schema to check the frontend's types match it.

**Example.** `apps/circle/views.py`:

```python
@extend_schema(tags=["Friends"], summary="Yes, they can borrow it")
@action(detail=True, methods=["post"])
def agree(self, request, pk=None):
```

---

## 28. Login and token words

### Authentication vs authorisation

**What.** *Authentication* is "who are you?" (the token says Ali).
*Authorisation* is "may you do this?" (Ali may read his own items, not
Sara's).

**Where.** Authentication: `JWTAuthentication` in settings. Authorisation:
`IsAuthenticated` plus the owner filter in every `get_queryset()`.

### Password hashing, salt, PBKDF2

**What.** A *hash* is a one-way scramble: easy to compute, impossible to
reverse. A *salt* is random text mixed in first, so two people with the
same password get different hashes. *PBKDF2* is the hashing method Django
uses, deliberately slow so guessing is slow.

**Why.** If the database leaked, nobody could read a single password.

**Where.** Django does it in `create_user()`. `apps/accounts/models.py`
calls `user.set_password(password)`; the plain password is never stored.

### Session vs token

**What.** A *session* is the old way: the server remembers "cookie 123 is
Ali" in a table. A *token* is the new way: the server gives Ali a signed
string and remembers nothing.

**Why tokens.** The frontend and backend live on different domains, and
tokens work across domains and for a future phone app. See "stateless" in
section 24.

### JWT

**What.** *JSON Web Token*. Three parts separated by dots: a header, the
data (`{"user_id": 7, "exp": ...}`), and a *signature* made with the
server's `SECRET_KEY`. Anybody can read the data; nobody can change it
without breaking the signature.

**Where.** The library `djangorestframework-simplejwt`. Settings under
`SIMPLE_JWT` in `config/settings.py`.

### Access token and refresh token

**What.** The access token (60 minutes) is sent with every request. The
refresh token (7 days) is sent only to `/api/auth/refresh/` to get a new
pair.

**Why two.** A short access token limits the damage if one is stolen; a
long refresh token means the person is not asked for their password every
hour.

### Rotation and blacklist

**What.** *Rotation*: every refresh gives a new refresh token. *Blacklist*:
the old one is written to a table of dead tokens and refused from then on.

**Why.** Without the blacklist, a stolen refresh token would keep working
for its full seven days even after the real person refreshed.

**Where.** `config/settings.py`:

```python
"ROTATE_REFRESH_TOKENS": True,
"BLACKLIST_AFTER_ROTATION": True,
```

and the app `rest_framework_simplejwt.token_blacklist` in the app list,
which adds the two blacklist tables.

### Bearer

**What.** The word before the token in the `Authorization` header. It
means "whoever bears (carries) this token is who it says".

### AUTH_USER_MODEL, AbstractUser, USERNAME_FIELD

**What.** Django ships with a user table that logs in by username. Ours
logs in by email. `AbstractUser` is Django's user class to build on;
`USERNAME_FIELD = "email"` says what the login name is;
`AUTH_USER_MODEL = "accounts.User"` tells Django to use our class.

**Why on day one.** Django does not allow swapping the user model after
the first migration has run.

**Where.** `apps/accounts/models.py` and `config/settings.py`.

### Why 404 and not 403 for somebody else's item

**What.** 403 says "that exists but you may not see it". 404 says "no such
thing". My Closette answers 404 for another person's item.

**Why.** 403 would confirm the id exists, which is a small information
leak. Looking the id up inside the owner-filtered queryset gives 404
naturally.

---

## 29. Security words

### TLS, certificate

**What.** *TLS* is the encryption under HTTPS. A *certificate* proves the
server really is `closette-api.onrender.com`. Render provides and renews
it; nothing in our code handles it.

### HSTS

**What.** *HTTP Strict Transport Security*: a header telling the browser
"only ever talk to me over HTTPS, for the next year". After the first
visit the browser will not even try plain HTTP.

**Where.** `SECURE_HSTS_SECONDS = 31536000` in `config/settings.py`.

### Proxy, X-Forwarded-Proto, SECURE_PROXY_SSL_HEADER

**What.** A *proxy* is a server in front of ours. Render's proxy handles
HTTPS and passes plain HTTP on to Django. It adds a header
`X-Forwarded-Proto: https` saying "this really was HTTPS". Django has to be
told to trust that header, or it would think every request was insecure and
redirect for ever.

**Where.** `SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")`.

### NUM_PROXIES

**What.** Tells the rate limiter how many proxies sit in front, so it
reads the caller's real address from the right place. Set to 1 (Render's).
Left unset, the limiter would trust a header the caller can write
themselves, and a password-guesser could change it on every request.

### CORS

**What.** *Cross-Origin Resource Sharing*. Browsers block a page on one
domain from calling a server on another, unless the server says that
domain is allowed. Our frontend (`fyp-bice-three.vercel.app`) and backend
(`closette-api.onrender.com`) are different domains.

**Where.** `CORS_ALLOWED_ORIGINS` in `config/settings.py`, read from the
environment. Only the Vercel address is allowed in production.

### CSRF

**What.** *Cross-Site Request Forgery*: a bad website making your browser
send a request to a good website using your cookies. Django's CSRF
middleware protects against it for cookie-based logins. Our API uses tokens
in a header, not cookies, so the attack does not apply to it; the middleware
stays on for the admin site, which does use cookies.

### Clickjacking, X-Frame-Options

**What.** *Clickjacking*: showing our site inside an invisible frame on a
bad site so a person clicks our buttons without knowing. `X_FRAME_OPTIONS =
"DENY"` tells browsers never to show our pages inside a frame.

### Enumeration

**What.** Using an app's answers to list things you should not know, such
as which emails have accounts. My Closette gives the same answer for a wrong
password and an unknown email, the same answer for a wrong friend code
whatever was wrong with it, and 404 for another person's item.

### Brute force

**What.** Trying passwords (or codes) one after another until one works.
Stopped by the rate limits: 10 logins a minute, 20 friend-code tries an
hour.

### Environment variable, .env, secret

**What.** An *environment variable* is a named value given to a program
from outside, not written in its code. `.env` is a file of them on the
developer's machine. A *secret* is one that must stay private: the database
password, the Cloudinary keys, the token-signing key.

**Why.** Code goes to GitHub, where anybody might read it. Secrets must
not.

**Where.** `backend/.env` (ignored by git). `backend/.env.example` lists
the names with empty values. On Render they are typed into the dashboard
once. `config/settings.py` reads them with `env("NAME")`.

### SECRET_KEY

**What.** The one secret that signs the login tokens. If it leaked,
anybody could make a token for any account.

**Where.** `config/settings.py` refuses to start in production with the
development key:

```python
if not DEBUG and SECRET_KEY == "insecure-development-key":
    raise ImproperlyConfigured("SECRET_KEY must be set when DEBUG is off.")
```

### DEBUG

**What.** A switch. On, Django shows full error pages with code in them
and relaxes several limits, for developing. Off, errors are plain and every
security setting is on. It is off on Render.

### Upload limits

**What.** `DATA_UPLOAD_MAX_MEMORY_SIZE` (20 MB) caps a whole request;
`MAX_UPLOAD_BYTES` (12 MB) in `apps/vision/uploads.py` caps one photo;
`ALLOWED_IMAGE_TYPES` lists the file types accepted.

**Why.** A huge upload could use up the server's memory. A file that is
not an image could crash the background remover.

---

## 30. Hosting words

### Deploy, build command, start command

**What.** *Deploy* is putting a new version live. The *build command* runs
once per deploy to prepare it; the *start command* runs the server.

**Where.** `render.yaml`:

```yaml
buildCommand: pip install -r requirements/base.txt && python manage.py collectstatic --no-input && python manage.py migrate
startCommand: gunicorn config.wsgi:application
```

### WSGI and gunicorn

**What.** *WSGI* is the standard handle a Python web program offers so a
server can run it; ours is `config/wsgi.py`. *gunicorn* is the production
server that grabs that handle and handles many requests at once.
`manage.py runserver` is for a laptop only.

### Static files, collectstatic, whitenoise

**What.** *Static files* are the CSS and JavaScript of the admin site.
`collectstatic` gathers them into one folder; *whitenoise* serves them
from Django itself, so no separate file server is needed.

### Health check

**What.** An address the host calls every few seconds to see the server is
alive. Ours is `/api/health/`, which answers `{"status": "ok"}`. It is
exempt from the HTTPS redirect because Render calls it over plain HTTP.

### Cron, scheduler, UTC

**What.** *Cron* is a timer that runs a command on a schedule, written as
five fields: `0 1,13 * * *` means "minute 0 of hours 1 and 13, every day".
Hosted timers run on *UTC* (the world's reference time); Pakistan is five
hours ahead, so 01:00 and 13:00 UTC are 06:00 and 18:00 in Lahore.

**Where.** The `closette-prices` service in `render.yaml`.

### Free plan sleep

**What.** Render's free web service stops after 15 minutes without
requests and takes up to a minute to start again. The frontend's waking
notice exists because of this.

### Requirements, pinning, venv, pip

**What.** `requirements/*.txt` lists every Python package with its exact
version (*pinned*: `Django==5.2.6`, not `Django>=5`). *pip* installs them.
A *venv* is a private folder of installed packages for this project only,
so two projects on one laptop cannot fight over versions.

**Why pin.** A new version of a package could change behaviour and break
the live site silently. Pinned means the server runs exactly what was
tested.

**Where.** `requirements/core.txt` (the API's needs), `base.txt` (core plus
background removal), `dev.txt` (base plus the test tools).

---

## 31. Python words used in this code

### class, object, self, method

**What.** A *class* is a blueprint; an *object* is one thing made from it.
A *method* is a function inside a class. `self` is the object the method
is working on. `GarmentItem` is a class; one kurta is an object;
`mark_worn` is a method; inside it, `self` is that kurta.

### Inheritance

**What.** A class built on another class, keeping everything the parent
has and changing or adding some parts. Written as `class Child(Parent):`.

**Example.** `apps/accounts/views.py`:

```python
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"
```

The library's login view does the work; we only change three settings.

### Decorator

**What.** A line starting with `@` just above a function or class that
changes how it behaves. Ones in this project:

| Decorator               | Does                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `@property`             | Lets a method be read like a plain value: `item.cost_per_wear` with no brackets |
| `@action(...)`          | Adds an extra address to a viewset                         |
| `@transaction.atomic`   | Runs the whole method as one database transaction          |
| `@extend_schema(...)`   | Adds a description to the API docs                         |
| `@lru_cache(...)`       | Remembers the answer for each input, so the same colour is never converted twice |
| `@dataclass(frozen=True)` | Makes a small class that only holds values and cannot be changed after creation |
| `@admin.register(...)`  | Shows a table in the admin site                            |
| `@pytest.fixture`       | Marks a helper tests can ask for by name                   |
| `@staticmethod`         | A method that does not need `self`                         |

### property

**Example.** `apps/wardrobe/models.py`:

```python
@property
def days_since_worn(self) -> int | None:
    if self.last_worn_date is None:
        return None
    return (timezone.localdate() - self.last_worn_date).days
```

Used as `item.days_since_worn`, and the serializer sends it as if it were
a column.

### dataclass

**What.** A class that is just a bundle of named values, with the boring
parts written for you.

**Example.** `apps/planner/weather.py`:

```python
@dataclass(frozen=True)
class Advice:
    headline: str
    wear: str
    warmth_levels: list[int]
    season: str
    take_umbrella: bool
```

### Exception, try, except, raise, from

**What.** An *exception* is an error signal. `raise` sends one; `try` /
`except` catches one. `raise X from exc` keeps the original error attached
for the log.

**Example.** `apps/planner/weather.py`:

```python
try:
    now = _get(CURRENT_URL, params)
except requests.Timeout as exc:
    raise WeatherUnavailable("The weather service did not answer in time.", "timeout") from exc
```

A custom exception is just a class built on `Exception`:

```python
class WeatherUnavailable(Exception):
    def __init__(self, reason: str, code: str):
        super().__init__(reason)
        self.reason = reason
        self.code = code
```

### f-string

**What.** Text with values inside curly brackets:
`f"{item.name} is not recorded as worn on {day}."`

### Type hints

**What.** Notes saying what kind of value a function takes and returns:
`def supports(slot: str) -> bool:`. Python does not enforce them; they
help the reader and the editor. `int | None` means "a number or nothing".

`from __future__ import annotations` at the top of many files lets a type
hint mention a class defined further down the same file.

### Comprehension

**What.** Building a list, set or dictionary in one line.

```python
names = [i.name for i in gone]
referenced = {name.lower(): hex_value for name, hex_value in NAMED_COLORS}
```

### Regular expression (regex)

**What.** A pattern for matching text. Used to spot phone numbers and
emails in listing notes, and to match shop wording.

**Example.** `apps/community/models.py`:

```python
LOOKS_LIKE_A_PHONE = re.compile(r"(?:\+?\d[\s\-().]*){9,}")
LOOKS_LIKE_AN_EMAIL = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
```

"Nine or more digits, with optional spaces, dashes or brackets between
them" and "something, an @, something, a dot, something".

### with statement

**What.** Runs a block with something set up before and cleaned up after,
whatever happens. `with transaction.atomic():` starts a transaction and
commits or rolls it back at the end. `with open(path, "rb") as fh:` opens
a file and closes it.

### *args and **kwargs

**What.** "Any extra positional arguments" and "any extra named
arguments". Seen in `def handle(self, *args, **options):` and
`def create_user(self, email, password=None, **extra_fields):`.

### lambda

**What.** A tiny unnamed function. `key=lambda rule: -len(rule[0])` means
"sort by the length of the first part, longest first".

### Module, package, import

**What.** A *module* is one `.py` file. A *package* is a folder of them
with an `__init__.py`. `import` brings one into another.
`from apps.vision import storage` brings in `apps/vision/storage.py`.

### Constants

**What.** Values written in CAPITALS at the top of a file that never
change while the program runs: `MAX_UPLOAD_BYTES = 12 * 1024 * 1024`,
`TRYON_DAILY_LIMIT`. Putting them at the top makes them easy to find and
change.

---

## 32. Testing words

### pytest, test function, assert

**What.** *pytest* finds every function whose name starts with `test_`,
runs it, and reports. `assert` is the check: the test fails if what follows
is false.

**Example.** `tests/test_security.py`:

```python
def test_a_tampered_signature_is_refused(api, make_user):
```

Test names are whole sentences on purpose, so the report reads like a list
of promises.

### Fixture, conftest.py

**What.** A *fixture* is a named helper a test asks for by putting its
name in the argument list. `conftest.py` holds the shared ones.

**Example.** `tests/conftest.py` offers `signed_in`, which returns a client
already carrying a token plus the account behind it:

```python
@pytest.fixture
def signed_in(api, make_user):
    def build(email="person@example.test", password="Test-pass-9273", **extra):
        user = make_user(email, password, **extra)
        client = APIClient()
        response = client.post("/api/auth/login/", {"email": email, "password": password}, format="json")
        client.credentials(HTTP_AUTHORIZATION="Bearer " + response.data["access"])
        return client, user
    return build
```

A test then writes `client, me = signed_in("ali@example.test")` and makes
requests as Ali.

### APIClient

**What.** A fake browser for tests. `client.post("/api/auth/login/",
{...})` sends a request through the whole stack without a network.

### Test database

**What.** pytest-django creates a separate database (`test_neondb`) for
each run and deletes it after. `--reuse-db` keeps it between runs to save
time. Real data is never touched.

### monkeypatch

**What.** A fixture that swaps one thing for another during one test and
puts it back after. Used to make rate limits tiny so a test can hit them in
three tries, and to replace Cloudinary and the try-on supplier with
stand-ins so no test reaches the internet.

**Example.** `tests/test_security.py`:

```python
monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", {..., "login": "3/min", ...})
```

### parametrize

**What.** Runs one test function once per value in a list. The contract
test runs once per TypeScript interface:

```python
@pytest.mark.parametrize("interface,component", PAIRS, ids=[p[0] for p in PAIRS])
```

### What passing tests prove, and do not

Passing tests prove that everything they check still works after a
change, and that the attacks they try still fail. They do not prove the
absence of bugs nobody thought to test. That is why the walkthrough
(section 11) was also run by hand against a real server.

---

## 33. Test yourself

Cover the right column and answer.

| Question                                                          | Answer                                                                                 |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| What does `GET /api/wardrobe/items/42/` ask for?                  | Read garment 42                                                                        |
| What status code says "not signed in"?                            | 401                                                                                    |
| Why does another person's item give 404, not 403?                 | 403 would confirm the id exists                                                        |
| What is a model?                                                  | A Python class describing one database table                                           |
| What is a migration?                                              | A script that changes the real database to match a model change                        |
| What is a serializer?                                             | The translator between a row and JSON, which also checks incoming data                 |
| Where is the security of the whole app?                           | `get_queryset()` filtering by `owner=self.request.user` before any id is looked up      |
| What does `on_delete=SET_NULL` do on `storage_location`?          | Deleting a drawer keeps the garments, with no place                                    |
| Why `PROTECT` on `category`?                                      | A category still holding items cannot be deleted                                       |
| What does `select_related("category")` fix?                       | The N+1 problem: one query instead of one per row                                      |
| What is a partial unique constraint, and give the example?        | Unique only among rows matching a condition: one open loan per garment                 |
| What does `transaction.atomic` guarantee?                         | All the changes inside happen, or none do                                              |
| What is `IntegrityError` and when does My Closette catch it?         | The database refusing a rule; caught so two simultaneous taps get a sentence, not a crash |
| How long do the two tokens live?                                  | Access 60 minutes, refresh 7 days                                                      |
| What is rotation with blacklisting?                               | Every refresh gives a new refresh token and kills the old one                          |
| Why email as the login and why on day one?                        | Simpler for people; Django cannot swap the user model after the first migration        |
| What is CORS and what does ours allow?                            | The browser rule about cross-domain calls; only the Vercel site                        |
| What is a throttle scope and name two?                            | A named rate limit a view opts into; `login` 10/min, `friend-code` 20/hour             |
| Why is `NUM_PROXIES` 1?                                           | So the rate limiter reads the caller's real address, not a header the caller can write |
| Where are secrets kept?                                           | `backend/.env` locally and Render's dashboard; never in GitHub                         |
| What runs `sync_deals` on the live site, and when?                | The `closette-prices` cron service on Render, 01:00 and 13:00 UTC                      |
| What is gunicorn?                                                 | The production server that runs the Django app                                         |
| What is a fixture?                                                | A named helper a test asks for by putting its name in the argument list                |
| What does `monkeypatch` do?                                       | Swaps something for a test and restores it after                                       |
| What does the contract test check?                                | That the frontend's TypeScript types match the backend's published schema              |
| What is `@property` for?                                          | Reading a method like a value: `item.cost_per_wear`                                    |
| What does the ORM protect against automatically?                  | SQL injection                                                                          |
| Why Postgres and not SQLite in production?                        | Real concurrency, array columns, partial unique constraints, trigram search            |
| What is a cache, with the example?                                | A remembered answer; the weather for a city is kept for 30 minutes                     |
| What does `@action(detail=True)` add?                             | An extra address on one row, such as `/items/42/mark-worn/`                            |
