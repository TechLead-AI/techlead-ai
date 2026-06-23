# CLAUDE.md — How to write code in Tech Lead AI

This file defines how code is written in this repository. Follow it exactly.

## The top three rules

1. **Write simple, easy-to-understand code.**
   Prefer the boring, obvious solution over the clever one. Clear names, small
   functions, straight-line logic. If a junior developer couldn't read it and
   understand it, rewrite it. (This is a mentoring product — our own code should
   be exemplary.)

2. **Split work into several small files.**
   No giant files. One clear responsibility per file. Prefer many small, focused
   modules over a few large ones. When a file grows past a single clear purpose,
   split it.

3. **Maintain `STRUCTURE.md`.**
   `STRUCTURE.md` is the navigation map of the codebase. Whenever you add, move,
   remove, or rename a file or directory, update `STRUCTURE.md` in the same
   change so it always reflects reality. Read it first to find your way around.

## Testing

- **Write a lot of tests for every component.** Each component ships with tests;
  a component without tests is not done.
- Cover the happy path, edge cases, and failure modes. Test behavior, not
  implementation details.
- Tests are written *alongside* the code for a component, in the same change.

## General conventions

- Keep functions small and single-purpose; keep nesting shallow.
- Name things for what they do, not how they do it.
- Comment the **why**, not the **what** — the code should explain the what.
- Handle errors explicitly; don't swallow them silently.
- Match the style of the surrounding code.
- Every table/query carries `org_id` (multi-tenant from day one — see `DESIGN.md`).
- Keep metric snapshots immutable once written (see `DESIGN.md`, component 6).

## Documents to keep in sync

Whenever the design or structure changes, update these in the same change:
- **`DESIGN.md`** — the product/system design and decisions.
- **`STRUCTURE.md`** — the file/directory map.
- **`CLAUDE.md`** — these coding rules (only when the rules themselves change).
