import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEntityDefinition } from '@hagicode/hagilight-core/entity-definition';

test('the en-US definition is one sentence that begins "HagiCode is"', () => {
  const definition = getEntityDefinition('en-US');
  assert.match(definition, /^HagiCode is a proposal-driven AI coding workbench\b/u);
  assert.equal((definition.match(/[.!?](?=\s|$)/gu) ?? []).length, 1, 'exactly one sentence terminator');
  assert.ok(definition.endsWith('.'));
  assert.match(definition, /Claude Code/u);
  assert.match(definition, /team knowledge/u);
});

test('the zh-CN definition is present, one sentence, and differs from en-US', () => {
  const zh = getEntityDefinition('zh-CN');
  assert.match(zh, /^HagiCode 是一款提案驱动的 AI 编码工作台/u);
  assert.equal((zh.match(/[。！？]/gu) ?? []).length, 1, 'exactly one sentence terminator');
  assert.notEqual(zh, getEntityDefinition('en-US'));
});

test('a locale without its own definition, or an unknown one, receives the en-US sentence', () => {
  const en = getEntityDefinition('en-US');
  assert.equal(getEntityDefinition('fr-FR'), en);
  assert.equal(getEntityDefinition('zh-Hant'), en);
  assert.equal(getEntityDefinition('constructor'), en);
  assert.equal(getEntityDefinition(undefined), en);
});
