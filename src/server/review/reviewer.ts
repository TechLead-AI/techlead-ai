import { ReviewResult, ReviewResultSchema, type ReviewComment } from "./types";

/**
 * The reviewer is the one part of the pipeline that talks to a model. We keep it
 * behind an interface so the rest of the engine is testable offline and the demo
 * works without an API key.
 */
export interface ReviewInput {
  prTitle: string;
  /** Merged convention markdown (org/team/repo). */
  conventions: string;
  /** Unified diff of the changes to review. */
  diff: string;
  /** Categories the junior has been pulled up on before (mentoring context). */
  recentMistakeCategories: string[];
}

export interface Reviewer {
  review(input: ReviewInput): Promise<ReviewResult>;
}

/**
 * Offline reviewer used for the demo and tests. It scans added lines of the diff
 * for a handful of well-known smells and produces deterministic, plausible
 * comments — no network, no API key.
 */
export class FakeReviewer implements Reviewer {
  async review(input: ReviewInput): Promise<ReviewResult> {
    const comments: ReviewComment[] = [];
    const added = parseAddedLines(input.diff);

    for (const { file, line, text } of added) {
      for (const rule of SMELLS) {
        if (rule.match(text)) {
          comments.push({
            filePath: file,
            lineStart: line,
            lineEnd: line,
            category: rule.category,
            severity: rule.severity,
            confidence: rule.confidence,
            message: rule.message,
            why: rule.why,
            suggestion: rule.suggestion,
            conventionRef: rule.conventionRef,
          });
        }
      }
    }

    const summary =
      comments.length === 0
        ? "Looks clean — no issues found in the changed lines. Nice work."
        : `Found ${comments.length} thing(s) worth looking at. The most important: ${
            comments.find((c) => c.severity !== "nit")?.message ??
            comments[0].message
          }`;

    return ReviewResultSchema.parse({ summary, comments });
  }
}

interface Smell {
  match: (line: string) => boolean;
  category: ReviewComment["category"];
  severity: ReviewComment["severity"];
  confidence: number;
  message: string;
  why: string;
  suggestion?: string;
  conventionRef?: string;
}

const SMELLS: Smell[] = [
  {
    match: (l) => /console\.log\(/.test(l),
    category: "convention",
    severity: "nit",
    confidence: 0.85,
    message: "Leftover console.log.",
    why: "Debug logging tends to leak into production and clutters output. Remove it or use a real logger.",
    suggestion: "Delete the console.log or replace it with the project logger.",
    conventionRef: "Code style",
  },
  {
    match: (l) => /:\s*any\b/.test(l) || /\bas any\b/.test(l),
    category: "readability",
    severity: "minor",
    confidence: 0.8,
    message: "Avoid `any` — it disables type checking.",
    why: "`any` removes the safety TypeScript gives you, so bugs that types would catch slip through. Prefer a precise type or `unknown` with narrowing.",
    suggestion: "Replace `any` with a specific type.",
    conventionRef: "Language specifics",
  },
  {
    match: (l) => /\b(TODO|FIXME)\b/.test(l),
    category: "convention",
    severity: "nit",
    confidence: 0.75,
    message: "TODO/FIXME left in the code.",
    why: "Unresolved TODOs pile up and get forgotten. Either do it now or track it in an issue.",
    conventionRef: "Git & PR hygiene",
  },
  {
    match: (l) => /(password|secret|api[_-]?key|token)\s*=\s*['\"][^'\"]+['\"]/i.test(l),
    category: "security",
    severity: "blocker",
    confidence: 0.92,
    message: "Hard-coded secret.",
    why: "Secrets in source get committed to history and leaked. Anyone with repo access — or a public mirror — can read them.",
    suggestion: "Move the value into an environment variable.",
    conventionRef: "Security",
  },
  {
    match: (l) => l.length > 120,
    category: "readability",
    severity: "nit",
    confidence: 0.7,
    message: "Very long line.",
    why: "Long lines are hard to read and review. Break it up.",
    conventionRef: "Code style",
  },
  {
    match: (l) => /catch\s*\([^)]*\)\s*\{\s*\}/.test(l),
    category: "bug",
    severity: "major",
    confidence: 0.88,
    message: "Empty catch block swallows errors.",
    why: "Silently swallowing errors hides real failures and makes debugging painful. At least log it, or handle it.",
    suggestion: "Log or handle the error instead of ignoring it.",
    conventionRef: "Code style",
  },
];

interface AddedLine {
  file: string;
  line: number;
  text: string;
}

/**
 * Parse a unified diff and return every added line with its file and new-file
 * line number. Good enough for the fake reviewer and for tests.
 */
export function parseAddedLines(diff: string): AddedLine[] {
  const out: AddedLine[] = [];
  let file = "unknown";
  let newLine = 0;

  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      // "+++ b/src/foo.ts" -> "src/foo.ts"
      file = raw.replace(/^\+\+\+ b\//, "").replace(/^\+\+\+ /, "").trim();
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = parseInt(hunk[1], 10);
      continue;
    }
    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      out.push({ file, line: newLine, text: raw.slice(1) });
      newLine++;
    } else if (!raw.startsWith("-")) {
      // Context line advances the new-file counter.
      newLine++;
    }
  }
  return out;
}
