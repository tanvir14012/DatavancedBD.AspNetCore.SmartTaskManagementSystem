# AI Prompt Strategy & Design Guide

This document describes the AI prompt strategy for the Smart Task Management System's AI-assisted features, with a focus on the task description improvement endpoint.

---

## Overview
The system uses a lightweight, deterministic prompt strategy for improving task descriptions without depending on complicated external heuristics. The architecture supports two modes:

1. **Local heuristic implementation** (current) - Fast, deterministic, no API costs
2. **Groq-backed OpenAI-compatible implementation** (optional) - Higher quality results when `Ai:Enabled` and a valid Groq key are configured

---

## AI prompt design

### Design principles
1. **Clarity & specificity**
   - Prompts are explicit about the task and constraints
   - Reduces ambiguity in model interpretation
   - Enables consistent results across multiple runs

2. **Safety-first**
   - Guardrails prevent harmful outputs
   - Input validation before processing
   - Output validation after processing

3. **Cost-conscious**
   - Deterministic local processing when possible
   - Controlled token usage through provider settings
   - Graceful fallbacks when AI is disabled or unavailable

4. **User-centric**
   - Preserves original intent and meaning
   - Improves readability without changing substance
   - Uses a professional but natural tone

### Prompt structure

#### Current implementation (heuristic)
The `/api/tasks/improve-description` endpoint can apply a deterministic text enhancement that:

```text
Input: "Update the database schema to support new fields and make sure we handle migration properly"

Process:
1. Split into sentences or clauses
2. Normalize capitalization and whitespace
3. Convert brief notes to task-style bullets
4. Improve readability and actionability

Output:
- Update the database schema to support new fields.
- Handle migration properly.
- Ensure backward compatibility.
```

#### Optional Groq-backed implementation
When AI is enabled through the `Ai` section, the backend sends a structured prompt to Groq using the OpenAI-compatible chat completions API:

```text
Role: Senior Technical Project Manager and Technical Writer

Task: Rewrite the user's raw task notes into a clear, actionable task description.

Input format:
[User's raw notes]

Output requirements:
- Clear and concise task title (if missing, infer one)
- Objective: what needs to be done
- Expected outcome: what success looks like
- Acceptance criteria: how to verify completion
- Use imperative mood (for example: "Create", "Update", "Fix")
- Keep the scope realistic and specific
- Do not invent missing information

Constraints:
- Preserve original intent and meaning
- Use professional but accessible language
- Maximum length: 500 words
- Do not change scope or add requirements that are not present
```

---

## Prompt strategy by use case

### Use case 1: improving task descriptions
**Goal:** Convert raw notes into a professional, actionable task description.

**Example input:**
```text
fix the login page it's broken on mobile and users are confused
```

**Prompt pattern:**
```text
Role: Technical Project Manager

Task: Convert this raw note into a clear, professional task description.

Requirements:
- Identify the main issue and clarify the scope
- List acceptance criteria
- Keep the user's original intent
- Format as bullet points

Original note: {user_input}
```

**Expected output:**
```markdown
## Fix mobile login page responsiveness

**Objective:** Resolve login form usability issues on mobile devices.

**Current issues:**
- Layout breaks on small screens
- Input fields are difficult to interact with
- Users report confusion during authentication

**Acceptance criteria:**
- [ ] Login form is responsive on mobile devices
- [ ] Form controls are easy to tap and complete
- [ ] Error states are clear and understandable
- [ ] Users can successfully sign in on supported devices
```

### Use case 2: validating generated descriptions
**Goal:** Check that AI output remains aligned with the original request.

**Validation checks:**
```text
✓ Reasonable length
✓ Original intent preserved
✓ No invented requirements
✓ Professional tone maintained
✓ Grammar and clarity improved
```

### Use case 3: batch processing
**Goal:** Process multiple descriptions efficiently.

**Pattern:**
```text
Process descriptions in batches of 5-10 items when the provider is rate-limited.

For each batch:
1. Validate all inputs first
2. Send the batch to the AI provider
3. Validate the generated output
4. Store the result
5. Log failures for retry
```

---

## Notes on provider selection
The AI flow is intentionally provider-agnostic at the application layer. The current implementation is configured to use Groq through an OpenAI-compatible endpoint by setting `Ai:GroqApiKey`, `Ai:GroqEndpoint`, and `Ai:Model`.

## References
- [Groq Console](https://console.groq.com)
- [Groq Documentation](https://console.groq.com/docs)
- [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat)
