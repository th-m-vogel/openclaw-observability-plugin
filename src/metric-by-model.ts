import { GEN_AI_AGENT_ID, GEN_AI_CONVERSATION_ID } from "./semconv.js";

export function stripToModelTierAttrs(attrs: Record<string, string>): Record<string, string> {
  const result = { ...attrs };
  delete result[GEN_AI_CONVERSATION_ID];
  delete result[GEN_AI_AGENT_ID];
  return result;
}
