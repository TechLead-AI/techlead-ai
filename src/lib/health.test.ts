import { describe, it, expect } from "vitest";
import { appName, isHealthy } from "./health";

describe("health", () => {
  it("reports the app name", () => {
    expect(appName()).toBe("Tech Lead AI");
  });

  it("is healthy", () => {
    expect(isHealthy()).toBe(true);
  });
});
