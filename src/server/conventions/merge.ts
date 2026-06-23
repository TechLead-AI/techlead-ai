/**
 * Convention config — DESIGN.md component 2. Conventions are layered
 * org -> team -> repo and merged into a single markdown block the review engine
 * reads. More specific layers come last so they can refine the broader ones.
 */

export type ConventionScope = "org" | "team" | "repo";

export interface ConventionLayer {
  scope: ConventionScope;
  version: number;
  markdown: string;
}

const SCOPE_ORDER: Record<ConventionScope, number> = {
  org: 0,
  team: 1,
  repo: 2,
};

const SCOPE_HEADING: Record<ConventionScope, string> = {
  org: "Organisation conventions",
  team: "Team conventions",
  repo: "Repository conventions",
};

/**
 * Merge layers into one markdown document, broad-to-specific. Empty layers are
 * skipped. The result is what the engine reviews against.
 */
export function mergeConventions(layers: ConventionLayer[]): string {
  const ordered = [...layers]
    .filter((l) => l.markdown.trim().length > 0)
    .sort((a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope]);

  if (ordered.length === 0) {
    return "No team conventions provided. Review against general best practices.";
  }

  return ordered
    .map(
      (l) =>
        `## ${SCOPE_HEADING[l.scope]} (v${l.version})\n\n${l.markdown.trim()}`,
    )
    .join("\n\n");
}

/** A starter template handed to managers so they don't face a blank box. */
export const CONVENTION_TEMPLATE = `# Team Conventions

## Code style
- (e.g. naming, formatting, file organisation)

## Architecture
- (e.g. layering rules, where business logic lives)

## Testing
- (e.g. what must be tested, test naming)

## Git & PR hygiene
- (e.g. PR size, commit messages)

## Security
- (e.g. input validation, secret handling)

## Language specifics
- (e.g. preferred patterns for your stack)

## Good / bad examples
- Good: ...
- Bad: ...
`;
