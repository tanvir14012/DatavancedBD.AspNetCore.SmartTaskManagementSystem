import assert from 'node:assert/strict';
import test from 'node:test';
import { improveDescriptionLocally } from '../src/domain/description.js';
import { DescriptionAiService } from '../src/infrastructure/description-ai.js';

void test('local description pass preserves the existing single-step and multi-step contracts', () => {
  assert.equal(improveDescriptionLocally('  fix login. '), 'Task: Fix login');
  assert.equal(
    improveDescriptionLocally('fix login; add tests'),
    '- Fix login\n- Add tests',
  );
});

void test('configured provider result is parsed and bad provider output falls back', async () => {
  const previous = {
    enabled: process.env.AI_ENABLED,
    key: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL,
    endpoint: process.env.GROQ_ENDPOINT,
    fetch: globalThis.fetch,
  };
  try {
    process.env.AI_ENABLED = 'true';
    process.env.GROQ_API_KEY = 'test-only-key';
    process.env.GROQ_MODEL = 'test-only-model';
    process.env.GROQ_ENDPOINT = 'https://api.groq.com/openai/v1';
    let called = 0;
    globalThis.fetch = () => {
      called += 1;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '  Clear task  ' } }],
          }),
          { status: 200 },
        ),
      );
    };
    const service = new DescriptionAiService();
    assert.equal(await service.improve('rough task'), 'Clear task');
    assert.equal(called, 1);
    process.env.GROQ_ENDPOINT = 'https://untrusted.example/v1';
    assert.equal(await service.improve('rough task'), null);
    assert.equal(called, 1);
  } finally {
    if (previous.enabled === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = previous.enabled;
    if (previous.key === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previous.key;
    if (previous.model === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = previous.model;
    if (previous.endpoint === undefined) delete process.env.GROQ_ENDPOINT;
    else process.env.GROQ_ENDPOINT = previous.endpoint;
    globalThis.fetch = previous.fetch;
  }
});
