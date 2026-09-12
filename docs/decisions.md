# Decisions

## Access and refresh tokens are kept in localStorage

Any script running on the page can read localStorage, so an XSS hole hands over
both tokens. An httpOnly cookie closes that off, but the API and the web app are
served from different origins, which brings in CSRF tokens on every write, a
shared cookie domain, and credentialed CORS on both sides. That cost is not
justified while the only writes come from the app's own forms.

`frontend/src/lib/tokens.ts` is the single module that touches storage, so the
switch stays a one-file change on the frontend if the threat model changes.
