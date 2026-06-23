import Anthropic from "@anthropic-ai/sdk";
import {
  ReviewResultSchema,
  type ReviewResult,
  CATEGORIES,
  SEVERITIES,
} from "./types";
import type { Reviewer, ReviewInput } from "./reviewer";

/**
 * Real review engine backed by Claude. Asks the model to return a structured
 * JSON review, then validates it with the same zod schema the rest of the code
 * uses. See DESIGN.md component 3.
 */
export class AnthropicReviewer implements Reviewer {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async review(input: ReviewInput): Promise<ReviewResult> {
    const system = buildSystemPrompt();
    const user = buildUserPrompt(input);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    const json = extractJson(text);
    // Validate against our schema; throws if the model returned a bad shape.
    return ReviewResultSchema.parse(json);
  }
}

export function buildSystemPrompt(): string {
  return [
    "You are Tech Lead AI, a senior engineer mentoring a junior developer by reviewing their pull request.",
    "Be encouraging but honest. For every issue, explain WHY it matters in a way a junior can learn from.",
    "Ground each comment in the team conventions when relevant; otherwise use general best practice.",
    "Only flag real issues — do not invent problems. Prefer fewer, high-value comments.",
    "",
    "Return ONLY a JSON object with this exact shape:",
    "{",
    '  "summary": string,',
    '  "comments": [{',
    '    "filePath": string,',
    '    "lineStart": number, "lineEnd": number,',
    `    "category": one of ${JSON.stringify(CATEGORIES)},`,
    `    "severity": one of ${JSON.stringify(SEVERITIES)},`,
    '    "confidence": number between 0 and 1,',
    '    "message": string, "why": string,',
    '    "suggestion": string (optional), "conventionRef": string (optional)',
    "  }]",
    "}",
  ].join("\n");
}

export function buildUserPrompt(input: ReviewInput): string {
  const history =
    input.recentMistakeCategories.length > 0
      ? `This junior has previously been given feedback in these categories: ${input.recentMistakeCategories.join(
          ", ",
        )}. If you see the same kind of issue again, mention that it's a recurring pattern.`
      : "No prior feedback history for this junior.";

  return [
    `# Pull request: ${input.prTitle}`,
    "",
    "## Team conventions",
    input.conventions,
    "",
    "## Mentoring context",
    history,
    "",
    "## Diff to review",
    "```diff",
    input.diff,
    "```",
  ].join("\n");
}

/** Pull the first JSON object out of a model response, tolerating prose/fences. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
