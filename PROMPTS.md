# AI Prompt Strategy & Design Guide

This document describes the AI prompt strategy for the Smart Task Management System's AI-assisted features, with focus on the task description improvement endpoint.

---

## Overview

The system uses a lightweight, deterministic prompt strategy for improving task descriptions without depending on complex external AI services. The architecture supports:

1. **Local heuristic implementation** (current) - Fast, deterministic, no API costs
2. **LLM-backed implementation** (future) - Higher quality results using GitHub Models or other providers

---

## AI Prompt Design

### Design Principles

1. **Clarity & Specificity**
   - Prompts are explicit about the task and constraints
   - Reduces ambiguity in model interpretation
   - Enables consistent results across multiple runs

2. **Safety-First**
   - Guardrails prevent harmful outputs
   - Input validation before processing
   - Output validation after processing

3. **Cost-Conscious**
   - Minimal prompts for free tier APIs
   - Deterministic local processing when possible
   - Controlled token usage with LLM providers

4. **User-Centric**
   - Preserves original intent and meaning
   - Improves readability without changing substance
   - Professional tone enhancement

### Prompt Structure

#### Current Implementation (Heuristic)

The `/api/tasks/improve-description` endpoint applies a deterministic text enhancement:

```text
Input: "Update the database schema to support new fields and make sure we handle migration properly"

Process:
1. Split into sentences/clauses
2. Capitalize each clause consistently
3. Trim extra whitespace
4. Convert brief notes to task-style bullets
5. Enhance verbs and language

Output:
- Update the database schema to support new fields.
- Handle migration properly.
- Ensure backward compatibility.
```

#### Future LLM Implementation

When an external LLM is available, use this structured prompt:

```text
Role: Senior Technical Project Manager & Technical Writer

Task: Rewrite the user's raw task notes into a clean, actionable task description.

Input Format:
[User's raw notes]

Output Requirements:
- Clear, concise task title (if missing, infer one)
- Objective: What needs to be done
- Expected Outcome: What success looks like
- Acceptance Criteria: How to verify completion
- Use imperative mood (e.g., "Create", "Update", "Fix")
- Format as Markdown with bullet points
- Keep scope realistic and specific
- Do NOT invent missing information

Constraints:
- Preserve original intent and meaning
- Use professional but accessible language
- Avoid technical jargon without explanation
- Maximum length: 500 words
- Do NOT add estimated time or assign resources
- Do NOT modify scope or add requirements
```

---

## Prompt Strategy by Use Case

### Use Case 1: Improving Task Descriptions

**Goal:** Convert raw user notes into a professional, actionable task description.

**Input Example:**
```
"fix the login page it's broken on mobile and users are confused"
```

**Prompt Pattern:**
```text
Role: Technical Project Manager

Task: Convert this raw note into a clear, professional task description.

Requirements:
- Identify the main issue and clarify the scope
- List acceptance criteria
- Use professional language
- Keep the user's original intent
- Format as bullet points

Original note: {user_input}
```

**Expected Output:**
```markdown
## Fix Mobile Login Page Responsiveness

**Objective:** Resolve login form usability issues on mobile devices

**Current Issues:**
- Layout breaks on small screens
- Input fields are difficult to interact with
- Users report confusion during authentication

**Acceptance Criteria:**
- [ ] Login form is responsive on mobile (320px - 768px)
- [ ] All form fields are easily tappable (minimum 44x44px)
- [ ] Error messages display clearly
- [ ] Form submission works on iOS and Android
- [ ] Users can complete login in under 30 seconds

**Testing:** Test on iPhone SE, Android 12, and tablet devices
```

### Use Case 2: Processing AI-Generated Descriptions

**Goal:** Validate and refine AI-generated descriptions.

**Validation Checks:**
```
✓ Length reasonable (100-1000 words)
✓ Original intent preserved
✓ No hallucinations or invented facts
✓ Professional tone maintained
✓ Grammatically correct
✓ Structurally clear
```

**Post-Processing:**
```typescript
function validateDescription(original: string, improved: string): {
  isValid: boolean;
  warnings: string[];
} {
  const checks = [
    // Check length
    improved.length < 100 || improved.length > 1000,
    // Check for keyword preservation
    containsKeywords(original, improved),
    // Check for hallucinations (no new technical terms)
    !introducesNewTechTerms(original, improved),
  ];

  return {
    isValid: checks.every(c => c),
    warnings: checks.filter(c => !c).map(c => c.message),
  };
}
```

### Use Case 3: Batch Processing

**Goal:** Process multiple descriptions efficiently.

**Pattern:**
```text
Process descriptions in batches of:
- 5-10 for free tier API (rate limit aware)
- 50-100 for production tier API

For each batch:
1. Validate all inputs first
2. Send batch to AI service
3. Validate all outputs
4. Store results
5. Log failures for retry
```

---

## Example Inputs and Outputs

### Example 1: Short Notes → Task Description

**Input:**
```
implement search feature
```

**Prompt:**
```text
Convert this short note into a detailed task:
- Add a specific objective
- List what needs to be built
- Define success criteria
```

**Output:**
```markdown
## Implement Search Feature

**Objective:** Enable users to search tasks by title and description

**Scope:**
- Add search input field to task list page
- Implement server-side search API endpoint
- Filter tasks by keyword match
- Display result count
- Sort results by relevance

**Acceptance Criteria:**
- [ ] Users can type in search box and results update in real-time
- [ ] Searches work on task title and description
- [ ] Results show matching snippet
- [ ] Search is case-insensitive
- [ ] Empty search shows all tasks
- [ ] Performance: search completes in <500ms
```

### Example 2: Technical Notes → Clear Task

**Input:**
```
refactor auth middleware to use new JWT validation with async handlers and support custom claim types
```

**Prompt:**
```text
Break down this technical task:
- Explain what's being refactored and why
- List specific files to change
- Define success criteria
```

**Output:**
```markdown
## Refactor Authentication Middleware

**Current State:**
- Legacy JWT validation using synchronous handler
- Limited claim type support

**Target State:**
- Async JWT validation with custom claim support
- Improved error handling and logging

**Work Items:**
- [ ] Create async JWT validation handler
- [ ] Add custom claim mapper
- [ ] Update middleware configuration
- [ ] Migrate existing code to use new handlers
- [ ] Add unit tests for new validators
- [ ] Update security documentation

**Files to Modify:**
- `Api/Services/AuthService.cs`
- `Api/Middleware/JwtMiddleware.cs`
- `Api/Options/AuthenticationOptions.cs`

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Backward compatibility maintained for standard claims
- [ ] Custom claims properly validated
- [ ] No performance degradation
```

### Example 3: Vague Requirements → Structured Task

**Input:**
```
update styling make it look better
```

**Prompt:**
```text
Transform this vague request into a specific design task:
- Identify specific areas to improve
- Define visual goals
- List concrete changes
```

**Output:**
```markdown
## Enhance Dashboard Visual Design

**Current Issues:**
- Typography needs hierarchy improvement
- Color scheme lacks contrast on accessibility check
- Spacing inconsistencies between components
- Buttons have ambiguous primary vs secondary states

**Design Goals:**
- Improve visual hierarchy
- Meet WCAG AA accessibility standards
- Create consistent spacing and alignment
- Establish clear button hierarchy

**Specific Changes:**
- [ ] Update heading font sizes and weights
- [ ] Adjust color contrast ratios (test with ColorOracle)
- [ ] Implement 8px grid spacing system
- [ ] Define button styles (primary, secondary, tertiary)
- [ ] Audit component spacing consistency
- [ ] Test with screen readers

**Deliverables:**
- Updated component library
- Updated dashboard page
- Accessibility test report
```

---

## Validation Approach

### Input Validation

Before sending to AI or local processor:

```typescript
interface DescriptionInput {
  text: string;
  maxLength?: number;
}

function validateInput(input: DescriptionInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if input exists
  if (!input.text || input.text.trim().length === 0) {
    errors.push('Description cannot be empty');
  }

  // Check minimum length
  if (input.text.trim().length < 10) {
    errors.push('Description must be at least 10 characters');
  }

  // Check maximum length
  const maxLength = input.maxLength || 5000;
  if (input.text.length > maxLength) {
    errors.push(`Description cannot exceed ${maxLength} characters`);
  }

  // Check for suspicious content
  if (containsMaliciousCode(input.text)) {
    errors.push('Description contains potentially harmful content');
  }

  // Check language (optional)
  if (!isViableLanguage(input.text)) {
    errors.push('Description language not supported');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

### Output Validation

After AI processing:

```typescript
interface ValidationResult {
  valid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
}

interface ValidationIssue {
  type: 'quality' | 'safety' | 'style';
  severity: 'error' | 'warning';
  message: string;
}

function validateOutput(
  original: string,
  improved: string
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Check length
  if (improved.length < original.length * 0.5) {
    issues.push({
      type: 'quality',
      severity: 'warning',
      message: 'Improved description is much shorter than original',
    });
  }

  // 2. Check keyword preservation
  const originalKeywords = extractKeywords(original);
  const improvedKeywords = extractKeywords(improved);
  const preservedRate = calculatePreservationRate(originalKeywords, improvedKeywords);

  if (preservedRate < 0.7) {
    issues.push({
      type: 'quality',
      severity: 'error',
      message: 'Original meaning not preserved in improved description',
    });
  }

  // 3. Check for hallucinations
  if (introducesNewClaims(original, improved)) {
    issues.push({
      type: 'quality',
      severity: 'error',
      message: 'Improved description adds unsupported claims',
    });
  }

  // 4. Check grammar and structure
  const grammarIssues = validateGrammar(improved);
  issues.push(...grammarIssues);

  // 5. Check safety
  if (containsMaliciousCode(improved)) {
    issues.push({
      type: 'safety',
      severity: 'error',
      message: 'Output contains potentially harmful content',
    });
  }

  // Calculate score
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const score = Math.max(0, 100 - errorCount * 10 - warningCount * 5);

  return {
    valid: errorCount === 0,
    score,
    issues,
  };
}
```

### Scoring Rubric

```
100: Perfect - Ready to use immediately
80-99: Good - Minor style issues, still usable
60-79: Fair - Needs review before use
40-59: Poor - Significant issues, requires editing
<40: Invalid - Do not use, regenerate
```

---

## Safety Considerations

### Security Guardrails

#### 1. Input Sanitization

```typescript
function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>{}]/g, '') // Remove potential markup
    .replace(/javascript:/gi, '') // Remove script protocols
    .replace(/on\w+=/gi, ''); // Remove event handlers
}
```

#### 2. Prompt Injection Prevention

Never construct prompts by directly concatenating user input:

```typescript
// ❌ DON'T: Vulnerable to prompt injection
const prompt = `Improve this text: ${userInput}`;

// ✅ DO: Use structured approach with clear boundaries
const prompt = buildPrompt({
  instruction: 'Improve task description',
  userInput: userInput,
  constraints: [...],
  maxTokens: 500,
});
```

#### 3. Output Filtering

```typescript
const BANNED_PATTERNS = [
  /credit.?card/i,
  /social.?security/i,
  /password/i,
  /@example\.com/i, // Email patterns
];

function filterSensitiveData(text: string): string {
  let filtered = text;

  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(filtered)) {
      console.warn(`Potentially sensitive data detected: ${pattern}`);
      // Flag for review, don't auto-remove to avoid data loss
      return ''; // Return empty and alert user
    }
  }

  return filtered;
}
```

### Rate Limiting

For AI service calls, implement rate limiting:

```typescript
class AiServiceRateLimiter {
  private requestQueue: RequestItem[] = [];
  private readonly maxRequests = 10;
  private readonly windowMs = 60000; // 1 minute

  async enqueue(task: () => Promise<string>): Promise<string> {
    const now = Date.now();

    // Remove expired requests
    this.requestQueue = this.requestQueue.filter(
      r => r.timestamp > now - this.windowMs
    );

    // Check limit
    if (this.requestQueue.length >= this.maxRequests) {
      const oldestRequest = this.requestQueue[0];
      const waitMs = this.windowMs - (now - oldestRequest.timestamp);
      throw new Error(`Rate limit exceeded. Retry after ${waitMs}ms`);
    }

    // Add request
    this.requestQueue.push({ timestamp: now });

    return task();
  }
}
```

### Audit Logging

Log all AI operations for compliance:

```typescript
interface AiAuditLog {
  timestamp: Date;
  userId: string;
  operation: 'improve-description' | 'validate-output';
  inputLength: number;
  outputLength: number;
  validationScore: number;
  success: boolean;
  errorMessage?: string;
}

function logAiOperation(log: AiAuditLog): void {
  logger.info('AI Operation', {
    ...log,
    timestamp: log.timestamp.toISOString(),
    // Don't log actual content, just metadata
  });
}
```

### Cost Control

Track and limit API spending:

```typescript
interface UsageMetrics {
  requestsPerDay: number;
  tokensPerDay: number;
  estimatedCostPerDay: number;
  currentLimit: number;
}

function trackUsage(
  inputTokens: number,
  outputTokens: number,
  modelPricing: { input: number; output: number }
): void {
  const costThisRequest =
    inputTokens * modelPricing.input + outputTokens * modelPricing.output;

  if (costThisRequest > ALERT_THRESHOLD) {
    logger.warn('High cost AI request', { costThisRequest });
  }

  // Update daily metrics
  updateDailyUsage(costThisRequest);
}
```

### Error Handling

Graceful degradation when AI fails:

```typescript
async function improveDescriptionWithFallback(
  description: string
): Promise<string> {
  try {
    // Try AI improvement first
    const improved = await aiService.improveDescription(description);

    // Validate output
    const validation = validateOutput(description, improved);
    if (validation.valid) {
      return improved;
    }

    // If validation fails, log but return original
    logger.warn('AI output validation failed', validation.issues);
    return description;
  } catch (error) {
    // If AI service is down, return original
    logger.error('AI service error', error);
    return description; // Return original, still useful
  }
}
```

---

## Production Deployment Checklist

- [ ] Input validation implemented and tested
- [ ] Output validation with scoring
- [ ] Sanitization of user inputs
- [ ] Prompt injection prevention
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Error handling with fallbacks
- [ ] Cost monitoring and alerts
- [ ] API key rotation strategy
- [ ] Monitoring and alerting set up
- [ ] Documentation reviewed by security team
- [ ] User privacy policy updated

---

## Future Enhancements

1. **Model Selection:** Support multiple models (gpt-4, claude, llama)
2. **Caching:** Cache results for identical inputs
3. **Batch Processing:** Queue and batch process descriptions
4. **Feedback Loop:** Learn from user corrections
5. **Custom Prompts:** Allow users to define improvement preferences
6. **Localization:** Support prompts in multiple languages

---

## References

- [GitHub Models Documentation](https://docs.github.com/en/github-models)
- [OpenAI Prompt Engineering](https://platform.openai.com/docs/guides/prompt-engineering)
- [OWASP AI Security](https://owasp.org/www-project-ai-security-and-privacy-guide/)
- [NIST AI Risk Management](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
