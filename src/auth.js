import {getSupabase} from './supabase.js';
export function initAuth(onReady){
 const client=getSupabase(), el=id=>document.getElementById(id);
 const overlay=el('auth-overlay'), submit=el('auth-submit'), mode=el('auth-mode'), error=el('auth-error');
 let signup=false,busy=false,until=0,timer;
 const label=()=>signup?'Account erstellen':'Anmelden';
 const reset=()=>{submit.disabled=false;submit.textContent=label();busy=false;};
 mode.onclick=()=>{if(busy)return;signup=!signup;el('auth-title').textContent=label();submit.textContent=label();el('auth-username').classList.toggle('hidden',!signup);mode.textContent=signup?'Ich habe bereits einen Account':'Neuen Account erstellen';};
 submit.onclick=async()=>{
  if(busy||Date.now()<until)return;
  if(!client){error.textContent='Supabase ist nicht konfiguriert.';return;}
  busy=true;submit.disabled=true;error.textContent='';submit.textContent='Bitte warten …';
  try{
   const credentials={email:el('auth-email').value.trim(),password:el('auth-password').value};
   const result=signup?await client.auth.signUp({...credentials,options:{data:{username:el('auth-username').value.trim()}}}):await client.auth.signInWithPassword(credentials);
   if(result.error)throw result.error;
   if(!result.data.session){error.textContent='Bitte bestätige deine E-Mail und melde dich anschließend an.';reset();return;}
   overlay.classList.add('hidden');
   await onReady();reset();
  }catch(e){
   const message=e.message||String(e),match=message.match(/after\s+(\d+)\s+seconds/i);
   error.textContent=message;
   if(match){until=Date.now()+Number(match[1])*1000;clearInterval(timer);const tick=()=>{const seconds=Math.ceil((until-Date.now())/1000);if(seconds<=0){clearInterval(timer);reset();}else submit.textContent=`Bitte ${seconds}s warten …`;};tick();timer=setInterval(tick,1000);}else reset();
  }
 };
 const {data:listener}=client?.auth.onAuthStateChange((event,session)=>{if(session&&event==='SIGNED_IN'){overlay.classList.add('hidden');}})||{data:null};
 return ()=>listener?.subscription.unsubscribe();
}
export function showAuth(){document.getElementById('auth-overlay').classList.remove('hidden');}
