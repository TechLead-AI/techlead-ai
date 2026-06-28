import { describe, it, expect } from "vitest";
import { FakeReviewer } from "./reviewer";

/** Build a one-file diff whose single added line is `line`. */
function diffWithLine(line: string): string {
  return ["+++ b/src/example.py", "@@ -0,0 +1,1 @@", `+${line}`].join("\n");
}

async function review(line: string) {
  return new FakeReviewer().review({
    prTitle: "Test",
    conventions: "Be tidy.",
    diff: diffWithLine(line),
    recentMistakeCategories: [],
  });
}

describe("FakeReviewer Python smells", () => {
  it("flags a leftover print()", async () => {
    const { comments } = await review('    print("debug", value)');
    expect(comments).toHaveLength(1);
    expect(comments[0].message).toBe("Leftover print().");
    expect(comments[0].severity).toBe("nit");
  });

  it("flags a bare except:", async () => {
    const { comments } = await review("    except:");
    expect(comments).toHaveLength(1);
    expect(comments[0].message).toBe("Bare `except:` catches everything.");
    expect(comments[0].severity).toBe("major");
  });

  it("does not flag a specific except", async () => {
    const { comments } = await review("    except ValueError:");
    expect(comments).toHaveLength(0);
  });

  it("does not flag a clean line", async () => {
    const { comments } = await review("    total = a + b");
    expect(comments).toHaveLength(0);
  });
});
