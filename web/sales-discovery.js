import { escape as e, profiles, selectedQuestions } from './engine.js';

// Short first-conversation answers reuse the established requirement IDs.
// They remain estimates; technical sizing and topology are never inferred here.
export const introQuestions = [
  { id: 'F01', title: 'What would you most like to improve?', hint: 'Pick the main reason for the conversation.', options: ['Lower costs', 'Better performance', 'Less day-to-day work', 'Move to the cloud', 'Something else', 'Not sure yet'] },
  { id: 'F02', title: 'How many databases are we talking about?', hint: 'A rough idea is enough.', options: ['One', 'A few (2–5)', 'Several (6 or more)', 'Not sure yet'] },
  { id: 'F05', title: 'Where does the application run today?', hint: 'Choose the closest match.', options: ['Our office or data centre', 'Oracle Cloud', 'AWS', 'Azure', 'Google Cloud', 'More than one place', 'Not sure yet'] },
  { id: 'F06', title: 'How much would an interruption affect the business?', hint: 'Your technical team can help with recovery targets later.', options: ['A short interruption has a big impact', 'Some downtime can be planned', 'Timing is flexible', 'Not sure yet'] },
  { id: 'F10', title: 'When would you like to get started?', hint: 'There is no need to commit to a date today.', options: ['Just exploring', 'In the next 3 months', 'In 3–6 months', 'Later', 'Not sure yet'] },
  { id: 'F08', title: 'Does the data need to stay in a particular place?', hint: 'For example, a country or your own premises.', options: ['In a particular country', 'At our own site', 'No known location requirement', 'Not sure yet'] }
];

export function introAnswer(state, question) {
  const answer = state.answers[question.id];
  const value = answer?.value || '';
  const [first, ...rest] = value.split('\n');
  const choice = question.options.includes(first) ? first : '';
  return { choice, note: choice ? rest.join('\n') : value, captured: !!value.trim() };
}

export function setIntroAnswer(state, id, choice, note) {
  const q = introQuestions.find(q => q.id === id);
  if (!q || (choice && !q.options.includes(choice))) throw Error('Invalid conversation choice');
  const old = state.answers[id] || {};
  const value = [choice, String(note || '').trim()].filter(Boolean).join('\n');
  if (old.value === value) return false;
  state.answers[id] = { ...old, value, status: choice === 'Not sure yet' ? 'Unknown' : 'Estimate' };
  return true;
}

export function prepareHandoff(state, questions, owner, due) {
  owner = String(owner || '').trim();
  if (!owner) throw Error('Add the colleague or team who will help with the technical follow-up.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due || '') || !Number.isFinite(Date.parse(due)) || new Date(due).toISOString().slice(0, 10) !== due) {
    throw Error('Choose a follow-up date.');
  }
  // Only deferred or already unknown answers get assigned. Keep known answers,
  // evidence, and any existing action ownership intact.
  let assigned = 0;
  for (const q of selectedQuestions(state, questions)) {
    const old = state.answers[q.id] || {};
    if (!old.value?.trim() || old.status === 'Unknown') {
      state.answers[q.id] = {
        ...old,
        value: old.value || '',
        status: 'Unknown',
        owner: old.owner?.trim() ? old.owner : owner,
        due: old.due || due,
        evidence: old.evidence || 'To discuss during the architect follow-up.'
      };
      assigned++;
    }
  }
  return assigned;
}

const stepNames = ['What matters', 'How it is used', 'What comes next'];
const modeTabs = mode => `<div class="tabs discovery-modes" aria-label="Discovery audience"><button data-discovery-mode="quick" class="${mode === 'quick' ? 'active' : ''}" aria-pressed="${mode === 'quick'}">First conversation</button><button data-discovery-mode="architect" class="${mode === 'architect' ? 'active' : ''}" aria-pressed="${mode === 'architect'}">Architect follow-up</button></div>`;
export { modeTabs };

function questionView(state, q, index) {
  const answer = introAnswer(state, q);
  return `<section class="conversation-question" aria-labelledby="intro-title-${q.id}">
    <p class="muted conversation-number">${index + 1} of 6</p>
    <h2 id="intro-title-${q.id}">${e(q.title)}</h2>
    <p class="muted">${e(q.hint)}</p>
    <div class="answer-choices" role="group" aria-label="${e(q.title)}">
      ${q.options.map((option, i) => `<button type="button" class="answer-choice ${answer.choice === option ? 'selected' : ''}" data-intro-id="${q.id}" data-intro-option="${i}" aria-pressed="${answer.choice === option}">${e(option)}${answer.choice === option ? '<span aria-hidden="true">✓</span>' : ''}</button>`).join('')}
    </div>
    <details class="conversation-note" ${answer.note ? 'open' : ''}><summary>Add a note (optional)</summary>
      <label class="visually-hidden" for="intro-note-${q.id}">Optional note: ${e(q.title)}</label>
      <textarea id="intro-note-${q.id}" data-intro-note="${q.id}" placeholder="Anything useful to remember, such as the application name.">${e(answer.note)}</textarea>
    </details>
  </section>`;
}

function briefView(state, showHandoff, handoffResult) {
  const captured = introQuestions.filter(q => introAnswer(state, q).captured).length;
  return `<div class="card conversation-brief"><span class="eyebrow">Conversation brief</span><h2>A useful starting point.</h2>
    <p class="muted">${captured} of 6 topics captured. You can share this starting point with the architect and fill in the rest together.</p>
    <dl class="brief-answers">${introQuestions.map((q, i) => `<div><dt>${e(q.title)}</dt><dd>${e(state.answers[q.id]?.value || 'Not discussed yet')}</dd><button type="button" class="btn small" data-sales-step="${Math.floor(i / 2)}" aria-label="Edit: ${e(q.title)}">Edit</button></div>`).join('')}</dl>
    <p class="muted">Current option: ${e(profiles[state.profile].name)}. The architect will confirm the fit, sizing, costs, connections and recovery needs.</p>
    <div class="actions"><button class="btn primary" data-sales-act="handoff">${handoffResult ? 'Update follow-up' : showHandoff ? 'Technical follow-up' : 'Prepare architect handoff'}</button><button class="btn" data-act="export">Save project file</button></div>
  </div>
  ${handoffResult ? `<div class="card soft conversation-handoff" role="status"><h2>Ready for the architect.</h2><p>${handoffResult.count} open topics are listed for ${e(handoffResult.owner)} to follow up by ${e(handoffResult.due)}.</p><p class="muted">You can finish the customer conversation here. The technical team can pick up the detail next. No message has been sent.</p><button class="btn" data-discovery-mode="architect">Open architect workspace</button></div>` : ''}
  ${showHandoff && !handoffResult ? `<form class="card conversation-handoff" id="handoffform"><h2>Who can help with the next conversation?</h2><p class="muted">Add one contact and a follow-up date for anything still unknown. No individual action forms to complete.</p>
    <div class="formgrid"><div class="field"><label for="handoff-owner">Colleague or technical team</label><input id="handoff-owner" name="owner" required placeholder="For example, your account architect or database team"></div>
    <div class="field"><label for="handoff-due">Follow-up date</label><input id="handoff-due" name="due" type="date" required></div></div>
    <p class="muted">Unanswered technical topics will be listed for this follow-up. Existing answers stay as they are. Presales agreement still happens after the BOM and design review.</p>
    <div class="footerbar"><span class="muted">This prepares the project locally. It does not send a message.</span><button class="btn primary" type="submit">Prepare follow-up</button></div>
  </form>` : ''}`;
}

export function salesView(state, step, showHandoff, heading, handoffResult = null) {
  const captured = introQuestions.filter(q => introAnswer(state, q).captured).length;
  return heading('Stage 1 / First conversation', 'Let’s start with the basics.', 'Six simple topics to understand what matters. Choose what you know, or pick “Not sure yet” and keep going.') + modeTabs('quick') + `
    <div class="conversation-progress"><span class="muted">${step < 3 ? `Part ${step + 1} of 3 · ${stepNames[step]}` : 'Your conversation brief'}</span><span class="count">${captured} of 6 topics captured</span></div>
    <div class="progressbar"><span style="width:${captured / 6 * 100}%"></span></div>
    <div class="spacer"></div>
    ${step < 3 ? `<div class="card conversation-card">${introQuestions.slice(step * 2, step * 2 + 2).map((q, i) => questionView(state, q, step * 2 + i)).join('')}
      <div class="footerbar"><div class="actions">${step ? `<button class="btn" data-sales-step="${step - 1}">← Back</button>` : ''}<button class="btn small" data-sales-step="3">Skip to summary</button></div><button class="btn primary" data-sales-step="${step + 1}">${step === 2 ? 'See conversation brief' : 'Next'} →</button></div>
    </div>` : briefView(state, showHandoff, handoffResult)}
    <p class="muted conversation-reassurance">You can leave the technical detail for the architect. Your answers are saved as you go.</p>`;
}
