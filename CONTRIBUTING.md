# Contributing

## Comments

Comments are written for somebody who does not program. A judge, a new team
member, or the author a year from now should be able to read one and
understand what the code is for and why it is the way it is.

- Plain English. Short sentences. No jargon where an ordinary word will do:
  "picture" not "asset", "web address" not "URI".
- Say why, not what. The code already says what it does.
- Give an example where the rule is not obvious: "Ali plans a kurta for
  Friday, sells it on Thursday, then confirms the plan. The kurta is skipped."
- Name the outside fact that makes the comment true when there is one: a
  measured number, a library's behaviour, a host's limit.
- No banner lines (`# ====`, `// ----`). A bare label line is fine in a long
  file.
- ASCII only.

Not everything needs a comment. A long stretch of code with none, then a real
paragraph where something is surprising, reads better than a label on every
block.

## User-facing copy

- Sentences under 25 words, averaging 15. Paragraphs under 5 sentences.
- Active voice. Short words: "buy" not "purchase", "about" not "approximately".
- Avoid negative contractions; they get misread.
- Never name a technology. No "JWT", "API", "sync", "upload failed".
- Errors say what to do next, not what went wrong internally.

## UI rules

- Every icon carries a visible text label. Hover-only labels do not exist on touch.
- Minimum interactive target 44x44px.
- Meaning never depends on colour alone. Pair it with text or a shape.
- Destructive actions are undoable rather than confirmed with a dialog.
- Empty states say what to do next and link to it.

## Stack notes

Base UI, not Radix. `render={<X />}` instead of `asChild`. `GroupLabel` must sit
inside `Group`. Positioning props go on `Positioner`, never `Popup`.

`ChoiceField` wraps `Select` because Base UI needs an `items` prop to map a
value back to its label, and has no clear action of its own: an optional field
needs a row with `value={null}`. `PlaceField` is the storage picker and holds
the nesting rule that `StorageLocation.clean()` enforces server side.

Never set a default `Content-Type` on the axios instance. Axios serialises
FormData to JSON when one is present, and file uploads arrive empty.

A `next/font` `variable` name must never match a Tailwind `@theme` token, or the
emitted custom property references itself.

Files in `frontend/src/components/ui/` are overwritten by `shadcn add`. Keep
project customisation out of them where possible, and re-check sizing after any
registry update.

## Before opening a pull request

```bash
cd backend  && python manage.py check && python manage.py makemigrations --check --dry-run
cd frontend && npm run lint && npx tsc --noEmit && npm test && npm run build
```
