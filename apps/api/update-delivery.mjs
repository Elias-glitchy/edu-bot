import { id, now } from './store.mjs';

const DEFAULT_TIMES=['09:00','13:00','17:00'];
const TIME_PATTERN=/^([01]\d|2[0-3]):[0-5]\d$/;

function providerConfiguration(environment={}) {
  const telegramMissing=[];
  if(!environment.COLLEAGUE_ZERO_TELEGRAM_BOT_TOKEN) telegramMissing.push('COLLEAGUE_ZERO_TELEGRAM_BOT_TOKEN');
  const whatsappMissing=[];
  for(const key of ['COLLEAGUE_ZERO_WHATSAPP_ACCESS_TOKEN','COLLEAGUE_ZERO_WHATSAPP_PHONE_NUMBER_ID','COLLEAGUE_ZERO_WHATSAPP_TEMPLATE_NAME','COLLEAGUE_ZERO_WHATSAPP_GRAPH_VERSION']) {
    if(!environment[key]) whatsappMissing.push(key);
  }
  return {
    telegram:{status:telegramMissing.length?'awaiting_configuration':'configured',missing:telegramMissing},
    whatsapp:{status:whatsappMissing.length?'awaiting_configuration':'configured',missing:whatsappMissing,templateLanguage:environment.COLLEAGUE_ZERO_WHATSAPP_TEMPLATE_LANGUAGE||'en_US'}
  };
}

function parseTimes(value) {
  const times=Array.isArray(value)?value.map(item=>String(item||'').trim()):[];
  if(times.length!==3||new Set(times).size!==3||times.some(item=>!TIME_PATTERN.test(item))) throw new Error('Choose exactly three different daily update times.');
  return [...times].sort();
}

function normalizeWhatsAppRecipient(value) {
  const recipient=String(value||'').replace(/[\s()-]/g,'');
  if(recipient&&!/^\+[1-9]\d{7,14}$/.test(recipient)) throw new Error('Use a WhatsApp number in international format, for example +27821234567.');
  return recipient;
}

function normalizeTelegramChatId(value) {
  const chatId=String(value||'').trim();
  if(chatId&&!/^-?\d{5,20}$/.test(chatId)) throw new Error('Use the numeric Telegram chat ID shown by your bot.');
  return chatId;
}

export function validateUpdateDeliveryPreferences(input={}) {
  const times=parseTimes(input.times);
  const whatsappEnabled=input.whatsappEnabled===true||input.whatsappEnabled==='true'||input.whatsappEnabled==='on';
  const telegramEnabled=input.telegramEnabled===true||input.telegramEnabled==='true'||input.telegramEnabled==='on';
  const whatsappRecipient=normalizeWhatsAppRecipient(input.whatsappRecipient);
  const telegramChatId=normalizeTelegramChatId(input.telegramChatId);
  if(whatsappEnabled&&!whatsappRecipient) throw new Error('Add the WhatsApp number before enabling WhatsApp updates.');
  if(telegramEnabled&&!telegramChatId) throw new Error('Add the Telegram chat ID before enabling Telegram updates.');
  return {times,whatsappEnabled,whatsappRecipient,telegramEnabled,telegramChatId};
}

export function saveUpdateDeliveryPreferences(db,{organizationId,userId,input}) {
  const value=validateUpdateDeliveryPreferences(input),timestamp=now();
  db.prepare(`INSERT INTO update_delivery_preferences(organization_id,user_id,times,whatsapp_enabled,whatsapp_recipient,telegram_enabled,telegram_chat_id,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(organization_id,user_id) DO UPDATE SET times=excluded.times,whatsapp_enabled=excluded.whatsapp_enabled,whatsapp_recipient=excluded.whatsapp_recipient,telegram_enabled=excluded.telegram_enabled,telegram_chat_id=excluded.telegram_chat_id,updated_at=excluded.updated_at`)
    .run(organizationId,userId,JSON.stringify(value.times),value.whatsappEnabled?1:0,value.whatsappRecipient||null,value.telegramEnabled?1:0,value.telegramChatId||null,timestamp,timestamp);
  return value;
}

function preferenceRow(db,organizationId,userId) {
  return db.prepare('SELECT * FROM update_delivery_preferences WHERE organization_id=? AND user_id=?').get(organizationId,userId);
}

export function getUpdateDeliveryState(db,{organizationId,userId,environment={}}) {
  const row=preferenceRow(db,organizationId,userId);
  const preferences=row?{
    times:JSON.parse(row.times),
    whatsappEnabled:Boolean(row.whatsapp_enabled),
    whatsappRecipient:row.whatsapp_recipient||'',
    telegramEnabled:Boolean(row.telegram_enabled),
    telegramChatId:row.telegram_chat_id||''
  }:{times:DEFAULT_TIMES,whatsappEnabled:false,whatsappRecipient:'',telegramEnabled:false,telegramChatId:''};
  const deliveries=db.prepare(`SELECT id,channel,scheduled_for,status,recipient_hint,provider_message_id,error,created_at,sent_at
    FROM notification_deliveries WHERE organization_id=? AND user_id=? ORDER BY created_at DESC LIMIT 20`).all(organizationId,userId);
  return {preferences,providers:providerConfiguration(environment),deliveries};
}

function localMinute(instant,timezone) {
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short',hourCycle:'h23'});
  const parts=Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`,weekday:parts.weekday};
}

function recipientHint(channel,recipient) {
  if(channel==='whatsapp') return recipient.length>5?`${recipient.slice(0,3)}••••${recipient.slice(-3)}`:'••••';
  return recipient.length>5?`${recipient.slice(0,2)}••••${recipient.slice(-3)}`:'••••';
}

function messageFor(db,organizationId,slotLabel) {
  const notifications=db.prepare('SELECT title,body,created_at FROM notifications WHERE organization_id=? ORDER BY created_at DESC LIMIT 5').all(organizationId);
  const title=`BUILD BOT ${slotLabel} update`;
  if(!notifications.length) return {title,body:'No new workforce activity is recorded. Your AI workforce is ready.'};
  const lines=notifications.map(item=>`• ${item.title}: ${item.body}`);
  return {title,body:lines.join('\n').slice(0,3000)};
}

async function responseJson(response) {
  try{return await response.json();}catch{return {};}
}

export async function deliverTelegram({chatId,title,body,environment,fetchImpl=fetch}) {
  const token=environment.COLLEAGUE_ZERO_TELEGRAM_BOT_TOKEN;
  if(!token) throw new Error('Telegram bot token is not configured.');
  const response=await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:`${title}\n\n${body}`.slice(0,4096)})});
  const payload=await responseJson(response);
  if(!response.ok||payload.ok===false) throw new Error(String(payload.description||`Telegram returned HTTP ${response.status}`).slice(0,300));
  return {messageId:String(payload.result?.message_id||'')};
}

export async function deliverWhatsApp({recipient,title,body,environment,fetchImpl=fetch}) {
  const token=environment.COLLEAGUE_ZERO_WHATSAPP_ACCESS_TOKEN,phoneNumberId=environment.COLLEAGUE_ZERO_WHATSAPP_PHONE_NUMBER_ID;
  const templateName=environment.COLLEAGUE_ZERO_WHATSAPP_TEMPLATE_NAME,graphVersion=environment.COLLEAGUE_ZERO_WHATSAPP_GRAPH_VERSION;
  if(!token||!phoneNumberId||!templateName||!graphVersion) throw new Error('WhatsApp Cloud API is not fully configured.');
  if(!/^v\d+\.\d+$/.test(graphVersion)) throw new Error('WhatsApp Graph version must look like v27.0.');
  const response=await fetchImpl(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`,{
    method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify({messaging_product:'whatsapp',to:recipient.replace(/^\+/,''),type:'template',template:{name:templateName,language:{code:environment.COLLEAGUE_ZERO_WHATSAPP_TEMPLATE_LANGUAGE||'en_US'},components:[{type:'body',parameters:[{type:'text',text:title.slice(0,256)},{type:'text',text:body.slice(0,3000)}]}]}})
  });
  const payload=await responseJson(response);
  if(!response.ok||payload.error) throw new Error(String(payload.error?.message||`WhatsApp returned HTTP ${response.status}`).slice(0,300));
  return {messageId:String(payload.messages?.[0]?.id||'')};
}

function slotLabel(time) {
  const hour=Number(time.slice(0,2));
  return hour<12?'morning':hour<17?'afternoon':'evening';
}

async function deliverSlot(db,{row,channel,recipient,scheduledFor,environment,fetchImpl}) {
  const config=providerConfiguration(environment)[channel];
  const timestamp=now(),deliveryId=id(),hint=recipientHint(channel,recipient);
  db.prepare(`INSERT OR IGNORE INTO notification_deliveries(id,organization_id,user_id,channel,scheduled_for,status,recipient_hint,created_at)
    VALUES(?,?,?,?,?,'claimed',?,?)`).run(deliveryId,row.organization_id,row.user_id,channel,scheduledFor,hint,timestamp);
  const delivery=db.prepare('SELECT * FROM notification_deliveries WHERE organization_id=? AND user_id=? AND channel=? AND scheduled_for=?').get(row.organization_id,row.user_id,channel,scheduledFor);
  if(!delivery||['sent','failed'].includes(delivery.status)) return delivery;
  if(config.status!=='configured') {
    db.prepare("UPDATE notification_deliveries SET status='awaiting_configuration',error=? WHERE id=?").run(`Missing server settings: ${config.missing.join(', ')}`,delivery.id);
    return db.prepare('SELECT * FROM notification_deliveries WHERE id=?').get(delivery.id);
  }
  const message=messageFor(db,row.organization_id,slotLabel(scheduledFor.slice(11,16)));
  try {
    const result=channel==='telegram'
      ?await deliverTelegram({chatId:recipient,...message,environment,fetchImpl})
      :await deliverWhatsApp({recipient,...message,environment,fetchImpl});
    db.prepare("UPDATE notification_deliveries SET status='sent',provider_message_id=?,error=NULL,sent_at=? WHERE id=?").run(result.messageId||null,now(),delivery.id);
  } catch(error) {
    db.prepare("UPDATE notification_deliveries SET status='failed',error=? WHERE id=?").run(String(error?.message||error).slice(0,300),delivery.id);
  }
  return db.prepare('SELECT * FROM notification_deliveries WHERE id=?').get(delivery.id);
}

export async function runDueUpdateDeliveries(db,{instant=now(),environment={},fetchImpl=fetch}={}) {
  const results=[];
  const rows=db.prepare(`SELECT p.*,o.timezone FROM update_delivery_preferences p JOIN organizations o ON o.id=p.organization_id
    WHERE p.whatsapp_enabled=1 OR p.telegram_enabled=1`).all();
  for(const row of rows) {
    const local=localMinute(instant,row.timezone),times=JSON.parse(row.times);
    if(!times.includes(local.time)) continue;
    const scheduledFor=`${local.date}T${local.time}[${row.timezone}]`;
    if(row.whatsapp_enabled&&row.whatsapp_recipient) results.push(await deliverSlot(db,{row,channel:'whatsapp',recipient:row.whatsapp_recipient,scheduledFor,environment,fetchImpl}));
    if(row.telegram_enabled&&row.telegram_chat_id) results.push(await deliverSlot(db,{row,channel:'telegram',recipient:row.telegram_chat_id,scheduledFor,environment,fetchImpl}));
  }
  return results;
}

