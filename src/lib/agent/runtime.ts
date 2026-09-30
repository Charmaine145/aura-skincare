import type { AgentEvent, ReplySource, SessionData, ToolName, TurnOutcome } from "@/types";
import { executeTool, type ToolContext, type ToolExecution } from "./tools";

export type Emit = (event: AgentEvent) => void;

export interface TurnResult {
  reply: string;
  source: ReplySource;
  endCall: boolean;
}

const MAX_OUTCOMES = 60;

export function recordOutcome(session: SessionData, outcome: TurnOutcome) {
  session.outcomes.push(outcome);
  if (session.outcomes.length > MAX_OUTCOMES) session.outcomes.splice(0, session.outcomes.length - MAX_OUTCOMES);
}

/** Executes a tool, streams it to the activity panel and records its verified outcome. */
export function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext, emit: Emit): ToolExecution {
  const id = crypto.randomUUID();
  emit({ type: "tool_call", id, name: name as ToolName, args });
  const started = performance.now();
  const result = executeTool(name, args, ctx);
  emit({ type: "tool_result", id, name: name as ToolName, status: result.status, summary: result.summary, ms: Math.round(performance.now() - started) });
  if (result.status === "blocked") emit({ type: "guardrail", rule: "Order-ID provenance", detail: result.summary });
  if (result.outcome) recordOutcome(ctx.session, result.outcome);
  return result;
}
