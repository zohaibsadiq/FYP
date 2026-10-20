# Contributing

## Comments

Before writing a comment, name the thing outside the function that makes it
true: a ticket, an HTTP status, a library version, a vendor bug, a measured
number. If there is nothing to name, the comment is restating the code. Delete
it.

- No second person. No "note that", "remember", "simply".
- No explanations of Django, React or Tailwind. The reader knows the stack.
- No banner rules (`# ====`, `// ----`). A bare label line is fine in a long file.
- No module-top docstrings that summarise what the file obviously is.
- Docstrings belong on public API surface and non-obvious invariants.
- ASCII only.

Most code needs no comment at all. Long silences with the occasional earned
paragraph beat a label on every block.

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
