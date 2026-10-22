# Closette frontend

The browser side of Closette, built with Next.js. It talks to the Django API
over HTTP and holds no data of its own.

Setup and running instructions are in the README at the repository root.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run lint
npx tsc --noEmit
```

`src/app/` holds the pages, `src/components/` the pieces they are built from,
`src/hooks/` the data fetching, and `src/types/` the shapes the API sends.
