import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore, id, now } from '../apps/api/store.mjs';
import { getUpdateDeliveryState, runDueUpdateDeliveries, saveUpdateDeliveryPreferences, validateUpdateDeliveryPreferences } from '../apps/api/update-delivery.mjs';

function workspace() {
  const db=openStore(':memory:'),organizationId=id(),userId=id(),created=now();
  db.prepare('INSERT INTO organizations(id,name,created_at,timezone) VALUES(?,?,?,?)').run(organizationId,'Delivery Test Academy',created,'Africa/Johannesburg');
  db.prepare('INSERT INTO users(id,email,salt,password_hash) VALUES(?,?,?,?)').run(userId,'owner@example.invalid','salt','hash');
  db.prepare("INSERT INTO memberships(user_id,organization_id,role) VALUES(?,?,'owner')").run(userId,organizationId);
  return {db,organizationId,userId};
}

test('daily update preferences require three unique times and valid destinations',()=>{
  assert.throws(()=>validateUpdateDeliveryPreferences({times:['09:00','13:00']}),/exactly three/i);
  assert.throws(()=>validateUpdateDeliveryPreferences({times:['09:00','09:00','17:00']}),/exactly three/i);
  assert.throws(()=>validateUpdateDeliveryPreferences({times:['09:00','13:00','17:00'],whatsappEnabled:true,whatsappRecipient:'082 123 4567'}),/international format/i);
  const value=validateUpdateDeliveryPreferences({times:['17:00','09:00','13:00'],whatsappEnabled:true,whatsappRecipient:'+27 82 123 4567',telegramEnabled:true,telegramChatId:'-1001234567890'});
  assert.deepEqual(value.times,['09:00','13:00','17:00']);
  assert.equal(value.whatsappRecipient,'+27821234567');
});

test('due update sends one Telegram and one WhatsApp template message without persisting secrets',async()=>{
  const {db,organizationId,userId}=workspace(),requests=[];
  saveUpdateDeliveryPreferences(db,{organizationId,userId,input:{times:['09:00','13:00','17:00'],whatsappEnabled:true,whatsappRecipient:'+27821234567',telegramEnabled:true,telegramChatId:'123456789'}});
  db.prepare('INSERT INTO notifications(id,organization_id,title,body,created_at) VALUES(?,?,?,?,?)').run(id(),organizationId,'Routine ready','Academic Research completed the scheduled scan.',now());
  const environment={
    COLLEAGUE_ZERO_TELEGRAM_BOT_TOKEN:'telegram-secret-token',
    COLLEAGUE_ZERO_WHATSAPP_ACCESS_TOKEN:'whatsapp-secret-token',
    COLLEAGUE_ZERO_WHATSAPP_PHONE_NUMBER_ID:'987654321',
    COLLEAGUE_ZERO_WHATSAPP_TEMPLATE_NAME:'build_bot_update',
    COLLEAGUE_ZERO_WHATSAPP_TEMPLATE_LANGUAGE:'en_US',
    COLLEAGUE_ZERO_WHATSAPP_GRAPH_VERSION:'v27.0'
  };
  const fetchImpl=async(url,options)=>{
    requests.push({url:String(url),options,payload:JSON.parse(options.body)});
    if(String(url).includes('api.telegram.org')) return new Response(JSON.stringify({ok:true,result:{message_id:42}}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({messages:[{id:'wamid.test'}]}),{status:200,headers:{'content-type':'application/json'}});
  };
  const first=await runDueUpdateDeliveries(db,{instant:'2026-11-06T07:00:10.000Z',environment,fetchImpl});
  const second=await runDueUpdateDeliveries(db,{instant:'2026-11-06T07:00:40.000Z',environment,fetchImpl});
  assert.equal(first.length,2);
  assert.equal(second.length,2);
  assert.equal(requests.length,2,'the same local update slot must not be sent twice');
  const telegram=requests.find(item=>item.url.includes('api.telegram.org'));
  assert.equal(telegram.payload.chat_id,'123456789');
  assert.match(telegram.payload.text,/Routine ready/);
  const whatsapp=requests.find(item=>item.url.includes('graph.facebook.com'));
  assert.equal(whatsapp.options.headers.authorization,'Bearer whatsapp-secret-token');
  assert.equal(whatsapp.payload.type,'template');
  assert.equal(whatsapp.payload.template.name,'build_bot_update');
  assert.equal(whatsapp.payload.template.components[0].parameters.length,2);
  const stored=JSON.stringify(getUpdateDeliveryState(db,{organizationId,userId,environment:{}}));
  assert.doesNotMatch(stored,/secret-token/);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM notification_deliveries WHERE status='sent'").get().count,2);
  db.close();
});

test('enabled channels visibly wait for missing server credentials',async()=>{
  const {db,organizationId,userId}=workspace();
  saveUpdateDeliveryPreferences(db,{organizationId,userId,input:{times:['09:00','13:00','17:00'],telegramEnabled:true,telegramChatId:'123456789'}});
  const results=await runDueUpdateDeliveries(db,{instant:'2026-11-06T07:00:00.000Z',environment:{},fetchImpl:async()=>{throw new Error('must not call provider');}});
  assert.equal(results[0].status,'awaiting_configuration');
  const state=getUpdateDeliveryState(db,{organizationId,userId,environment:{}});
  assert.equal(state.providers.telegram.status,'awaiting_configuration');
  assert.equal(state.deliveries[0].status,'awaiting_configuration');
  db.close();
});

