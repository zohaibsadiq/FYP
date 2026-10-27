# Closette: An AI-Assisted Smart Wardrobe Management System

## Team Guide

This guide explains the whole project in simple words. It is written for the
team members who will present and defend the project, so that anybody in the
group can answer a question from a judge about any part of it.

It covers:

- what Closette is and why it exists
- every technology used, what it is, and why it was chosen
- every feature, from the small ones to the large ones, with the exact steps
  that happen behind the screen
- which file holds each part of the code
- the database, the image host, the weather service and the other outside
  services
- how it is tested, how it is hosted, and how to run it on your own computer
- the questions judges are likely to ask, with answers
- a short demo script for the presentation
- a glossary of every technical word used in this guide

**How to read it.** Read Part 1 once, slowly. It gives the whole picture. Then
read the feature you are responsible for in Part 2 until you can explain it
without the guide. Keep Part 3 for reference during the defence.

Words in **bold** are explained in the glossary at the very end.

---

# PART 1: THE WHOLE PICTURE

---

## 1. What Closette is

Closette is a website that helps a person manage the clothes they own.

A real wardrobe cannot answer questions. Closette can. A person photographs
the clothes they own, writes down where each one is kept, and the app then
answers:

| Question                         | What Closette does                                                   |
| -------------------------------- | -------------------------------------------------------------------- |
| Where is my blue shirt?          | Remembers the room, the wardrobe, the drawer.                        |
| What have I not worn for months? | Keeps a wear log and shows the forgotten things.                     |
| What did a shirt really cost me? | Divides the price by the number of times worn (cost per wear).       |
| What should I wear today?        | Shows the weather for the person's city and advice for it.           |
| What will I wear on Friday?      | A day planner with a calendar.                                       |
| Is this on sale anywhere?        | Reads the catalogues of 8 real Pakistani clothing shops twice a day. |
| Can I sell this?                 | A buy-and-sell marketplace between the app's users.                  |
| Can I borrow my friend's jacket? | Lending between friends, with return dates.                          |
| How would this look on me?       | Virtual try-on: a picture of the person wearing the garment.         |

It works in a web browser on a phone or a laptop. Nothing has to be installed.

### The one-minute pitch

> People own far more clothes than they wear, forget what they have, buy
> things they already own, and cannot find things in their own wardrobe.
> Closette is a digital copy of a person's wardrobe. It knows what you own,
> where it is, when you last wore it, and what it is worth. Around that
> it adds four things a wardrobe alone can never do: it watches shop prices
> for you, lets you sell what you no longer wear, lets you borrow from
> friends, and lets you see yourself wearing something before you decide.

### Where the name comes from

**Closette** is "closet" plus "-ette". The ending "-ette" means small, as in
"kitchenette" (a small kitchen). So Closette means "a little closet": a
wardrobe small enough to carry in your pocket.

_Closet_ is the American word for what British English calls a _wardrobe_
and Urdu calls an _almari_. The subtitle, "Smart Wardrobe Management System",
says the same thing again in plain words.

The word "wardrobe" has two meanings and the app uses both:

1. the clothes a person owns ("her wardrobe is mostly black")
2. the piece of furniture the clothes live in

In the code, the first meaning is the `GarmentItem` table and the second is
the `StorageLocation` table.

### Where the AI is

The title says "AI-Assisted". Be precise about this when a judge asks,
because over-claiming is the fastest way to lose marks.

Two real trained models do work in this project:

1. **Background removal.** When a person photographs a shirt on a bed, the
   app cuts the shirt out of the background and keeps only the shirt. This
   uses a model called **U-2-Net**, a deep neural network trained to find the
   main object in a picture. It has about 176 MB of learned weights. It runs
   inside our own server through a library called `rembg`.

2. **Virtual try-on.** A picture of the person wearing a garment is made by a
   model called **Kling**, which runs on a supplier's computers (a company
   called PiAPI). We send two pictures and get one back.

Everything else is ordinary, careful programming, and should be called that:

- Colour naming uses colour science (a colour space called Lab), not AI.
- Reading shop catalogues uses word matching rules, not AI.
- Weather advice uses temperature bands, not AI.
- The misspelling-tolerant search uses a database feature (trigram
  similarity), not AI.

If a judge asks "where is the AI?", the honest answer is: in background
removal and in virtual try-on. The rest is smart logic.

### Who it is for

Anybody who owns clothes. The first users are university students in
Pakistan, which is why the shops are Pakistani, the currency is rupees, the
categories include kurta, shalwar kameez and khussa, and the weather advice is
tuned for Lahore summers.

---

## 2. The big picture

Closette is two separate programs that talk to each other over the internet.

```
   The person's browser (phone or laptop)
                |
                |   opens the website
                v
   +----------------------------+
   |  FRONTEND  (Next.js)       |   hosted on Vercel
   |  what the person sees:     |   fyp-bice-three.vercel.app
   |  pages, buttons, pictures  |
   +----------------------------+
                |
                |   asks for data, sends changes (JSON over HTTPS)
                v
   +----------------------------+
   |  BACKEND  (Django)         |   hosted on Render
   |  the rules and the data:   |   closette-api.onrender.com
   |  who may see what, counts, |
   |  saving, checking          |
   +----------------------------+
        |        |         |          |
        v        v         v          v
   Database   Cloudinary  OpenWeather  Shops      PiAPI
   (Neon)     (pictures)  (weather)    (prices)   (try-on)
```

**The frontend** is the part the person sees and touches. It draws the
pages, the buttons and the pictures. It holds no data of its own. Every time
it needs something, it asks the backend.

**The backend** is the part the person never sees. It owns the data and the
rules: who is signed in, who may see which clothes, how many items somebody
has, what happens when a shirt is sold. It talks to the database and to the
outside services.

The two halves talk in a format called **JSON**, which is plain text
arranged in a way computers can read easily:

```
{ "name": "Blue Kurta", "brand": "Junaid Jamshed", "wear_count": 3 }
```

### Why two programs and not one?

1. **The same backend can serve a phone app later** without rewriting
   anything. The phone app would just ask the same questions.
2. **Each half can be changed and deployed on its own.** Fixing a button
   does not need the server to restart.
3. **It is how modern web products are built**, so the skills transfer to a
   job.

---

## 3. Every technology, what it is, and why we chose it

### 3.1 The backend: Python, Django and Django REST Framework

**Python** is the programming language of the backend. It was chosen
because it is clear to read, and because the image work (cutting out
backgrounds, reading colours) has excellent Python libraries.

**Django** is a Python framework for building websites and servers. A
framework is a large box of ready-made parts. Django gives us:

| Part Django gives us   | What it means in plain words                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The ORM                | A way to talk to the database in Python instead of writing database commands by hand. It also blocks a whole class of attacks (SQL injection) automatically. |
| Migrations             | When we add a column to a table, Django writes a small script that changes the real database safely, step by step.                                           |
| The admin site         | A ready-made back office at `/admin/` where we can look at and fix data.                                                                                     |
| Accounts and passwords | Password hashing, password rules and permissions, already tested by thousands of projects.                                                                   |

**Django REST Framework (DRF)** sits on top of Django and turns it into an
**API**: a server that answers questions with JSON instead of drawing web
pages. DRF gives us serializers (translators between database rows and
JSON), permissions, paging, filtering and rate limiting.

**Why not Node.js, Laravel or Firebase?** Python suits the image work.
Django's ready parts (accounts, admin, migrations) would take months to build
by hand. Firebase would have made the "who may see what" rules harder to
write and test, and all our data rules are the heart of this project.

### 3.2 The frontend: TypeScript, React and Next.js

**React** is a library for building screens out of small reusable pieces
called components. A button is a component; a garment card is a component; a
page is many components together.

**Next.js** is the framework around React. It gives us pages (one folder =
one web address), fast loading, image resizing, and a one-command deploy to
Vercel. We use version 16.

**TypeScript** is JavaScript with types. A type says "this value is a
number" or "this value is text". If the backend sends `wear_count` as a
number and the page tries to treat it as text, the build fails before anybody
sees the page. It catches mistakes early.

Smaller frontend libraries worth knowing by name:

| Library                    | Job                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------- |
| TanStack Query             | Fetches data from the backend, remembers it, and refreshes it when something changes. |
| axios                      | Sends the HTTP requests, attaches the sign-in token, refreshes it when it expires.    |
| Tailwind CSS               | Styling. Small class names like `h-11` instead of separate CSS files.                 |
| Base UI and shadcn/ui      | Ready-made accessible building blocks: dialogs, tabs, menus, switches.                |
| lucide-react               | The icons.                                                                            |
| sonner                     | The small "Saved." pop-up messages (toasts).                                          |
| Vitest and Testing Library | The frontend test tools.                                                              |

### 3.3 The database: PostgreSQL on Neon

A **database** is where the data lives permanently: every user, every
garment, every wearing, every listing. It is organised in **tables**, like
spreadsheets. Each table has rows (one row = one thing) and columns (one
column = one fact about it).

We use **PostgreSQL** (often shortened to Postgres), a free, mature,
widely used database. Reasons:

- It supports **partial unique rules**. Example: a garment may appear in many
  loan rows over the years, but only one of them may be _open_ at a time.
  Postgres can enforce that itself, so even two requests arriving at the
  same moment cannot both succeed. Some other databases cannot express this.
- It can store a **list in one column** (used for a garment's seasons and
  occasions).
- It has **trigram similarity**, the feature behind the misspelling-tolerant
  search.

The database is hosted by **Neon**, a company that runs Postgres in the
cloud. The database is called **`neondb`** and lives in Singapore
(`ap-southeast-1`). Neon was chosen because it has a free plan, it goes to
sleep when nobody is using it so it costs nothing while idle, and it gives us
one connection address to paste into the settings.

Two things we had to handle because of Neon:

- Neon puts the database to sleep after 5 minutes of silence. A connection
  kept open longer than that is dead. So Django checks each connection is
  alive before reusing it (`CONN_HEALTH_CHECKS`).
- We connect through Neon's "pooler" address, which shares connections.
  One Django feature (server-side cursors) does not work through it, so it is
  switched off.

During development the tests use a separate throwaway database
(`test_neondb`) so they never touch real data.

### 3.4 Pictures: Cloudinary

Garment photos, body photos and try-on results are not stored on our own
server. They are stored with **Cloudinary**, a company that hosts and
delivers images.

Why not store them on our server?

- Render, our server host, **wipes the server's disk on every deploy**.
  Photos saved there would vanish every time we pushed a change.
- Cloudinary **resizes on the fly**. One upload can be shown small on a phone
  and large on a laptop, just by changing the web address.
- Cloudinary delivers from servers near the viewer (a CDN), so pictures load
  fast.

Every picture gets a **public id** (its file name on Cloudinary) and a **web
address** (the URL). We store both, because showing a picture needs the
address and deleting it needs the id.

Pictures are filed in folders by purpose and by account:

```
closette/
  garments/original/u42/...    the photo as taken, account 42
  garments/clean/u42/...       the same photo with the background removed
  users/body/u42/body          the body photo for try-on (one per account)
  tryon/results/u42/...        pictures made by try-on
```

The `u42` part is the account's id. It is also a security check: when the
browser sends back a picture id to attach to a garment, the server checks
the id starts with that account's own folder. Nobody can attach another
person's picture to their own item.

### 3.5 Weather: OpenWeather

**OpenWeather** is a public weather service with a free plan. The backend
asks it for the current weather and the next 24 hours of forecast for the
city on the person's profile, and turns the numbers into advice ("Warm.
Light clothes are enough.").

The free plan allows 60 requests a minute. Every visit to the Home page
would spend one, so the answer is **remembered for 30 minutes** (a cache) and
reused.

### 3.6 Shop prices: Shopify catalogues

Almost every clothing shop in Pakistan runs its website on **Shopify**. A
Shopify shop publishes its own catalogue as a JSON file at the address
`/products.json`. It needs no key or permission, it is meant to be read, and
it carries the one fact that makes something a sale: the price it was cut
from.

We read eight shops: **Outfitters, Limelight, Gul Ahmed, Bonanza Satrangi,
Beechtree, Generation, Junaid Jamshed, Almirah**. Each was checked by hand:
the address answers, and the shop's own rules file (`robots.txt`) allows it.
Beechtree asks for ten seconds between requests, and we wait ten seconds.

This is **not scraping**. Scraping means reading the shop's web pages meant
for humans and breaking when the design changes. We read a data file the
shop publishes for exactly this purpose.

### 3.7 Virtual try-on: PiAPI and Kling

**Kling** is a trained model that draws a garment onto a photo of a person.
It needs very powerful hardware (GPUs) that our server does not have, so we
use it through **PiAPI**, a company that runs the model and sells access to
it. We send two web addresses (the body photo and the garment photo), they
run the model for two to four minutes, and we fetch the finished picture.

Each picture costs about **7 US cents**. That is why there is a daily limit
of 10 pictures per account.

**Why Kling?** Several models were tested with a real kurta before choosing.
Published research shows most try-on models are trained on Western clothes,
and some turn a shalwar kameez into a Western-style dress. Kling handled a
mandarin collar, a button placket and long sleeves correctly. It was chosen
on evidence.

### 3.8 Hosting: Render, Vercel, GitHub

- **GitHub** holds the code. Every change is a commit.
- **Vercel** hosts the frontend. Every push to the `master` branch builds
  and publishes the site automatically. Vercel is made by the same company
  as Next.js. Address: `fyp-bice-three.vercel.app`.
- **Render** hosts the backend. It runs two things from one file,
  `render.yaml`: the API itself (`closette-api`), and a timer
  (`closette-prices`) that refreshes shop prices twice a day. Address:
  `closette-api.onrender.com`.

Render's free plan puts the server to sleep after 15 minutes without
visitors, and waking it takes up to a minute. The frontend knows this: as
soon as the site opens it knocks on the server (`/api/health/`), and if the
answer is slow it shows "Waking the server up" instead of looking broken.

---

## 4. How the two halves talk to each other

Every action in the app is one or more **requests** from the frontend to the
backend. A request has an address (`/api/wardrobe/items/`), a method (GET to
read, POST to create, PATCH to change, DELETE to remove), and usually a
**token** that proves who is asking.

### Example: Ali presses "I wore this today" on his blue kurta

```
1. Browser sends:   POST /api/wardrobe/items/42/mark-worn/
                    with the header  Authorization: Bearer <Ali's token>

2. Django reads the address book (urls.py) and sends the request to the
   wardrobe app, to the function called mark_worn.

3. DRF checks the token. It is valid and belongs to Ali (account 7).

4. DRF checks the rate limit. Ali is well under it.

5. The view asks the database for item 42, but ONLY among Ali's items.
   If 42 belonged to somebody else, the answer would be "not found".

6. The view checks the kurta is not sold, put away or lent out.
   If it were, the answer would be a sentence explaining why.

7. The kurta's mark_worn() method writes one row into the wear log and
   recounts "times worn" and "last worn".

8. The backend answers with the updated kurta as JSON.

9. The frontend shows "Saved. You wore this today." and refreshes the closet
   and the Home page counts.
```

Step 5 is the security of the whole app, and the same pattern is used
everywhere: the database question is always limited to the signed-in person
_before_ the id is looked up.

### Tokens: how the app knows who you are

When Ali signs in, the backend gives the browser two **tokens** (long random-
looking strings):

| Token         | Lives for  | Used for                                          |
| ------------- | ---------- | ------------------------------------------------- |
| Access token  | 60 minutes | Sent with every request as proof of who is asking |
| Refresh token | 7 days     | Getting a new access token when the old one ends  |

A token is signed with the server's secret key. Change one character of it
and the signature no longer matches, so the server rejects it. The server
does not need to remember who is signed in; it just checks the signature.

When the access token runs out, the frontend notices (the server answers
401), quietly asks for a new one with the refresh token, and repeats the
original request. The person never sees this happen. Every refresh also
replaces the refresh token and puts the old one on a **blacklist**, so a
stolen refresh token stops working as soon as the real person refreshes.

Signing out deletes both tokens from the browser.

### What a page does while it waits

The frontend keeps a copy of everything it has fetched (TanStack Query). When
somebody changes something, the related copies are marked stale and fetched
again. Example: marking a kurta worn refreshes the kurta, the closet list and
the Home page counts, but not the shop prices, because those did not change.

---

## 5. Where everything is: the folder map

```
FYP/
|-- backend/                   the Django server
|   |-- config/                settings, the top-level address book, server entry points
|   |   |-- settings.py        every setting: database, security, limits, keys
|   |   |-- urls.py            sends /api/wardrobe/... to the wardrobe app, and so on
|   |   `-- pagination.py      lists come back 24 at a time
|   |-- apps/                  one folder per feature area
|   |   |-- accounts/          sign up, sign in, profile, friend codes, badges
|   |   |-- wardrobe/          clothes, categories, storage places, wear log
|   |   |-- vision/            photo checks, background removal, Cloudinary
|   |   |-- intelligence/      colour naming
|   |   |-- planner/           weather and the day planner
|   |   |-- shopping/          shop catalogues, sale prices, price history
|   |   |-- community/         Buy and Sell
|   |   |-- circle/            Borrow from Friends
|   |   `-- tryon/             Virtual try-on
|   |-- tests/                 237 automated tests
|   |-- requirements/          the exact list of Python packages
|   |-- manage.py              Django's command runner
|   `-- .env                   the secret keys (never in GitHub)
|
|-- frontend/                  the Next.js website
|   `-- src/
|       |-- app/               one folder per page (web address)
|       |-- components/        reusable pieces: cards, dialogs, forms, layout
|       |-- hooks/             the code that asks the backend for data
|       |-- lib/               small helpers: dates, money, the request sender
|       `-- types/             the shapes of the data the backend sends
|
|-- docs/                      this guide and the technical guide
|-- render.yaml                how the backend is hosted
|-- README.md                  how to run the project
`-- CONTRIBUTING.md            coding rules
```

### Inside every backend app, the same five files

Once you understand one app, you understand them all:

| File             | Plain meaning                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `models.py`      | The shape of the data. Each class is one database table.                                          |
| `serializers.py` | The translator. Turns a database row into JSON for the browser, and checks data coming in.        |
| `views.py`       | The worker. Receives a request, checks who is asking and whether they may, does the job, answers. |
| `urls.py`        | The address book for this app: which address goes to which view.                                  |
| `admin.py`       | Makes the tables visible in Django's admin site.                                                  |

Some apps also have `filters.py` (the `?slot=TOP` style filters) and a
`management/commands/` folder (jobs run from the command line, such as the
price refresh).

### The pages of the website

| Address                | Menu name           | What it is                                                 | File                                         |
| ---------------------- | ------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `/`                    |                     | The public front page                                      | `src/app/page.tsx`                           |
| `/login`               |                     | Sign in                                                    | `src/app/(auth)/login/page.tsx`              |
| `/register`            |                     | Create an account                                          | `src/app/(auth)/register/page.tsx`           |
| `/dashboard`           | Home                | Greeting, weather, counts, recent things, forgotten things | `src/app/(app)/dashboard/page.tsx`           |
| `/closet`              | My Clothes          | The closet grid, search, tabs, sold and put away           | `src/app/(app)/closet/page.tsx`              |
| `/closet/add`          |                     | Add an item in four steps                                  | `src/app/(app)/closet/add/page.tsx`          |
| `/closet/42`           |                     | One item: details, actions, history                        | `src/app/(app)/closet/[id]/page.tsx`         |
| `/storage`             | Where Things Are    | The tree of rooms, wardrobes and drawers                   | `src/app/(app)/storage/page.tsx`             |
| `/plan`                | My Plans            | Calendar and day planner                                   | `src/app/(app)/plan/page.tsx`                |
| `/try-on`              | Try It On           | Body photo, pick a garment, pictures                       | `src/app/(app)/try-on/page.tsx`              |
| `/shop`                | Sales               | Clothes on sale in real shops                              | `src/app/(app)/shop/page.tsx`                |
| `/marketplace`         | Buy and Sell        | Things other users are selling                             | `src/app/(app)/marketplace/page.tsx`         |
| `/marketplace/selling` |                     | My listings and the requests I received and sent           | `src/app/(app)/marketplace/selling/page.tsx` |
| `/friends`             | Borrow from Friends | My code, requests, friends, loans                          | `src/app/(app)/friends/page.tsx`             |
| `/friends/9`           |                     | One friend's lendable clothes                              | `src/app/(app)/friends/[id]/page.tsx`        |
| `/profile`             | (top-right menu)    | My details                                                 | `src/app/(app)/profile/page.tsx`             |

The `(auth)` and `(app)` folder names in brackets do not appear in the web
address. They are groups: pages in `(app)` need a sign-in and share the menu
layout; pages in `(auth)` are public and share the sign-in layout with the
photo panel.

---

# PART 2: EVERY FEATURE, ONE BY ONE

Each feature below is described the same way: what it does, what happens
step by step behind the screen, the rules worth knowing, where the code is,
and what to say if a judge asks about it.

---

## 6. Accounts: signing up, signing in, my details

### What it does

- A person creates an account with their email, name, city and a password.
- They sign in with email and password.
- They stay signed in for up to 7 days without typing the password again.
- They can change their name, city and phone number on the "My details" page.
- They can choose which clothes to see first: women's, men's, children's or
  everything.

### The pages

- `/register` - "Create your closet": full name, email, city, who you shop
  for, password, confirm password. The country is set to Pakistan.
- `/login` - "Welcome back": email and password.
- `/profile` - "My details": name, email (cannot be changed), city, phone.

Both sign-in pages share a layout with a photograph of a wardrobe on one
side. The photo is a stock picture, not anybody's real clothes.

### Step by step: signing up

```
1. Sara fills the form and presses the button.
2. Browser sends  POST /api/auth/register/  with the form as JSON.
3. The RegisterSerializer checks:
     - the email is not already used (ignoring capital letters)
     - the two passwords match
     - the password passes Django's rules (8+ characters, not common,
       not all numbers, not too close to the email)
4. The password is hashed and the account is saved in the users table.
5. The backend answers with the account AND two tokens, so Sara is signed
   in at once without typing the password a second time.
6. The browser stores the tokens and opens the Home page.
```

### Step by step: signing in

```
1. Sara types her email and password.
2. Browser sends  POST /api/auth/login/.
3. The email is lower-cased first. Phone keyboards capitalise the first
   letter, and "Sara@..." must still match "sara@...".
4. Django checks the password against the stored hash.
5. Wrong password, or an email nobody has: the SAME message comes back.
   This stops the login box being used to find out which emails have
   accounts.
6. Right password: the backend answers with the account and two tokens.
```

A person may try to sign in at most 10 times a minute from one address.
After that they must wait. This makes guessing a password impossible.

### Step by step: staying signed in

```
1. Every request carries the access token (60 minutes).
2. When it runs out, the server answers 401.
3. The frontend notices, sends the refresh token to /api/auth/refresh/,
   gets a new pair, and repeats the original request. The person sees
   nothing.
4. The old refresh token goes on the blacklist and can never be used again.
5. If the refresh token has also run out (7 days), the person is sent to
   the sign-in page.
```

If many requests fail at the same moment (the usual case after an hour
away), the frontend refreshes only once and makes the others wait for it.
Otherwise each one would ask for its own new token and they would cancel
each other out.

### My details

The profile page saves name, city, phone and the "who do you shop for"
choice through `PATCH /api/auth/me/`. The city matters: it decides which
weather is shown. Saving the profile therefore also throws away the old
weather reading.

The phone number is explained right next to its box: it is shown to one
buyer or seller only, once a sale is agreed. It never appears anywhere else.

### Rules worth knowing

- Email is the login name. There is no username.
- A person can only ever read or change their _own_ account. The address
  `/api/auth/me/` always means "the signed-in person"; there is no way to
  ask for anybody else's.
- There is no password reset by email yet.

### Where the code is

| Part                                     | File                                        |
| ---------------------------------------- | ------------------------------------------- |
| The users table                          | `backend/apps/accounts/models.py`           |
| Sign-up and login checks                 | `backend/apps/accounts/serializers.py`      |
| The views (register, login, me, waiting) | `backend/apps/accounts/views.py`            |
| Addresses under `/api/auth/`             | `backend/apps/accounts/urls.py`             |
| Token lifetimes, rotation, blacklist     | `backend/config/settings.py` (`SIMPLE_JWT`) |
| Sign-up page                             | `frontend/src/app/(auth)/register/page.tsx` |
| Sign-in page                             | `frontend/src/app/(auth)/login/page.tsx`    |
| The photo panel beside both              | `frontend/src/app/(auth)/layout.tsx`        |
| My details page                          | `frontend/src/app/(app)/profile/page.tsx`   |
| Login, register, profile requests        | `frontend/src/hooks/use-auth.ts`            |
| Token storage in the browser             | `frontend/src/lib/tokens.ts`                |
| Attaching and refreshing the token       | `frontend/src/lib/api.ts`                   |
| Sending signed-out people to /login      | `frontend/src/app/(app)/layout.tsx`         |

| Address               | Method    | Does                                       |
| --------------------- | --------- | ------------------------------------------ |
| `/api/auth/register/` | POST      | Create an account, return tokens           |
| `/api/auth/login/`    | POST      | Check password, return tokens              |
| `/api/auth/refresh/`  | POST      | Trade a refresh token for a new pair       |
| `/api/auth/me/`       | GET/PATCH | Read or change my own details              |
| `/api/auth/waiting/`  | GET       | Counts for the red badges (see section 13) |

### If a judge asks

- _"How are passwords stored?"_ Hashed with PBKDF2 and a random salt. They
  cannot be read back, even by us.
- _"What if somebody steals the token?"_ The access token dies in an hour.
  The refresh token is replaced on every use and the old one blacklisted.
- _"Can somebody find out if my friend has an account?"_ No. Wrong password
  and unknown email give the same answer, and friends are added by code,
  never by searching an email.

---

## 7. My Clothes: the closet

This is the heart of the app. Everything else is built on it.

### What it does

- Add a piece of clothing, with or without a photo.
- When a photo is added, the background is cut away and the colour is found
  automatically.
- See all clothes in a grid, search them (even with spelling mistakes), and
  switch between tops, bottoms, full body, outerwear, footwear and
  accessories.
- Open one item to see everything about it and act on it: mark it worn, put
  it in the wash, favourite it, allow or refuse lending, put it away, change
  its details, delete it.
- Keep a wear log: every day each thing was worn, with a note such as
  "Ayesha's mehndi".
- See cost per wear: what the thing cost divided by how often it was worn.
- Put things away for the season, or see what has been sold, without losing
  their history.

### 7.1 Adding an item: the four steps

The add page (`/closet/add`) walks the person through four steps:

1. **What sort of thing is it?** Six big tiles: Tops, Bottoms, Full body,
   Outerwear, Footwear, Accessories (and Headwear). Each tile shows example
   names taken from the real categories.
2. **Which one exactly?** The categories in that group, such as Kurta,
   Shirt, T-Shirt, Polo, Sweater, Hoodie. A person can also add their own
   category.
3. **Take a photo** (optional). Pick a photo from the phone or take one.
   Within a couple of seconds the background disappears and a preview of the
   cutout appears, with the detected colour and its name.
   A photo can also be added or changed later, from the item's own page.
4. **The rest.** Name, brand, size, material, pattern, colour (already
   filled from the photo), seasons, occasions, warmth level, waterproof,
   price and date bought, where it is kept, notes, and whether friends may
   borrow it.

Nothing is saved until the final Save button. If the person leaves after
uploading a photo, the frontend tells the backend to throw the unused
pictures away, so they do not sit on Cloudinary costing money.

### 7.2 Step by step: what happens to a photo

This is the most technical flow in the app. Learn it well.

```
1. The browser sends the photo:  POST /api/wardrobe/upload/
   (as a file, the way a form with an attachment is sent)

2. read_upload() checks it:
     - a file was really sent
     - it is at most 12 MB
     - it is a JPG, PNG, WebP or HEIC
   Anything else answers with a clear sentence, such as
   "That image is 15 MB. The limit is 12 MB."

3. remove_background() in apps/vision/background.py:
     a. opens the picture (if it cannot, "That file is not a readable image")
     b. fixes the rotation. Phones store "this is rotated" as a hidden tag
        instead of turning the pixels, and the model only sees pixels.
        Without this step, shirts come out sideways.
     c. shrinks it so the longest side is at most 1600 pixels. Bigger only
        costs time for detail the small grid picture throws away.
     d. runs the U-2-Net model (through rembg). The model marks which pixels
        are the garment and which are background.
     e. makes the background transparent and trims the empty edges, so
        every garment fills its card the same way.
     f. works out the average colour of the solid pixels, ignoring very dark
        (shadow) and very bright (glare) ones, which would drag the average
        towards grey.
     g. measures how much of the frame the garment fills. Under 2% means
        almost nothing was found (a blurry photo, or a white top on a white
        sheet) and a warning is sent back.

4. name_for_hex() in apps/intelligence/colors.py turns the average colour
   into a word: the closest of 36 named colours such as Navy, Olive, Blush.
   The comparison is done in the Lab colour space, where distance matches
   what the eye sees. Plain red-green-blue numbers do not.

5. storage.upload_image() sends BOTH pictures to Cloudinary:
     - the original, under closette/garments/original/u<account id>/
     - the cutout, under closette/garments/clean/u<account id>/
   Both are kept. If the model got it wrong, the original is still there.
   Hidden phone data (GPS, camera) is stripped on the way.

6. The backend answers with the two web addresses, the two public ids, the
   detected colour and its name, the time it took, and the warning if any.

7. The browser shows the preview and fills the colour fields.

8. When the person presses Save, the browser sends the whole form, including
   the two public ids, to  POST /api/wardrobe/items/.

9. The GarmentItemSerializer checks the public ids start with this account's
   own folder (closette/garments/.../u<id>/). Nobody can attach another
   person's picture to their own item.

10. The item is saved. It appears in the closet.
```

The first upload after the server starts takes about 30 seconds, because
the 176 MB model is loaded (and, on a brand new machine, downloaded). Later
uploads take about one and a half seconds.

**On the live server this step cannot run.** The model needs about 1 GB of
memory and the free Render plan gives 512 MB. It works on a laptop. Items
can still be added without a photo on the live site. Say this plainly if
asked.

### 7.3 The closet grid

The closet page (`/closet`) shows:

- a heading with the counts: "12 items, 2 in the wash"
- a search box
- tabs: All, Tops, Bottoms, Full body, Outerwear, Footwear, Accessories
- a grid of item cards, 24 per page, newest first
- "Add an item"
- "Sold and put away", with a count, which only appears once something has
  been sold or put away

Each card shows the cutout picture, name, brand, colour, status, when it was
last worn, and quick buttons for "I wore this", the wash, and favourite.

**Search that forgives spelling mistakes.** Typing "snekers" would normally
find nothing. When the normal search finds nothing, the backend tries a
second time, comparing the typed word three letters at a time against the
name, brand, colour and category of every item (a Postgres feature called
trigram similarity). "snekers" still finds "Blue Sneakers". The page then
says these are the nearest spellings, not exact matches, so nobody thinks the
search is broken. The second attempt only runs when the first found nothing,
so a normal search costs almost nothing extra. Words shorter than three
letters are not tried: "j" alone would match both Jeans and Jacket.

### 7.4 The item page

Opening a card goes to `/closet/42`. The page shows the picture, every
detail, where it is kept, how many times it was worn, when it was last worn
and for what, and cost per wear. The actions:

| Button                                      | What happens                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| I wore this today                           | Writes one row in the wear log for today. Pressing twice counts once.         |
| To the wash / It is clean                   | Moves the status between In wardrobe and In the wash.                         |
| Save to favourites / Remove from favourites | Flips the favourite flag.                                                     |
| Allow lending / Do not lend this one        | Decides whether friends who can see the closet see this item at all.          |
| Put it away / Bring it back                 | Moves the status to Put away and back. Explained below.                       |
| Add a photo / Change photo (on the picture)  | Opens the edit form at its Photo section: choose a photo, replace it, or remove it.        |
| Change details                               | Opens the edit form: every detail, and the photo at the top. A replaced or removed photo is deleted from Cloudinary. |
| Delete                                      | Two presses. Deletes the item and both its pictures from Cloudinary.          |
| The wear history                            | Opens a list of every day it was worn, newest first, with the note for each.  |

### 7.5 The wear log and cost per wear

Every "I wore this" creates one row in `wear_events`: which garment, which
day, an optional note. The garment keeps two running totals, `wear_count`
and `last_worn_date`, so the grid can show them without counting rows for
every card.

Rules:

- **One wearing per garment per day.** A double tap is far more likely than
  truly wearing a shirt twice in one day, and every extra row would quietly
  halve the cost per wear. The database enforces this.
- **A past day can be recorded**: "I wore this on the 14th". A future day
  cannot: "That day has not happened yet."
- **A mistaken tap can be undone** with "unmark worn".
- **A note can be attached**: "Ayesha's mehndi". The grid shows the most
  recent note under the item.
- **Cost per wear** = price paid / times worn. Example: a 4,000 rupee kurta
  worn 8 times costs 500 per wear. Never worn, it shows the full price. No
  price recorded, it shows nothing rather than a made-up number.
- Something sold, put away or lent out **cannot be marked worn**. The
  answer is a sentence: "Blue Kurta is lent to a friend, so wearing it cannot
  be recorded."

### 7.6 Put away, and sold

A person has clothes they still own but do not want in the way: winter
coats in July. "Put it away" moves the item to the Put away status. It
leaves the closet grid, leaves every count, and stops appearing in planners
and lending lists. Its history stays. "Bring it back" reverses it.

Sold things (from Buy and Sell, section 11) are treated the same way, except they
cannot be brought back, because they belong to somebody else now.

Both are reached through the "Sold and put away" button on the closet page.
The button only appears when there is something to show, and the count on it
is live, so putting the last thing back takes the button away. Somebody who
has sold everything has an empty closet but still needs the way in, so the
button sits in the header next to "Add an item", not in the row of tabs that
an empty closet hides.

Behind the screen, the closet list leaves sold and put-away things out
unless asked for them by name (`?gone=true`). The counts do the same, so
"Things you own" never says somebody has more clothes than they really do.

### 7.7 Categories

Thirty-four built-in categories come with the app, created by a migration
(`apps/wardrobe/migrations/0002_seed_categories.py`). Each belongs to a
**slot**, which is where on the body it is worn:

| Slot      | Built-in categories                                 |
| --------- | --------------------------------------------------- |
| TOP       | T-Shirt, Shirt, Polo, Sweater, Hoodie, Kurta        |
| BOTTOM    | Jeans, Trousers, Chinos, Shorts, Skirt, Shalwar     |
| FULL_BODY | Dress, Suit, Shalwar Kameez                         |
| OUTERWEAR | Jacket, Blazer, Coat, Waistcoat                     |
| FOOTWEAR  | Sneakers, Formal Shoes, Sandals, Boots, Khussa      |
| ACCESSORY | Watch, Belt, Bag, Scarf, Sunglasses, Tie, Jewellery |
| HEADWEAR  | Cap, Hat                                            |
| OTHER     | Unstitched Fabric                                   |

Built-in categories belong to nobody and cannot be changed or deleted. A
person can add their own, such as "Lawn suits", which only they see. A
category still holding items cannot be deleted.

The slot is what the rest of the app reads. The planner, the try-on and the
shop prices all ask "is this a top or a bottom?", never "is this a kurta or
a shirt?".

### 7.8 What Home shows

The Home page (`/dashboard`) greets the person by name and shows:

- the weather card (section 9)
- four counts: things you own, in the wash, places you keep them, worn this
  week
- the four most recently added items
- "worn recently": the last few days of the wear log, grouped by day
- "forgotten": things not worn for 90 days, shown as a gentle reminder, not
  a warning

A brand new account sees "Start with one item" and a big "Add my first
item" button instead.

All the counts come from one address, `/api/wardrobe/items/stats/`, which
asks the database once and returns every number together.

### Where the code is

| Part                                                                     | File                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| The tables: categories, places, garments, wear events                    | `backend/apps/wardrobe/models.py`                           |
| The translators, including the picture ownership check                   | `backend/apps/wardrobe/serializers.py`                      |
| The views: list, item, stats, wear, wash, favourite, upload, discard     | `backend/apps/wardrobe/views.py`                            |
| Filters and the misspelling search                                       | `backend/apps/wardrobe/filters.py`                          |
| Photo checks (size, type)                                                | `backend/apps/vision/uploads.py`                            |
| Background removal and colour average                                    | `backend/apps/vision/background.py`                         |
| Talking to Cloudinary                                                    | `backend/apps/vision/storage.py`                            |
| Colour naming                                                            | `backend/apps/intelligence/colors.py`                       |
| Built-in categories                                                      | `backend/apps/wardrobe/migrations/0002_seed_categories.py`  |
| Cleaning up pictures nothing points at                                   | `backend/apps/wardrobe/management/commands/prune_images.py` |
| Closet grid page                                                         | `frontend/src/app/(app)/closet/page.tsx`                    |
| Add item page (four steps)                                               | `frontend/src/app/(app)/closet/add/page.tsx`                |
| Item page                                                                | `frontend/src/app/(app)/closet/[id]/page.tsx`               |
| Item card, photo field, photo guide, wear history, sold list, forgotten, recent wears | `frontend/src/components/wardrobe/`                         |
| Home page                                                                | `frontend/src/app/(app)/dashboard/page.tsx`                 |
| All closet requests                                                      | `frontend/src/hooks/use-wardrobe.ts`                        |
| Words for "worn 3 days ago"                                              | `frontend/src/lib/wear.ts`, `frontend/src/lib/dates.ts`     |
| Prices as "Rs 4,000"                                                     | `frontend/src/lib/money.ts`                                 |

| Address                                   | Method           | Does                                             |
| ----------------------------------------- | ---------------- | ------------------------------------------------ |
| `/api/wardrobe/items/`                    | GET/POST         | List (with filters and search) or add a garment  |
| `/api/wardrobe/items/42/`                 | GET/PATCH/DELETE | One garment                                      |
| `/api/wardrobe/items/42/mark-worn/`       | POST             | Record a wearing (today, or a given date)        |
| `/api/wardrobe/items/42/unmark-worn/`     | POST             | Undo a wearing                                   |
| `/api/wardrobe/items/42/wears/`           | GET              | Every day it was worn                            |
| `/api/wardrobe/items/42/toggle-laundry/`  | POST             | In or out of the wash                            |
| `/api/wardrobe/items/42/toggle-favorite/` | POST             | Favourite on or off                              |
| `/api/wardrobe/items/stats/`              | GET              | All the counts for Home                          |
| `/api/wardrobe/items/bulk-move/`          | POST             | Move many items into one place (API only so far) |
| `/api/wardrobe/upload/`                   | POST             | Photo in, cutout and colour out                  |
| `/api/wardrobe/upload/discard/`           | POST             | Throw away pictures that never became an item    |
| `/api/wardrobe/categories/`               | GET/POST         | Built-in and own categories                      |
| `/api/wardrobe/wears/`                    | GET              | The wear log across the whole closet             |

### If a judge asks

- _"Why keep both the original and the cutout?"_ If the model gets it wrong,
  the original is still there. The cutout is what the grid shows.
- _"Why does pressing 'I wore this' twice count once?"_ A double tap is more
  likely than a real second wearing, and each extra row would halve the cost
  per wear. The database refuses the second row.
- _"What is cost per wear for?"_ It answers "was this worth buying?" A 4,000
  rupee kurta worn once cost 4,000 a wear. Worn forty times, 100 a wear.
- _"Why is 'put away' not just delete?"_ The history (what was worn when,
  what was paid) has value. Deleting would make holes in it.

---

## 8. Where Things Are: storage places

### What it does

Lets a person describe the real places they keep clothes, as a tree:

```
Bedroom                         (a room)
`-- Main Wardrobe               (a wardrobe)
    |-- Drawer 2                (a drawer)
    `-- Top shelf               (a shelf)
Guest room
`-- Suitcase                    (a suitcase)
```

Every garment can then be given a place, and the item page shows the full
path: "Bedroom > Main Wardrobe > Drawer 2". The question "where is my blue
shirt?" is answered.

### The page

`/storage` ("Where Things Are") shows the tree with the number of items in
each place. From there a person can add a place ("What is it called?",
what kind it is, where it is inside), rename it, move it inside another
place, or remove it.

When a place is created from inside the item form, the kind is guessed
from the name: "Drawer 2" becomes a drawer, "Suitcase" a suitcase. Without
the guess, every quickly added place would land in the tree as "Other".

### Rules worth knowing

- **Four levels at most**: Room > Wardrobe > Drawer > Box. The check counts
  what is already inside the thing being moved. Moving a wardrobe full of
  drawers into a cabinet pushes the drawers one level deeper, so the drawers
  are counted too. The picker greys out places with no room instead of
  letting a form be filled in and then refused.
- **No loops.** A place cannot be put inside itself or inside something that
  is inside it.
- **Names are unique inside the same parent.** Two wardrobes may each have a
  "Drawer 2"; one wardrobe cannot. The message says where the clash is:
  "There is already a Drawer 2 in Bedroom > Main Wardrobe."
- **Deleting a place deletes the places inside it.** The clothes survive;
  they simply have no recorded place any more. The confirmation says exactly
  what will go: "The 3 places inside it go as well. 12 items will be left
  without a place."
- **Item counts leave out sold and put-away things**, the same as everywhere
  else.
- A person can only use their own places. Trying to put a garment in another
  person's drawer answers "That storage location belongs to another account."

### Where the code is

| Part                                   | File                                                        |
| -------------------------------------- | ----------------------------------------------------------- |
| The table and the depth and loop rules | `backend/apps/wardrobe/models.py` (`StorageLocation`)       |
| The friendly duplicate-name check      | `backend/apps/wardrobe/serializers.py`                      |
| The views, including the nested tree   | `backend/apps/wardrobe/views.py` (`StorageLocationViewSet`) |
| The page                               | `frontend/src/app/(app)/storage/page.tsx`                   |
| The place picker used in forms         | `frontend/src/components/form/place-field.tsx`              |
| Guessing the kind from the name        | `frontend/src/lib/storage-kind.ts`                          |
| Counting what a delete would remove    | `frontend/src/lib/storage-tree.ts`                          |

| Address                          | Method       | Does                                         |
| -------------------------------- | ------------ | -------------------------------------------- |
| `/api/wardrobe/storage/`         | GET/POST     | List places, or add one                      |
| `/api/wardrobe/storage/7/`       | PATCH/DELETE | Rename, move or remove one                   |
| `/api/wardrobe/storage/tree/`    | GET          | The whole tree, nested, with item counts     |
| `/api/wardrobe/storage/7/items/` | GET          | Items in this place and everything inside it |

### If a judge asks

- _"Why a limit of four levels?"_ Real closets are shallow, and every path
  lookup walks the tree. A cap keeps it fast and the screen readable.
- _"Why can two rooms not share a name?"_ Postgres treats two empty parents
  as different values, so a second rule was needed just for top-level places.
  Without it nothing stopped two "Bedroom" rows.

---

## 9. My Plans: weather and the day planner

### What it does

- Shows today's weather for the person's city, with advice on what to wear.
- Lets the person plan which clothes to wear on any day, on a calendar.
- When the day has passed, one press confirms "I wore this", and every item
  in the plan is written into the wear log at once.

### 9.1 The weather card

The card appears on Home and on My Plans. It shows the city, temperature,
how it feels, today's high and low, humidity, wind, rain chance, and a
headline with a sentence of advice:

| Feels like     | Headline | Advice                                                 |
| -------------- | -------- | ------------------------------------------------------ |
| under 8 C      | Cold     | Something heavy, and a layer underneath.               |
| 8 to 16 C      | Chilly   | A jacket or a shawl over what you are wearing.         |
| 16 to 23 C     | Mild     | Light layers. Easy to take one off if it warms up.     |
| 23 to 31 C     | Warm     | Light clothes are enough.                              |
| 31 C and above | Very hot | The lightest and loosest you own. Stay out of the sun. |

If rain is forecast (40% or more, or it is already raining), the advice adds
"Rain is likely, so take something that keeps water out."

The bands use "feels like", not the thermometer. Thirty degrees in still,
humid air is dressed for differently from thirty in a breeze.

### Step by step: where the weather comes from

```
1. The page asks  GET /api/planner/today/.
2. The backend looks at the city and country on the account.
   No city saved -> answers with a reason: "Tell us your city and the
   weather can be shown here." The card then shows a box to type it in.
3. The backend checks its memory (cache). If this city was looked up in
   the last 30 minutes, the saved answer is returned at once.
4. Otherwise it asks OpenWeather twice: current weather, and the next
   eight 3-hour forecast steps (24 hours) for the high, low and rain chance.
5. It turns the numbers into the advice above.
6. It saves the answer for 30 minutes and returns it.
```

A failed lookup (unknown city, service down, no key) is still a successful
answer with a reason inside it, never an error. The Home page draws around
the gap, and a red error for "no city saved yet" would alarm people for
nothing.

### 9.2 Planning a day

`/plan` ("Plan your days") shows a month grid. Days with a plan are marked.
Tapping a day opens it: a label ("Ayesha's mehndi", "Job interview"), a
note, and "Pick what you will wear", which opens a picker of the closet as
tappable pictures. Up to 12 items per day.

### Step by step: saving and confirming a plan

```
1. Ali picks Friday, writes "Wedding", picks the kurta and the trousers.
2. Browser sends  POST /api/planner/outfits/  with the date, label and
   the item ids.
3. The serializer checks:
     - every item is Ali's own
     - none of them is sold or put away ("Blue Kurta is not in your closet
       any more, so it cannot be planned")
     - no item is listed twice
     - Ali has no other plan for that day ("You already have a plan for
       that day. Open it and change it instead.")
     - the day is not more than a year in the past
4. The plan is saved. The calendar marks Friday.

   ...Friday passes...

5. Ali opens Friday and presses "I wore this".
6. Browser sends  POST /api/planner/outfits/15/wore-it/.
7. The backend refuses if the day has not happened yet.
8. confirm_worn() writes one wear event per item for that date, with the
   plan's label as the note. Anything sold or put away between planning
   and confirming is skipped, so nobody is recorded wearing something they
   no longer have.
9. The plan is marked confirmed, with the time. The calendar shows it as
   worn, not just planned.
```

### Rules worth knowing

- **One plan per day.** A calendar square that could hold two different
  answers would have to explain which one it shows.
- **Confirming twice adds nothing**, because a wearing is counted once per
  item per day.
- **The planner never shows sold or put-away clothes** in the picker.

### Where the code is

| Part                                            | File                                       |
| ----------------------------------------------- | ------------------------------------------ |
| The plan table and confirm_worn()               | `backend/apps/planner/models.py`           |
| The checks on a plan                            | `backend/apps/planner/serializers.py`      |
| Today's weather and the plan views              | `backend/apps/planner/views.py`            |
| Talking to OpenWeather, the bands               | `backend/apps/planner/weather.py`          |
| Cache time and timeout settings                 | `backend/config/settings.py` (`WEATHER_*`) |
| The plan page                                   | `frontend/src/app/(app)/plan/page.tsx`     |
| Weather card, month grid, day plan, item picker | `frontend/src/components/planner/`         |
| Plan and weather requests                       | `frontend/src/hooks/use-planner.ts`        |

| Address                            | Method       | Does                                      |
| ---------------------------------- | ------------ | ----------------------------------------- |
| `/api/planner/today/`              | GET          | Weather and advice for my city            |
| `/api/planner/outfits/`            | GET/POST     | My plans, or make one                     |
| `/api/planner/outfits/15/`         | PATCH/DELETE | Change or remove a plan                   |
| `/api/planner/outfits/calendar/`   | GET          | Which days in a range have a plan         |
| `/api/planner/outfits/15/wore-it/` | POST         | Confirm it was worn, fill in the wear log |

### If a judge asks

- _"Why cache the weather?"_ The free plan allows 60 requests a minute and
  every Home visit would spend one. Weather does not change in 30 minutes.
- _"What if the weather service is down?"_ The card says so in a sentence and
  the rest of the page works. Nothing else depends on it.

---

## 10. Sales: clothes on sale in real shops

### What it does

Shows what is on sale right now in eight real Pakistani clothing shops,
with the price, the old price, the percentage off, the sizes still in
stock, and a link to the shop's own page. A person can filter by who it is
for, what it is, colour, size, shop and price, and see how the price of one
product has moved over time.

### How the prices get into the app

Nothing is fetched from a shop while a person is waiting for a page. A job
runs twice a day, reads every shop, and writes what it found into our own
tables. The page only reads our tables. So the page is fast, a shop being
down breaks nothing, and every price carries the moment it was really
checked.

```
   06:00 and 18:00 Pakistan time, on Render's timer:

   python manage.py sync_deals --quiet

   for each of the 8 shops:
     1. read the shop's /products.json, page by page (250 products a page),
        waiting between pages if the shop asks for a gap
     2. for each product:
          a. is it clothing at all? Bedsheets, perfume, makeup, gift cards
             and underwear are dropped, not filed under "other".
          b. is it cloth sold by the metre? Then it is "Unstitched Fabric".
          c. where is it worn? Match the shop's own words against a list of
             phrases, longest first ("formal shoes" before "shoes",
             "t-shirt" before "shirt").
          d. what colour? Match colour words in the title (navy, olive,
             "sea green" -> Emerald).
          e. who is it for? Read the shop's tags for women / men / kids.
             Children first ("Girls Junior" is the children's half of a shop
             that also sells to adults). Nothing stated -> "Not stated",
             shown only under Everyone.
          f. which size is cheapest and in stock? That is the price shown.
          g. is it really a sale? The "was" price must be higher than the
             price, or it is not a sale and is not shown as one.
     3. compare with what we already had:
          new product      -> add a row
          price changed    -> update the row and write ONE price-change row
          price fell       -> also remember when it fell ("just dropped")
          no longer listed -> mark the row delisted, keep it for history
     4. record the result for this shop (success or the reason it failed)
```

A full run reads about 7,500 products in under two minutes. One shop
failing is an ordinary day: its old prices stay, with their old timestamp,
and the page says how old they are. Every shop failing makes the run report
a failure the scheduler can see.

### The page

`/shop` ("Sales") shows:

- a **freshness bar**: "Prices checked 2 hours ago", or a warning when they
  are older than 24 hours ("...and may have moved since")
- tabs: **Everyone, Women, Men, Kids**, each with a count
- a search box
- quick choices: Half price or better, Under Rs 2,000, In stock only
- a filter panel: only reduced things, price dropped this week, how big a
  cut, where it is worn, kind, colour, size, shop, price range, leave out
  sold-out things
- sort: biggest saving, cheapest first, dearest first, price dropped most
  recently, newly added
- a grid of deal cards: picture, title, shop, price, old price, % off, sizes
  (with "+3 more"), a "just dropped" mark when the price fell in the last 7
  days, and a link that opens the shop's page in a new tab
- a **price history** for each product: every price it has been seen at,
  with dates

The page opens on the tab matching what the person said they shop for. The
counts on the tabs come from the shops' own labelling, so a tab that would be
empty says so before it is tapped.

### Rules worth knowing

- **The filter choices are counted** against everything listed, so a choice
  never disappears just because another one is switched on.
- **Switching tab drops the narrower filters** (size, colour). A size that
  exists in menswear may not exist in the children's range, and a page that
  goes empty on a tap looks broken.
- **A price change is only written when the price really changes.** Writing
  one on every refresh would bury the few real changes under thousands of
  identical rows, and "it has not changed in a month" is worth being able to
  say.
- **Sizes are kept as the shop spells them** ("M", "Medium"), and both
  spellings are tried when filtering.
- The classification was measured at about **90% accurate**. An early
  version checked whether the word "fabric" appeared anywhere, which wrongly
  rejected clothes whose tags mentioned fabric. Matching whole words fixed it
  (from 48.5% to 89.8%).

### Where the code is

| Part                                                        | File                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| The tables: shops, deals, price changes, sync runs          | `backend/apps/shopping/models.py`                         |
| Reading a shop's catalogue                                  | `backend/apps/shopping/feeds.py`                          |
| Working out what a product is                               | `backend/apps/shopping/classify.py`                       |
| Comparing new with old and saving                           | `backend/apps/shopping/sync.py`                           |
| The command the timer runs                                  | `backend/apps/shopping/management/commands/sync_deals.py` |
| The list of eight shops                                     | `backend/apps/shopping/management/commands/seed_shops.py` |
| Filters                                                     | `backend/apps/shopping/filters.py`                        |
| The views: deals, price history, freshness, filter counts   | `backend/apps/shopping/views.py`                          |
| The timer schedule                                          | `render.yaml` (`closette-prices`)                         |
| The page                                                    | `frontend/src/app/(app)/shop/page.tsx`                    |
| Tabs, freshness bar, filter panel, deal card, price history | `frontend/src/components/shop/`                           |
| Requests                                                    | `frontend/src/hooks/use-shopping.ts`                      |

| Address                                 | Method | Does                                           |
| --------------------------------------- | ------ | ---------------------------------------------- |
| `/api/shopping/deals/`                  | GET    | Products on sale, filtered, sorted, searched   |
| `/api/shopping/deals/88/price-history/` | GET    | Every price one product was seen at            |
| `/api/shopping/freshness/`              | GET    | How old the prices are, and which shops worked |
| `/api/shopping/filters/`                | GET    | Every filter choice with its count             |

### If a judge asks

- _"Is this scraping?"_ No. Each shop publishes its catalogue as a data file
  for exactly this use. We read it twice a day and honour each shop's rules
  and requested delays.
- _"Why not fetch live prices when the page opens?"_ Eight shops, 7,500
  products, two minutes. Nobody waits two minutes for a page. And a shop
  being down would break the page.
- _"How accurate is the classification?"_ About 90%, measured. Unclear
  products show under Everyone rather than in a wrong tab.

---

## 11. Buy and Sell: the marketplace

### What it does

Lets a person sell clothes from their closet to other users of the app, and
buy from them. The app introduces the two people; the money and the handover
happen between them, in person.

### The pages

- `/marketplace` ("Buy and Sell"): what other people are selling. Tabs for
  Everyone, Women, Men, Kids; a search box ("Try: kurta"); filters for city,
  near me, size and highest price; sort by newest, cheapest, dearest. Each card shows the garment photo, name, brand,
  size, condition, price, seller's name and city, and an "Ask to buy" button.
- `/marketplace/selling` ("My selling and requests"): my listings, the
  requests people sent me, and the requests I sent.

### Step by step: a complete sale

```
Ali sells his trousers to Sara.

1. Ali presses "Sell something" and picks the trousers. Only things in his
   wardrobe are offered: nothing sold, put away, lent out or already listed.

2. He picks how worn they are: New with tags / Worn once or twice / Good /
   Well worn. The app suggests a price from what he paid:
        New with tags  80%     Worn once or twice  55%
        Good           40%     Well worn           25%
   Example: paid 2,500, "Good" -> suggested 1,000. He can type any price.
   No purchase price saved -> no suggestion, and the box says so honestly.

3. He picks who it would suit (starts from what he usually shops for) and
   may write a note. A phone number, email or "WhatsApp me" in the note is
   refused: "Leave your phone number out of this. It is shared automatically
   with a buyer once you accept them."

4. POST /api/market/my-listings/  saves the listing. The trousers' status
   becomes Listed for sale. Ali can still wear them.

5. Sara browses. She sees the trousers: photo, name, brand, size, condition,
   price, "Ali" and his city. She does NOT see what he paid, how often he
   wore them, or which drawer they live in. The backend never sends those
   to a buyer; a separate translator describes the garment with only what a
   buyer needs.

6. Sara presses "Ask to buy" and writes "Is it still available?".
   POST /api/market/listings/31/enquire/  saves the request. One request
   per person per listing. Her card now says "Asked" instead of offering
   the button again.

7. Ali's menu badge shows 1. On "My selling and requests" he sees Sara's
   request, with her name and city only.

8. Ali presses Accept.  POST /api/market/enquiries-received/12/accept/
   The listing becomes Held for a buyer and stops taking new requests.
   Now, and only now, both of them see each other's contact details: name,
   city, email and phone. Nobody else ever sees them.

9. They meet and exchange the trousers and the money, outside the app.

10. Ali presses Sold.  POST /api/market/my-listings/31/sold/
    The listing is marked Sold. The trousers' status becomes Sold: they
    leave Ali's closet grid and every count. Any other waiting requests on
    the listing are closed.
```

Other paths:

- **Decline** a request: the listing goes back to For sale, unless somebody
  else has already been accepted.
- **Take it down** (withdraw a listing): the garment goes back to In
  wardrobe as if nothing happened.
- **Change my mind** as a buyer: the request is deleted, not marked, so the
  same person can ask again another day.
- **Block** a person: hides listings in both directions and refuses
  requests both ways. A one-way block would leave the blocked person still
  able to appear in the blocker's app.
- **Report** a listing: records the complaint (not clothing, fake, offensive,
  moving the deal off the app, other) for an administrator to read in the
  admin site. Nothing is hidden automatically; a report that took a listing
  down by itself would be a way to silence anybody.

### Rules worth knowing

- **No money passes through the app.** That keeps card details and payment
  law out of the project entirely.
- **Contact details are shared by the app, not typed into notes.** The
  pattern check is what makes the privacy rule real.
- **One open listing per garment**, enforced by the database.
- **The city is copied** from the seller's profile when the listing is made
  (and can be changed). Copied rather than read live, so moving city later
  does not silently move every old listing.
- A listing that is sold or taken down stays as a row for the seller's
  history.

### Where the code is

| Part                                                                             | File                                                  |
| -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| The tables, the resale percentages, the contact-detail check                     | `backend/apps/community/models.py`                    |
| The buyer's view of a garment, the contact block                                 | `backend/apps/community/serializers.py`               |
| Browse, my listings, requests both ways, blocks, price suggestion, stats         | `backend/apps/community/views.py`                     |
| Filters                                                                          | `backend/apps/community/filters.py`                   |
| Reports in the admin site                                                        | `backend/apps/community/admin.py`                     |
| Browse page                                                                      | `frontend/src/app/(app)/marketplace/page.tsx`         |
| My selling and requests page                                                     | `frontend/src/app/(app)/marketplace/selling/page.tsx` |
| Listing card, sell dialog, ask dialog, request card, report dialog, audience row | `frontend/src/components/market/`                     |
| Requests                                                                         | `frontend/src/hooks/use-market.ts`                    |

| Address                                               | Method          | Does                                            |
| ----------------------------------------------------- | --------------- | ----------------------------------------------- |
| `/api/market/listings/`                               | GET             | What others are selling (not mine, not blocked) |
| `/api/market/listings/31/enquire/`                    | POST            | Ask to buy                                      |
| `/api/market/listings/31/report/`                     | POST            | Report it                                       |
| `/api/market/my-listings/`                            | GET/POST        | My listings, or sell something                  |
| `/api/market/my-listings/31/sold/`                    | POST            | Mark sold                                       |
| `/api/market/my-listings/31/withdraw/`                | POST            | Take it down, keep the garment                  |
| `/api/market/my-listings/31/enquiries/`               | GET             | Requests on this listing                        |
| `/api/market/enquiries-received/`                     | GET             | Every request people sent me                    |
| `/api/market/enquiries-received/12/accept/`           | POST            | Say yes; shares contact details both ways       |
| `/api/market/enquiries-received/12/decline/`          | POST            | Say no                                          |
| `/api/market/my-enquiries/`                           | GET             | Requests I sent                                 |
| `/api/market/my-enquiries/12/withdraw/`               | POST            | Change my mind                                  |
| `/api/market/blocks/`                                 | GET/POST/DELETE | Block and unblock                               |
| `/api/market/price-suggestion/?item=5&condition=GOOD` | GET             | What a garment might fetch                      |
| `/api/market/stats/`                                  | GET             | Numbers for the page heading                    |

### If a judge asks

- _"How do you handle payment?"_ We do not. Buyer and seller settle in
  person. That is a deliberate scope decision.
- _"How do you protect the seller's privacy?"_ A buyer sees only the garment
  and the seller's first name and city. Contact details appear only after
  the seller accepts that buyer, and only to those two.
- _"Where do the price suggestions come from?"_ Percentages that resale
  sites and their sellers commonly use, applied to what the person paid. It
  is a starting point; the seller types whatever they like.

---

## 12. Borrow from Friends

### What it does

Lets friends lend clothes to each other inside the app: see what a friend is
willing to lend, ask for it with dates, and keep track of what is out and
when it is due back.

### Why friends are added by a code, not by a name

A judge will ask this. The reasoning:

- A **name search** cannot tell a real person from somebody using their
  name. Five results all saying "Ali Khan" and no way to know which is your
  friend.
- An **email search** would let anybody with an address check whether that
  person has an account here. That is a privacy leak.
- A **code** can only be used by somebody you handed it to, in person or by
  message, and it can be replaced at any time if it leaks.

The code is 8 characters from an alphabet with no 0 or O and no 1, I or L,
because codes get read out over the phone and those are the characters
people mix up. Example: `K7MNP3QX`. There are about 850 billion possible
codes.

### The problem of two friends with the same name

The app never confuses two people internally, because each is a different
account. But a person would. So:

1. When Sara accepts Ali's request, she is asked **what to call him**. The
   nickname is hers alone; Ali never sees it. If she already has a friend
   called "Ali Khan", the app says so and asks for another name, such as
   "Ali Khan (uni)".
2. The database refuses two friends with the same nickname for one person.
3. If she types nothing, the app picks his name, or his name plus his city
   if that is taken ("Ali Khan (Lahore)"), or his name with a number.
4. The circle with his initials gets its colour from his account id, not his
   name, so two "Ali Khan" rows never even look alike.

### The page

`/friends` ("Borrow from Friends") shows:

- **Your code**, with a copy button and "new code", and the switch "Let my
  friends see what I can lend" (off for every new account)
- **Add a friend**: type the code a friend gave you
- **Requests**: people who asked to be your friend, with Accept (and the
  nickname box) and Decline
- **Your friends**: nickname, their name and city, whether they have opened
  their closet, how many things you could borrow; rename, block, remove
- **Asks waiting for you**, **Lent out**, **Borrowed**: the loans from both
  sides, with Agree / Decline / Returned / Cancel, and an overdue mark

Opening a friend goes to `/friends/9`: their lendable clothes with a picture,
name, brand, size and whether each is free, in the wash or lent out just now.
Each has "Ask to borrow".

### Step by step: becoming friends

```
1. Ali opens Borrow from Friends. His code appears (it is made the first
   time anybody looks at it).
2. He tells Sara his code.
3. Sara presses "Add a friend" and types it. Capital letters, spaces and
   dashes do not matter.
   POST /api/friends/requests/by-code/
4. The backend finds the account with that code. A code nobody has, her own
   code, somebody already her friend, or a request already waiting all
   answer with a sentence. "That code does not belong to anybody" is the
   same whatever was wrong, so the box cannot be used to try codes until one
   lands. At most 20 tries an hour.
5. A friend request is saved. Ali's menu badge shows 1.
6. Ali presses Accept and types "Sara from uni".
   POST /api/friends/requests/4/accept/
7. Two friend rows are written at once: Ali -> Sara called "Sara from uni",
   and Sara -> Ali called "Ali Khan" (chosen automatically on her side, with
   the city added if "Ali Khan" was already taken in her list).
8. Both now see each other under Your friends.
```

If Ali asks Sara and Sara then types Ali's code, there is already a request
waiting from Ali. That one is used instead of opening a second request going
the other way.

### Step by step: borrowing

```
1. Ali switches on "Let my friends see what I can lend". Until then,
   friends see nothing of his, and the switch is off for every new account.
2. On his coat's page he presses "Do not lend this one". Friends will never
   see the coat even though the closet is shared.
3. Sara opens Ali's closet.  GET /api/friends/9/closet/
   She sees only: things in his wardrobe or in the wash, marked lendable.
   Not the coat. Not anything sold, put away or already lent. She sees
   name, brand, size, colour and picture. Never price, wear count or drawer.
4. She presses "Ask to borrow" on the kurta: the day she wants it, the day
   she will give it back (at most 90 days), and a message if she likes.
   POST /api/friends/loans/ask/42/
   The backend checks everything again, not trusting the list on her
   screen, which may be minutes old: still friends, not blocked either way,
   closet still shared, item still lendable and free, no other open loan.
5. Ali's badge shows 1. He presses Agree.  POST /api/friends/loans/7/agree/
   The kurta's status becomes Lent to a friend. It stays in Ali's counts
   (it is still his) but cannot be worn, washed, planned or sold.
6. Sara wears it to the wedding.
7. Ali presses Returned.  POST /api/friends/loans/7/returned/
   The kurta is back In wardrobe.
```

If the return day passes, the loan shows as **overdue** on both sides, with
the number of days late. Overdue loans are counted but kept out of the badge
total, because nobody is waiting for an answer on them.

### Rules worth knowing

- **Sharing is off until switched on.** A new account shares nothing with
  anybody by accident.
- **One open loan per garment**, enforced by the database.
- **Blocking a friend** hides everything both ways but keeps the record of
  who has what. A blocked person and a person who never opened their closet
  get the same message, so a block cannot be told apart from privacy.
- **Removing a friend removes both rows.** Leaving theirs behind would show
  them a friend who cannot see them, which looks like a bug.
- **A cancelled request is deleted**, not kept, so asking again later is
  possible.
- **Contact details are refused** in borrow messages too.
- The garment never changes owner in the database. Only its status moves.

### Where the code is

| Part                                                                       | File                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| The friend code and the sharing switch                                     | `backend/apps/accounts/models.py`              |
| The tables: friend requests, friends, loans                                | `backend/apps/circle/models.py`                |
| Asking by code, nickname checks, what a friend may see                     | `backend/apps/circle/serializers.py`           |
| Accepting, naming, lending, returning, stats                               | `backend/apps/circle/views.py`                 |
| The page                                                                   | `frontend/src/app/(app)/friends/page.tsx`      |
| One friend's closet                                                        | `frontend/src/app/(app)/friends/[id]/page.tsx` |
| Add-friend dialog, request card, borrow dialog, loan card, initials circle | `frontend/src/components/friends/`             |
| Requests                                                                   | `frontend/src/hooks/use-friends.ts`            |

| Address                            | Method       | Does                                 |
| ---------------------------------- | ------------ | ------------------------------------ |
| `/api/friends/my-code/`            | GET/POST     | My code; POST makes a new one        |
| `/api/friends/requests/by-code/`   | POST         | Ask somebody by their code           |
| `/api/friends/requests/`           | GET          | People who asked me                  |
| `/api/friends/requests/4/accept/`  | POST         | Say yes and choose a nickname        |
| `/api/friends/requests/4/decline/` | POST         | Say no                               |
| `/api/friends/`                    | GET          | My friends                           |
| `/api/friends/9/`                  | PATCH/DELETE | Rename or block; remove both ways    |
| `/api/friends/9/closet/`           | GET          | What this friend is lending          |
| `/api/friends/loans/`              | GET          | Everything lent, borrowed or waiting |
| `/api/friends/loans/ask/42/`       | POST         | Ask to borrow garment 42             |
| `/api/friends/loans/7/agree/`      | POST         | Yes (lender only)                    |
| `/api/friends/loans/7/decline/`    | POST         | No (lender only)                     |
| `/api/friends/loans/7/returned/`   | POST         | It came back (lender only)           |
| `/api/friends/loans/7/cancel/`     | POST         | Take back my request (borrower only) |
| `/api/friends/stats/`              | GET          | The numbers the page opens with      |

### If a judge asks

- _"Why not search friends by name?"_ See the three reasons above. Say them
  in order: fake names, email privacy, replaceable codes.
- _"What if two friends have the same name?"_ Private nicknames, a database
  rule, and a colour from the account id.
- _"Can a friend see what I paid?"_ No. A separate translator describes a
  garment to a friend with name, brand, size, colour and picture only.

---

## 13. Notifications: the red badges

### What it does

Small red numbers in the menu show how many things are waiting for an
answer: friend requests, requests to borrow my things, and requests to buy
my things.

### How it works

There is no messaging system and no extra server. One small address,
`GET /api/auth/waiting/`, returns five numbers:

```
{ "friend_requests": 1, "borrow_asks": 0, "buy_requests": 2,
  "overdue": 0, "total": 3 }
```

The frontend asks for it **every minute while a page is open**, and again
whenever the tab comes back into focus. It is the only request in the app
that repeats by itself. It returns counts only, no names and no items,
because it runs for everybody who is signed in and almost always answers
zero, so anything bigger would be wasted work.

The backend answers with two database questions, not five: the loans table
is asked once and gives both of its counts in the same answer.

Overdue loans are reported but kept out of the total, because nobody is
waiting for an answer on them.

### Where the code is

| Part                | File                                                           |
| ------------------- | -------------------------------------------------------------- |
| The counts          | `backend/apps/accounts/views.py` (`WaitingView`)               |
| Asking every minute | `frontend/src/hooks/use-friends.ts` (`useWaiting`)             |
| Drawing the badges  | `frontend/src/components/layout/sidebar.tsx`, `mobile-nav.tsx` |

### If a judge asks

- _"Why not real push notifications?"_ They need a service and permissions
  the project has not taken on yet. Polling once a minute is simple, costs
  almost nothing, and is enough while the app is open. Push or email is a
  next step.

---

## 14. Try It On: virtual try-on

### What it does

Makes a picture of the person wearing a garment, without them putting it
on. The garment can be one from their closet, or a photo they upload just
for this.

### The page

`/try-on` ("Try It On") shows, from the top:

1. A line saying whether Try-On is switched on and how many pictures are
   left today ("7 of 10 left today").
2. **Add a photo of yourself**: guidance (a full-length, front-facing photo,
   plain background, fitted clothes), a "Before you add it" explanation of
   where the photo goes, a consent tick box, and the file picker. Once a
   photo is saved it is shown here, with a two-step delete.
3. **Pick something to try**: the closet garments that have a photo and can
   be drawn (tops, bottoms, outerwear, full outfits; not shoes, bags or
   watches). Tap one to start.
4. **Upload a photo instead**: for a garment that is not in the closet. It
   asks which part of the body it covers (Top half / Bottom half / Full
   outfit) and whether to keep it in the closet under a name.
5. **Your pictures**: every picture made, newest first. A waiting one shows
   "Drawing it on you. This takes two to four minutes." A finished one shows
   the picture with Save and Delete. A failed one shows the reason in plain
   words.
6. A note: "These pictures are a guide to how something looks, not how it
   fits."

### Step by step: the body photo

```
1. Ali reads the explanation, ticks the consent box, picks a photo.
2. POST /api/try-on/body-photo/  with the photo and consent=true.
3. Without the tick: "Tick the box to say the photo may be sent away to be
   processed." Nothing is saved.
4. The photo is checked like any other (12 MB, real image) and sent to
   Cloudinary under closette/users/body/u<id>/body. A fixed name means one
   photo per account: a new upload replaces the old one.
5. The account records the photo's address, its id, and the exact time of
   consent.
```

Deleting the photo (two presses, and the screen says what will happen)
deletes every try-on picture made from it, all in one database step, then
removes the files from Cloudinary, and clears the consent time. Clearing it
is what takes the permission back.

### Step by step: making a picture

```
1. Ali taps his blue kurta.
   POST /api/try-on/  with { "item": 42 }

2. The backend checks:
     - Ali has a body photo ("Add a photo of yourself first.")
     - Ali has pictures left today (10 a day, counted in the database)
     - the kurta is his, has a photo, and is a kind the model can draw
       (shoes and watches are refused before anything is spent)

3. A try_ons row is created, status "Working on it", with a COPY of the
   garment's name, picture and slot. The picture is of a person, so it must
   outlive the garment being renamed, re-photographed or deleted later.

4. providers.submit() sends PiAPI two web addresses: the body photo, and
   the garment photo in the right input (upper for tops and outerwear,
   lower for bottoms, dress for full outfits), with batch_size 1.
   PiAPI answers at once with a task id. The row remembers it.

5. The backend answers "working on it" immediately. Nobody waits.

6. The page re-reads the list every six seconds while anything is waiting.
   Each time, for each waiting row, the backend asks PiAPI "done yet?".
     still running  -> nothing changes
     failed         -> the row is marked failed with a plain sentence
     finished       -> the finished picture is copied from PiAPI onto our
                       own Cloudinary (PiAPI's link expires; a person's
                       picture should not), and the row is marked Ready

7. Two to four minutes later the card shows the picture. The page stops
   re-reading once nothing is waiting.
```

For an uploaded garment, the flow is the same except that the person must
say which part of the body it covers. A bare photo says nothing about
itself, and sent as the wrong input a kurta is drawn onto the legs. A closet
garment skips the question because its category already answers it. If the
person chose to keep the upload, a new garment is created in the closet
under the built-in category for that body part.

### Rules worth knowing

- **Consent is recorded on the server, with a time**, not just remembered
  by a tick box in the browser, because the permission has to be provable by
  the server that acts on it.
- **10 pictures per account per day**, counted in the database. A rate limit
  on top slows down a burst.
- **Every picture costs about 7 US cents.** Nothing is sent to the supplier
  until every check has passed.
- **Deleting a picture** also deletes an uploaded garment photo that nothing
  else points at. A garment kept in the closet owns its own photo.
- **One hidden trap** is written in the code: the supplier's documentation
  calls `batch_size` optional with a default of 1. It is required. Leaving it
  out is rejected with a bare "Invalid input" that names no field.

### Where the code is

| Part                                                                  | File                                     |
| --------------------------------------------------------------------- | ---------------------------------------- |
| Body photo fields and consent time                                    | `backend/apps/accounts/models.py`        |
| The try_ons table                                                     | `backend/apps/tryon/models.py`           |
| Talking to PiAPI: submit and check                                    | `backend/apps/tryon/providers.py`        |
| The checks: closet garment, uploaded garment, consent                 | `backend/apps/tryon/serializers.py`      |
| Body photo save and delete, making a picture, the daily limit, status | `backend/apps/tryon/views.py`            |
| The key and the daily limit setting                                   | `backend/config/settings.py` (`TRYON_*`) |
| The page                                                              | `frontend/src/app/(app)/try-on/page.tsx` |
| Body photo card, upload dialog, picture card                          | `frontend/src/components/tryon/`         |
| Requests, including the six-second re-read                            | `frontend/src/hooks/use-tryon.ts`        |

| Address                   | Method          | Does                                               |
| ------------------------- | --------------- | -------------------------------------------------- |
| `/api/try-on/status/`     | GET             | Switched on? Body photo saved? How many left today |
| `/api/try-on/body-photo/` | GET/POST/DELETE | Check, save or delete the body photo               |
| `/api/try-on/`            | GET/POST        | My pictures, or ask for a new one                  |
| `/api/try-on/5/`          | GET/DELETE      | One picture (asks the supplier if still waiting)   |

### If a judge asks

- _"Does the model run on your server?"_ No. On PiAPI's hardware. We send two
  picture addresses and fetch one back. That is why it works on a free
  server while background removal does not.
- _"Why this model?"_ Tested against a real kurta. Published research shows
  most try-on models are trained on Western clothes and some turn a shalwar
  kameez into a Western dress. Kling drew the collar, placket and sleeves
  correctly.
- _"What happens to the body photo?"_ Stored under the person's own folder,
  sent to the supplier only to be drawn on, shown to nobody else, deletable
  at any time along with every picture made from it.
- _"Why does it take minutes?"_ The model is heavy. The app does not make
  anybody wait: it queues the work, answers at once, and checks back every
  six seconds.

---

## 15. Small things that are everywhere

A few pieces of the project are not one feature but show up in every
feature. Know them.

**Lists come in pages of 24.** Every list address answers with `count`,
`next`, `previous` and `results`. Twenty-four divides evenly into the two,
three and four column grids, so the last row is never ragged. A page may ask
for more with `?page_size=` (up to 200), which the category dropdown uses to
get all 34 categories at once.

**Every list is filtered by owner first.** Said three times in this guide
because it is the security of the whole app.

**Sentences, not codes.** Every refusal from the backend is a sentence a
person can read: "Blue Kurta is lent to a friend, so wearing it cannot be
recorded." The frontend shows that sentence in a toast. Nothing says
"Error 400".

**Two requests at the same moment.** Every place where two taps could land
together (two "I wore this", two friends asking for one kurta, two listings
of one garment) has a database rule, and the code catches the database's
refusal and turns it into the same readable sentence a single request would
have got, instead of a crash.

**The waking message.** The free server sleeps. The frontend pings
`/api/health/` as soon as the site opens and shows "Waking the server up"
after four seconds of silence. File: `frontend/src/lib/wake.ts`,
`frontend/src/components/layout/waking-notice.tsx`.

**Accessibility rules followed throughout** (good to mention):

- Every icon has a visible text label. Hover-only labels do not exist on a
  touch screen.
- Every button is at least 44 by 44 pixels, the recommended size for a thumb.
- Meaning never depends on colour alone. A red badge always carries a number.
- Every empty page says what to do next and links to it.
- Animations switch off for anybody whose device asks for less motion.

**Dark mode.** The site follows the device's light or dark setting.

**The live API documentation.** `/api/docs/` on the backend is a clickable
page listing every address, what it takes and what it returns, generated
from the code itself (by drf-spectacular). Judges who know APIs like to see
it.

---

# PART 3: UNDER THE FLOOR

---

## 16. The database, table by table

The database is called **`neondb`**. It is a PostgreSQL database hosted by
Neon. These are the tables our own code creates. Each one is a class in a
`models.py` file.

| Table                   | One row is...                                                                  | Defined in                 |
| ----------------------- | ------------------------------------------------------------------------------ | -------------------------- |
| `users`                 | one account: email, name, city, phone, friend code, body photo, sharing switch | `apps/accounts/models.py`  |
| `categories`            | one kind of clothing, such as Kurta or Sneakers, with where it is worn (slot)  | `apps/wardrobe/models.py`  |
| `storage_locations`     | one place clothes are kept, pointing at the place it is inside                 | `apps/wardrobe/models.py`  |
| `garment_items`         | one piece of clothing, with its photos, colour, price, place and status        | `apps/wardrobe/models.py`  |
| `wear_events`           | one day on which one garment was worn, with an optional note                   | `apps/wardrobe/models.py`  |
| `planned_outfits`       | one planned day: date, label, note, confirmed time                             | `apps/planner/models.py`   |
| `planned_outfits_items` | the link between a plan and the garments in it                                 | (made automatically)       |
| `shops`                 | one shop we read: address, settings, last check result                         | `apps/shopping/models.py`  |
| `deals`                 | one product in one shop at the price last seen                                 | `apps/shopping/models.py`  |
| `deal_price_changes`    | one real change of price for one product                                       | `apps/shopping/models.py`  |
| `deal_sync_runs`        | one attempt at refreshing one shop: how many found, added, removed             | `apps/shopping/models.py`  |
| `listings`              | one garment put up for sale                                                    | `apps/community/models.py` |
| `listing_enquiries`     | one person asking to buy one listing                                           | `apps/community/models.py` |
| `marketplace_blocks`    | one person blocking another                                                    | `apps/community/models.py` |
| `listing_reports`       | one complaint about a listing                                                  | `apps/community/models.py` |
| `friend_requests`       | one request to be friends, waiting, accepted or declined                       | `apps/circle/models.py`    |
| `friends`               | one direction of a friendship, with the private nickname                       | `apps/circle/models.py`    |
| `loans`                 | one garment lent by one person to another, with dates                          | `apps/circle/models.py`    |
| `try_ons`               | one virtual try-on picture: garment copy, result, status                       | `apps/tryon/models.py`     |

Django adds its own tables as well: permissions, the admin log, sessions,
the list of migrations already applied, and the token blacklist. About 30
tables in total.

### How the tables connect

```
users ---< garment_items >--- categories
  |            |    |
  |            |    `--- storage_locations (a place, inside another place)
  |            |
  |            +---< wear_events
  |            +---< listings ---< listing_enquiries
  |            +---< loans
  |            `---< try_ons
  |
  +---< planned_outfits >---< garment_items   (many to many)
  +---< friend_requests
  +---< friends
  `---< marketplace_blocks, listing_reports

shops ---< deals ---< deal_price_changes
      `--< deal_sync_runs
```

`---<` means "one of these has many of those". One user has many garments;
one garment has many wear events.

### Rules the database enforces by itself

These are the most important ones. The database refuses to break them, even
when two requests arrive at the same instant.

| Rule                                                  | Table               | Why                                                |
| ----------------------------------------------------- | ------------------- | -------------------------------------------------- |
| One wearing per garment per day                       | `wear_events`       | A double tap must not count twice                  |
| One plan per person per day                           | `planned_outfits`   | A calendar square shows one answer                 |
| One open listing per garment                          | `listings`          | A garment cannot be for sale twice at once         |
| One request per buyer per listing                     | `listing_enquiries` | No spamming a seller                               |
| One open loan per garment                             | `loans`             | Two friends cannot both be promised the same kurta |
| One unanswered friend request per pair                | `friend_requests`   | No spamming a person                               |
| Each person's nicknames for friends are unique        | `friends`           | Two "Ali Khan" rows cannot share one label         |
| A place name is unique inside the same parent         | `storage_locations` | Two "Drawer 2" in one wardrobe would be confusing  |
| Nobody can befriend, block, or borrow from themselves | several             | Common sense, enforced                             |
| A price cannot be negative                            | `deals`, `listings` | A negative price is always a mistake               |

### What a garment's status means

Every garment has one `status`. It is the most important column in the
whole app.

| Status        | Shown as         | Meaning                                                                   |
| ------------- | ---------------- | ------------------------------------------------------------------------- |
| `IN_WARDROBE` | In wardrobe      | Normal. Can be worn, planned, lent, sold.                                 |
| `IN_LAUNDRY`  | In the wash      | Still yours, just not clean. Can be lent later.                           |
| `LENT_OUT`    | Lent to a friend | Still yours, but a friend has it. Cannot wear, wash or sell.              |
| `FOR_SALE`    | Listed for sale  | Still yours, up on the marketplace. Can still be worn.                    |
| `SOLD`        | Sold             | Not yours any more. Leaves every count.                                   |
| `ARCHIVED`    | Put away         | Still yours, out of the way for the season. Leaves counts, can come back. |

The code groups them:

```
WEARABLE  = In wardrobe
GONE      = Sold, Put away                 (not part of the wardrobe)
AWAY      = Sold, Put away, Lent to a friend  (not in your hands)
```

How the status moves:

```
                 put away           bring back
  In wardrobe  ------------>  Put away  ------------>  In wardrobe
  In wardrobe  <----------->  In the wash   (the wash button, both ways)
  In wardrobe  --- list it -->  Listed for sale --- mark sold -->  Sold
                                      `--- take down --->  In wardrobe
  In wardrobe  --- friend borrows -->  Lent to a friend --- returned -->  In wardrobe
```

---

## 17. Security, in plain words

A judge will ask "how is this secure?". Here is the list.

| Protection                                       | What it means                                                                                                                                                     | Where                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Everything is HTTPS                              | All traffic is encrypted. Plain HTTP is redirected to HTTPS. Browsers are told to remember this for a year (HSTS).                                                | `config/settings.py`            |
| Passwords are hashed                             | A password is never stored. It is turned into a one-way scramble (PBKDF2 with a random salt). Even with the database, nobody can read passwords back.             | Django built in                 |
| Password rules                                   | At least 8 characters, not too similar to the email, not a common password, not all numbers.                                                                      | `config/settings.py`            |
| Tokens, not sessions                             | Signed tokens prove who is asking. Access lasts 60 minutes, refresh 7 days.                                                                                       | `config/settings.py`            |
| Token rotation and blacklist                     | Every refresh gives a new token and kills the old one. A stolen token dies fast.                                                                                  | `config/settings.py`            |
| Owner filtering everywhere                       | Every database question is limited to the signed-in person first. Another person's item answers "not found", which does not even confirm it exists.               | every `views.py`                |
| Same answer for wrong password and unknown email | Nobody can use the login box to discover which emails have accounts.                                                                                              | `apps/accounts`                 |
| Rate limits                                      | Login 10 tries a minute. Sign-up 10 an hour. Friend code guesses 20 an hour. Body photo uploads 12 an hour. General traffic 120 an hour without login, 2000 with. | `config/settings.py`            |
| One proxy trusted                                | The rate limiter identifies callers by the address Render reports, not by a header the caller can write themselves.                                               | `NUM_PROXIES = 1`               |
| Upload limits                                    | A photo may be at most 12 MB and must be a real image (JPG, PNG, WebP, HEIC). A whole request may be at most 20 MB.                                               | `apps/vision/uploads.py`        |
| Picture ownership check                          | A picture id sent back by the browser must sit in that account's own Cloudinary folder.                                                                           | `apps/vision/storage.py`        |
| No SQL injection                                 | Django's ORM always sends values separately from the query, so typed text can never become a command.                                                             | Django built in                 |
| No clickjacking                                  | The site refuses to be shown inside another site's frame.                                                                                                         | `X_FRAME_OPTIONS = DENY`        |
| CORS                                             | Only our own frontend address (the Vercel site) may call the API from a browser.                                                                                  | `CORS_ALLOWED_ORIGINS`          |
| Secrets out of the code                          | Keys and passwords live in `backend/.env` on the developer's machine and in Render's secret store. The repository holds only `.env.example` with empty values.    | `.gitignore`                    |
| Secret key guard                                 | The server refuses to start in production with the development key.                                                                                               | `config/settings.py`            |
| Contact details refused                          | Phone numbers, emails and "WhatsApp me" hints are refused in listing notes, buy requests and borrow messages.                                                     | `apps/community/models.py`      |
| Phone number privacy                             | A phone number is shown to exactly one other person, and only after the seller accepts them.                                                                      | `apps/community/serializers.py` |
| Body photo consent                               | The person must tick a consent box. The time is recorded. Deleting the photo deletes every picture made from it.                                                  | `apps/tryon`                    |
| Spending limits                                  | 10 try-on pictures per account per day, counted in the database.                                                                                                  | `apps/tryon/views.py`           |
| Metadata stripped                                | Hidden phone data in photos (GPS location, camera model) is removed by Cloudinary on upload.                                                                      | `apps/vision/storage.py`        |

Django's own production check (`manage.py check --deploy`) reports zero
warnings.

---

## 18. Testing

### Backend: 237 automated tests

Written with **pytest**. Run with one command:

```
cd backend
pytest
```

Each run creates a fresh throwaway database (`test_neondb`), fills it,
runs every test, and throws it away. Real data is never touched. Nothing in
the suite reaches the internet: Cloudinary, the weather service and the
try-on supplier are all replaced with stand-ins during tests.

| File               | Tests | What it proves                                                                                                         |
| ------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| `test_security.py` | 49    | Attacks fail: forged tokens, reading another person's data, becoming an admin, injection, email guessing, brute force. |
| `test_wardrobe.py` | 27    | Counts are right; sold and put-away things leave the counts; bringing things back works.                               |
| `test_circle.py`   | 45    | Friend codes, two friends with the same name, sharing switch, lending and returning.                                   |
| `test_tryon.py`    | 62    | Consent, uploads, body-part choice, the submit-then-check flow, the daily limit, privacy.                              |
| `test_contract.py` | 54    | The data shapes the frontend expects match exactly what the backend sends, field by field.                             |

The last one deserves a sentence in the defence. The frontend and backend are
separate programs. Each one checks itself, but nothing checks one against
the other. `test_contract.py` reads the frontend's TypeScript files and
compares them with the backend's published schema, in both directions. A
field renamed on one side fails this test instead of breaking a page in
front of a judge. It exists because exactly that bug happened once.

### Frontend: 360 automated tests

Written with **Vitest** and **Testing Library**, which test what a person
sees ("a button called Delete exists") rather than internal details. Run
with:

```
cd frontend
npm test
```

### The full walkthrough

On top of the automated tests, the whole app was walked through over the
network as two people, Ali and Sara: sign up, add clothes with a real photo,
wear, wash, put away, plan a day, confirm it, sell to the other person,
exchange contact details, mark sold, add each other as friends, share a
closet, borrow and return, save and delete a body photo, rotate tokens.
94 of 94 checks passed.

### Other checks

```
cd frontend
npm run lint        finds sloppy code
npx tsc --noEmit    checks every type
npm run build       builds the real site, as Vercel does
```

---

## 19. Hosting and deployment

### How a change goes live

```
developer edits code
   -> git commit, git push to GitHub
        -> Vercel sees the push, builds the frontend, publishes it  (about 2 minutes)
        -> Render sees the push, installs packages, runs migrations, restarts the API
```

Nobody uploads files by hand. The code in GitHub _is_ the live site.

### The backend on Render

`render.yaml` describes two services:

**`closette-api`** - the API. Free plan. On every deploy Render installs the
packages, collects the static files for the admin site, runs the database
migrations and starts the server with `gunicorn`. Render checks
`/api/health/` every few seconds to see it is alive.

**`closette-prices`** - the price refresh. A timer, not a website. It runs
`python manage.py sync_deals --quiet` at 01:00 and 13:00 UTC, which is 6 in
the morning and 6 in the evening in Pakistan. It installs only the packages
it needs (not the 176 MB background-removal model, which it never uses).
Render does not offer timers for free; this is the smallest machine they
sell, about one dollar a month.

Why a separate service for the timer? A timer inside the website would fall
asleep whenever the website fell asleep, and the prices would quietly go
stale. A separate timer wakes on schedule whether or not anybody has opened
the site.

### The frontend on Vercel

Connected to GitHub. Two settings were set by hand because the website lives
in a subfolder: Root Directory = `frontend`, Framework = Next.js. One
environment variable, `NEXT_PUBLIC_API_URL`, points at the Render backend.

### Secrets

| Name                                                                   | What it is                                    |
| ---------------------------------------------------------------------- | --------------------------------------------- |
| `SECRET_KEY`                                                           | Signs the login tokens                        |
| `DATABASE_URL`                                                         | The Neon database address and password        |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary access                             |
| `OPENWEATHER_API_KEY`                                                  | Weather access                                |
| `TRYON_API_KEY`                                                        | PiAPI access for try-on                       |
| `ALLOWED_HOSTS`                                                        | Which addresses may serve the API             |
| `CORS_ALLOWED_ORIGINS`                                                 | Which website may call the API from a browser |

They live in `backend/.env` on the developer's machine and in Render's
dashboard. Neither is in GitHub.

### The sleeping server, honestly

The free Render plan sleeps after 15 minutes of silence and takes up to a
minute to wake. The first visitor after a quiet spell would normally see a
request hang and fail. So the frontend pings `/api/health/` the moment the
site opens, and after four seconds of silence shows "Waking the server up".
By the time the person has typed their password, the server is usually
awake. In a demo, open the site a minute before you need it.

---

## 20. Running it on your own computer

You need Python 3.13, Node 22 or newer, and the `.env` file with the keys
(ask the person who has it; it is never in GitHub).

```
# Backend (first time)
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements/dev.txt
copy .env.example .env         then fill in the values
python manage.py migrate

# Backend (every time)
cd backend
venv\Scripts\activate
python manage.py runserver     -> http://localhost:8000

# Frontend (first time)
cd frontend
npm install

# Frontend (every time)
cd frontend
npm run dev                    -> http://localhost:3000
```

Useful addresses while it runs:

| Address                           | What it is                                                                  |
| --------------------------------- | --------------------------------------------------------------------------- |
| `http://localhost:3000`           | The website                                                                 |
| `http://localhost:8000/api/docs/` | Live, clickable documentation of every API address, generated from the code |
| `http://localhost:8000/admin/`    | Django's admin site                                                         |

Useful commands:

```
python manage.py seed_shops     adds the eight shops (once)
python manage.py sync_deals     reads the shops and refreshes prices (about two minutes)
python manage.py prune_images   lists Cloudinary pictures nothing points at; --delete removes them
python manage.py missing_images lists items whose pictures are gone from Cloudinary; --clear removes the dead links
pytest                          runs the backend tests
```

The first photo upload downloads the 176 MB background-removal model and
takes about 30 seconds. Later uploads take about one and a half seconds.

---

## 21. Known limits, and the honest answer to each

Judges respect honesty more than perfection. These are the limits, and what
to say.

| Limit                                              | Honest answer                                                                                                                                                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background removal does not run on the live server | The model needs about 1 GB of memory. The free Render server has 512 MB. It works perfectly on a laptop. The fix is either a paid server or moving the model into the browser. Items can still be added without a photo on the live site. |
| The live server sleeps                             | A free-plan limit. The frontend shows a waking message. A paid plan removes it.                                                                                                                                                           |
| Try-on costs money                                 | 7 cents a picture. There is a daily limit of 10 per account. This is a real trade-off of using a strong model.                                                                                                                            |
| Try-on is a guide, not a fitting                   | It shows how something looks, not how it fits. The page says so.                                                                                                                                                                          |
| No password reset by email                         | Not built yet. It needs an email service. Planned.                                                                                                                                                                                        |
| Notifications only while the app is open           | The badges update every minute while a page is open. Email or push notifications are a next step.                                                                                                                                         |
| No outfit suggester yet                            | The columns for it exist (warmth level, waterproof) and the weather already says which warmth suits today. Matching clothes to that is the next feature.                                                                                  |
| Shops are Pakistani only                           | By design, for the first users. Adding a shop is one line, as long as it runs on Shopify.                                                                                                                                                 |
| Shop classification is about 90% accurate          | Measured. The remaining products are shown under "Everything" rather than in a wrong tab.                                                                                                                                                 |
| No payment inside the app                          | By design. Buyer and seller settle in person. It keeps card details and payment law out of the project.                                                                                                                                   |

---

## 22. Questions judges may ask, with answers

Keep the answers short. Say the answer, then one reason.

**What problem does this solve?**
People forget what they own, cannot find things, buy duplicates, and wear a
small part of their wardrobe. Closette gives them a searchable copy of their
wardrobe with wear history, and adds shopping, selling, lending and try-on
around it.

**Why a website and not a mobile app?**
A website works on every phone and laptop with nothing to install. The
backend is an API, so a phone app can be added later without changing it.

**Why Django?**
It gives accounts, passwords, admin and database migrations ready-made, and
Python is the best language for the image work.

**Why Next.js?**
It gives pages, fast loading and a one-command deploy, and TypeScript catches
mistakes before they reach the screen.

**Why PostgreSQL?**
It can enforce rules such as "only one open loan per garment" by itself, it
can store lists in a column, and it has the similarity search behind the
misspelling-tolerant search.

**Why is the database on Neon and the pictures on Cloudinary?**
Neon is free and sleeps when idle. Cloudinary keeps pictures safe across
deploys (Render wipes its disk) and resizes them on the fly.

**How do you stop one user seeing another user's clothes?**
Every database question is limited to the signed-in person before the id is
looked up. Another person's item answers "not found". 49 automated tests try
to break this and fail.

**How are passwords stored?**
Hashed with PBKDF2 and a random salt, by Django. They cannot be read back.

**What is a token? Why not sessions?**
A signed string that proves who is asking. The frontend and backend are on
different domains, and tokens work across domains and for a future phone app.

**What happens when a token is stolen?**
The access token dies in 60 minutes. The refresh token is replaced on every
use and the old one blacklisted, so it dies the moment the real person
refreshes.

**Where is the AI?**
Background removal (U-2-Net through rembg) and virtual try-on (Kling through
PiAPI). Colour naming, shop reading, weather advice and search are logic, not
AI.

**How does the photo become a clean cutout?**
The server reads the photo, fixes its rotation, shrinks it to at most 1600
pixels, runs the U-2-Net model to find the garment, makes everything else
transparent, trims the empty edges, works out the average colour, and uploads
both the original and the cutout to Cloudinary. About 1.5 seconds.

**How do you name the colour?**
The average colour is converted into a colour space called Lab, where
distance matches what the eye sees. The closest of 36 named colours wins.

**How do you get shop prices? Is it scraping?**
No. Shopify shops publish their catalogue as a data file at
`/products.json`. We read it twice a day, honouring each shop's rules.

**What happens when a shop is down?**
Nothing breaks. The stored prices stay, still stamped with the last
successful check, and the page says how old they are.

**How does the app know a kurta is a top?**
Rules. The shop's own words are matched against a list of phrases, longest
first, so "t-shirt" is not read as "shirt". Measured at about 90% accurate.

**How is a sale done? Does money pass through the app?**
No money. A buyer asks, the seller accepts, both see each other's contact
details, they meet, and the seller marks it sold. The garment then leaves the
seller's closet.

**How do you stop people putting phone numbers in listings?**
A pattern check refuses phone numbers, emails and "WhatsApp me" hints in any
free text. Numbers are shared automatically, only after acceptance.

**Why friend codes and not searching by name?**
A name search cannot tell a real person from somebody using their name, and
an email search would reveal who has an account. A code can only be used by
somebody you gave it to, and can be replaced.

**What was the hardest problem?**
Two friends with the same name. The answer is three layers: a private
nickname chosen on accept, a database rule that nicknames are unique per
person, and a colour from the account id so two "Ali Khan" rows never look
alike.

**Does the try-on model run on your server?**
No. It runs on PiAPI's hardware. We send two picture addresses and fetch one
back. Generation takes two to four minutes, so the page checks every six
seconds.

**What happens to the body photo?**
Stored on Cloudinary under the person's own folder, sent to the supplier to
be drawn on, shown to nobody else. Consent is recorded with a time. Deleting
the photo deletes every picture made from it.

**What stops somebody running up a bill?**
A daily limit of 10 pictures per account counted in the database, a rate
limit on top, and garments the model cannot draw (shoes, watches) are refused
before anything is sent.

**How do you know it works?**
237 backend tests and 360 frontend tests, all automated. One test file
attacks the app. One checks the frontend's data shapes against the backend's.
A full walkthrough as two users passed 94 of 94 checks.

**What would you do next?**
Move background removal into the browser so photos work on the free server.
Build the outfit suggester. Add email for password reset and notifications.

**How long did it take?**
Say the true number of weeks or months. Judges can tell.

---

## 23. A demo script for the defence

About ten minutes. Open the live site a minute early so the server is
awake. Have two accounts ready: a main one with 15 to 20 items with photos,
and a second one on a phone for the friend and buyer parts.

1. **Home.** Sign in. Point at the weather card and the four counts. Say
   "every number here comes from the database through the API".
2. **Add an item.** Choose Tops, Kurta, take or pick a photo, show the
   background disappearing and the colour being detected. Fill the name,
   price and drawer. Save. (If demoing on the live site, skip the photo and
   say why.)
3. **The item page.** Press "I wore this today" twice; show it counts once.
   Show cost per wear. Put it in the wash and back.
4. **Search.** Type "snekers". Show it still finds Sneakers and says these
   are the nearest spellings.
5. **Put away.** Put a winter coat away. Show the counts drop and the "Sold
   and put away" button appear. Bring it back.
6. **Where Things Are.** Show the tree. Add a drawer inside a wardrobe.
7. **My Plans.** Plan today with two items. Press "I wore this". Show the
   wear log filled in.
8. **Sales.** Show the freshness bar ("Prices checked 2 hours ago"), the
   Women/Men/Kids tabs, a filter, a price history.
9. **Buy and Sell.** List the kurta; show the suggested price. On the phone,
   find it, ask to buy. On the laptop, accept; show the phone number appears
   on both sides. Mark sold; show the kurta leave the closet.
10. **Borrow from Friends.** Show your code. On the phone, enter it. Accept
    with a nickname. Switch sharing on. On the phone, open the closet, ask to
    borrow. Agree; show "Lent to a friend". Mark returned.
11. **Try It On.** Show an existing finished picture (made before, since it
    takes three minutes). Explain the consent box and the daily limit.
12. **Close** with the tests: run `pytest` on the laptop if time allows, or
    show the numbers.

---

## 24. Glossary

| Word             | Plain meaning                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| API              | A server that answers questions with data instead of web pages. Ours lives at `/api/...`.              |
| Access token     | A short-lived signed string sent with every request to prove who is asking. Lasts 60 minutes.          |
| Backend          | The server program. Owns the data and the rules.                                                       |
| Blacklist        | The list of refresh tokens that have been used up and must be refused.                                 |
| Cache            | A remembered answer, reused instead of asking again. The weather is cached for 30 minutes.             |
| CDN              | A network of servers around the world that deliver pictures from close to the viewer.                  |
| Cloudinary       | The company that stores and delivers our pictures.                                                     |
| Column           | One fact about every row in a table, such as `wear_count`.                                             |
| Commit           | One saved change in git, with a message.                                                               |
| Component        | One reusable piece of screen in React, such as a garment card.                                         |
| CORS             | The browser rule that decides which websites may call our API. Only our own may.                       |
| Cron             | A timer that runs a job on a schedule. Our price refresh is a cron job.                                |
| Cutout           | A garment photo with the background made transparent.                                                  |
| Deploy           | Putting a new version of the code live on the hosting service.                                         |
| Django           | The Python framework the backend is built with.                                                        |
| DRF              | Django REST Framework. Turns Django into an API.                                                       |
| Endpoint         | One address the API answers, such as `/api/wardrobe/items/`.                                           |
| Frontend         | The website program the person sees, built with Next.js.                                               |
| Git / GitHub     | Git tracks every change to the code. GitHub stores it online.                                          |
| Hash             | A one-way scramble. Passwords are stored hashed, so they cannot be read back.                          |
| Hex colour       | A colour written as six characters, such as `#1b2f55` (navy).                                          |
| HTTPS            | Encrypted web traffic. All of ours is.                                                                 |
| JSON             | The text format the frontend and backend use to exchange data.                                         |
| Kling            | The try-on model, run for us by PiAPI.                                                                 |
| Lab colour space | A way of writing colours where distance matches what the eye sees. Used for colour naming.             |
| Migration        | A small script that changes the database shape safely. Django writes them.                             |
| Model (Django)   | A Python class that describes one database table.                                                      |
| Model (AI)       | A trained neural network, such as U-2-Net or Kling.                                                    |
| Neon             | The company hosting our Postgres database.                                                             |
| Next.js          | The framework the frontend is built with.                                                              |
| ORM              | Django's way of using the database from Python without writing SQL by hand.                            |
| PiAPI            | The company whose service runs the Kling try-on model for us.                                          |
| PostgreSQL       | The database software. Often shortened to Postgres.                                                    |
| Public id        | A picture's file name on Cloudinary. Needed to delete it.                                              |
| Query            | A question asked of the database.                                                                      |
| Rate limit       | A cap on how many requests one caller may make in a period. Stops password guessing.                   |
| Refresh token    | A longer-lived token (7 days) used only to get a new access token.                                     |
| rembg            | The Python library that runs U-2-Net to remove backgrounds.                                            |
| Render           | The company hosting our backend and the price timer.                                                   |
| Request          | One message from the frontend to the backend. GET reads, POST creates, PATCH changes, DELETE removes.  |
| Row              | One thing in a table: one user, one garment, one wearing.                                              |
| Serializer       | The DRF translator between a database row and JSON, which also checks incoming data.                   |
| Shopify          | The shop-website software most Pakistani clothing shops use. It publishes `/products.json`.            |
| Slot             | Where on the body a garment is worn: top, bottom, full body, outerwear, footwear, accessory, headwear. |
| Status           | The one word that says where a garment is: in wardrobe, in the wash, lent, for sale, sold, put away.   |
| Table            | A set of rows of the same kind, like one sheet of a spreadsheet.                                       |
| TanStack Query   | The frontend library that fetches, remembers and refreshes data.                                       |
| Toast            | The small message that pops up for a few seconds, such as "Saved."                                     |
| Token            | See access token and refresh token.                                                                    |
| Trigram          | Three letters in a row. Comparing trigrams is how the search tolerates misspellings.                   |
| TypeScript       | JavaScript with types. Catches mistakes before the code runs.                                          |
| U-2-Net          | The neural network that finds the main object in a photo. Used for background removal.                 |
| URL              | A web address.                                                                                         |
| Vercel           | The company hosting our frontend.                                                                      |
| View (Django)    | The function that handles one request: checks, does the work, answers.                                 |
| 401              | The server's answer meaning "you are not signed in" or "that token is not valid".                      |
| 404              | The server's answer meaning "not found". Also what another person's item answers.                      |
