// IDs checked against the publishers' SDK type declarations on 2026-11-06:
// openai 7.53.0 (resources/shared.d.ts), @anthropic-ai/sdk 1.6.0 (messages.d.ts).
// A preset is a form shortcut, never proof of account access or a successful request.
export const OPENAI_TEXT_MODEL_PRESETS = [
  "gpt-6-astra", "gpt-6.1-sol", "gpt-6.1-terra", "gpt-6-sol", "gpt-6-luna",
] as const;
export const GPT56_TEXT_MODEL_PRESETS = [
  "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna",
] as const;
export const CLAUDE_TEXT_MODEL_PRESETS = [
  "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5",
  "claude-mythos-5-1", "claude-fable-5-1",
] as const;

export function getTextModelPresets(protocol?: string, family?: string): readonly string[] {
  if (protocol === "anthropic_messages") return CLAUDE_TEXT_MODEL_PRESETS;
  if (protocol !== "openai_chat_completions") return [];
  const openai = [...OPENAI_TEXT_MODEL_PRESETS, ...GPT56_TEXT_MODEL_PRESETS];
  return family === "openai" ? openai : [...openai, ...CLAUDE_TEXT_MODEL_PRESETS];
}
