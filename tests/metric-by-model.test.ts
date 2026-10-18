import { describe, expect, it } from "vitest";
import { stripToModelTierAttrs } from "../src/metric-by-model.js";

describe("stripToModelTierAttrs", () => {
  it("drops gen_ai.conversation.id and gen_ai.agent.id", () => {
    const attrs = {
      "gen_ai.response.model": "claude-3.5-sonnet",
      "gen_ai.provider.name": "anthropic",
      "gen_ai.conversation.id": "agent:main:cron:job1:run:abc",
      "gen_ai.agent.id": "main",
    };
    expect(stripToModelTierAttrs(attrs)).toEqual({
      "gen_ai.response.model": "claude-3.5-sonnet",
      "gen_ai.provider.name": "anthropic",
    });
  });

  it("leaves other attributes, including token.type, untouched", () => {
    const attrs = {
      "gen_ai.response.model": "gpt-test",
      "gen_ai.operation.name": "chat",
      "token.type": "cache_read",
    };
    expect(stripToModelTierAttrs(attrs)).toEqual(attrs);
  });

  it("is a no-op when neither key is present", () => {
    const attrs = { "gen_ai.response.model": "gpt-test" };
    expect(stripToModelTierAttrs(attrs)).toEqual(attrs);
  });

  it("does not mutate the input object", () => {
    const attrs = {
      "gen_ai.response.model": "gpt-test",
      "gen_ai.conversation.id": "session-1",
    };
    stripToModelTierAttrs(attrs);
    expect(attrs).toEqual({
      "gen_ai.response.model": "gpt-test",
      "gen_ai.conversation.id": "session-1",
    });
  });
});
