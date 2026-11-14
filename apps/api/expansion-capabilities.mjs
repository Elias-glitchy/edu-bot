const flag=(environment,name,fallback)=>{
  const value=environment[`COLLEAGUE_ZERO_${name}`];
  if(value==null||value==='')return fallback;
  return /^(1|true|yes|on)$/i.test(value);
};

export function expansionFlags(environment=process.env){
  return Object.freeze({
    mcpExecution:flag(environment,'MCP_EXECUTION_ENABLED',true),
    memory:flag(environment,'MEMORY_ENABLED',true),
    skills:flag(environment,'SKILLS_ENABLED',true),
    collections:flag(environment,'COLLECTIONS_ENABLED',true),
    multiAgent:flag(environment,'MULTI_AGENT_ENABLED',true),
    geminiVoice:flag(environment,'GEMINI_VOICE_ENABLED',true),
    geminiMultimodal:flag(environment,'GEMINI_MULTIMODAL_ENABLED',true),
    codeSandbox:flag(environment,'CODE_SANDBOX_ENABLED',false)
  });
}

export function getExpansionCapabilities({flags=expansionFlags(),geminiApiKey}={}){
  const geminiConfigured=Boolean(geminiApiKey);
  return {
    gemini:{configured:geminiConfigured,text:geminiConfigured?'configured':'awaiting_credentials',voice:flags.geminiVoice?(geminiConfigured?'configured':'awaiting_credentials'):'disabled',multimodal:flags.geminiMultimodal?(geminiConfigured?'configured':'awaiting_credentials'):'disabled'},
    mcpExecution:flags.mcpExecution?'available_governed':'disabled',
    memory:flags.memory?'available_local':'disabled',skills:flags.skills?'available_local':'disabled',collections:flags.collections?'available_local':'disabled',multiAgent:flags.multiAgent?(geminiConfigured?'available_with_gemini':'graph_ready_awaiting_credentials'):'disabled',codeSandbox:flags.codeSandbox?'available_local':'disabled'
  };
}

export function requireFeature(flags,key){if(!flags[key]){const error=new Error(`${key} is disabled by server feature flag.`);error.status=503;throw error;}}
