import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReviewSummary, truncate } from '../src/utils/formatters.js';

test('truncate short text unchanged', () => {
  assert.equal(truncate('abc', 10), 'abc');
});

test('truncate long text', () => {
  assert.equal(truncate('abcdefgh', 5), 'abcde...');
});

test('formatReviewSummary returns fallback when empty', () => {
  assert.equal(formatReviewSummary([]), '暂无评论。');
});
