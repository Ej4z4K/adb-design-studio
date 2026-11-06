// Shared business rules for the plain-English presales flow. No UI or network calls.
export const PUBLIC_ACCESS = 'Public — restricted';
export const PRIVATE_ACCESS = 'Private';
export const unsure = value => !String(value || '').trim() || /^(not sure|not discussed|to confirm|unknown|recommend)/i.test(String(value).trim());
export const introQuestions = [
  {id:'F01',title:'What are you looking to improve?',hint:'Choose the main reason for the conversation.',options:['Reduce costs','Improve performance','Reduce administration','Move to the cloud','Other','Not sure yet']},
  {id:'F05',title:'Where do your applications run today?',hint:'Choose the closest match. You can choose the new service later.',options:['Our premises','Oracle Cloud','AWS','Azure','Google Cloud','Several places','Not sure yet']},
  {id:'F02',title:'How many databases are involved?',hint:'A rough idea is enough.',options:['One','2–5','More than 5','Not sure yet']},
  {id:'F03',title:'Roughly how much data do you have?',hint:'An estimate is fine. Your database team can confirm the size later.',options:['Under 100 GB','100 GB–1 TB','1–10 TB','Over 10 TB','Not sure yet']},
  {id:'F04',title:'When does the service need to run?',hint:'Think about the hours your applications need the database.',options:['All the time','Mainly working hours','Occasionally','Not sure yet']},
  {id:'F06',title:'How would a service interruption affect you?',hint:'We will work out the technical recovery targets later.',options:['Major business impact','Some downtime is manageable','Timing is flexible','Not sure yet']},
  {id:'F12',title:'How would you like to connect?',hint:'Private company access or carefully restricted internet access.',options:['Private company connection','Restricted access over the internet','Recommend an option']},
  {id:'F10',title:'When are you looking to move?',hint:'There is no need to commit to a date today.',options:['Exploring','Within 3 months','Within 6 months','Later','Not sure yet']}
];
export function defaultPresales() { return {version:2,contact:'',followup:'',dataLocation:'Not sure yet',locationNote:'',budget:'',validatedCount:'',validatedEcpu:'',validatedGB:'',validatedHours:'',sizingEvidence:'',sizingReviewer:'',sizingValidated:false}; }
export function introAnswer(state,q) {const value=state.answers[q.id]?.value||'';const [first,...rest]=value.split('\n');const choice=q.options.includes(first)?first:'';return {choice,note:choice?rest.join('\n'):value,captured:!!value.trim()};}
export function setIntroAnswer(state,id,choice,note) {
 const q=introQuestions.find(q=>q.id===id);if(!q||(choice&&!q.options.includes(choice)))throw Error('Invalid conversation choice');
 const old=state.answers[id]||{},value=[choice,String(note||'').trim()].filter(Boolean).join('\n');if(old.value===value)return false;
 state.answers[id]={...old,value,status:unsure(choice||value)?'Unknown':'Estimate'};
 if(id==='F12')state.network.access=choice==='Restricted access over the internet'?PUBLIC_ACCESS:choice==='Private company connection'?PRIVATE_ACCESS:'To confirm';
 if(state.presales)state.presales.sizingValidated=false;
 return true;
}
export function accessPolicy(s) {
 const isPublic=String(s.network.access).startsWith('Public');const supported=s.profile==='S';
 const mode=isPublic?(supported?'public':'unsupported'):s.network.access==='Private'?'private':'pending';
 const privateText=['S','D'].includes(s.profile)||!s.profile
  ? 'Private connectivity assumption: an existing customer-managed VPN or FastConnect connection is available to reach the target OCI network. New connections and carrier/provider charges are excluded. Reachability, routing, DNS, capacity and resilience remain to be confirmed.'
  :s.profile==='C'
   ? 'Private connectivity assumption: the existing customer-site client network can reach the proposed database service. New client circuits are excluded. Site readiness, backup and Oracle management/control connectivity require separate validation; they are not assumed to be covered by VPN or FastConnect.'
   : 'Private connectivity assumption: existing customer and provider-native private connectivity can reach the selected cloud service. New hybrid circuits and provider charges are excluded. Native network attachment, account linking, routes, DNS, capacity and resilience remain to be confirmed. OCI FastConnect is not assumed to be the native provider connection.';
 const controls=['Allow only approved fixed public IP addresses; no unrestricted internet access.','Encrypt database connections; require mTLS where supported by the service and application clients.','Use separate application accounts with minimum required permissions.','Protect and rotate passwords, wallets and client certificates.','Enable auditing, monitoring and alerts.','Obtain named security approval before implementation.'];
 return {mode,isPublic,supported,assumption:mode==='public'?'Restricted public access proposal: approved company internet addresses only, encrypted connections, least-privilege accounts, protected credentials, audit/alerts and security approval before implementation.':mode==='unsupported'?'Public access is not offered by this design path. Choose a supported service or use its private connection design.':privateText,controls,label:mode==='public'?'Restricted internet access':mode==='unsupported'?'Access option needs review':mode==='pending'?'Private connection proposed — confirm preference':'Private company connection',link:mode==='public'?'Encrypted internet connection':s.profile==='C'?'Existing site client network':['AS','AD','AZ','GC'].includes(s.profile)?'Existing provider-native private path':'Existing VPN / FastConnect'};
}
const positive=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v))&&Number(v)>0;
export function validatedSize(s) {
 const p=s.presales||{};const valid=p.sizingValidated===true&&positive(p.validatedEcpu)&&Number.isInteger(Number(p.validatedEcpu))&&positive(p.validatedGB)&&positive(p.validatedCount)&&Number.isInteger(Number(p.validatedCount))&&positive(p.validatedHours)&&Number(p.validatedHours)<=744&&!!p.sizingEvidence?.trim()&&!!p.sizingReviewer?.trim();
 return {valid,base:valid?Number(p.validatedEcpu):null,storage:valid?Number(p.validatedGB):null,count:valid?Number(p.validatedCount):null,hours:valid?Number(p.validatedHours):null};
}
export function validDate(d) {return /^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;}
export function openAssumptions(s) {
 const items=[];for(const q of introQuestions){const a=s.answers[q.id];if(!a?.value?.trim()||a.status==='Unknown')items.push(q.title+' — to confirm.');}
 if(!s.profile)items.push('Service selection is still open; no deployment or product price has been assumed.');
 if(!s.region?.trim())items.push('Target cloud region or customer site is not confirmed.');
 if(!validatedSize(s).valid)items.push('Database quantities, compute, storage and running hours require architect validation. No data-size band or database-count band has been converted into a billable quantity.');
 if(unsure(s.presales?.dataLocation))items.push('Data residency and location requirements need confirmation.');else items.push('Data location requirement: '+s.presales.dataLocation+(s.presales.locationNote?' — '+s.presales.locationNote:' — details to confirm')+'. The target service and region must meet this requirement.');
 items.push(accessPolicy(s).assumption);
 if(s.network.access==='To confirm')items.push('Private access is the proposed starting point; the customer has not selected an access approach.');
 items.push('Pricing basis: '+(s.sizing.workload==='Lakehouse'?'Lakehouse':'transaction processing')+', '+(s.sizing.license==='BYOL'?'customer-supplied licenses (eligibility to confirm)':'license-included service')+'. The current worksheet assumes the same proposed capacity per database; differing databases need separate validation.');
 items.push('Backup, recovery, landing-zone readiness, delivery costs and service/region eligibility remain subject to review.');
 return items;
}
export function presalesGaps(s) {
 const gaps=[];if(!s.project?.trim())gaps.push('Give the opportunity a name.');if(!['S','D','C','AS','AD','AZ','GC'].includes(s.profile))gaps.push('Choose the proposed service before agreement.');
 if(s.presales?.dataLocation==='At our own site'&&s.profile&&s.profile!=='C')gaps.push('The data must stay at your site. Choose Cloud@Customer or resolve that requirement before agreement.');
 if(accessPolicy(s).mode==='unsupported')gaps.push('Restricted public access is only offered for OCI Serverless in this app. Choose private access or review the service selection.');
 const unresolved=introQuestions.some(q=>!s.answers[q.id]?.value?.trim()||s.answers[q.id]?.status==='Unknown')||!validatedSize(s).valid||!s.region?.trim()||unsure(s.presales?.dataLocation)||(['In a particular country','At our own site'].includes(s.presales?.dataLocation)&&!s.presales?.locationNote?.trim());
 if(unresolved&&(!s.presales?.contact?.trim()||!validDate(s.presales?.followup)))gaps.push('Add one technical follow-up contact and date for the open assumptions.');
 return gaps;
}
