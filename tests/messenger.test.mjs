import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMessenger } from '../apps/web/messenger-view.js';

test('inbox renders custom bots, group chats, and honest computer availability',()=>{
  const originalStorage=globalThis.localStorage;
  globalThis.localStorage={getItem:()=>null};
  try {
    const chief={id:'chief-id',slug:'chief',name:'CHIEF',role:'Executive',kind:'built_in',enabled:1,status:'idle',accent:'#2563EB'};
    const custom={id:'custom-id',slug:'custom-123',name:'Researcher 1',role:'Researcher',kind:'custom',enabled:1,status:'idle',accent:'#4F46E5',avatar_id:'bot_avatar_075'};
    const data={organization:{id:'org-id',name:'Test workspace'},agents:[chief,custom],groups:[{id:'group-id',title:'Research team',participants:[chief.id,custom.id],created_at:'2026-10-13T00:00:00Z'}],messages:[],groupMessages:[],directConversations:[],tasks:[],schedules:[]};
    const args={data,view:'bots',activeAgentId:custom.id,activeGroupId:null,mobileThreadOpen:true,notice:'',theme:'dark',filter:'',esc:value=>String(value),time:value=>value,taskCard:()=>''};
    const botHtml=renderMessenger(args);
    assert.match(botHtml,/Researcher 1/);
    assert.match(botHtml,/data-inbox-group="group-id"/);
    assert.match(botHtml,/Computer unavailable/);
    assert.match(botHtml,/data-agent-id="custom-id"/);
    assert.match(botHtml,/\/assets\/bot-avatars-v2\/bot-avatar-075\.png/);
    assert.match(botHtml,/placeholder="Message Researcher 1…"/);
    assert.doesNotMatch(botHtml,/Celeritas|llama3\.2|qwen2\.5|name="model"/i);
    const groupHtml=renderMessenger({...args,view:'group',activeGroupId:'group-id'});
    assert.match(groupHtml,/data-group-id="group-id"/);
    assert.match(groupHtml,/Participants/);
    assert.match(groupHtml,/Research team/);
    assert.doesNotMatch(groupHtml,/Celeritas|llama3\.2|qwen2\.5|name="model"/i);
    for(const view of ['workforce','conversations','missions','routines','activity','approvals','reports','notifications','crm','settings','more']){
      const html=renderMessenger({...args,view,sectionContent:`<section data-test-section="${view}">Section content</section>`});
      assert.match(html,/class="messenger-grid"/,`${view} keeps the inbox frame`);
      assert.match(html,/class="messenger-sidebar"/,`${view} keeps the bot inbox`);
      assert.match(html,new RegExp(`data-test-section="${view}"`),`${view} renders inside the frame`);
      assert.match(html,/id="workspace-section"/,`${view} has a scrollable content region`);
      assert.doesNotMatch(html,/class="layout"/,`${view} never uses the legacy dashboard`);
    }
  } finally {globalThis.localStorage=originalStorage;}
});
