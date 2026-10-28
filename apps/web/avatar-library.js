// Avatar IDs are presentation metadata. They must never enter bot execution,
// permissions, model selection, instructions, or scheduling decisions.
export const AVATARS=Object.freeze(Array.from({length:75},(_,index)=>{
  const number=String(index+1).padStart(3,'0');
  return Object.freeze({id:`bot_avatar_${number}`,src:`/assets/bot-avatars-v2/bot-avatar-${number}.png`,number:index+1});
}));

export const DEFAULT_AVATAR_ID=AVATARS[0].id;
const byId=new Map(AVATARS.map(avatar=>[avatar.id,avatar]));

export function isValidAvatarId(value){return typeof value==='string'&&byId.has(value);}
export function avatarAsset(value){return byId.get(value)||byId.get(DEFAULT_AVATAR_ID);}
export function agentAvatarSrc(agent){
  const selected=agent?.avatar_id??agent?.avatarId;
  if(isValidAvatarId(selected))return avatarAsset(selected).src;
  if(agent?.kind==='custom')return avatarAsset(DEFAULT_AVATAR_ID).src;
  const slug=String(agent?.slug||'chief');
  return /^[a-z0-9-]+$/.test(slug)?`/assets/agents/${slug}.png`:'/assets/agents/chief.png';
}
export function agentAvatarMarkup(agent,{className='',alt='',loading='lazy'}={}){
  const safe=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const src=agentAvatarSrc(agent);
  const fallback='/assets/agents/chief.png';
  return `<img class="${safe(className)}" src="${safe(src)}" alt="${safe(alt)}" loading="${safe(loading)}" data-avatar-fallback="${safe(fallback)}">`;
}
