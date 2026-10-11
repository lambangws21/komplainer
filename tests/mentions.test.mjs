import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMentions, newMentions, mentionSuggestions } from '../src/lib/mentions.mjs';

const accounts = [{ id: 'USR-1', nama: 'Budi Santoso' }, { id: 'USR-2', nama: 'Budi' }, { id: 'USR-3', nama: 'Ani' }];

test('extractMentions matches full names with word boundaries, preferring the longest match', () => {
  assert.deepEqual(extractMentions('Tolong cek @Budi Santoso soal implant ini.', accounts), ['USR-1']);
  assert.deepEqual(extractMentions('@Budi tolong dicek', accounts), ['USR-2']);
  assert.deepEqual(extractMentions('email budi@gmail.com bukan mention', accounts), []);
  assert.deepEqual(new Set(extractMentions('@Ani dan @Budi Santoso sudah tahu.', accounts)), new Set(['USR-3', 'USR-1']));
});

test('newMentions only reports mentions not already present in the previous text, excluding self', () => {
  assert.deepEqual(newMentions('', '@Ani sudah tahu', accounts, 'USR-1'), ['USR-3']);
  assert.deepEqual(newMentions('@Ani sudah tahu', '@Ani sudah tahu, @Budi juga', accounts, 'USR-1'), ['USR-2']);
  assert.deepEqual(newMentions('@Ani sudah tahu', '@Ani sudah tahu', accounts, 'USR-1'), []);
  assert.deepEqual(newMentions('', '@Ani perlu tahu', accounts, 'USR-3'), []);
});

test('mention suggestions support full names, empty search, and completed mentions', () => {
  assert.equal(mentionSuggestions('email@company', accounts), null);
  assert.equal(mentionSuggestions('@Budi Santoso ', accounts), null);
  assert.deepEqual(mentionSuggestions('Tolong @budi san', accounts).options.map((a) => a.id), ['USR-1']);
  assert.equal(mentionSuggestions('@', accounts).options.length, 3);
  assert.deepEqual(mentionSuggestions('@unknown', accounts).options, []);
  assert.equal(mentionSuggestions('Tolong @Budi\nlanjut', accounts), null);
});
