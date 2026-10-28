import { renderMessenger } from './messenger-view.js';
import { AVATARS, DEFAULT_AVATAR_ID, avatarAsset, agentAvatarMarkup } from './avatar-library.js';

const app=document.querySelector('#app');
let data=null, lastSignature='', view='chief', authMode='login', busy=false, notice='', activeGroupId=null, activeAgentId=null, editingAgentId=null, mobileThreadOpen=false;
let detailsCollapsed=localStorage.getItem('build-bot-details-collapsed')==='1';
const theme=localStorage.getItem('build-bot-theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
document.documentElement.dataset.theme=theme;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const avatar=slug=>`/assets/agents/${slug}.png`;
const icon={chief:'✦',workforce:'▦',bots:'◇',conversations:'◉',missions:'▤',routines:'⏱',activity:'◷',approvals:'✓',reports:'▥',notifications:'♢',crm:'◎',settings:'⚙'};
const labels={chief:'Chief',workforce:'AI Workforce',bots:'Bot chats',conversations:'Conversations',missions:'Missions',routines:'Routines',activity:'Activity',approvals:'Approvals',reports:'Reports',notifications:'Notifications',crm:'Local CRM',settings:'Settings'};
async function api(path,method='GET',payload) {
  let response;
  try {
    response=await fetch('/api'+path,{method,headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined});
  } catch {
    throw new Error('BUILD BOT’s local server is offline. Double-click “Open BUILD BOT.cmd”, then reload this page.');
  }
  const result=await response.json().catch(()=>({error:`Request failed (${response.status})`}));
  if(!response.ok) throw new Error(result.error||`Request failed (${response.status})`);
  return result;
}
function flash(message){notice=message;render();setTimeout(()=>{notice='';render();},5000);}
async function load(){
  try {const next=await api('/state'), signature=JSON.stringify(next);if(signature!==lastSignature){data=next;lastSignature=signature;render();}}
  catch(err){if(err.message==='Sign in required.'){data=null;lastSignature='';render();}else flash(err.message);}
}
function auth(){
  const register=authMode==='register';
  app.innerHTML=`<div class="auth-wrap"><div class="auth-brand"><img class="logo" src="/assets/brand/logo-dark.png" alt="BUILD BOT"><div><h1>Your AI workforce, in one place.</h1><p>Start with CHIEF and a focused research workflow. Follow every handoff, source, and decision from one clear workspace.</p><img class="bot-hero" src="${avatar('chief')}" alt="CHIEF robot avatar"></div><small>BUILD BOT · Local alpha</small></div><div class="auth-panel"><div class="auth-card"><div class="eyebrow">Your workspace starts here</div><h2>${register?'Create your workspace':'Welcome back'}</h2><p class="subtle">${register?'Create a local owner account to explore this alpha build.':'Sign in to your BUILD BOT workspace.'}</p><form id="auth-form">${register?'<label class="field">Organization name<input name="organization" autocomplete="organization" required maxlength="100" placeholder="Acme Studio"></label>':''}<label class="field">Email<input name="email" type="email" autocomplete="email" required placeholder="you@company.com"></label><label class="field">Password<input name="password" type="password" autocomplete="${register?'new-password':'current-password'}" required minlength="10" placeholder="At least 10 characters"></label><div class="error" role="alert" id="auth-error"></div><button class="primary" type="submit">${register?'Create workspace':'Sign in'}</button></form><div class="auth-toggle">${register?'Already have an account?':'New to BUILD BOT?'} <button class="link-btn" type="button" data-auth-toggle>${register?'Sign in':'Create workspace'}</button></div><p class="auth-note">Local development alpha. Built-in bots can research public sources; routines run only while the local server is available. Cloud computers, external integrations, and voice are not connected yet.</p></div></div></div>`;
}
function taskCard(t){
  const sources=(t.result?.sources||[]).filter(s=>s.url?.startsWith('https://en.wikipedia.org/wiki/')||s.url==='https://example.org/fixture');
  const manager=data.agents.find(a=>a.id===t.agent_id);
  return `<article class="task-card"><div class="task-top"><h3>${esc(t.query)}</h3><span class="status ${esc(t.status)}">${esc(t.status)}</span></div><p class="agent-byline">${manager?agentAvatarMarkup(manager,{alt:''}):''}<span>${esc(manager?.name||'Manager')} · ${time(t.created_at)}</span></p><ol class="steps">${t.plan.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${t.result?`<div class="result"><strong>Research result</strong><br>${esc(t.result.summary)}${sources.length?`<div class="sources">${sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join('')}</div>`:''}</div>`:''}${t.error?`<div class="result error">${esc(t.error)}</div>`:''}<div class="controls">${['queued','running'].includes(t.status)?`<button class="ghost" data-task="${t.id}" data-action="pause">Pause</button>`:''}${t.status==='paused'?`<button class="ghost" data-task="${t.id}" data-action="resume">Resume</button>`:''}${['queued','running','paused'].includes(t.status)?`<button class="ghost" data-task="${t.id}" data-action="cancel">Cancel</button>`:''}</div></article>`;
}
function avatarPickerField(){
  const selected=avatarAsset(DEFAULT_AVATAR_ID);
  return `<div class="avatar-picker-field"><div><strong>Choose Your Bot Avatar</strong><p>Give your AI bot a unique identity. Choose from 75 futuristic robot characters.</p></div><div class="avatar-picker-current">${agentAvatarMarkup({kind:'custom',avatar_id:selected.id},{alt:'Selected bot avatar'})}<div><strong data-avatar-selected-label>Avatar ${String(selected.number).padStart(3,'0')}</strong><small>Visual identity only. It does not change what your bot can do.</small><button type="button" class="ghost" data-open-avatar-gallery>Browse 75 avatars</button></div></div><input type="hidden" name="avatarId" value="${selected.id}"></div>`;
}
function openAvatarGallery(agentId=null){
  const agent=agentId?data.agents.find(item=>item.id===agentId):null;
  const selectedValue=agent?.avatar_id||document.querySelector('#agent-form [name="avatarId"]')?.value||DEFAULT_AVATAR_ID;
  let selected=avatarAsset(selectedValue);
  const opener=document.activeElement;
  const dialog=document.createElement('dialog');
  dialog.className='avatar-dialog';
  dialog.innerHTML=`<div class="avatar-dialog-head"><div><span class="eyebrow">Visual identity</span><h2>${agent?`Change ${esc(agent.name)}’s avatar`:'Choose Your Bot Avatar'}</h2><p>Any robot can represent any bot. Appearance never changes its role, instructions, tools, or permissions.</p></div><button type="button" class="avatar-dialog-close" data-avatar-close aria-label="Close avatar gallery">×</button></div><div class="avatar-dialog-body"><div class="avatar-dialog-preview"><img src="${selected.src}" alt="Selected robot avatar"><div><strong data-avatar-dialog-label>Avatar ${String(selected.number).padStart(3,'0')}</strong><small>Full-colour portrait from your supplied library</small></div></div><div class="avatar-dialog-browser"><label class="avatar-search">Find avatar number<input type="search" placeholder="Search 001–075" aria-label="Find avatar number"></label><div class="avatar-gallery" role="group" aria-label="Choose a robot avatar">${AVATARS.map(avatar=>`<button type="button" class="avatar-choice ${avatar.id===selected.id?'selected':''}" data-avatar-option="${avatar.id}" aria-pressed="${avatar.id===selected.id?'true':'false'}" aria-label="Avatar ${String(avatar.number).padStart(3,'0')}"><img src="${avatar.src}" alt="" loading="lazy"><span>${String(avatar.number).padStart(3,'0')}</span></button>`).join('')}</div></div></div><div class="avatar-dialog-foot"><p role="alert" class="avatar-dialog-error"></p><button type="button" class="ghost" data-avatar-close>Cancel</button><button type="button" class="primary" data-avatar-confirm>${agent?'Save avatar':'Use this avatar'}</button></div>`;
  dialog.addEventListener('click',async event=>{
    if(event.target.closest('[data-avatar-close]')){dialog.close();return;}
    const choice=event.target.closest('[data-avatar-option]');
    if(choice){
      selected=avatarAsset(choice.dataset.avatarOption);
      dialog.querySelectorAll('[data-avatar-option]').forEach(button=>{const active=button.dataset.avatarOption===selected.id;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
      dialog.querySelector('.avatar-dialog-preview img').src=selected.src;
      dialog.querySelector('[data-avatar-dialog-label]').textContent=`Avatar ${String(selected.number).padStart(3,'0')}`;
      return;
    }
    const confirm=event.target.closest('[data-avatar-confirm]');
    if(!confirm)return;
    if(agent){
      confirm.disabled=true;
      try{await api(`/agents/${agent.id}/avatar`,'PATCH',{avatarId:selected.id});dialog.close();await load();}
      catch(error){dialog.querySelector('.avatar-dialog-error').textContent=error.message;confirm.disabled=false;}
      return;
    }
    const input=document.querySelector('#agent-form [name="avatarId"]');
    if(input){
      input.value=selected.id;
      document.querySelector('.avatar-picker-current img').src=selected.src;
      document.querySelector('[data-avatar-selected-label]').textContent=`Avatar ${String(selected.number).padStart(3,'0')}`;
    }
    dialog.close();
  });
  dialog.addEventListener('input',event=>{
    if(!event.target.matches('.avatar-search input'))return;
    const query=event.target.value.trim().replace(/[^0-9]/g,'');
    dialog.querySelectorAll('[data-avatar-option]').forEach(button=>{button.hidden=!!query&&!button.dataset.avatarOption.endsWith(query);});
  });
  dialog.addEventListener('close',()=>{dialog.remove();opener?.focus?.();});
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector('.avatar-search input').focus();
}
function chief(){
  const relevant=data.tasks.filter(t=>!t.conversation_id).slice(0,3);
  return `<div class="page-head"><div><span class="eyebrow">Command center</span><h1>Your AI Chief Executive</h1><p>Ask CHIEF to coordinate public-source research.</p></div><span class="count">Research pilot · Read-only</span></div><div class="chief-grid"><section class="panel chat"><div class="chat-heading"><img class="avatar" src="${avatar('chief')}" alt=""><div><strong>CHIEF</strong><small>AI Executive Orchestrator · ${data.tasks.some(t=>['queued','running'].includes(t.status))?'Coordinating':'Ready'}</small></div></div><div class="chat-scroll" id="chat-scroll">${data.messages.length?data.messages.map(m=>`<div class="message ${m.sender==='owner'?'owner':''}">${m.sender==='owner'?'':`<img src="${avatar('chief')}" alt="">`}<div class="bubble">${esc(m.body)}<small>${m.sender==='owner'?'You':'CHIEF'} · ${time(m.created_at)}</small></div></div>`).join(''):`<div class="empty-chat"><img src="${avatar('chief')}" alt="CHIEF"><h2>What should we find out?</h2><p>Give CHIEF a focused research question. Intelligence Manager will search public sources and return links you can check.</p><div class="prompt-row"><button type="button" data-prompt="Research the latest public information about solar energy in South Africa">Research solar energy</button><button type="button" data-prompt="Look up what circular construction means">Explore a topic</button></div></div>`}</div><div class="composer"><form id="research-form"><textarea name="objective" aria-label="Message CHIEF" placeholder="Research a topic for me…" required minlength="8" maxlength="1000"></textarea><button class="primary" type="submit" ${busy?'disabled':''}>Send →</button></form><div class="composer-note">Public research only in this pilot. Sources are linked; no external actions are taken.</div></div></section><div class="side-stack"><section class="panel side-card"><div class="mini-label">Live work</div><h3>Delegated research</h3>${relevant.length?`<div class="task-list">${relevant.map(taskCard).join('')}</div>`:'<p class="muted-empty">No work has been delegated. Send CHIEF a research question to begin.</p>'}</section><section class="panel side-card"><div class="mini-label">The team</div><h3>11 built-in agents</h3><p>CHIEF coordinates ten specialist managers. Intelligence Manager is connected to read-only public research in this slice.</p><button class="ghost" data-view="workforce">View workforce →</button></section></div></div>`;
}
function workforce(){
  const q=esc(window.__agentFilter||'');
  const rows=data.agents.filter(a=>`${a.name} ${a.role}`.toLowerCase().includes((window.__agentFilter||'').toLowerCase()));
  const card=a=>`<article class="panel agent-card ${a.slug==='chief'?'chief-card':''}"><div class="agent-image ${a.kind==='custom'?'custom-avatar':''}">${agentAvatarMarkup(a,{alt:`${a.name} avatar`,loading:'lazy'})}</div><div class="agent-body"><div class="eyebrow">${a.kind==='custom'?'Custom · v'+a.version:a.slug==='chief'?'Executive':'Built-in manager'}</div><h3>${esc(a.name)}</h3><p>${esc(a.role)}</p><div class="agent-bottom"><span class="status ${esc(a.status)}">${a.enabled?'Active':'Inactive'}</span>${a.enabled?(a.slug==='chief'?'<button class="link-btn" data-view="chief">Open inbox →</button>':`<button class="link-btn" data-open-bot="${a.id}">Open chat →</button>`):''}</div><div class="controls">${a.kind==='custom'?`<button class="ghost" data-change-avatar="${a.id}">Change Avatar</button><button class="ghost" data-edit-agent="${a.id}">Edit</button><button class="ghost" data-agent-toggle="${a.id}" data-enabled="${a.enabled?'0':'1'}">${a.enabled?'Deactivate':'Activate'}</button><button class="ghost danger" data-delete-agent="${a.id}">Delete bot</button>`:`<button class="ghost" data-built-in-toggle="${a.id}" data-action="${a.enabled?'deactivate':'activate'}">${a.enabled?'Deactivate':'Activate'}</button>`}</div></div></article>`;
  const builtins=rows.filter(a=>a.kind!=='custom'),custom=rows.filter(a=>a.kind==='custom');
  const editing=data.agents.find(a=>a.id===editingAgentId);
  const colors=['#1E293B','#4F46E5','#2563EB','#0284C7','#0891B2','#059669','#CA8A04','#D97706','#EA580C','#E11D48','#C026D3','#7C3AED'];
  return `<div class="page-head"><div><span class="eyebrow">Your team</span><h1>AI Workforce</h1><p>One executive, ten specialists. Status reflects recorded work.</p></div><div class="workforce-actions"><input id="agent-filter" class="search-input" type="search" placeholder="Search the team" value="${q}" aria-label="Search agents"><button type="button" class="primary" data-new-bot>+ New Bot</button></div></div><div class="workforce-grid">${builtins.map(card).join('')}</div><h2 class="section-title">Custom agents</h2>${custom.length?`<div class="workforce-grid">${custom.map(card).join('')}</div>`:'<div class="callout">No custom agents yet. Create a profile below. Custom bots can perform bounded public-source research; no other tools are granted.</div>'}<div class="panel form-panel"><h3>${editing?'Edit custom agent':'Create custom agent profile'}</h3><form id="agent-form" data-agent-id="${editing?.id||''}"><div class="form-grid"><label class="field">Name<input name="name" required minlength="2" maxlength="60" value="${esc(editing?.name||'')}"></label><label class="field">Role<input name="role" required minlength="3" maxlength="120" value="${esc(editing?.role||'')}"></label></div><label class="field">Instructions<textarea name="instructions" maxlength="3000" placeholder="Describe the agent’s responsibilities">${esc(editing?.instructions||'')}</textarea></label><label class="field">Accent color<select name="accent">${colors.map(color=>`<option value="${color}" ${color===editing?.accent?'selected':''}>${color}</option>`).join('')}</select></label>${editing?`<div class="avatar-picker-field avatar-edit-shortcut"><strong>Bot Avatar</strong><p>Visual identity is independent of bot functionality.</p><button type="button" class="ghost" data-change-avatar="${editing.id}">Change Avatar</button></div>`:avatarPickerField()}<div class="controls"><button class="primary" type="submit">${editing?'Save version':'Create profile'}</button>${editing?'<button class="ghost" type="button" data-cancel-agent-edit>Cancel</button>':''}</div><p class="subtle">Profiles are stored per organization. Public research uses a fixed workflow; custom instructions are saved but not yet interpreted by a model. External integrations and computers are not connected.</p></form></div>`;
}
function bots(){
  const managers=data.agents.filter(a=>a.kind==='built_in'&&a.slug!=='chief');
  const agent=managers.find(a=>a.id===activeAgentId)||managers[0];
  if(agent) activeAgentId=agent.id;
  const conversation=data.directConversations.find(c=>c.agent_id===agent?.id);
  const messages=conversation?data.groupMessages.filter(m=>m.conversation_id===conversation.id):[];
  const tasks=conversation?data.tasks.filter(t=>t.conversation_id===conversation.id):[];
  return `<div class="page-head"><div><span class="eyebrow">Direct manager work</span><h1>Bot chats</h1><p>Ask any built-in manager for bounded public-source research.</p></div></div><div class="callout" style="margin-bottom:20px">These managers can research public information in this alpha. Their specialized business tools, external data, and open-ended model conversations are not connected yet.</div><div class="group-layout"><aside class="panel side-card"><h3>Choose a manager</h3><div class="group-list">${managers.map(a=>`<button type="button" class="ghost ${a.id===agent?.id?'selected':''}" data-bot="${a.id}">${esc(a.name)}</button>`).join('')}</div></aside><section class="panel group-thread">${agent?`<div class="chat-heading"><img class="avatar" src="${avatar(agent.slug)}" alt=""><div><strong>${esc(agent.name)}</strong><small>${esc(agent.role)} · public research only</small></div></div><div class="group-messages">${messages.length?messages.map(m=>`<div class="message ${m.sender==='owner'?'owner':''}">${m.sender==='owner'?'':`<img src="${avatar(agent.slug)}" alt="">`}<div class="bubble">${esc(m.body)}<small>${m.sender==='owner'?'You':esc(agent.name)} · ${time(m.created_at)}</small></div></div>`).join(''):'<p class="muted-empty">No work yet. Ask a focused research question to start this conversation.</p>'}</div><div class="composer"><form id="bot-research-form" data-agent-id="${agent.id}"><textarea name="objective" required minlength="8" maxlength="1000" placeholder="Research a topic for me…" aria-label="Research request for ${esc(agent.name)}"></textarea><button class="primary" type="submit">Send →</button></form></div><div class="group-tasks">${tasks.map(taskCard).join('')}</div>`:''}</section></div>`;
}
function routines(){
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const routineAgent=schedule=>data.agents.find(agent=>agent.id===schedule.agent_id);
  return `<div class="page-head"><div><span class="eyebrow">Scheduled local work</span><h1>Routines</h1><p>Run public research or generate evidence-backed reports on chosen days.</p></div><span class="count">${data.schedules.length} routine${data.schedules.length===1?'':'s'}</span></div><div class="two-col"><div><div class="panel form-panel"><h3>Create routine</h3><form id="schedule-form"><label class="field">Name<input name="title" required minlength="3" maxlength="100" placeholder="Daily market scan"></label><label class="field">Work type<select name="kind"><option value="research">Public research</option><option value="report">Recorded-work report</option></select></label><label class="field">Research bot<select name="agentId">${data.agents.filter(a=>a.enabled&&a.slug!=='chief').map(a=>`<option value="${a.id}" ${a.slug==='intelligence-manager'?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><label class="field">Research request<textarea name="objective" maxlength="1000" placeholder="Research renewable energy in South Africa"></textarea></label><label class="field">Report type<select name="reportType"><option value="daily">Daily</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></label><label class="field">Time in ${esc(data.organization.timezone)}<input name="localTime" type="time" value="09:00" required></label><div class="field">Days<div class="day-row">${days.map((day,i)=>`<label class="check-row"><input type="checkbox" name="weekdays" value="${i}" checked><span>${day}</span></label>`).join('')}</div></div><button class="primary" type="submit">Create routine</button></form></div><div class="callout" style="margin-top:16px">Routines run while this local server is running and recover a missed occurrence once after restart. No email or push delivery is connected. A spring-forward local time that does not exist is skipped.</div></div><div class="stack">${data.schedules.length?data.schedules.map(s=>`<article class="panel side-card"><div class="task-top"><h3>${esc(s.title)}</h3><span class="status ${s.enabled?'active':'paused'}">${s.enabled?'enabled':'paused'}</span></div><p class="agent-byline">${s.kind==='research'&&routineAgent(s)?agentAvatarMarkup(routineAgent(s),{alt:'' }):''}${s.kind==='research'?`Assigned to ${esc(data.agents.find(a=>a.id===s.agent_id)?.name||'Intelligence Manager')} · `:'' }${esc(s.kind==='research'?s.objective:`${s.report_type} report`)}</p><p>${esc(s.local_time)} ${esc(s.timezone)} · ${s.weekdays.map(d=>days[d]).join(', ')}<br>Next: ${time(s.next_run_at)}</p><button class="ghost" data-schedule="${s.id}" data-schedule-action="${s.enabled?'disable':'enable'}">${s.enabled?'Pause':'Resume'}</button></article>`).join(''):'<div class="callout">No routines yet.</div>'}<h2 class="section-title">Recent runs</h2>${data.scheduleRuns.slice(0,10).map(r=>`<div class="panel side-card"><strong>${esc(r.status)}</strong> · ${time(r.scheduled_for)}</div>`).join('')}</div></div>`;
}
function notifications(){
  const unread=data.notifications.filter(n=>!n.read_at).length;
  return `<div class="page-head"><div><span class="eyebrow">In-app delivery</span><h1>Notifications</h1><p>Routine starts, completed reports, and research outcomes.</p></div><span class="count">${unread} unread</span></div><div class="stack">${data.notifications.length?data.notifications.map(n=>`<article class="panel side-card"><div class="task-top"><h3>${esc(n.title)}</h3><span class="pill">${n.read_at?'Read':'New'}</span></div><p>${esc(n.body)}</p><small>${time(n.created_at)}</small>${n.read_at?'':`<div class="controls"><button class="ghost" data-notification-read="${n.id}">Mark read</button></div>`}</article>`).join(''):'<div class="callout">Nothing here yet. Scheduled work will add notifications.</div>'}</div>`;
}
function conversations(){
  const names=new Map(data.agents.map(a=>[a.id,a.name]));
  return `<div class="page-head"><div><span class="eyebrow">Collaborate</span><h1>Groups</h1><p>Your bot teams live alongside direct chats in the same inbox.</p></div><div class="group-page-actions"><span class="count">${data.groups.length} group${data.groups.length===1?'':'s'}</span><button type="button" class="ghost" data-view="chief">Work Inbox →</button></div></div><div class="workspace-group-grid"><div class="stack">${data.groups.length?data.groups.map(g=>`<div class="panel workspace-group-entry"><button type="button" class="workspace-group-card" data-group="${esc(g.id)}"><span class="workspace-group-icon">◉</span><span><strong>${esc(g.title)}</strong><small>${esc(g.participants.map(id=>names.get(id)).filter(Boolean).join(' · '))}</small><em>Open conversation →</em></span></button><button type="button" class="ghost danger group-delete" data-delete-group="${esc(g.id)}" aria-label="Delete group ${esc(g.title)}">Delete group</button></div>`).join(''):'<div class="callout">No groups yet. Create one to coordinate bots in a shared conversation.</div>'}</div><div class="panel form-panel"><h3>Create a group</h3><form id="group-form"><label class="field">Group name<input name="title" required minlength="3" maxlength="100" placeholder="Market research team"></label><div class="field">Participants<small class="subtle">CHIEF joins automatically when active.</small>${data.agents.filter(a=>a.slug!=='chief'&&a.enabled).map(a=>`<label class="check-row"><input type="checkbox" name="agentIds" value="${a.id}"><span>${esc(a.name)}</span></label>`).join('')}</div><button class="primary" type="submit">Create group</button></form></div></div>`;
}
function missions(){
  const actionButton=(mission,action,label)=>`<button class="ghost" data-mission="${mission.id}" data-mission-action="${action}">${label}</button>`;
  return `<div class="page-head"><div><span class="eyebrow">Plan and execute</span><h1>Missions</h1><p>Draft, review, and activate bounded research missions.</p></div><span class="count">${data.missions.length} mission${data.missions.length===1?'':'s'}</span></div><div class="two-col"><div><div class="panel form-panel"><h3>Draft a mission</h3><form id="mission-form"><label class="field">Mission title<input name="title" required minlength="3" maxlength="100" placeholder="Understand a new market"></label><label class="field">Research objective<textarea name="objective" required minlength="8" maxlength="1000" placeholder="Research the renewable energy market in South Africa"></textarea></label><button class="primary" type="submit">Save draft</button></form></div><div class="callout" style="margin-top:16px">Mission planning and activation are owner controlled. Recurring Sunday plans and weekday schedules are still in development.</div></div><div class="stack">${data.missions.length?data.missions.map(m=>`<article class="panel side-card"><div class="task-top"><h3>${esc(m.title)}</h3><span class="status ${esc(m.status)}">${esc(m.status)}</span></div><p>${esc(m.objective)}</p>${m.plan.length?`<ol class="steps">${m.plan.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}<div class="controls">${m.status==='draft'?actionButton(m,'propose','Ask CHIEF for plan'):''}${m.status==='proposed'?actionButton(m,'activate','Activate mission'):''}${['draft','proposed','active','blocked'].includes(m.status)?actionButton(m,'cancel','Cancel'):''}</div>${data.tasks.filter(t=>t.mission_id===m.id).map(taskCard).join('')}</article>`).join(''):'<div class="callout">No missions yet. Create a draft to see a reviewable plan.</div>'}</div></div>`;
}
function reports(){
  const localToday=new Intl.DateTimeFormat('sv-SE',{timeZone:data.organization.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const itemAvatar=item=>{const task=data.tasks.find(t=>t.id===item.taskId);const agent=data.agents.find(a=>a.id===task?.agent_id);return agent?agentAvatarMarkup(agent,{alt:''}):'';};
  return `<div class="page-head"><div><span class="eyebrow">From recorded work</span><h1>Reports</h1><p>Each count and research claim links back to a task.</p></div></div><div class="two-col"><div class="panel form-panel"><h3>Generate a report</h3><form id="report-form"><label class="field">Report type<select name="type"><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="daily">Daily</option></select></label><label class="field">Date in ${esc(data.organization.timezone)}<input name="date" type="date" value="${localToday}" required></label><button class="primary" type="submit">Generate from events</button></form><p class="subtle">One immutable snapshot is stored per type and date. Missing business metrics are labeled.</p></div><div class="stack">${data.reports.length?data.reports.map(r=>`<article class="panel side-card"><div class="task-top"><h3>${esc(r.report_type[0].toUpperCase()+r.report_type.slice(1))} · ${esc(r.period_date)}</h3><span class="status completed">Recorded</span></div><p>Generated ${time(r.created_at)} · ${esc(r.content.timezone)}</p><div class="report-metrics">${Object.entries(r.content.counts).map(([key,value])=>`<div><strong>${value}</strong><small>${esc(key.replaceAll('_',' '))}</small></div>`).join('')}</div>${r.content.items.length?`<h4>Evidence</h4><ul class="report-items">${r.content.items.map(item=>`<li>${itemAvatar(item)}<strong>${esc(item.objective)}</strong> · ${esc(item.status)}${item.evidence.filter(url=>url.startsWith('https://en.wikipedia.org/wiki/')||url==='https://example.org/fixture').map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`).join('')}</li>`).join('')}</ul>`:'<p>No task events for this date.</p>'}<p class="subtle">${esc(r.content.unavailable.join(' '))}</p></article>`).join(''):'<div class="callout">No reports generated yet. Generate one from recorded tasks and events.</div>'}</div></div>`;
}
function crm(){
  return `<div class="page-head"><div><span class="eyebrow">Local data connector</span><h1>Local CRM</h1><p>Maintain contact notes through exact-action approvals.</p></div><span class="count">In-app records only</span></div><div class="two-col"><div><div class="panel form-panel"><h3>Add a contact</h3><form id="contact-form"><label class="field">Contact name<input name="name" required minlength="2" maxlength="100" placeholder="Customer or company"></label><button class="primary" type="submit">Add contact</button></form></div><div class="callout" style="margin-top:16px">This is an internal test connector. It does not sync with an external CRM or send messages.</div></div><div class="stack">${data.contacts.length?data.contacts.map(c=>`<article class="panel side-card"><div class="task-top"><h3>${esc(c.name)}</h3><span class="pill">v${c.version}</span></div><p><strong>Current note:</strong> ${c.note?esc(c.note):'No note yet.'}</p><form class="note-form" data-contact-id="${c.id}"><label class="field">Propose a replacement note<textarea name="note" required maxlength="2000" placeholder="Write the exact note for owner review"></textarea></label><button class="ghost" type="submit">Request approval</button></form></article>`).join(''):'<div class="callout">No contacts yet. Add one to exercise the approval flow.</div>'}</div></div>`;
}
function approvals(){
  const pending=data.approvals.filter(a=>a.status==='pending');
  const history=data.approvals.filter(a=>a.status!=='pending');
  const card=a=>`<article class="panel side-card approval-card"><div class="task-top"><h3>Replace note · ${esc(a.contact_name)}</h3><span class="status ${esc(a.status)}">${esc(a.status)}</span></div><p>Local CRM · policy version ${a.policy_version} · expires ${time(a.expires_at)}</p><div class="approval-preview"><div><small>Current</small><p>${a.payload.before?esc(a.payload.before):'Empty note'}</p></div><div><small>Proposed exact text</small><p>${esc(a.payload.after)}</p></div></div><div class="hash-line">Action fingerprint: ${esc(a.action_hash.slice(0,16))}…</div>${a.status==='pending'?`<div class="controls"><button class="primary" data-approval="${a.id}" data-decision="approve" data-hash="${a.action_hash}">Approve exact update</button><button class="ghost" data-approval="${a.id}" data-decision="reject" data-hash="${a.action_hash}">Reject</button></div>`:''}</article>`;
  return `<div class="page-head"><div><span class="eyebrow">Human decision gate</span><h1>Approvals</h1><p>Review the destination and exact content before a local write.</p></div><span class="count">${pending.length} pending</span></div><div class="callout" style="margin-bottom:20px">Approving executes the displayed note update once in the in-app CRM. Any change to its text or contact version requires a new approval.</div><h2 class="section-title">Pending</h2><div class="stack">${pending.length?pending.map(card).join(''):'<div class="callout">Nothing needs approval.</div>'}</div><h2 class="section-title">History</h2><div class="stack">${history.length?history.map(card).join(''):'<div class="callout">No decisions yet.</div>'}</div>`;
}
function activity(){
  const actorAvatar=entry=>{const agent=data.agents.find(a=>a.slug===entry.actor||a.name===entry.actor);return agent?agentAvatarMarkup(agent,{alt:''}):'';};
  return `<div class="page-head"><div><span class="eyebrow">Verified history</span><h1>Activity</h1><p>Every handoff and state change from the research workflow.</p></div><span class="count">${data.events.length} recorded event${data.events.length===1?'':'s'}</span></div><div class="timeline">${data.events.length?data.events.slice().reverse().map(e=>`<div class="event"><time>${time(e.created_at)}</time><div><strong>${actorAvatar(e)}${esc(e.type.replaceAll('.',' · '))}</strong><span>${esc(e.actor)} · ${esc(e.detail)}</span></div></div>`).join(''):'<div class="callout">No activity yet. Research work will appear here after you send CHIEF a request.</div>'}</div>`;
}
function settings(){
  const currentTheme=document.documentElement.dataset.theme;
  return `<div class="page-head"><div><span class="eyebrow">Workspace</span><h1>Settings</h1><p>Your local account, timezone, and current product availability.</p></div></div>
    <section class="panel side-card settings-box"><h3>Account</h3><div class="row"><strong>Email</strong><span>${esc(data.me.email)}</span></div><div class="row"><strong>Organization</strong><span>${esc(data.organization.name)}</span></div><div class="row"><strong>Role</strong><span>${esc(data.me.role)}</span></div><form id="timezone-form" class="row"><label class="field">Organization timezone<input name="timezone" value="${esc(data.organization.timezone)}" required></label><button class="ghost" type="submit">Save timezone</button></form><div class="row"><strong>Session</strong><button class="ghost" data-logout>Sign out</button></div></section>
    <section class="panel side-card settings-box theme-settings" aria-labelledby="themes-title"><h2 id="themes-title">Themes</h2><p>Choose how BUILD BOT looks on this device.</p><div class="theme-options" role="group" aria-label="Choose a theme"><button type="button" class="theme-option ${currentTheme==='light'?'active':''}" data-theme-choice="light" aria-pressed="${currentTheme==='light'}"><span class="theme-swatch light" aria-hidden="true">☀</span><span>Light</span></button><button type="button" class="theme-option ${currentTheme==='dark'?'active':''}" data-theme-choice="dark" aria-pressed="${currentTheme==='dark'}"><span class="theme-swatch dark" aria-hidden="true">☾</span><span>Dark</span></button></div></section>
    <h2 class="section-title">BUILD account</h2><div class="callout settings-box">BUILD account sign-in and linking are not connected in this local alpha. You are signed in with a separate BUILD BOT account. Connecting real BUILD Growth or BUILD Bid data requires BUILD’s authentication and API details; activating a bot here does not grant access to those systems.</div><h2 class="section-title">Available now</h2><div class="callout settings-box">Local owner account, tenant-scoped workforce with opt-in built-in bots, direct public research, CHIEF delegation, group handoffs, single-run missions, local routines, custom agent profiles, evidence-backed reports, in-app notifications, and exact-action approval for local CRM notes. Specialized manager tools, production connectors, and cloud computers are not connected.</div>`;
}
function more(){
  const sections=[['activity','Activity','Recent work and handoffs'],['approvals','Approvals','Review decisions awaiting you'],['reports','Reports','Evidence-backed summaries'],['notifications','Notifications','Updates from your workforce'],['crm','Local CRM','Contacts and exact-action notes'],['settings','Settings','Account and workspace preferences']];
  return `<div class="page-head"><div><span class="eyebrow">Workspace</span><h1>More</h1><p>Everything here remains in your BUILD BOT inbox workspace.</p></div></div><div class="workspace-more-grid">${sections.map(([key,label,description])=>`<button class="panel workspace-more-card" data-view="${key}"><strong>${label}</strong><small>${description}</small><span>Open →</span></button>`).join('')}</div>`;
}
function shell(){
  const pages={workforce,conversations,missions,routines,activity,approvals,reports,notifications,crm,settings,more};
  const previousView=window.__lastRenderedView;
  const previousScroll=document.querySelector('#workspace-section')?.scrollTop||0;
  const sectionContent=pages[view]?.()||'';
  app.innerHTML=renderMessenger({data,view,activeAgentId,activeGroupId,mobileThreadOpen,notice,theme:document.documentElement.dataset.theme,filter:window.__inboxFilter||'',esc,time,taskCard,sectionContent});
  const workspace=app.querySelector('.messenger-app');
  workspace?.classList.toggle('details-collapsed',detailsCollapsed);
  workspace?.querySelector('.messenger-top nav[aria-label="Workspace sections"]')?.remove();
  workspace?.querySelector('.messenger-top-actions [data-theme-toggle]')?.remove();
  const menuItems=[['chief','Inbox'],['workforce','Workforce'],['conversations','Groups'],['missions','Missions'],['routines','Routines'],['more','More']];
  let createMenu=workspace?.querySelector('.inbox-create');
  if(!createMenu){
    const plus=workspace?.querySelector('.inbox-title > .inbox-plus');
    if(plus){
      createMenu=document.createElement('details');
      createMenu.className='inbox-create';
      createMenu.innerHTML='<summary class="inbox-plus" aria-label="Create or navigate">＋</summary><div><button data-new-bot>+ New Bot</button><button data-view="conversations">Create group</button><button data-view="routines">Create routine</button></div>';
      plus.replaceWith(createMenu);
    }
  }
  const menuList=createMenu?.querySelector(':scope > div');
  if(menuList)for(const [destination,label] of menuItems){
    const item=document.createElement('button');
    item.type='button';
    item.dataset.view=destination;
    item.textContent=label;
    menuList.append(item);
  }
  const context=workspace?.querySelector('.messenger-details');
  if(context)context.id='workspace-context';
  if(view==='group'&&activeGroupId&&data.groups.some(group=>group.id===activeGroupId)){
    const header=workspace?.querySelector('.messenger-thread .thread-head');
    if(header){
      const button=document.createElement('button');
      button.type='button';
      button.className='ghost danger group-delete';
      button.dataset.deleteGroup=activeGroupId;
      button.setAttribute('aria-label','Delete group chat');
      button.textContent='Delete group';
      header.append(button);
    }
  }
  const panelToggleTarget=detailsCollapsed?workspace?.querySelector('.thread-head'):context?.querySelector('.details-head');
  if(panelToggleTarget){
    const button=document.createElement('button');
    button.type='button';
    button.className='details-toggle';
    button.dataset.detailsToggle='';
    button.setAttribute('aria-controls','workspace-context');
    button.setAttribute('aria-expanded',detailsCollapsed?'false':'true');
    button.setAttribute('aria-label',detailsCollapsed?'Show right panel':'Hide right panel');
    button.title=detailsCollapsed?'Show right panel':'Hide right panel';
    button.textContent=detailsCollapsed?'Show panel ◧':'Hide panel ◨';
    panelToggleTarget.append(button);
  }
  window.__lastRenderedView=view;
  const section=document.querySelector('#workspace-section');
  if(section&&previousView===view)section.scrollTop=previousScroll;
  const scroll=document.querySelector('#chat-scroll');if(scroll)scroll.scrollTop=scroll.scrollHeight;
}
function render(){data?shell():auth();}
app.addEventListener('click',async e=>{
  const toggle=e.target.closest('[data-auth-toggle]');if(toggle){authMode=authMode==='register'?'login':'register';render();return;}
  if(e.target.closest('[data-details-toggle]')){detailsCollapsed=!detailsCollapsed;localStorage.setItem('build-bot-details-collapsed',detailsCollapsed?'1':'0');render();return;}
  const nav=e.target.closest('[data-view]');if(nav){view=nav.dataset.view;mobileThreadOpen=view!=='chief';window.__agentFilter='';render();return;}
  const inboxAgent=e.target.closest('[data-inbox-agent]');if(inboxAgent){const target=inboxAgent.dataset.inboxAgent;view=target==='chief'?'chief':'bots';activeAgentId=target==='chief'?null:target;mobileThreadOpen=true;render();return;}
  const inboxGroup=e.target.closest('[data-inbox-group]');if(inboxGroup){view='group';activeGroupId=inboxGroup.dataset.inboxGroup;mobileThreadOpen=true;render();return;}
  if(e.target.closest('[data-thread-back]')){view='chief';mobileThreadOpen=false;render();return;}
  const openBot=e.target.closest('[data-open-bot]');if(openBot){activeAgentId=openBot.dataset.openBot;view='bots';mobileThreadOpen=true;render();return;}
  const bot=e.target.closest('[data-bot]');if(bot){activeAgentId=bot.dataset.bot;render();return;}
  const group=e.target.closest('[data-group]');if(group){activeGroupId=group.dataset.group;view='group';mobileThreadOpen=true;render();return;}
  const deleteGroup=e.target.closest('[data-delete-group]');if(deleteGroup){
    const selected=data.groups.find(item=>item.id===deleteGroup.dataset.deleteGroup);
    if(!selected||!window.confirm(`Delete “${selected.title}” from your Inbox? Its past messages and work will be retained in local history but hidden from the Inbox.`))return;
    deleteGroup.disabled=true;
    try{await api(`/groups/${selected.id}`,'DELETE');if(activeGroupId===selected.id){activeGroupId=null;view='conversations';}await load();}
    catch(err){deleteGroup.disabled=false;flash(err.message);}return;
  }
  const prompt=e.target.closest('[data-prompt]');if(prompt){const input=document.querySelector('#research-form textarea');input.value=prompt.dataset.prompt;input.focus();return;}
  if(e.target.closest('[data-new-bot]')){view='workforce';editingAgentId=null;mobileThreadOpen=true;render();document.querySelector('#agent-form')?.scrollIntoView({behavior:'smooth'});document.querySelector('#agent-form [name="name"]')?.focus();return;}
  if(e.target.closest('[data-open-avatar-gallery]')){openAvatarGallery();return;}
  const changeAvatar=e.target.closest('[data-change-avatar]');if(changeAvatar){openAvatarGallery(changeAvatar.dataset.changeAvatar);return;}
  const edit=e.target.closest('[data-edit-agent]');if(edit){editingAgentId=edit.dataset.editAgent;render();document.querySelector('#agent-form')?.scrollIntoView({behavior:'smooth'});return;}
  if(e.target.closest('[data-cancel-agent-edit]')){editingAgentId=null;render();return;}
  const agentToggle=e.target.closest('[data-agent-toggle]');if(agentToggle){const enabling=agentToggle.dataset.enabled==='1';agentToggle.disabled=true;agentToggle.textContent=enabling?'Activating…':'Deactivating…';try{await api(`/agents/${agentToggle.dataset.agentToggle}/${enabling?'enable':'disable'}`,'POST');await load();}catch(err){agentToggle.disabled=false;agentToggle.textContent=enabling?'Activate':'Deactivate';flash(err.message);}return;}
  const builtInToggle=e.target.closest('[data-built-in-toggle]');if(builtInToggle){const activating=builtInToggle.dataset.action==='activate';builtInToggle.disabled=true;builtInToggle.textContent=activating?'Activating…':'Deactivating…';try{await api(`/agents/${builtInToggle.dataset.builtInToggle}/${builtInToggle.dataset.action}`,'POST');await load();}catch(err){builtInToggle.disabled=false;builtInToggle.textContent=activating?'Activate':'Deactivate';flash(err.message);}return;}
  const deleteAgent=e.target.closest('[data-delete-agent]');if(deleteAgent){
    const agent=data.agents.find(item=>item.id===deleteAgent.dataset.deleteAgent);
    if(!agent||agent.kind!=='custom'||!window.confirm(`Delete ${agent.name}? Its scheduled work will stop. Past work will remain in your history.`))return;
    try{await api(`/agents/${agent.id}`,'DELETE');if(editingAgentId===agent.id)editingAgentId=null;if(activeAgentId===agent.id){activeAgentId=null;view='workforce';}await load();}catch(err){flash(err.message);}return;
  }
  const mission=e.target.closest('[data-mission]');if(mission){try{await api(`/missions/${mission.dataset.mission}/${mission.dataset.missionAction}`,'POST');await load();}catch(err){flash(err.message);}return;}
  const schedule=e.target.closest('[data-schedule]');if(schedule){try{await api(`/schedules/${schedule.dataset.schedule}/${schedule.dataset.scheduleAction}`,'POST');await load();}catch(err){flash(err.message);}return;}
  const notification=e.target.closest('[data-notification-read]');if(notification){try{await api(`/notifications/${notification.dataset.notificationRead}/read`,'POST');await load();}catch(err){flash(err.message);}return;}
  const approval=e.target.closest('[data-approval]');if(approval){approval.disabled=true;try{await api(`/approvals/${approval.dataset.approval}/${approval.dataset.decision}`,'POST',{actionHash:approval.dataset.hash});await load();}catch(err){flash(err.message);}return;}
  const themeChoice=e.target.closest('[data-theme-choice]');if(themeChoice){const next=themeChoice.dataset.themeChoice;if(next==='light'||next==='dark'){document.documentElement.dataset.theme=next;localStorage.setItem('build-bot-theme',next);render();}return;}
  if(e.target.closest('[data-logout]')){try{await api('/auth/logout','POST');data=null;lastSignature='';render();}catch(err){flash(err.message);}return;}
  const task=e.target.closest('[data-task]');if(task){task.disabled=true;try{await api(`/tasks/${task.dataset.task}/${task.dataset.action}`,'POST');await load();}catch(err){flash(err.message);}return;}
});
app.addEventListener('submit',async e=>{
  if(e.target.id==='auth-form'){
    e.preventDefault();const form=e.target,b=Object.fromEntries(new FormData(form));
    try{await api(`/auth/${authMode==='register'?'register':'login'}`,'POST',b);await load();}
    catch(err){form.querySelector('#auth-error').textContent=err.message;}return;
  }
  if(['research-form','group-research-form','bot-research-form'].includes(e.target.id)){
    e.preventDefault();const form=e.target,message=form.elements.objective.value.trim();
    const groupId=form.dataset.groupId,agentId=form.dataset.agentId;
    const path=agentId?`/agents/${agentId}/chat`:'/chat';
    const payload={message,...(groupId?{conversationId:groupId}:{})};
    const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
    try{await api(path,'POST',payload);if(form.elements.objective.dataset.draftKey)localStorage.removeItem(form.elements.objective.dataset.draftKey);await load();}
    catch(err){if(submit?.isConnected)submit.disabled=false;flash(err.message);}return;
  }
  if(e.target.id==='group-form'){
    e.preventDefault();const form=e.target,formData=new FormData(form);
    try{const result=await api('/groups','POST',{title:formData.get('title'),agentIds:formData.getAll('agentIds')});activeGroupId=result.groupId;view='group';mobileThreadOpen=true;await load();}
    catch(err){flash(err.message);}return;
  }
  if(e.target.id==='agent-form'){
    e.preventDefault();const form=e.target,payload=Object.fromEntries(new FormData(form));
    try{const result=await api(form.dataset.agentId?`/agents/${form.dataset.agentId}`:'/agents',form.dataset.agentId?'PATCH':'POST',payload);editingAgentId=null;if(result.agentId){activeAgentId=result.agentId;view='bots';mobileThreadOpen=true;}await load();}
    catch(err){flash(err.message);}return;
  }
  if(e.target.id==='mission-form'){
    e.preventDefault();const form=e.target;
    try{await api('/missions','POST',Object.fromEntries(new FormData(form)));await load();}
    catch(err){flash(err.message);}return;
  }
  if(e.target.id==='schedule-form'){
    e.preventDefault();const formData=new FormData(e.target);
    const payload={title:formData.get('title'),kind:formData.get('kind'),agentId:formData.get('agentId'),objective:formData.get('objective'),reportType:formData.get('reportType'),localTime:formData.get('localTime'),weekdays:formData.getAll('weekdays').map(Number)};
    try{await api('/schedules','POST',payload);await load();}
    catch(err){flash(err.message);}return;
  }
  if(e.target.id==='report-form'){
    e.preventDefault();
    try{await api('/reports/generate','POST',Object.fromEntries(new FormData(e.target)));await load();}
    catch(err){flash(err.message);}return;
  }
  if(e.target.id==='timezone-form'){
    e.preventDefault();
    try{await api('/settings/timezone','PATCH',Object.fromEntries(new FormData(e.target)));await load();}
    catch(err){flash(err.message);}return;
  }
  if(e.target.id==='contact-form'){
    e.preventDefault();
    try{await api('/contacts','POST',Object.fromEntries(new FormData(e.target)));await load();}
    catch(err){flash(err.message);}return;
  }
  if(e.target.classList.contains('note-form')){
    e.preventDefault();
    try{await api(`/contacts/${e.target.dataset.contactId}/propose-note`,'POST',Object.fromEntries(new FormData(e.target)));view='approvals';await load();}
    catch(err){flash(err.message);}return;
  }
});
app.addEventListener('input',e=>{if(e.target.dataset.draftKey) localStorage.setItem(e.target.dataset.draftKey,e.target.value);if(['agent-filter','inbox-filter'].includes(e.target.id)){const key=e.target.id==='agent-filter'?'__agentFilter':'__inboxFilter';window[key]=e.target.value;const pos=e.target.selectionStart;render();const input=document.querySelector(`#${e.target.id}`);input.focus();input.setSelectionRange(pos,pos);}});
document.addEventListener('error',event=>{const image=event.target;if(image instanceof HTMLImageElement&&image.dataset.avatarFallback&&!image.src.endsWith(image.dataset.avatarFallback))image.src=image.dataset.avatarFallback;},true);
setInterval(()=>{if(data && !['TEXTAREA','INPUT'].includes(document.activeElement?.tagName)) load();},2000);
load();
