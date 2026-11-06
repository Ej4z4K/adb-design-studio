import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fresh,profiles,preGaps,approve,change,agreementValid,importState,sizing,bom,selectedQuestions,detailFields,lldText} from '../web/engine.js';
import {introQuestions,introAnswer,setIntroAnswer,accessPolicy,validatedSize,proposalSize,openAssumptions,PUBLIC_ACCESS} from '../web/presales-model.js';
import {startView,conversationView,sizeView,connectionsView,costsView,reviewView,costSummary} from '../web/presales-ui.js';
import {diagram} from '../web/hld.js';
const questions=JSON.parse(await readFile(new URL('../web/data/questions.json',import.meta.url)));
const cat={source:'Oracle public test fixture',retrievedAt:new Date().toISOString(),products:[{sku:'B95702',unit:'ECPU Per Hour',rates:{GBP:0.25}},{sku:'B95706',unit:'Gigabyte Storage Capacity Per Month',rates:{GBP:0.1}}]};
const project=(profile='S')=>({...fresh(),profile,project:'Test proposal',region:'uk-london-1'});
function followup(s){Object.assign(s.presales,{contact:'Account architect',followup:'2026-12-01'});return s;}
function confirmedSize(s){Object.assign(s.presales,{validatedCount:'2',validatedEcpu:'10',validatedGB:'1000',validatedHours:'730',sizingReviewer:'DB architect',sizingEvidence:'Measured target assessment',sizingValidated:true});return s;}
const heading=()=>'';

test('sales sees eight discovery questions, one at a time, and may start without a service',()=>{
 const s=project('');assert.equal(introQuestions.length,8);
 for(const q of introQuestions)assert(q.options.some(o=>/Not sure|Recommend/.test(o)));
 const html=conversationView(s,0,heading);assert(html.includes('What are you looking to improve?'));assert(!html.includes('data-part="owner"'));assert(!html.includes('How many databases are involved?'));
 assert(startView(s,heading).includes('Help us choose'));
 assert(sizeView(s,heading).includes('No service')===false);
 assert(costsView(s,cat,heading,()=>''));assert(diagram(s).includes('Service selection pending'));
 assert(!preGaps(followup(s),questions).every(x=>!x.includes('service')));
});
test('discovery bands create explicit numerical budget quantities before architect validation',()=>{
 const s=project();setIntroAnswer(s,'F02','2–5','');setIntroAnswer(s,'F03','100 GB–1 TB','');
 assert.equal(sizing(s).base,8);assert.equal(sizing(s).storage,400);const b=bom(s,cat);assert.equal(b.lines.find(l=>l.id==='compute').amount,4380);assert.equal(b.lines.find(l=>l.id==='storage').amount,120);assert.equal(b.subtotal,4500);assert.equal(costSummary(s,cat).headline,'£4,500.00');assert(!validatedSize(s).valid);assert(openAssumptions(s).some(a=>a.includes('Budget quantity: 3')));
 assert.equal(importState(JSON.parse(JSON.stringify(s))).answers.F02.value,'2–5');
});
test('architect validation requires positive exact quantities, evidence and a named reviewer',()=>{
 const s=confirmedSize(project());assert(validatedSize(s).valid);const b=bom(s,cat);assert.equal(b.lines.find(l=>l.id==='compute').quantity,14600);assert.equal(b.lines.find(l=>l.id==='storage').quantity,2000);assert.equal(b.subtotal,3850);
 for(const [key,value] of [['validatedCount','2–5'],['validatedEcpu','-1'],['validatedHours','745'],['sizingEvidence',''],['sizingReviewer','']]){const bad=structuredClone(s);bad.presales[key]=value;assert(!validatedSize(bad).valid);assert.equal(sizing(bad).base,8);}
 setIntroAnswer(s,'F04','Mainly working hours','');assert(!validatedSize(s).valid,'Changed sales inputs require renewed size validation');
});
test('private connectivity is explicitly assumed and new circuit charges excluded while configuration stays unpriced',()=>{
 const s=project();const policy=accessPolicy(s);assert(policy.assumption.includes('VPN or FastConnect'));assert(policy.assumption.includes('excluded'));const b=bom(s,cat);const circuit=b.lines.find(l=>l.id==='connection');assert(circuit.excluded);assert.equal(circuit.amount,0);assert.equal(b.lines.find(l=>l.id==='extra0').amount,null);assert(b.lines.find(l=>l.id==='extra0').label.includes('configuration'));assert(diagram(s).includes('Existing VPN / FastConnect'));assert(openAssumptions(s).includes(policy.assumption));
});
test('site and native-provider assumptions stay separate from OCI circuit requirements',()=>{
 for(const p of ['C','AS','AD','AZ','GC']){const s=project(p),a=accessPolicy(s);assert(!a.link.includes('FastConnect'));assert(!diagram(s).includes('Existing VPN / FastConnect'));assert(!bom(s,cat).lines.find(l=>l.id==='connection').label.includes('FastConnect'));}
 assert(accessPolicy(project('C')).assumption.includes('management/control'));assert(accessPolicy(project('AZ')).assumption.includes('not assumed'));
});
test('restricted public access is offered only on the supported serverless path',()=>{
 const s=project();setIntroAnswer(s,'F12','Restricted access over the internet','');assert.equal(s.network.access,PUBLIC_ACCESS);assert.equal(accessPolicy(s).mode,'public');assert(connectionsView(s,heading).includes('data-access="Public — restricted"'));assert(!bom(s,cat).lines.some(l=>l.id==='connection'));assert(diagram(s).includes('Approved fixed public IP addresses only'));assert(!diagram(s).includes('Private database endpoint'));assert(!diagram(s).includes('Existing VPN / FastConnect'));
 for(const p of ['D','C','AS','AD','AZ','GC']){const t=project(p);assert(!connectionsView(t,heading).includes('data-access="Public'));assert(!conversationView(t,6,heading).includes('data-intro-option="1"'));t.network.access=PUBLIC_ACCESS;assert.equal(accessPolicy(t).mode,'unsupported');assert(preGaps(followup(t),questions).some(x=>x.includes('public access')));assert.throws(()=>approve(t,questions,'Reviewer','Conditions',true));}
});
test('public proposal, HLD and LLD require allowlisting, encrypted access and security sign-off',()=>{
 const s=followup(project());s.network.access=PUBLIC_ACCESS;const p=accessPolicy(s);assert.equal(p.controls.length,6);assert(p.controls.some(x=>x.includes('minimum required')));assert(p.controls.some(x=>x.includes('rotate')));assert(p.controls.some(x=>x.includes('auditing')));
 const ids=detailFields(s).map(f=>f.id);assert(ids.includes('publicAllowlist'));assert(ids.includes('publicEncryption'));assert(ids.includes('publicSignoff'));assert(!ids.includes('endpoint'));
 approve(s,questions,'Business owner','Security approval and sizing outstanding',true);assert(lldText(s).includes('approved source IP allowlist'));assert(lldText(s).includes('Named')||lldText(s).includes('named'));
});
test('one technical contact enables conditional review without completing the old technical questionnaire',()=>{
 const s=project();assert(preGaps(s,questions).some(x=>x.includes('contact')));followup(s);assert.equal(Object.keys(s.answers).length,0);assert.equal(preGaps(s,questions).length,0);assert.throws(()=>approve(s,questions,'Person','Conditions',false));approve(s,questions,'Person','Open sizing and network validation assigned to architect',true);assert(agreementValid(s));assert.equal(s.approval.baselineVersion,2);assert(lldText(s).includes('DRAFT'));change(s);assert(!agreementValid(s));assert.throws(()=>lldText(s));
});
test('existing answers and source evidence survive migration, but prior approval cannot be silently reused',()=>{
 const s=project();delete s.presales;s.answers.F01={value:'Portal — lower cost',status:'Confirmed',evidence:'Original workshop'};s.approval={reviewer:'Old reviewer',revision:s.revision,at:'2026-11-05'};const imported=importState(JSON.parse(JSON.stringify(s)));assert.equal(imported.answers.F01.evidence,'Original workshop');assert.equal(imported.presales.version,2);assert.equal(imported.approval,null);assert(!agreementValid({...imported,approval:s.approval}));assert.throws(()=>importState({...s,presales:{version:2,contact:{unsafe:true}}}));
});
test('all deployment paths retain profile-specific technical questions after the sales simplification',()=>{
 for(const p of Object.keys(profiles)){const s=project(p);assert.equal(selectedQuestions(s,questions).length,20);assert(selectedQuestions(s,questions).some(q=>q.id==='F12'));const ids=detailFields(s).map(f=>f.id);assert.equal(ids.includes('fleet'),['D','C','AD'].includes(p));assert.equal(ids.includes('site'),p==='C');assert.equal(ids.includes('native'),['AS','AD','AZ','GC'].includes(p));assert(ids.includes('connectionValidation'));}
});
test('proposal views escape customer input, show four review areas and do not expose technical input forms by default',()=>{
 const s=followup(project());s.project='<script>bad()</script>';s.answers.F01={value:'<img onerror=bad()>',status:'Estimate'};const html=startView(s,heading)+conversationView(s,0,heading)+reviewView(s,cat,questions,heading);assert(!html.includes('<script>'));assert(!html.includes('<img onerror'));assert(html.includes('&lt;script&gt;'));for(const label of ['Your proposed service','Your estimated costs','How it connects','What we have assumed'])assert(html.includes(label));assert(!html.includes('data-bind="details.'));assert(reviewView(s,cat,questions,heading).includes('listed assumptions as the basis for detailed design'));
});

test('customer proposal export stays simple before approval and carries assumptions and controls into all approved outputs',async()=>{
 const {proposalReport}=await import('../web/reports.js');const s=followup(project());let html=proposalReport(s,cat,diagram(s),questions);assert(html.includes('Existing VPN / FastConnect'));assert(html.includes('Indicative monthly subtotal: £1,580.00'));assert(html.includes('Budget runtime: 730'));assert(html.includes('Indicative budget quantities'));assert(!html.includes('Source compatibility assessment'));assert(!html.includes('sizingValidated'));assert(!html.includes('Requirements register for the technical team'));
 s.network.access=PUBLIC_ACCESS;html=proposalReport(s,cat,diagram(s),questions);assert(html.includes('approved fixed public IP'));assert(!html.includes('Existing VPN / FastConnect'));
 approve(s,questions,'Reviewer','Open items assigned to architect',true);html=proposalReport(s,cat,diagram(s),questions);assert(html.includes('Requirements register for the technical team'));assert(html.includes('Detailed design and migration'));assert(html.includes('publicAllowlist'));
});

test('legacy burst settings are not silently added to a newly validated proposal',()=>{
 const s=confirmedSize(project());s.sizing.burstEcpu=99;s.sizing.burstHours=100;assert(!bom(s,cat).lines.some(l=>l.id==='burst'));assert(openAssumptions(s).some(a=>a.includes('Pricing basis')));
});

test('site residency cannot silently become a cloud-hosted proposal; malformed imported contact types are rejected',()=>{
 const s=followup(project());s.presales.dataLocation='At our own site';s.presales.locationNote='Customer data centre';assert(preGaps(s,questions).some(g=>g.includes('stay at your site')));s.profile='C';assert(!preGaps(s,questions).some(g=>g.includes('stay at your site')));assert.throws(()=>importState({...s,presales:{...s.presales,contact:true}}));assert.throws(()=>importState({...s,presales:{...s.presales,sizingValidated:'yes'}}));
});


test('unknown answers have visible defaults, runtime affects compute only and changing answers recalculates',()=>{
 const s=project();assert.deepEqual([proposalSize(s).count,proposalSize(s).base,proposalSize(s).storage,proposalSize(s).hours],[1,8,1200,730]);
 const initial=bom(s,cat);assert.equal(initial.subtotal,1580);
 setIntroAnswer(s,'F04','Mainly working hours','');let b=bom(s,cat);assert.equal(b.lines.find(l=>l.id==='compute').amount,440);assert.equal(b.lines.find(l=>l.id==='storage').amount,120);
 setIntroAnswer(s,'F03','Over 10 TB','');setIntroAnswer(s,'F02','More than 5','');assert.equal(proposalSize(s).base,32);assert.equal(proposalSize(s).count,6);assert.equal(proposalSize(s).storage,4000);assert(proposalSize(s).assumptions.some(a=>a.includes('no upper bound')));
 s.presales.validatedEcpu='99999';assert.equal(proposalSize(s).base,32,'unchecked manual quantities must not override budget assumptions');
});

test('every selected deployment has a numerical compute budget, with provider reference pricing distinguished',()=>{
 const catalogue={...cat,products:[...cat.products,...['B95713','B95709'].map(sku=>({sku,unit:'ECPU Per Hour',rates:{GBP:0.3}}))]};
 for(const profile of Object.keys(profiles)){
  const s=project(profile),b=bom(s,catalogue),compute=b.lines.find(l=>l.id==='compute');assert(compute.amount>0,profile);assert(compute.quantity>0);assert(!b.complete);
  assert.equal(!!compute.benchmark,['AS','AD','AZ','GC'].includes(profile));
  if(compute.benchmark){assert(compute.basis.includes('not a verified'));assert(costsView(s,catalogue,heading,()=>'').includes('Reference pricing only'));}
  if(['D','C','AD'].includes(profile))assert.equal(b.lines.find(l=>l.id==='storage').amount,null,'infrastructure storage cannot inherit Serverless billing');
 }
});

test('missing prices remain unavailable, quote overrides replace reference lines and old agreements need review',()=>{
 const s=followup(project());assert.equal(costSummary(s,{products:[]}).headline,'To be confirmed');assert.equal(bom(s,{products:[]}).lines.find(l=>l.id==='compute').amount,null);
 s.profile='AZ';s.lines=[{id:'compute',kind:'quote',quantity:1,rate:999,evidence:'Provider offer 123',label:'Provider compute'}];const b=bom(s,cat);assert.equal(b.lines.find(l=>l.id==='compute').amount,999);assert(!b.lines.find(l=>l.id==='compute').benchmark);
 s.approval={baselineVersion:2,revision:s.revision};assert(!agreementValid(s));approve(s,questions,'Reviewer','Budget assumptions accepted',true);assert(agreementValid(s));assert.equal(s.approval.estimateVersion,1);
});


test('customer-facing headings use professional wording',()=>{
 const s=project();const headings=(k,t,sub)=>k+' '+t+' '+sub;
 const html=startView(s,headings)+sizeView(s,headings)+costsView(s,cat,headings,()=>'')+reviewView(s,cat,questions,headings);
 assert(!/plain[ -]english|dumb|dummed/i.test(html));assert(html.includes('Initial bill of materials and cost estimate.'));
});
