import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fresh, profiles, preGaps, approve, change, agreementValid, importState } from '../web/engine.js';
import { introQuestions, introAnswer, setIntroAnswer, prepareHandoff, salesView } from '../web/sales-discovery.js';

const questions = JSON.parse(await readFile(new URL('../web/data/questions.json', import.meta.url)));
const project = (profile = 'S') => ({ ...fresh(), profile, project: 'Test opportunity', region: 'To confirm with architect' });

test('first conversation is six plain-language topics with an unsure option', () => {
  assert.equal(introQuestions.length, 6);
  for (const q of introQuestions) {
    assert(q.options.includes('Not sure yet'));
    assert(questions.common.some(original => original.id === q.id));
  }
  const html = salesView(project(), 0, false, () => '');
  assert.equal((html.match(/class="conversation-question"/g) || []).length, 2);
  assert(!html.includes('data-part="owner"'));
  assert(!html.includes('data-part="evidence"'));
  assert(!html.includes('id="handoffform"'));
});

test('rough sales choices retain traceability but never invent capacity or technical settings', () => {
  const s = project();
  const before = JSON.stringify([s.sizing, s.network]);
  setIntroAnswer(s, 'F02', 'A few (2–5)', 'Include development');
  assert.equal(s.answers.F02.value, 'A few (2–5)\nInclude development');
  assert.equal(s.answers.F02.status, 'Estimate');
  assert.equal(JSON.stringify([s.sizing, s.network]), before);
  assert.deepEqual(introAnswer(s, introQuestions[1]), { choice: 'A few (2–5)', note: 'Include development', captured: true });
  assert.equal(importState(JSON.parse(JSON.stringify(s))).answers.F02.value, s.answers.F02.value);
});

test('existing customer answers and evidence survive the simplified UI and handoff', () => {
  const s = project();
  s.answers.F01 = { value: 'Customer portal; reduce maintenance', status: 'Confirmed', evidence: 'Customer workshop' };
  const original = JSON.stringify(s.answers.F01);
  assert.equal(introAnswer(s, introQuestions[0]).note, s.answers.F01.value);
  prepareHandoff(s, questions, 'Account architect', '2026-12-01');
  assert.equal(JSON.stringify(s.answers.F01), original);
});

test('unsure answers need no action form during discovery but still block agreement until owned', () => {
  const s = project();
  for (const q of introQuestions) setIntroAnswer(s, q.id, 'Not sure yet', '');
  assert(s.answers.F01.status === 'Unknown');
  assert(preGaps(s, questions).length > 0);
  assert.throws(() => approve(s, questions, 'Reviewer', 'Follow up later', true));
  assert.throws(() => prepareHandoff(s, questions, '', '2026-12-01'));
  assert.throws(() => prepareHandoff(s, questions, 'Architect', '2026-02-30'));
  assert.equal(prepareHandoff(s, questions, 'Architect', '2026-12-01'), 19);
  assert.equal(preGaps(s, questions).length, 0);
  assert.equal(s.approval, null, 'Handoff is not presales acceptance');
  approve(s, questions, 'Reviewer', 'Architect owns open points by 1 December', true);
  assert(agreementValid(s));
  setIntroAnswer(s, 'F01', 'Lower costs', '');
  change(s);
  assert(!agreementValid(s));
});

test('handoff assigns the selected profile only and preserves existing action owners', () => {
  for (const profile of Object.keys(profiles)) {
    const s = project(profile);
    s.answers.F03 = { value: '', status: 'Unknown', owner: 'Existing DBA', due: '2026-12-03', evidence: 'Existing action' };
    prepareHandoff(s, questions, 'New architect', '2026-12-01');
    assert.equal(Object.keys(s.answers).length, 19);
    assert.equal(s.answers.F03.owner, 'Existing DBA');
    assert.equal(s.answers.F03.due, '2026-12-03');
    assert.equal(s.answers.F03.evidence, 'Existing action');
    assert(questions[profile].every(q => s.answers[q.id]?.status === 'Unknown'));
    assert.equal(preGaps(s, questions).length, 0);
  }
});

test('the brief escapes customer text and allows skipping without fabricating answers', () => {
  const s = project();
  s.answers.F01 = { value: '<script>alert(1)</script>', status: 'Estimate' };
  const html = salesView(s, 3, true, () => '');
  assert(html.includes('&lt;script&gt;'));
  assert(!html.includes('<script>'));
  assert(html.includes('Not discussed yet'));
  assert.equal(Object.keys(s.answers).length, 1);
  assert(preGaps(s, questions).length > 0);
});

test('handoff ends in a short confirmation and leaves the architect worksheet optional', () => {
  const html = salesView(project(), 3, false, () => '', { count: 17, owner: 'Account architect', due: '2026-12-01' });
  assert(html.includes('Ready for the architect.'));
  assert(html.includes('Open architect workspace'));
  assert(!html.includes('id="handoffform"'));
  assert(!html.includes('data-part="status"'));
});
