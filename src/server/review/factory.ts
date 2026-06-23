import type { Reviewer } from "./reviewer";
import { FakeReviewer } from "./reviewer";
import { AnthropicReviewer } from "./anthropic-reviewer";

/**
 * Choose the reviewer based on the environment. With an API key we use Claude;
 * without one we fall back to the offline FakeReviewer so the demo always works.
 */
export function createReviewer(): { reviewer: Reviewer; modelVersion: string } {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.REVIEW_MODEL || "claude-sonnet-4-6";

  if (apiKey && apiKey.trim().length > 0) {
    return { reviewer: new AnthropicReviewer(apiKey, model), modelVersion: model };
  }
  return { reviewer: new FakeReviewer(), modelVersion: "fake-reviewer-v1" };
}
