import { renderMessenger } from './messenger-view.js';
import { AVATARS, DEFAULT_AVATAR_ID, avatarAsset, agentAvatarMarkup } from './avatar-library.js';
import { renderEducationMissions } from './education-ui.js';
import { startGeminiVoice } from './voice-live.js';

const app=document.querySelector('#app');
let data=null, lastSignature='', view='chief', authMode='login', busy=false, notice='', activeGroupId=null, activeAgentId=null, editingAgentId=null, mobileThreadOpen=false;
const savedDetailsState=localStorage.getItem('build-bot-details-collapsed');
let detailsCollapsed=savedDetailsState===null?window.matchMedia('(max-width:1050px)').matches:savedDetailsState==='1';
const theme=localStorage.getItem('build-bot-theme') || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
document.documentElement.dataset.theme=theme;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=value=>new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const avatar=slug=>`/assets/agents/${slug}.png`;
const icon={chief:'✦',workforce:'▦',bots:'◇',conversations:'◉',missions:'▤',routines:'⏱',activity:'◷',approvals:'✓',reports:'▥',notifications:'♢',crm:'◎',settings:'⚙'};
const labels={chief:'Chief',workforce:'AI Workforce',bots:'Bot chats',conversations:'Conversations',missions:'Missions',routines:'Routines',activity:'Activity',approvals:'Approvals',reports:'Reports',notifications:'Notifications',crm:'Local CRM',settings:'Settings'};
const pendingChatFiles=window.__pendingChatFiles||new Map();window.__pendingChatFiles=pendingChatFiles;
const chatFileAccept='.pdf,.docx,.pptx,.xlsx,.zip,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif';
const formatBytes=value=>value<1024?`${value} B`:value<1024*1024?`${(value/1024).toFixed(1)} KB`:`${(value/(1024*1024)).toFixed(1)} MB`;
function enhanceChatComposer(workspace){
  const form=workspace?.querySelector('.thread-composer form'),textarea=form?.elements?.objective;if(!form||!textarea)return;
  const attachmentKey=textarea.dataset.draftKey||form.id;form.dataset.attachmentKey=attachmentKey;textarea.required=false;
  const voice=form.querySelector('[data-start-voice]');if(voice){voice.className='composer-mic voice-button';voice.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V6a3.5 3.5 0 1 0-7 0v6a3.5 3.5 0 0 0 3.5 3.5Zm-6-4a1 1 0 0 1 2 0 4 4 0 0 0 8 0 1 1 0 1 1 2 0 6 6 0 0 1-5 5.91V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.59A6 6 0 0 1 6 11.5Z"/></svg>';textarea.after(voice);}
  const fileInput=document.createElement('input');fileInput.type='file';fileInput.multiple=true;fileInput.accept=chatFileAccept;fileInput.hidden=true;fileInput.dataset.chatFiles='';fileInput.dataset.attachmentKey=attachmentKey;
  const attach=document.createElement('button');attach.type='button';attach.className='composer-attach';attach.dataset.chatAttach='';attach.title='Add photos and files';attach.setAttribute('aria-label','Add photos and files');attach.textContent='＋';form.prepend(fileInput,attach);
  const send=form.querySelector('[type="submit"]');if(send){send.textContent='↑';send.title='Send message';}
  const entries=pendingChatFiles.get(attachmentKey)||[];
  if(entries.length){const tray=document.createElement('div');tray.className='chat-attachment-tray';tray.setAttribute('aria-label','Files ready to send');tray.innerHTML=entries.map((entry,index)=>`<div class="chat-attachment-preview">${entry.previewUrl?`<img src="${esc(entry.previewUrl)}" alt="">`:`<span class="chat-file-icon" aria-hidden="true">${entry.file.name.toLowerCase().endsWith('.zip')?'ZIP':entry.file.type==='application/pdf'?'PDF':'DOC'}</span>`}<span><strong>${esc(entry.file.name)}</strong><small>${formatBytes(entry.file.size)}</small></span><button type="button" data-remove-chat-file="${index}" aria-label="Remove ${esc(entry.file.name)}">×</button></div>`).join('');form.before(tray);}
  const note=workspace.querySelector('.thread-composer>small');if(note)note.textContent='Attach up to 5 files with no fixed upload-size limit, or use the microphone for a Gemini Live conversation. Computer actions remain approval controlled.';
}
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
async function uploadAcademicFile(file,category='reference'){
  const query=new URLSearchParams({name:file.name,category});let response;
  try{response=await fetch(`/api/academic-files?${query}`,{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});}
  catch{throw new Error('The upload connection was interrupted. Check that EDU BOT is online and try again.');}
  const result=await response.json().catch(()=>({error:`Upload failed (${response.status})`}));
  if(!response.ok)throw new Error(result.error||`Upload failed (${response.status})`);return result;
}
function flash(message){notice=message;render();setTimeout(()=>{notice='';render();},5000);}
function openComputerFullscreen({viewUrl,name='Bot',computerId,canControl=false}){
  document.querySelector('.computer-fullscreen-overlay')?.remove();
  const embedded=document.querySelector('.computer-live-view');if(embedded)embedded.src='about:blank';if(window.__computerViewUrls)delete window.__computerViewUrls[computerId];
  const overlay=document.createElement('section'),toolbar=document.createElement('header'),identity=document.createElement('div'),label=document.createElement('strong'),mode=document.createElement('span'),actions=document.createElement('div'),control=document.createElement('button'),close=document.createElement('button'),frame=document.createElement('iframe');
  overlay.className='computer-fullscreen-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',`${name} Linux computer`);
  const updateMode=()=>{mode.textContent=canControl?'Interactive · mouse & keyboard enabled':'View only';mode.className=`computer-fullscreen-mode ${canControl?'interactive':'readonly'}`;control.textContent=canControl?'Return control':'Take control';};
  toolbar.className='computer-fullscreen-toolbar';identity.className='computer-fullscreen-identity';label.textContent=`${name} · Linux computer`;actions.className='computer-fullscreen-actions';control.type='button';control.className='ghost';close.type='button';close.className='ghost';close.textContent='Exit full screen';close.setAttribute('aria-label','Exit full-screen computer view');updateMode();
  frame.className='computer-fullscreen-frame';frame.src=viewUrl;frame.title=`${name} full-screen Linux computer`;frame.allow='fullscreen';
  identity.append(label,mode);actions.append(control,close);toolbar.append(identity,actions);overlay.append(toolbar,frame);document.body.append(overlay);document.body.classList.add('computer-fullscreen-open');frame.focus();
  control.addEventListener('click',async()=>{control.disabled=true;try{await api(`/computers/${computerId}/lease/${canControl?'release':'acquire'}`,'POST',{});const stream=await api(`/computers/${computerId}/stream-token`);canControl=stream.canControl;frame.src=stream.viewUrl;updateMode();frame.focus();}catch(error){label.textContent=error.message;}finally{control.disabled=false;}});
  const dismiss=()=>{overlay.remove();document.body.classList.remove('computer-fullscreen-open');document.removeEventListener('keydown',onKey);if(window.__computerViewUrls)delete window.__computerViewUrls[computerId];render();load();};
  const onKey=event=>{if(event.key==='Escape')dismiss();};close.addEventListener('click',dismiss);document.addEventListener('keydown',onKey);
}
async function load(){
  try {const next=await api('/state'), signature=JSON.stringify(next);if(signature!==lastSignature){data=next;lastSignature=signature;render();}}
  catch(err){if(err.message==='Sign in required.'){data=null;lastSignature='';render();}else flash(err.message);}
}
function auth(){
  const register=authMode==='register';
  app.innerHTML=`<div class="auth-wrap"><div class="auth-brand"><img class="logo" src="/assets/brand/logo-dark.png" alt="BUILD BOT"><div><h1>Your autonomous academic colleague.</h1><p>CHIEF coordinates ten protected education specialists through real missions, tool evidence, independent quality checks and lecturer approvals.</p><img class="bot-hero" src="${avatar('chief')}" alt="CHIEF robot avatar"></div><small>BUILD BOT 2.0 · Colleague Zero</small></div><div class="auth-panel"><div class="auth-card"><div class="eyebrow">Education workforce workspace</div><h2>${register?'Create your workspace':'Welcome back'}</h2><p class="subtle">${register?'Create a local fictional-data demonstration workspace.':'Sign in to your BUILD BOT 2.0 workspace.'}</p><form id="auth-form">${register?'<label class="field">Organization name<input name="organization" autocomplete="organization" required maxlength="100" placeholder="Fictional Academy"></label>':''}<label class="field">Email<input name="email" type="email" autocomplete="email" required placeholder="lecturer@example.invalid"></label><label class="field">Password<input name="password" type="password" autocomplete="${register?'new-password':'current-password'}" required minlength="10" placeholder="At least 10 characters"></label><div class="error" role="alert" id="auth-error"></div><button class="primary" type="submit">${register?'Create workspace':'Sign in'}</button></form><div class="auth-toggle">${register?'Already have an account?':'New to BUILD BOT?'} <button class="link-btn" type="button" data-auth-toggle>${register?'Sign in':'Create workspace'}</button></div><p class="auth-note">Local development build for fictional education data. Draft grading requires educator review. Per-bot Linux computers require WSL 2, Docker Desktop, and the BUILD BOT computer image.</p></div></div></div>`;
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
  return `<div class="page-head"><div><span class="eyebrow">Scheduled local work</span><h1>Routines</h1><p>Run public research or generate evidence-backed reports on chosen days.</p></div><span class="count">${data.schedules.length} routine${data.schedules.length===1?'':'s'}</span></div><div class="two-col"><div><div class="panel form-panel"><h3>Create routine</h3><form id="schedule-form"><label class="field">Name<input name="title" required minlength="3" maxlength="100" placeholder="Daily market scan"></label><label class="field">Work type<select name="kind"><option value="research">Public research</option><option value="report">Recorded-work report</option></select></label><label class="field">Research bot<select name="agentId">${data.agents.filter(a=>a.enabled&&a.slug!=='chief').map(a=>`<option value="${a.id}" ${a.slug==='intelligence-manager'?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><label class="field">Research request<textarea name="objective" maxlength="1000" placeholder="Research renewable energy in South Africa"></textarea></label><label class="field">Report type<select name="reportType"><option value="daily">Daily</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option></select></label><label class="field">Time in ${esc(data.organization.timezone)}<input name="localTime" type="time" value="09:00" required></label><div class="field">Days<div class="day-row">${days.map((day,i)=>`<label class="check-row"><input type="checkbox" name="weekdays" value="${i}" checked><span>${day}</span></label>`).join('')}</div></div><button class="primary" type="submit">Create routine</button></form></div><div class="callout" style="margin-top:16px">Routines run while this local server is running and recover a missed occurrence once after restart. Your three daily WhatsApp and Telegram summaries are controlled in Settings. A spring-forward local time that does not exist is skipped.</div></div><div class="stack">${data.schedules.length?data.schedules.map(s=>`<article class="panel side-card"><div class="task-top"><h3>${esc(s.title)}</h3><span class="status ${s.enabled?'active':'paused'}">${s.enabled?'enabled':'paused'}</span></div><p class="agent-byline">${s.kind==='research'&&routineAgent(s)?agentAvatarMarkup(routineAgent(s),{alt:'' }):''}${s.kind==='research'?`Assigned to ${esc(data.agents.find(a=>a.id===s.agent_id)?.name||'Intelligence Manager')} · `:'' }${esc(s.kind==='research'?s.objective:`${s.report_type} report`)}</p><p>${esc(s.local_time)} ${esc(s.timezone)} · ${s.weekdays.map(d=>days[d]).join(', ')}<br>Next: ${time(s.next_run_at)}</p><button class="ghost" data-schedule="${s.id}" data-schedule-action="${s.enabled?'disable':'enable'}">${s.enabled?'Pause':'Resume'}</button></article>`).join(''):'<div class="callout">No routines yet.</div>'}<h2 class="section-title">Recent runs</h2>${data.scheduleRuns.slice(0,10).map(r=>`<div class="panel side-card"><strong>${esc(r.status)}</strong> · ${time(r.scheduled_for)}</div>`).join('')}</div></div>`;
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
  return `<div class="page-head"><div><span class="eyebrow">Plan and execute</span><h1>Missions</h1><p>Draft, review, and run dependency-aware work across the specialist team.</p></div><span class="count">${data.missions.length} mission${data.missions.length===1?'':'s'}</span></div><div class="two-col"><div><div class="panel form-panel"><h3>Draft a mission</h3><form id="mission-form"><label class="field">Mission title<input name="title" required minlength="3" maxlength="100" placeholder="Understand a new market"></label><label class="field">Research objective<textarea name="objective" required minlength="8" maxlength="1000" placeholder="Research the renewable energy market in South Africa"></textarea></label><button class="primary" type="submit">Save draft</button></form></div><div class="callout" style="margin-top:16px">Run specialist team creates research, curriculum and assessment branches, performs independent QA, packages reporting, then lets CHIEF reconcile the result.</div></div><div class="stack">${data.missions.length?data.missions.map(m=>`<article class="panel side-card"><div class="task-top"><h3>${esc(m.title)}</h3><span class="status ${esc(m.status)}">${esc(m.status)}</span></div><p>${esc(m.objective)}</p>${m.plan.length?`<ol class="steps">${m.plan.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}<div class="controls">${['draft','proposed','blocked'].includes(m.status)?actionButton(m,'execute','Run specialist team'):''}${m.status==='draft'?actionButton(m,'propose','Ask CHIEF for research plan'):''}${m.status==='proposed'?actionButton(m,'activate','Run single research task'):''}${['draft','proposed','active','blocked'].includes(m.status)?actionButton(m,'cancel','Cancel'):''}</div>${data.tasks.filter(t=>t.mission_id===m.id).map(taskCard).join('')}</article>`).join(''):'<div class="callout">No missions yet. Create a draft to see a reviewable plan.</div>'}</div></div>`;
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
  const external=data.toolExecutionRequests||[],externalPending=external.filter(item=>item.status==='pending_approval'),externalHistory=external.filter(item=>item.status!=='pending_approval');
  const externalCard=item=>`<article class="panel side-card approval-card"><div class="task-top"><h3>${esc(item.tool_name)} · ${esc(item.bot_name||'Bot')}</h3><span class="status ${item.status==='succeeded'?'completed':item.status==='pending_approval'?'paused':esc(item.status)}">${esc(item.status.replaceAll('_',' '))}</span></div><p>${esc(item.connector_name||'External connector')} · <strong>${esc(item.risk_class.replaceAll('_',' '))}</strong> · expires ${time(item.expires_at)}</p><div class="approval-preview"><div><small>Reason</small><p>${esc(item.reason||'No reason supplied')}</p></div><div><small>Exact arguments</small><pre>${esc(JSON.stringify(item.normalized_arguments,null,2))}</pre></div></div><div class="hash-line">Action fingerprint: ${esc(item.arguments_hash.slice(0,16))}…</div>${item.status==='pending_approval'?`<div class="controls"><button class="primary" data-tool-approval="${item.id}" data-decision="approve" data-hash="${item.arguments_hash}">Approve exact action</button><button class="ghost" data-tool-approval="${item.id}" data-decision="reject" data-hash="${item.arguments_hash}">Reject</button></div>`:`<button class="ghost" data-tool-receipt="${item.id}">View receipt</button>`}</article>`;
  const allPending=pending.length+externalPending.length;
  return `<div class="page-head"><div><span class="eyebrow">Human decision gate</span><h1>Approvals</h1><p>Review the destination and exact content before any consequential action.</p></div><span class="count">${allPending} pending</span></div><div class="callout" style="margin-bottom:20px">Approvals are bound to the exact arguments shown below. Any change creates a new action fingerprint and requires a new decision.</div><h2 class="section-title">External tool actions</h2><div class="stack">${externalPending.length?externalPending.map(externalCard).join(''):'<div class="callout">No external actions need approval.</div>'}</div><h2 class="section-title">Local actions</h2><div class="stack">${pending.length?pending.map(card).join(''):'<div class="callout">No local actions need approval.</div>'}</div><h2 class="section-title">External history</h2><div class="stack">${externalHistory.length?externalHistory.slice(0,30).map(externalCard).join(''):'<div class="callout">No external tool history yet.</div>'}</div><h2 class="section-title">Local history</h2><div class="stack">${history.length?history.map(card).join(''):'<div class="callout">No local decisions yet.</div>'}</div>`;
}
function activity(){
  const actorAvatar=entry=>{const agent=data.agents.find(a=>a.slug===entry.actor||a.name===entry.actor);return agent?agentAvatarMarkup(agent,{alt:''}):'';};
  return `<div class="page-head"><div><span class="eyebrow">Verified history</span><h1>Activity</h1><p>Every handoff and state change from the research workflow.</p></div><span class="count">${data.events.length} recorded event${data.events.length===1?'':'s'}</span></div><div class="timeline">${data.events.length?data.events.slice().reverse().map(e=>`<div class="event"><time>${time(e.created_at)}</time><div><strong>${actorAvatar(e)}${esc(e.type.replaceAll('.',' · '))}</strong><span>${esc(e.actor)} · ${esc(e.detail)}</span></div></div>`).join(''):'<div class="callout">No activity yet. Research work will appear here after you send CHIEF a request.</div>'}</div>`;
}
function settings(){
  const currentTheme=document.documentElement.dataset.theme;
  const capabilityRows=Object.entries(data.capabilities||{}).filter(([key])=>key!=='gemini').map(([key,value])=>`<div class="row"><strong>${esc(key.replace(/([A-Z])/g,' $1'))}</strong><span class="status ${String(value).includes('disabled')?'paused':'completed'}">${esc(String(value).replaceAll('_',' '))}</span></div>`).join('');
  const connectorCards=(data.connectors||[]).map(connector=>{const google=connector.connector_type==='google_workspace';return `<article class="connector-card"><div><strong>${esc(connector.display_name)}</strong><small>${esc(google?'GOOGLE WORKSPACE':connector.connector_type.toUpperCase())} · ${esc(connector.status.replaceAll('_',' '))}</small><code>${esc(google?(connector.account_email||'No Google account authorized'):connector.config?.endpoint||'Endpoint hidden')}</code>${connector.scopes?.length?`<p>${connector.scopes.length} ${google?'OAuth scopes':'discovered tools'} · ${esc(connector.scopes.slice(0,4).map(value=>value.split('/').at(-1)).join(', '))}${connector.scopes.length>4?' …':''}</p>`:'<p>No scopes or tools discovered yet.</p>'}${connector.budget?`<p>Budget: ${esc(connector.budget.consumed.calls||0)} / ${esc(connector.budget.limits.calls||0)} calls · resets ${time(connector.budget.resetsAt)}</p>`:'<p>No connector budget record yet.</p>'}</div><div class="connector-actions">${google?`<button class="primary" type="button" data-connector-oauth="${connector.id}">${connector.status==='verified'?'Reconnect':'Connect Google'}</button><button class="ghost danger" type="button" data-connector-revoke="${connector.id}">Disconnect</button>`:`<button class="ghost" type="button" data-connector-verify="${connector.id}">Verify</button>`}<button class="ghost" type="button" data-connector-sync="${connector.id}">Sync governed tools</button><button class="ghost danger" type="button" data-connector-delete="${connector.id}" data-connector-name="${esc(connector.display_name)}">Remove</button></div></article>`}).join('');
  const connectionOptions=(data.connectors||[]).map(item=>`<option value="${item.id}">${esc(item.display_name)}</option>`).join('');
  const roleTargets=[...new Map((data.agents||[]).map(item=>[item.role_key,item.role])).entries()].filter(([key])=>key).map(([key,label])=>`<option value="role:${esc(key)}">Role · ${esc(label)}</option>`).join('');
  const permissionTargets=`<option value="organization:${data.organization.id}">Entire organization</option>${roleTargets}${(data.agents||[]).map(item=>`<option value="bot:${item.id}">Bot · ${esc(item.name)}</option>`).join('')}`;
  const activePolicies=(data.toolPolicies||[]).filter(item=>!item.revoked_at).slice(0,20).map(item=>`<div class="row"><span><strong>${esc(item.subject_type)}</strong> · ${esc(item.tool_name)} · ${esc(item.permission.replaceAll('_',' '))}</span><button class="ghost danger" type="button" data-policy-revoke="${item.id}">Revoke</button></div>`).join('');
  const updateDelivery=data.updateDelivery||{preferences:{times:['09:00','13:00','17:00']},providers:{whatsapp:{status:'awaiting_configuration'},telegram:{status:'awaiting_configuration'}},deliveries:[]},updatePreferences=updateDelivery.preferences;
  const deliveryHistory=updateDelivery.deliveries.slice(0,6).map(item=>`<div class="row"><strong>${esc(item.channel[0].toUpperCase()+item.channel.slice(1))} · ${esc(item.recipient_hint)}</strong><span class="status ${item.status==='sent'?'completed':'paused'}">${esc(item.status.replaceAll('_',' '))}</span></div>`).join('');
  return `<div class="page-head"><div><span class="eyebrow">Workspace</span><h1>Settings</h1><p>Your local account, timezone, and current product availability.</p></div></div>
    <section class="panel side-card settings-box"><h3>Account</h3><div class="row"><strong>Email</strong><span>${esc(data.me.email)}</span></div><div class="row"><strong>Organization</strong><span>${esc(data.organization.name)}</span></div><div class="row"><strong>Role</strong><span>${esc(data.me.role)}</span></div><form id="timezone-form" class="row"><label class="field">Organization timezone<input name="timezone" value="${esc(data.organization.timezone)}" required></label><button class="ghost" type="submit">Save timezone</button></form><div class="row"><strong>Session</strong><button class="ghost" data-logout>Sign out</button></div></section>
    <section class="panel side-card settings-box" aria-labelledby="daily-updates-title"><h2 id="daily-updates-title">Daily WhatsApp & Telegram updates</h2><p>Receive three short summaries from your AI workforce every day in ${esc(data.organization.timezone)}. In-app notifications continue even when external delivery is off.</p><form id="update-delivery-form"><div class="form-grid">${updatePreferences.times.map((value,index)=>`<label class="field">Update ${index+1}<input type="time" name="times" value="${esc(value)}" required></label>`).join('')}</div><div class="form-grid"><div><label class="check-row"><input type="checkbox" name="whatsappEnabled" ${updatePreferences.whatsappEnabled?'checked':''}><span>Send by WhatsApp</span></label><label class="field">WhatsApp number<input name="whatsappRecipient" value="${esc(updatePreferences.whatsappRecipient||'')}" placeholder="+27821234567" autocomplete="tel"></label><p class="subtle">Server connection: ${esc(updateDelivery.providers.whatsapp.status.replaceAll('_',' '))}. Scheduled WhatsApp messages use an approved template with two text fields: update title and update body.</p></div><div><label class="check-row"><input type="checkbox" name="telegramEnabled" ${updatePreferences.telegramEnabled?'checked':''}><span>Send by Telegram</span></label><label class="field">Telegram chat ID<input name="telegramChatId" value="${esc(updatePreferences.telegramChatId||'')}" placeholder="123456789"></label><p class="subtle">Server connection: ${esc(updateDelivery.providers.telegram.status.replaceAll('_',' '))}. Open the Telegram bot and press Start before enabling updates.</p></div></div><button class="primary" type="submit">Save daily updates</button></form>${deliveryHistory?`<h3>Recent delivery receipts</h3>${deliveryHistory}`:'<div class="callout" style="margin-top:16px">No WhatsApp or Telegram delivery attempts yet.</div>'}</section>
    <section class="panel side-card settings-box theme-settings" aria-labelledby="themes-title"><h2 id="themes-title">Themes</h2><p>Choose how BUILD BOT looks on this device.</p><div class="theme-options" role="group" aria-label="Choose a theme"><button type="button" class="theme-option ${currentTheme==='light'?'active':''}" data-theme-choice="light" aria-pressed="${currentTheme==='light'}"><span class="theme-swatch light" aria-hidden="true">☀</span><span>Light</span></button><button type="button" class="theme-option ${currentTheme==='dark'?'active':''}" data-theme-choice="dark" aria-pressed="${currentTheme==='dark'}"><span class="theme-swatch dark" aria-hidden="true">☾</span><span>Dark</span></button></div></section>
    <section class="panel side-card settings-box" aria-labelledby="expansion-title"><h2 id="expansion-title">Expansion runtime</h2><p>Gemini powers bot conversations, governed tool execution, specialist missions, native voice and multimodal analysis after the server API key is configured.</p><div class="row"><strong>Gemini text</strong><span>${esc(data.capabilities?.gemini?.text||'unknown')}</span></div><div class="row"><strong>Gemini Live voice</strong><span>${esc(data.capabilities?.gemini?.voice||'unknown')}</span></div><div class="row"><strong>Gemini multimodal</strong><span>${esc(data.capabilities?.gemini?.multimodal||'unknown')}</span></div>${capabilityRows}<div class="row"><strong>Built-in skills</strong><span>${esc(data.expansion?.builtInSkills||0)}</span></div><div class="row"><strong>Active memories</strong><span>${esc(data.expansion?.memories||0)}</span></div><div class="row"><strong>Knowledge collections</strong><span>${esc(data.expansion?.collections||0)}</span></div></section>
    <section class="panel side-card settings-box connector-settings" aria-labelledby="connectors-title"><h2 id="connectors-title">Connections & tools</h2><p>Connect Google Workspace, a public Streamable HTTP MCP server, Composio, or Zapier. Google tokens are encrypted; MCP secrets stay in server environment variables.</p><form id="google-connector-form"><div class="form-grid"><label class="field">Google connection name<input name="displayName" value="Google Workspace" required maxlength="80"></label><div class="field"><span>First-party tools</span><small>Drive, Docs, Slides, Sheets, Gmail drafts and Calendar</small></div></div><button class="primary" type="submit">Add Google Workspace</button></form><hr><form id="connector-form"><div class="form-grid"><label class="field">MCP provider<select name="connectorType"><option value="mcp">Remote MCP</option><option value="composio">Composio</option><option value="zapier">Zapier MCP</option></select></label><label class="field">Connection name<input name="displayName" required minlength="2" maxlength="80" placeholder="School tools"></label></div><label class="field">HTTPS MCP endpoint<input name="endpoint" type="url" placeholder="Composio may be blank; paste your Zapier or remote server URL"></label><div class="form-grid"><label class="field">Authentication<select name="authMode"><option value="none">OAuth / no static secret</option><option value="bearer">Bearer token</option><option value="x-api-key">x-api-key</option><option value="x-consumer-api-key">Composio consumer key</option></select></label><label class="field">Server secret reference<input name="secretRef" placeholder="env:MCP_API_KEY" pattern="env:[A-Z][A-Z0-9_]{1,63}"></label></div><button class="primary" type="submit">Save MCP connection</button></form><div class="connector-list">${connectorCards||'<div class="callout">No external connections configured yet.</div>'}</div></section>
    <section class="panel side-card settings-box"><h2>Bot tool permissions</h2><p>Execution is denied by default. Grant access to the whole organization, a role, or one bot. A bot deny always overrides wider grants.</p><form id="tool-policy-form"><div class="form-grid"><label class="field">Applies to<select name="target" required>${permissionTargets}</select></label><label class="field">Connection<select name="connectionId" required>${connectionOptions}</select></label></div><div class="form-grid"><label class="field">Tool name<input name="toolName" value="*" required></label><label class="field">Permission<select name="permission"><option value="allow_read">Allow reads</option><option value="allow_propose">Allow proposals with approval</option><option value="deny">Deny</option></select></label></div><button class="primary" type="submit" ${connectionOptions?'':'disabled'}>Add permission</button></form><div class="stack">${activePolicies||'<div class="callout">No active grants. All external tools are denied.</div>'}</div></section>
    <h2 class="section-title">BUILD account</h2><div class="callout settings-box">BUILD account sign-in and linking are not connected in this local alpha. You are signed in with a separate BUILD BOT account. Connecting real BUILD Growth or BUILD Bid data requires BUILD’s authentication and API details; activating a bot here does not grant access to those systems.</div><h2 class="section-title">Available now</h2><div class="callout settings-box">Tenant-scoped workforce, Gemini-powered governed execution, exact-action approvals and receipts, persistent sourced memory, twelve versioned academic skills, cited document collections, dependency-aware multi-agent missions, Gemini Live voice, isolated Docker computers, and full-screen controlled desktops.</div>`;
}
function more(){
  const sections=[['activity','Activity','Recent work and handoffs'],['approvals','Approvals','Review decisions awaiting you'],['reports','Reports','Evidence-backed summaries'],['notifications','Notifications','Updates from your workforce'],['crm','Local CRM','Contacts and exact-action notes'],['settings','Settings','Account and workspace preferences']];
  return `<div class="page-head"><div><span class="eyebrow">Workspace</span><h1>More</h1><p>Everything here remains in your BUILD BOT inbox workspace.</p></div></div><div class="workspace-more-grid">${sections.map(([key,label,description])=>`<button class="panel workspace-more-card" data-view="${key}"><strong>${label}</strong><small>${description}</small><span>Open →</span></button>`).join('')}</div>`;
}
function shell(){
  const pages={workforce,conversations,missions:()=>renderEducationMissions({data,esc,time,agentAvatarMarkup}),routines,activity,approvals,reports,notifications,crm,settings,more};
  const previousView=window.__lastRenderedView;
  const previousScroll=document.querySelector('#workspace-section')?.scrollTop||0;
  const sectionContent=pages[view]?.()||'';
  app.innerHTML=renderMessenger({data,view,activeAgentId,activeGroupId,mobileThreadOpen,notice,theme:document.documentElement.dataset.theme,filter:window.__inboxFilter||'',esc,time,taskCard,sectionContent});
  enhanceChatComposer(app.querySelector('.messenger-app'));
  if(view==='workforce')for(const card of app.querySelectorAll('.agent-card')){const name=card.querySelector('h3')?.textContent,agent=data.agents.find(item=>item.name===name);if(agent?.kind==='built_in'){const label=card.querySelector('.eyebrow');if(label)label.textContent=agent.slug==='chief'?'Executive orchestrator':'Protected education specialist';if(agent.allowed_tools?.length){const badges=document.createElement('div');badges.className='tool-badges';badges.setAttribute('aria-label','Allowed tools');badges.innerHTML=agent.allowed_tools.slice(0,3).map(tool=>`<span>${esc(tool.replaceAll('_',' '))}</span>`).join('')+(agent.allowed_tools.length>3?`<span>+${agent.allowed_tools.length-3}</span>`:'');card.querySelector('.agent-body p')?.after(badges);}}}
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
  const computerAction=e.target.closest('[data-computer-action]');if(computerAction){try{await api(`/computers/${computerAction.dataset.computerId}/${computerAction.dataset.computerAction}`,'POST',{});if(window.__computerViewUrls)delete window.__computerViewUrls[computerAction.dataset.computerId];notice=`Computer ${computerAction.dataset.computerAction} completed.`;await load();}catch(error){notice=error.message;render();}return;}
  const computerView=e.target.closest('[data-computer-view]');if(computerView){try{const result=await api(`/computers/${computerView.dataset.computerId}/stream-token`);window.__computerViewUrls=window.__computerViewUrls||{};window.__computerViewUrls[computerView.dataset.computerId]=result.viewUrl;render();}catch(error){notice=error.message;render();}return;}
  const computerFullscreen=e.target.closest('[data-computer-fullscreen]');if(computerFullscreen){try{const computerId=computerFullscreen.dataset.computerId,computer=data.computers?.find(item=>item.id===computerId);if(!computer?.lease_owner_type)await api(`/computers/${computerId}/lease/acquire`,'POST',{});else if(computer.lease_owner_type==='agent')throw new Error('The bot is finishing a computer action. Try full-screen control again in a moment.');const result=await api(`/computers/${computerId}/stream-token`);openComputerFullscreen({viewUrl:result.viewUrl,name:computer?.agent_name||'Bot',computerId,canControl:result.canControl});}catch(error){notice=error.message;render();}return;}
  const computerLease=e.target.closest('[data-computer-lease]');if(computerLease){try{const computerId=computerLease.dataset.computerId;await api(`/computers/${computerId}/lease/${computerLease.dataset.computerLease}`,'POST',{});const stream=await api(`/computers/${computerId}/stream-token`);window.__computerViewUrls=window.__computerViewUrls||{};window.__computerViewUrls[computerId]=stream.viewUrl;notice=computerLease.dataset.computerLease==='acquire'?'You have exclusive computer control. Bot computer actions will wait until you return control.':'Control returned to the bot. Your desktop view is now read-only.';await load();}catch(error){notice=error.message;render();}return;}
  const verifyConnector=e.target.closest('[data-connector-verify]');if(verifyConnector){verifyConnector.disabled=true;verifyConnector.textContent='Verifying…';try{const result=await api(`/connectors/${verifyConnector.dataset.connectorVerify}/verify`,'POST',{});await load();flash(`Connected. ${result.tools.length} MCP tool(s) discovered.`);}catch(error){verifyConnector.disabled=false;verifyConnector.textContent='Verify & discover';flash(error.message);}return;}
  const syncConnector=e.target.closest('[data-connector-sync]');if(syncConnector){syncConnector.disabled=true;syncConnector.textContent='Syncing…';try{const result=await api(`/connectors/${syncConnector.dataset.connectorSync}/tools/sync`,'POST',{});await load();flash(`${result.count} governed tool definitions synchronized. Policies still deny execution until explicitly granted.`);}catch(error){syncConnector.disabled=false;syncConnector.textContent='Sync governed tools';flash(error.message);}return;}
  const oauthConnector=e.target.closest('[data-connector-oauth]');if(oauthConnector){oauthConnector.disabled=true;try{const result=await api(`/connectors/${oauthConnector.dataset.connectorOauth}/oauth/start`,'POST',{});window.location.assign(result.authorizationUrl);}catch(error){oauthConnector.disabled=false;flash(error.message);}return;}
  const revokeConnector=e.target.closest('[data-connector-revoke]');if(revokeConnector){if(!window.confirm('Disconnect this Google account, erase encrypted credentials, and revoke its tool permissions?'))return;try{await api(`/connectors/${revokeConnector.dataset.connectorRevoke}/revoke`,'POST',{});await load();flash('Google Workspace disconnected and credentials erased.');}catch(error){flash(error.message);}return;}
  const revokePolicy=e.target.closest('[data-policy-revoke]');if(revokePolicy){try{await api(`/tool-policies/${revokePolicy.dataset.policyRevoke}`,'DELETE');await load();flash('Tool permission revoked.');}catch(error){flash(error.message);}return;}
  const attachButton=e.target.closest('[data-chat-attach]');if(attachButton){attachButton.closest('form')?.querySelector('[data-chat-files]')?.click();return;}
  const removeChatFile=e.target.closest('[data-remove-chat-file]');if(removeChatFile){const form=removeChatFile.closest('.thread-composer')?.querySelector('form'),key=form?.dataset.attachmentKey,entries=pendingChatFiles.get(key)||[],removed=entries.splice(Number(removeChatFile.dataset.removeChatFile),1)[0];if(removed?.previewUrl)URL.revokeObjectURL(removed.previewUrl);if(entries.length)pendingChatFiles.set(key,entries);else pendingChatFiles.delete(key);render();return;}
  const voiceButton=e.target.closest('[data-start-voice]');if(voiceButton){
    if(window.__buildBotVoice){const active=window.__buildBotVoice;window.__buildBotVoice=null;voiceButton.disabled=true;try{await active.client.stop();await api(`/voice/sessions/${active.sessionId}/end`,'POST',{});voiceButton.textContent='◉';voiceButton.title='Talk to this bot';}catch(error){flash(error.message);}finally{voiceButton.disabled=false;}return;}
    let session;
    try{
      voiceButton.disabled=true;voiceButton.textContent='…';
      session=await api('/voice/sessions','POST',{conversationId:voiceButton.dataset.conversationId,agentId:voiceButton.dataset.agentId||null,retentionMode:'transcript'});
      if(session.status==='awaiting_credentials')throw new Error('Voice is ready to connect, but Gemini credentials are not configured on the BUILD BOT server yet. Add GEMINI_API_KEY and restart BUILD BOT.');
      const token=await api('/voice/ephemeral-token','POST',{sessionId:session.id});
      const client=await startGeminiVoice({token:token.token,model:token.model,websocketEndpoint:token.websocketEndpoint,onStatus:status=>{if(voiceButton.isConnected){voiceButton.textContent=status==='listening'?'■':'…';voiceButton.title=status==='listening'?'Stop voice conversation':status.replaceAll('_',' ');}},onTranscript:(speaker,text,final=false)=>api(`/voice/sessions/${session.id}/events`,'POST',{eventType:`transcript.${speaker}`,transcriptText:text,metadata:{final}}).catch(()=>{}),onError:error=>{if(voiceButton.isConnected){voiceButton.textContent='!';voiceButton.title=error.message;}}});
      window.__buildBotVoice={client,sessionId:session.id};voiceButton.textContent='■';voiceButton.title='Stop voice conversation';
    }catch(error){if(session?.id)api(`/voice/sessions/${session.id}/end`,'POST',{}).catch(()=>{});voiceButton.textContent='◉';voiceButton.disabled=false;flash(error.message);return;}
    voiceButton.disabled=false;return;
  }
  const deleteConnector=e.target.closest('[data-connector-delete]');if(deleteConnector){if(!window.confirm(`Remove the ${deleteConnector.dataset.connectorName} connector from BUILD BOT?`))return;try{await api(`/connectors/${deleteConnector.dataset.connectorDelete}`,'DELETE');await load();flash('Connector removed.');}catch(error){flash(error.message);}return;}
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
  if(e.target.closest('[data-activate-education-team]')){try{await api('/education/activate-team','POST',{});await load();flash('CHIEF and the ten academic specialists are active.');}catch(err){flash(err.message);}return;}
  const demoLaunch=e.target.closest('[data-demo-launch]');if(demoLaunch){demoLaunch.disabled=true;demoLaunch.textContent='Preparing fictional evidence…';try{await api('/education/demo/launch','POST',{});await load();flash('Guided live demo ready. CHIEF has delegated the nine-step mission.');}catch(err){demoLaunch.disabled=false;demoLaunch.textContent='Start the guided live demo';flash(err.message);}return;}
  const demoAdvance=e.target.closest('[data-demo-advance]');if(demoAdvance){const missionId=demoAdvance.dataset.demoAdvance;demoAdvance.disabled=true;demoAdvance.textContent='CHIEF and specialists are working…';let refreshing=false;const progressTimer=setInterval(async()=>{if(refreshing)return;refreshing=true;try{await load();}catch{}finally{refreshing=false;}},550);try{const result=await api(`/education/demo/${missionId}/advance`,'POST',{});clearInterval(progressTimer);await load();const message={failure_detected:'Academic QA exposed the deliberate scoring mismatch.',approval_required:'Correction verified. The marked-papers PDF is ready. EDU BOT is stopped at lecturer approval.',completed:'Approved update completed and verified with receipts.'}[result.checkpoint]||'Demo checkpoint completed.';flash(message);}catch(err){clearInterval(progressTimer);if(demoAdvance.isConnected)demoAdvance.disabled=false;flash(err.message);}return;}
  const deleteAgent=e.target.closest('[data-delete-agent]');if(deleteAgent){
    const agent=data.agents.find(item=>item.id===deleteAgent.dataset.deleteAgent);
    if(!agent||agent.kind!=='custom'||!window.confirm(`Delete ${agent.name}? Its scheduled work will stop. Past work will remain in your history.`))return;
    try{await api(`/agents/${agent.id}`,'DELETE');if(editingAgentId===agent.id)editingAgentId=null;if(activeAgentId===agent.id){activeAgentId=null;view='workforce';}await load();}catch(err){flash(err.message);}return;
  }
  const mission=e.target.closest('[data-mission]');if(mission){try{await api(`/missions/${mission.dataset.mission}/${mission.dataset.missionAction}`,'POST');await load();}catch(err){flash(err.message);}return;}
  const educationMission=e.target.closest('[data-education-mission]');if(educationMission){try{await api(`/education/missions/${educationMission.dataset.educationMission}/${educationMission.dataset.action}`,'POST');await load();}catch(err){flash(err.message);}return;}
  const schedule=e.target.closest('[data-schedule]');if(schedule){try{await api(`/schedules/${schedule.dataset.schedule}/${schedule.dataset.scheduleAction}`,'POST');await load();}catch(err){flash(err.message);}return;}
  const notification=e.target.closest('[data-notification-read]');if(notification){try{await api(`/notifications/${notification.dataset.notificationRead}/read`,'POST');await load();}catch(err){flash(err.message);}return;}
  const approval=e.target.closest('[data-approval]');if(approval){approval.disabled=true;try{await api(`/approvals/${approval.dataset.approval}/${approval.dataset.decision}`,'POST',{actionHash:approval.dataset.hash});await load();}catch(err){flash(err.message);}return;}
  const toolApproval=e.target.closest('[data-tool-approval]');if(toolApproval){toolApproval.disabled=true;try{await api(`/tool-executions/${toolApproval.dataset.toolApproval}/${toolApproval.dataset.decision}`,'POST',{actionHash:toolApproval.dataset.hash});await load();flash(toolApproval.dataset.decision==='approve'?'Approved action executed and receipt stored.':'External action rejected.');}catch(err){toolApproval.disabled=false;flash(err.message);}return;}
  const toolReceipt=e.target.closest('[data-tool-receipt]');if(toolReceipt){try{const result=await api(`/tool-executions/${toolReceipt.dataset.toolReceipt}`),latest=result.receipts?.at(-1);window.alert(latest?`Status: ${latest.status}\nResult hash: ${latest.result_hash||'not available'}\nEvidence: ${latest.after_evidence?.length||0} after-action record(s)\nRollback: ${latest.rollback_metadata?.supported?'available by new approval':'not safely available'}`:`Status: ${result.status}\nNo execution receipt yet.`);}catch(err){flash(err.message);}return;}
  const educationApproval=e.target.closest('[data-education-approval]');if(educationApproval){educationApproval.disabled=true;try{await api(`/education/approvals/${educationApproval.dataset.educationApproval}/${educationApproval.dataset.decision}`,'POST',{actionHash:educationApproval.dataset.hash});await load();}catch(err){educationApproval.disabled=false;flash(err.message);}return;}
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
    const attachmentKey=form.dataset.attachmentKey,attachments=pendingChatFiles.get(attachmentKey)||[];
    if(!message&&!attachments.length){flash('Type a message or attach at least one file.');return;}
    const groupId=form.dataset.groupId,agentId=form.dataset.agentId;
    const path=agentId?`/agents/${agentId}/chat`:'/chat';
    const submit=form.querySelector('[type="submit"]'),textarea=form.elements.objective,thread=form.closest('.messenger-thread')?.querySelector('#chat-scroll');if(submit){submit.disabled=true;submit.dataset.originalText=submit.textContent;submit.textContent='…';}if(textarea)textarea.disabled=true;
    const optimistic=document.createElement('div');optimistic.className='thread-message owner chat-pending';optimistic.innerHTML='<div><p></p><small>You · sending…</small></div>';optimistic.querySelector('p').textContent=message||`Uploading ${attachments.length} attachment${attachments.length===1?'':'s'}…`;
    const responder=String(textarea?.getAttribute('aria-label')||'').replace(/^Message\s+/,'').trim()||'Your AI colleague';
    const thinking=document.createElement('div');thinking.className='thread-message chat-pending bot-thinking';thinking.innerHTML='<div><p><span class="thinking-label">Thinking</span><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span></p><small></small></div>';thinking.querySelector('small').textContent=`${responder} is reviewing your request`;
    if(thread){thread.append(optimistic,thinking);thread.scrollTop=thread.scrollHeight;}
    try{for(const entry of attachments){if(!entry.fileId){const uploaded=await uploadAcademicFile(entry.file,'reference');entry.fileId=uploaded.fileId;}}const payload={message,fileIds:attachments.map(entry=>entry.fileId),...(groupId?{conversationId:groupId}:{})},result=await api(path,'POST',payload);if(result.navigateTo)view=result.navigateTo;if(textarea?.dataset.draftKey)localStorage.removeItem(textarea.dataset.draftKey);for(const entry of attachments)if(entry.previewUrl)URL.revokeObjectURL(entry.previewUrl);pendingChatFiles.delete(attachmentKey);await load();if(result.demoMissionId)flash('Live demo pack validated. CHIEF command centre is ready below.');}
    catch(err){optimistic.remove();thinking.remove();if(submit?.isConnected){submit.disabled=false;submit.textContent=submit.dataset.originalText||'➤';}if(textarea?.isConnected)textarea.disabled=false;flash(err.message);}return;
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
  if(e.target.id==='education-mission-form'){
    e.preventDefault();const form=e.target,formData=new FormData(form),submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Uploading and planning…';
    try{
      const fileIds=formData.getAll('fileIds').map(String),uploads=[...formData.getAll('assignments').filter(file=>file instanceof File&&file.size).map(file=>[file,'assignment'])];
      const rubric=formData.get('rubric'),roster=formData.get('roster');if(rubric instanceof File&&rubric.size)uploads.push([rubric,'rubric']);if(roster instanceof File&&roster.size)uploads.push([roster,'roster']);
      for(const [file,category] of uploads){const uploaded=await uploadAcademicFile(file,category);fileIds.push(uploaded.fileId);}
      await api('/education/missions','POST',{templateId:formData.get('templateId'),title:formData.get('title'),objective:formData.get('objective'),fileIds:[...new Set(fileIds)],demoQaInjection:formData.get('demoQaInjection')==='on'});await load();
    }catch(err){submit.disabled=false;submit.textContent='Upload and launch mission';flash(err.message);}return;
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
  if(e.target.id==='update-delivery-form'){
    e.preventDefault();const formData=new FormData(e.target);
    const payload={times:formData.getAll('times'),whatsappEnabled:formData.get('whatsappEnabled')==='on',whatsappRecipient:formData.get('whatsappRecipient'),telegramEnabled:formData.get('telegramEnabled')==='on',telegramChatId:formData.get('telegramChatId')};
    try{await api('/settings/update-delivery','PATCH',payload);await load();flash('Your three daily WhatsApp and Telegram update times are saved.');}
    catch(err){flash(err.message);}return;
  }
  if(e.target.id==='connector-form'){
    e.preventDefault();const form=e.target;
    try{await api('/connectors','POST',Object.fromEntries(new FormData(form)));await load();flash('Connector saved. Verify it to discover its MCP tools.');}
    catch(err){flash(err.message);}return;
  }
  if(e.target.id==='google-connector-form'){
    e.preventDefault();
    try{const result=await api('/connectors/google','POST',Object.fromEntries(new FormData(e.target)));await load();flash(result.oauthConfigured?'Google Workspace added. Press Connect Google to authorize it.':'Google Workspace added, but the server OAuth credentials still need to be configured.');}
    catch(err){flash(err.message);}return;
  }
  if(e.target.id==='tool-policy-form'){
    e.preventDefault();const values=Object.fromEntries(new FormData(e.target)),separator=values.target.indexOf(':'),payload={...values,subjectType:values.target.slice(0,separator),subjectId:values.target.slice(separator+1)};delete payload.target;
    try{await api('/tool-policies','POST',payload);await load();flash('Bot tool permission saved.');}
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
app.addEventListener('change',e=>{if(!e.target.matches('[data-chat-files]'))return;const input=e.target,key=input.dataset.attachmentKey,entries=pendingChatFiles.get(key)||[],errors=[];for(const file of input.files){if(entries.length>=5){errors.push('You can attach up to 5 files.');break;}if(!file.size){errors.push(`${file.name} is empty.`);continue;}if(!chatFileAccept.split(',').some(extension=>file.name.toLowerCase().endsWith(extension))){errors.push(`${file.name} is not a supported file type.`);continue;}if(entries.some(entry=>entry.file.name===file.name&&entry.file.size===file.size))continue;entries.push({file,previewUrl:file.type.startsWith('image/')?URL.createObjectURL(file):null,fileId:null});}if(entries.length)pendingChatFiles.set(key,entries);input.value='';render();if(errors.length)flash(errors[0]);});
app.addEventListener('input',e=>{if(e.target.dataset.draftKey) localStorage.setItem(e.target.dataset.draftKey,e.target.value);if(['agent-filter','inbox-filter'].includes(e.target.id)){const key=e.target.id==='agent-filter'?'__agentFilter':'__inboxFilter';window[key]=e.target.value;const pos=e.target.selectionStart;render();const input=document.querySelector(`#${e.target.id}`);input.focus();input.setSelectionRange(pos,pos);}});
document.addEventListener('error',event=>{const image=event.target;if(image instanceof HTMLImageElement&&image.dataset.avatarFallback&&!image.src.endsWith(image.dataset.avatarFallback))image.src=image.dataset.avatarFallback;},true);
setInterval(()=>{if(data && !['TEXTAREA','INPUT'].includes(document.activeElement?.tagName)) load();},2000);
load();
