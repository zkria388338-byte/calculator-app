const Store = (() => {
  const key = 'calc_settings_v2';
  const defaults = { theme:'dark', language:'en', sound:false, vibration:false, font:'medium', scientific:true, history:[] };
  const load = () => ({ ...defaults, ...(JSON.parse(localStorage.getItem(key) || '{}')) });
  const save = (data) => localStorage.setItem(key, JSON.stringify(data));
  return { load, save, defaults };
})();

const i18n = { en:{history:'History',settings:'Settings',language:'Language',theme:'Theme',sound:'Sound',vibration:'Vibration',font:'Font Size',scientific:'Scientific Mode',close:'Close'}, ar:{history:'السجل',settings:'الإعدادات',language:'اللغة',theme:'السمة',sound:'الصوت',vibration:'الاهتزاز',font:'حجم الخط',scientific:'الوضع العلمي',close:'إغلاق'} };

const Engine = (() => {
  const ops = {'+':[2,'L'],'-':[2,'L'],'*':[3,'L'],'/':[3,'L'],'%':[3,'L'],'^':[4,'R'],'u-':[5,'R']};
  const fns = new Set(['sqrt','sin','cos','tan','log','ln']);
  const dec = n => (n.toString().split('.')[1]||'').length;
  const safeNum = n => Number(Number(n).toPrecision(14));
  const precise = (a,b,op) => { if(op==='+'||op==='-'){const s=10**Math.max(dec(a),dec(b));return (Math.round(a*s)+(op==='+'?1:-1)*Math.round(b*s))/s;} if(op==='*'){const da=dec(a),db=dec(b);return Number(String(a).replace('.',''))*Number(String(b).replace('.',''))/10**(da+db);} if(op==='/'){ if(b===0) throw Error('Div0'); return a/b; } if(op==='%'){ if(b===0) throw Error('Div0'); return (a/100)*b; } if(op==='^') return a**b; throw Error('Bad op'); };
  function tokenize(s){ const t=[]; for(let i=0;i<s.length;){const c=s[i]; if(c===' '){i++;continue;} if(/[0-9.]/.test(c)){let n=c;i++;while(i<s.length&&/[0-9.]/.test(s[i]))n+=s[i++]; if((n.match(/\./g)||[]).length>1) throw Error('decimal'); t.push({k:'n',v:n});continue;} if(/[a-z]/i.test(c)){let n=c;i++;while(i<s.length&&/[a-z]/i.test(s[i]))n+=s[i++]; if(!fns.has(n)) throw Error('fn'); t.push({k:'f',v:n});continue;} if('+-*/%^()'.includes(c)){t.push({k:(c==='('||c===')')?'p':'o',v:c});i++;continue;} throw Error('token');} return t; }
  function rpn(tokens){const out=[],st=[];let prev=null;for(const x of tokens){ if(x.k==='n') out.push(x); else if(x.k==='f') st.push(x); else if(x.k==='o'){let o=x.v; if(o==='-'&&(!prev||prev.k==='o'||(prev.k==='p'&&prev.v==='(')||prev.k==='f')) o='u-'; while(st.length&&st.at(-1).k==='o'){const top=st.at(-1).v; if((ops[o][1]==='L'&&ops[o][0]<=ops[top][0])||(ops[o][1]==='R'&&ops[o][0]<ops[top][0])) out.push(st.pop()); else break;} st.push({k:'o',v:o}); } else if(x.v==='(') st.push(x); else { while(st.length&&st.at(-1).v!=='(') out.push(st.pop()); if(!st.length) throw Error('paren'); st.pop(); if(st.length&&st.at(-1).k==='f') out.push(st.pop()); } prev=x;} while(st.length){const x=st.pop(); if(x.k==='p') throw Error('paren'); out.push(x);} return out; }
  function evalRpn(tokens){const st=[]; for(const t of tokens){ if(t.k==='n') st.push(Number(t.v)); else if(t.k==='o'){ if(t.v==='u-'){if(!st.length) throw Error('expr'); st.push(-st.pop()); continue;} const b=st.pop(),a=st.pop(); if(a===undefined||b===undefined) throw Error('expr'); st.push(precise(a,b,t.v)); } else {const x=st.pop(); if(x===undefined) throw Error('expr'); const y=t.v==='sqrt'?(x<0?NaN:Math.sqrt(x)):t.v==='sin'?Math.sin(x):t.v==='cos'?Math.cos(x):t.v==='tan'?Math.tan(x):t.v==='log'?(x<=0?NaN:Math.log10(x)):(x<=0?NaN:Math.log(x)); if(!Number.isFinite(y)) throw Error('domain'); st.push(y);} } if(st.length!==1||!Number.isFinite(st[0])) throw Error('expr'); return safeNum(st[0]); }
  const format = n => Number.isInteger(n)?String(n):String(Number(n.toFixed(10))).replace(/\.0+$/,'');
  const compute = (s) => { const val = evalRpn(rpn(tokenize(s))); return { value: val, formatted: format(val) }; };
  return { compute };
})();

const App = (() => {
  const $ = (id) => document.getElementById(id);
  const state = { expr:'', ans:0, memory:0, settings:Store.load(), preview:'' };
  const els = { expression:$('expression'), result:$('result'), preview:$('preview'), history:$('historyList'), keypad:$('keypad'), modal:$('settingsModal') };
  const persist=()=>Store.save({...state.settings, history:state.settings.history});
  const applySettings=()=>{document.body.dataset.theme=state.settings.theme;document.body.dataset.font=state.settings.font;document.documentElement.lang=state.settings.language;document.documentElement.dir=state.settings.language==='ar'?'rtl':'ltr';document.querySelectorAll('.sci').forEach(b=>b.style.display=state.settings.scientific?'':'none');const l=i18n[state.settings.language];$('historyTitle').textContent=l.history;$('settingsTitle').textContent=l.settings;$('langLabel').textContent=l.language;$('themeLabel').textContent=l.theme;$('soundLabel').textContent=l.sound;$('vibrationLabel').textContent=l.vibration;$('fontLabel').textContent=l.font;$('sciLabel').textContent=l.scientific;$('closeSettings').textContent=l.close;};
  const buzz=()=>{ if(state.settings.sound){const ctx=new (window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=300;g.gain.value=.02;o.start();o.stop(ctx.currentTime+.05);} if(state.settings.vibration && navigator.vibrate) navigator.vibrate(12); };
  const draw=()=>{els.expression.textContent=state.expr||'0';els.result.textContent=state.ans===null?'Error':String(state.ans);els.preview.textContent=state.preview;};
  const drawHistory=()=>{els.history.innerHTML=state.settings.history.map((h,i)=>`<li><span class='text' data-use='${h.expr}'>${h.expr} = ${h.result}</span><button class='del-item' data-del='${i}' aria-label='delete'>✕</button></li>`).join('');};
  const append=(s)=>{state.expr+=s; preview(); draw();};
  const preview=()=>{ if(!state.expr.trim()){state.preview='';return;} try{state.preview='= '+Engine.compute(state.expr).formatted;}catch{state.preview='';} };
  const calculate=()=>{if(!state.expr.trim()) return; try{const out=Engine.compute(state.expr); state.ans=out.formatted; state.settings.history.unshift({expr:state.expr,result:out.formatted}); state.settings.history=state.settings.history.slice(0,20); state.expr=out.formatted; }catch{state.ans='Error';} preview(); draw(); drawHistory(); persist();};
  const backspace=()=>{state.expr=state.expr.slice(0,-1); preview(); draw();};
  let backspaceTimer;
  $('backspaceBtn').addEventListener('mousedown',()=>{backspaceTimer=setTimeout(()=>{state.expr='';state.preview='';draw();},650);});
  $('backspaceBtn').addEventListener('mouseup',()=>clearTimeout(backspaceTimer));
  els.keypad.addEventListener('click',(e)=>{const b=e.target.closest('button'); if(!b) return; buzz(); if(b.dataset.value) append(b.dataset.value); if(b.dataset.fn) append(`${b.dataset.fn}(`); if(b.dataset.action==='clear'){state.expr='';state.preview='';draw();} if(b.dataset.action==='backspace') backspace(); if(b.dataset.action==='equals') calculate(); if(b.dataset.action==='ans') append(String(state.ans||0)); if(b.dataset.action==='memory-clear') state.memory=0; if(b.dataset.action==='memory-recall') append(String(state.memory)); if(b.dataset.action==='memory-add') state.memory+=Number(state.ans)||0; if(b.dataset.action==='memory-subtract') state.memory-=Number(state.ans)||0; });
  document.addEventListener('keydown',(e)=>{const k=e.key; if(/^[0-9]$/.test(k)||'+-*/^().'.includes(k)||k==='%') append(k); else if(k==='Enter'||k==='='){e.preventDefault();calculate();} else if(k==='Backspace') backspace(); else if(k==='Escape'){state.expr='';state.preview='';draw();}});
  $('copyResult').addEventListener('click',async()=>{await navigator.clipboard.writeText(String(state.ans));$('copyResult').textContent='✓';setTimeout(()=>$('copyResult').textContent='⧉',700);});
  els.history.addEventListener('click',(e)=>{const del=e.target.dataset.del;const use=e.target.dataset.use; if(del!==undefined){state.settings.history.splice(Number(del),1); drawHistory(); persist();} if(use){state.expr=use; preview(); draw();}});
  $('clearHistoryBtn').addEventListener('click',()=>{state.settings.history=[];drawHistory();persist();});
  $('settingsBtn').addEventListener('click',()=>els.modal.showModal()); $('closeSettings').addEventListener('click',()=>els.modal.close());
  [['languageSelect','language'],['themeSelect','theme'],['fontSelect','font']].forEach(([id,key])=>$(id).addEventListener('change',(e)=>{state.settings[key]=e.target.value;applySettings();persist();}));
  [['soundToggle','sound'],['vibrationToggle','vibration'],['scientificToggle','scientific']].forEach(([id,key])=>$(id).addEventListener('change',(e)=>{state.settings[key]=e.target.checked;applySettings();persist();}));
  const init=()=>{['language','theme','font'].forEach(k=>$(k+'Select').value=state.settings[k]);['sound','vibration','scientific'].forEach(k=>$(k+'Toggle').checked=state.settings[k]); applySettings(); state.settings.history=state.settings.history||[]; drawHistory(); draw();};
  return { init };
})();

App.init();
