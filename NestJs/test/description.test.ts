import assert from 'node:assert/strict';
import test from 'node:test';
import { improveDescriptionLocally } from '../src/domain/description.js';

void test('local description pass preserves the existing single-step and multi-step contracts', () => {
  assert.equal(improveDescriptionLocally('  fix login. '), 'Task: Fix login');
  assert.equal(
    improveDescriptionLocally('fix login; add tests'),
    '- Fix login\n- Add tests',
  );
});
