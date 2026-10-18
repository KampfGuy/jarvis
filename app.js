"use strict";
// J.A.R.V.I.S. PWA: talks to the grokchan-api Cloudflare Worker (/chat, character "jarvis").
const API="https://grokchan-api.kampfguy.workers.dev";
const $=id=>document.getElementById(id);
const log=$("log"),q=$("q"),body=document.body;
const LS={pw:"jv_pw",hist:"jv_hist",mute:"jv_mute",voice:"jv_voice",model:"jv_model"};
// Free OpenRouter models accepted by grokchan-api (keep in sync with its MODELS list). "" = server default.
const MODELS=[["","Auto (default)"],["nvidia/nemotron-3-ultra-550b-a55b:free","Nemotron 3 Ultra"],["nvidia/nemotron-3-super-120b-a12b:free","Nemotron 3 Super"],["nvidia/nemotron-3.5-super-vl:free","Nemotron 3.5 Super VL"],["poolside/laguna-s-2.1:free","Laguna S 2.1"],["google/gemma-4-31b-it:free","Gemma 4 31B"]];
let hist=[];try{hist=JSON.parse(localStorage.getItem(LS.hist)||"[]").filter(m=>m&&m.role&&typeof m.content==="string").slice(-20);}catch{hist=[];}
let busy=false,pendingText="";

/* ---------- state + clock ---------- */
const STATE_TXT={idle:"STANDBY",listening:"LISTENING",thinking:"PROCESSING",speaking:"SPEAKING"};
function setState(s){body.dataset.state=s;$("stateTxt").textContent=STATE_TXT[s]||"STANDBY";}
function tick(){$("clock").textContent=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
tick();setInterval(tick,15000);

/* ---------- transcript ---------- */
function addMsg(role,text,cls){
  const el=document.createElement("div");el.className="msg "+(role==="user"?"u":"j")+(cls?" "+cls:"");
  const who=document.createElement("span");who.className="who";who.textContent=role==="user"?"YOU":(cls==="err"?"SYSTEM":"JARVIS");
  el.appendChild(who);
  if(role!=="user"&&!cls){const b=document.createElement("button");b.className="replay";b.type="button";b.setAttribute("aria-label","Read aloud");b.textContent="▶";b.onclick=()=>{unlockAudio();speak(text,true);};el.appendChild(b);}
  const t=document.createElement("span");t.className="txt";t.textContent=text;el.appendChild(t);
  log.appendChild(el);log.scrollTop=log.scrollHeight;return el;
}
function addTyping(){const el=addMsg("assistant","","typing");el.querySelector(".txt").innerHTML='<span class="dots"><i></i><i></i><i></i></span>';return el;}
function saveHist(){hist=hist.slice(-20);localStorage.setItem(LS.hist,JSON.stringify(hist));}
function greeting(){
  const h=new Date().getHours();
  if(h>=5&&h<12)return "Good morning, sir.";
  if(h>=12&&h<17)return "Good afternoon, sir.";
  if(h>=17&&h<22)return "Good evening, sir.";
  return "Good evening, sir. Burning the midnight oil again, I see.";
}
for(const m of hist)addMsg(m.role,m.content);
addMsg("assistant",greeting()+(hist.length?" Shall we carry on where we left off?":" How may I assist you?"));

/* ---------- hint ---------- */
let hintT;
function hint(msg,ms=9000){const h=$("hint");h.textContent=msg;h.hidden=false;clearTimeout(hintT);if(ms)hintT=setTimeout(()=>h.hidden=true,ms);}
function hideHint(){$("hint").hidden=true;}

/* ---------- speech synthesis (voice out) ---------- */
const synth=window.speechSynthesis;
let muted=localStorage.getItem(LS.mute)==="1",voice=null,audioUnlocked=false,speakGen=0;
const PREF=["Daniel","Arthur","Oliver","Malcolm","Google UK English Male","Microsoft Ryan","Microsoft George","Microsoft Thomas","Rishi","Aaron","Fred"];
function pickVoice(){
  if(!synth)return;const vs=synth.getVoices();if(!vs.length)return;
  const saved=localStorage.getItem(LS.voice);let v=saved&&vs.find(x=>x.name===saved);
  const gb=vs.filter(x=>/^en[-_]GB/i.test(x.lang));
  if(!v)for(const n of PREF){v=gb.find(x=>x.name.includes(n))||vs.find(x=>x.name.includes(n)&&/^en/i.test(x.lang));if(v)break;}
  if(!v)v=gb.find(x=>/male|daniel|arthur|george|ryan/i.test(x.name))||gb[0]||vs.find(x=>/^en[-_]/i.test(x.lang))||vs[0];
  voice=v;$("voiceName").textContent=v?v.name.replace(/\s*\(.*\)/,""):"default";
}
if(synth){pickVoice();if(synth.addEventListener)synth.addEventListener("voiceschanged",pickVoice);else synth.onvoiceschanged=pickVoice;setTimeout(pickVoice,600);setTimeout(pickVoice,2000);}
function unlockAudio(){ // iOS only allows speech after a user gesture; speak a silent utterance on first tap
  if(audioUnlocked||!synth)return;audioUnlocked=true;
  try{const u=new SpeechSynthesisUtterance(" ");u.volume=0;synth.speak(u);}catch{}
  pickVoice();
}
document.addEventListener("pointerdown",unlockAudio,{once:true,capture:true});
document.addEventListener("touchend",unlockAudio,{once:true,capture:true});
function cleanForSpeech(s){
  return s.replace(/```[\s\S]*?```/g," (code omitted) ").replace(/`([^`]*)`/g,"$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").replace(/https?:\/\/\S+/g,"the link")
    .replace(/[*_#>~|]+/g," ").replace(/^\s*[-•]\s+/gm,"").replace(/\bJ\.A\.R\.V\.I\.S\.?/g,"Jarvis")
    .replace(/\s+/g," ").trim();
}
function chunks(s){ // short utterances avoid iOS/Chrome cut-offs on long text
  const parts=s.match(/[^.!?;:]+[.!?;:]*\s*/g)||[s];const out=[];let cur="";
  for(const p of parts){if((cur+p).length>180&&cur){out.push(cur.trim());cur=p;}else cur+=p;}
  if(cur.trim())out.push(cur.trim());return out;
}
function stopSpeaking(){speakGen++;if(synth)synth.cancel();if(body.dataset.state==="speaking")setState("idle");}
function speak(text,force){
  if(!synth||(muted&&!force)){setState("idle");return;}
  const gen=++speakGen;synth.cancel();
  const list=chunks(cleanForSpeech(text));if(!list.length){setState("idle");return;}
  let i=0;
  const next=()=>{
    if(gen!==speakGen)return;
    if(i>=list.length){setState("idle");return;}
    const u=new SpeechSynthesisUtterance(list[i++]);
    if(voice){u.voice=voice;u.lang=voice.lang;}else u.lang="en-GB";
    u.rate=1.0;u.pitch=0.92;u.volume=1;
    u.onstart=()=>{if(gen===speakGen)setState("speaking");};
    u.onend=next;u.onerror=next;
    synth.speak(u);
  };
  setState("speaking");next();
}
function setMuteUI(){
  $("mute").innerHTML=muted
    ?'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
    :'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
  $("mute").setAttribute("aria-label",muted?"Unmute voice":"Mute voice");$("mute").setAttribute("aria-pressed",String(muted));
}
setMuteUI();
$("mute").onclick=()=>{muted=!muted;localStorage.setItem(LS.mute,muted?"1":"0");setMuteUI();if(muted)stopSpeaking();else{unlockAudio();speak("Voice restored, sir.",true);}};

/* ---------- speech recognition (voice in) ---------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const standalone=window.navigator.standalone===true||matchMedia("(display-mode: standalone)").matches;
let rec=null,listening=false,gotResult=false;
function dictationFallback(reason){
  listening=false;if(body.dataset.state==="listening")setState("idle");
  hint((reason?reason+" ":"")+"Tap the text box and use the 🎤 key on your iPhone keyboard to dictate, then tap send.",12000);
  q.focus();
}
function startListening(){
  if(!SR){dictationFallback("Voice recognition isn't available here"+(standalone?" in home-screen mode":"")+".");return;}
  stopSpeaking();
  try{
    rec=new SR();rec.lang=navigator.language&&/^en/i.test(navigator.language)?navigator.language:"en-US";
    rec.interimResults=true;rec.continuous=false;rec.maxAlternatives=1;
    gotResult=false;const myRec=rec;
    rec.onstart=()=>{listening=true;setState("listening");hideHint();q.placeholder="Listening, sir…";};
    rec.onresult=e=>{
      gotResult=true;let interim="",fin="";
      for(let k=0;k<e.results.length;k++){const r=e.results[k];if(r.isFinal)fin+=r[0].transcript;else interim+=r[0].transcript;}
      q.value=(fin+interim).trim();autosize();
      if(e.results[e.results.length-1].isFinal){try{myRec.stop();}catch{}}
    };
    rec.onerror=e=>{
      const er=e.error||"";
      if(er==="not-allowed"||er==="service-not-allowed")dictationFallback("Microphone or speech access was blocked"+(standalone?" (common in home-screen mode)":"")+".");
      else if(er==="no-speech")hint("I didn't catch anything, sir. Tap the mic and try again.",5000);
      else if(er==="aborted"){}
      else if(er==="network")dictationFallback("Speech recognition needs a network connection.");
      else dictationFallback("Voice recognition failed ("+er+").");
    };
    rec.onend=()=>{
      const was=listening;listening=false;q.placeholder="Speak or type, sir…";
      if(body.dataset.state==="listening")setState("idle");
      const t=(q.value||"").trim();
      if(was&&gotResult&&t)send(t); // auto-send when speech ends
    };
    rec.start();
    // Safety net: if recognition never starts (seen in iOS home-screen mode), fall back to keyboard dictation.
    setTimeout(()=>{if(rec===myRec&&!listening&&!gotResult&&body.dataset.state==="idle"&&document.activeElement!==q){try{myRec.abort();}catch{}dictationFallback("Voice recognition didn't start.");}},7000);
  }catch(err){dictationFallback("Voice recognition couldn't start.");}
}
$("mic").onclick=()=>{unlockAudio();if(listening){try{rec.stop();}catch{}}else startListening();};

/* ---------- password gate ---------- */
function pw(){return localStorage.getItem(LS.pw)||"";}
function showGate(msg){$("gate").hidden=false;$("gateErr").hidden=!msg;$("gateErr").textContent=msg||"";$("pw").value=pw();setTimeout(()=>$("pw").focus(),50);}
$("gateForm").onsubmit=e=>{e.preventDefault();const v=$("pw").value.trim();if(!v)return;localStorage.setItem(LS.pw,v);$("gate").hidden=true;unlockAudio();if(pendingText){const t=pendingText;pendingText="";send(t);}};
if(!pw())showGate();

/* ---------- chat ---------- */
async function send(text){
  text=(text||"").trim();if(!text||busy)return;
  if(!pw()){pendingText=text;showGate();return;}
  hideHint();q.value="";autosize();q.blur();
  addMsg("user",text);hist.push({role:"user",content:text});saveHist();
  busy=true;$("send").disabled=true;setState("thinking");
  const typing=addTyping();
  try{
    const ac=new AbortController();const to=setTimeout(()=>ac.abort(),60000);
    const r=await fetch(API+"/chat",{method:"POST",signal:ac.signal,headers:{"Content-Type":"application/json","X-Access-Password":pw()},body:JSON.stringify({character:"jarvis",messages:hist.slice(-20),...(model()?{model:model()}:{})})});
    clearTimeout(to);typing.remove();
    if(r.status===401){
      hist.pop();saveHist();
      addMsg("assistant","Access denied: the password was rejected (401). Please re-enter it, sir.","err");
      setState("idle");pendingText=text;showGate("That password was rejected. Please try again.");return;
    }
    const o=await r.json().catch(()=>({}));
    if(!r.ok||!o.reply)throw new Error(o.error||("HTTP "+r.status));
    const reply=String(o.reply).replace(/<ja>[\s\S]*?(<\/ja>|$)/gi,"").trim();
    hist.push({role:"assistant",content:reply});saveHist();
    addMsg("assistant",reply);
    speak(reply);
  }catch(err){
    typing.remove();
    addMsg("assistant",err.name==="AbortError"?"The request timed out, sir. Please try again.":"I'm afraid something went wrong: "+err.message,"err");
    hist.pop();saveHist();setState("idle");
  }finally{busy=false;$("send").disabled=!q.value.trim();}
}

/* ---------- composer ---------- */
function autosize(){q.style.height="auto";q.style.height=Math.min(q.scrollHeight,120)+"px";$("send").disabled=!q.value.trim()||busy;}
q.addEventListener("input",autosize);autosize();
q.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();$("composer").requestSubmit();}});
q.addEventListener("focus",()=>{if(body.dataset.state==="speaking")stopSpeaking();setTimeout(()=>log.scrollTop=log.scrollHeight,300);});
$("composer").onsubmit=e=>{e.preventDefault();unlockAudio();send(q.value);};

/* ---------- menu ---------- */
const menu=$("menu");
function toggleMenu(open){menu.hidden=!open;$("menuBtn").setAttribute("aria-expanded",String(open));}
$("menuBtn").onclick=e=>{e.stopPropagation();toggleMenu(menu.hidden);};
document.addEventListener("click",e=>{if(!menu.hidden&&!menu.contains(e.target))toggleMenu(false);});
$("clearBtn").onclick=()=>{toggleMenu(false);stopSpeaking();hist=[];saveHist();log.innerHTML="";addMsg("assistant","Memory banks cleared, sir. A clean slate.");};
$("pwBtn").onclick=()=>{toggleMenu(false);showGate();};
$("voiceBtn").onclick=()=>{ // cycle through English voices
  if(!synth)return;const vs=synth.getVoices().filter(v=>/^en/i.test(v.lang));if(!vs.length)return;
  const i=voice?vs.findIndex(v=>v.name===voice.name):-1;voice=vs[(i+1)%vs.length];
  localStorage.setItem(LS.voice,voice.name);$("voiceName").textContent=voice.name.replace(/\s*\(.*\)/,"")+" ("+voice.lang+")";
  unlockAudio();speak("This is "+voice.name.replace(/\s*\(.*\)/,"")+", sir.",true);
};

/* ---------- model picker ---------- */
function model(){const m=localStorage.getItem(LS.model)||"";return MODELS.some(x=>x[0]===m)?m:"";}
const modelSel=$("modelSel");
MODELS.forEach(([id,name])=>modelSel.add(new Option(name,id)));
modelSel.value=model();
modelSel.onchange=()=>{localStorage.setItem(LS.model,modelSel.value);toggleMenu(false);
  const name=MODELS.find(x=>x[0]===modelSel.value)[1];addMsg("assistant",modelSel.value?"Switching to "+name+", sir. Should it be unavailable, I shall fall back to the others.":"Back to the default model, sir.");};

/* ---------- PWA ---------- */
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
