# AI Prompt Strategy

This project uses a lightweight prompt strategy for improving task descriptions without depending on an external AI service. The endpoint works as a deterministic text enhancer and can be upgraded to a provider-backed implementation later.

## Basic prompt pattern

Use this pattern when improving raw notes or project updates:

```text
You are an expert project coordinator. Improve the input text to be clear, concise, actionable, and professional.
Requirements:
- fix grammar and punctuation
- expand short notes into a usable task description
- preserve original intent
- format into a clear action plan when useful
- keep output in plain English with strong verbs
- avoid fluff and unnecessary commentary
```

## Current implementation behavior

The `/api/ai/improve-description` endpoint applies a local heuristic pass that:

- splits input into sentences or clauses
- capitalizes each clause consistently
- trims extra whitespace
- converts brief notes into task-style bullets
- preserves meaning while improving readability

## Production upgrade path

When an external model is available, the same endpoint can call an LLM with a stronger prompt template like:

```text
Role: Senior product manager and technical writer.
Task: Rewrite the user's raw task notes into a clean, actionable task description.
Constraints:
- Keep the scope realistic and specific
- Use an imperative tone
- Include objective, expected outcome, and acceptance cues when possible
- Return plain text or Markdown bullets
- Do not invent missing facts
```

## Guardrails

- Validate input length and empty content before prompting.
- Keep prompts deterministic and minimal for cost control.
- Require a structured response for downstream parsing.
- Avoid exposing internal system instructions in API responses.
