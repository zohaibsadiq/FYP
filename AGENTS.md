# Conventions

## Comments

Before writing a comment, name the thing outside this function that makes it
true: a ticket, an HTTP status, a library version, a vendor bug, a measured
number. If you can't name one, the comment is restating the code. Delete it.

- Never address the reader. No "you", "we", "note that", "remember", "simply".
- Never explain Django, React or Tailwind. Assume the reader knows the stack.
- No banner rules (`# ====`, `// ----`). A bare label line is fine in a long file.
- No module-top docstrings that summarise what the file obviously is.
- Docstrings belong on public API surface and non-obvious invariants, nowhere else.
- ASCII only. No em-dashes, no curly quotes.
- A comment with bullet points is documentation. Put it in `docs/`.

Most code needs no comment. Long silences with the occasional earned paragraph
beat a label on every block.

## User-facing copy

Lives in `frontend/src/lib/copy.ts`, not inline in components.

- Sentences under 25 words, averaging 15. Paragraphs under 5 sentences.
- Active voice. Short words: "buy" not "purchase", "about" not "approximately".
- Avoid negative contractions ("can't", "don't") — they get misread.
- Never name a technology. No "JWT", "API", "sync", "upload failed".
- Errors say what to do next, not what went wrong internally.

## UI rules

- Every icon carries a visible text label. Hover-only labels don't exist on touch.
- Minimum interactive target 44x44px.
- Meaning never depends on colour alone. Pair it with text or a shape.
- Destructive actions are undoable, not confirmed with a dialog.
- Empty states say what to do next and link to it.

## Stack notes

Base UI, not Radix. `render={<X />}` instead of `asChild`. `GroupLabel` must be
inside `Group`. Positioning props go on `Positioner`, never `Popup`.

Never set a default `Content-Type` on the axios instance: axios serialises
FormData to JSON when one is present, and file uploads silently arrive empty.

A `next/font` `variable` name must never match a Tailwind `@theme` token, or the
emitted custom property references itself.

Files in `frontend/src/components/ui/` are overwritten by `shadcn add`. Keep
project customisation out of them where possible, and re-check sizing after any
registry update.
