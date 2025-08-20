// Workout Log v5 — mobile-first, robust
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // Elements
  const monthLabel = $('#monthLabel');
  const selectedDateLabel = $('#selectedDateLabel');
  const weekList = $('#weekList');
  const prevWeekBtn = $('#prevWeek');
  const menuBtn = $('#menuBtn');
  const menu = $('#menu');
  const exportBtn = $('#exportBtn');
  const importInput = $('#importInput');
  const clearAllBtn = $('#clearAllBtn');
  const settingsBtn = $('#settingsBtn');
  const settingsDlg = $('#settings');
  const settingsForm = $('#settingsForm');
  const themeSelect = $('#theme');
  const weightKgInput = $('#weightKg');
  const setTimeSecInput = $('#setTimeSec');
  const restTimeSecInput = $('#restTimeSec');
  const dayTypeSelect = $('#dayTypeSelect');
  const kcalChip = $('#kcalChip');
  const prChip = $('#prChip');
  const entriesList = $('#entriesList');
  const addBtn = $('#addBtn');

  // Sheet
  const sheet = $('#sheet');
  const entryForm = $('#entryForm');
  const entryId = $('#entryId');
  const exercise = $('#exercise');
  const setCount = $('#setCount');
  const intensity = $('#intensity');
  const setRows = $('#setRows');
  const notes = $('#notes');
  const cancelBtn = $('#cancelBtn');

  // Date state
  let viewAnchor = new Date(); viewAnchor.setHours(0,0,0,0);
  let selectedISO = toISO(new Date());

  // Prefs
  const PREF_KEY = 'workout_prefs_v1';
  function loadPrefs(){ try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch(e){ return {}; } }
  function savePrefs(p){ localStorage.setItem(PREF_KEY, JSON.stringify(p)); }
  function applyTheme(t){ document.documentElement.setAttribute('data-theme', t || 'dark'); }

  // Data (v3) with migration
  const KEY = 'workout_log_v3';
  function loadAll(){
    const raw = localStorage.getItem(KEY);
    if (raw) { try { return JSON.parse(raw) || {}; } catch(e){ return {}; } }
    // migrate from v2 or v1
    let migrated = {};
    for (const old of ['workout_log_v2','workout_log_v1']) {
      try {
        const o = JSON.parse(localStorage.getItem(old) || 'null');
        if (o && typeof o === 'object') {
          Object.entries(o).forEach(([date, day]) => {
            if (Array.isArray(day)) migrated[date] = { dayType: null, entries: normalizeEntries(day) };
            else migrated[date] = { dayType: day.dayType || null, entries: normalizeEntries(day.entries || []) };
          });
          break;
        }
      } catch(e){}
    }
    saveAll(migrated); return migrated;
  }
  function saveAll(data){ localStorage.setItem(KEY, JSON.stringify(data)); }
  function normalizeEntries(arr){
    return (arr || []).map(e => {
      let sets = e.sets;
      if (!Array.isArray(sets)) {
        const count = Math.max(1, Number(e.sets || 1));
        const reps = Math.max(1, Number(e.reps || 1));
        const weight = (e.weight===''||e.weight==null)?'':Number(e.weight);
        sets = Array.from({length: count}, () => ({ reps, weight }));
      } else {
        sets = sets.map(s => ({ reps: Number(s.reps||1), weight: (s.weight===''||s.weight==null)?'':Number(s.weight) }));
      }
      return {
        id: e.id || uuid(),
        exercise: e.exercise,
        sets,
        intensity: e.intensity || 'moderate',
        notes: e.notes || '',
        timestamp: e.timestamp || new Date().toISOString()
      };
    });
  }

  function getDay(iso){
    const all = loadAll();
    let day = all[iso];
    if (!day) day = { dayType: null, entries: [] };
    day.entries = normalizeEntries(day.entries);
    const all2 = loadAll(); all2[iso] = day; saveAll(all2);
    return day;
  }
  function setDay(iso, day){ const all = loadAll(); all[iso] = day; saveAll(all); }

  // Utils
  function uuid(){ if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);}); }
  function toISO(d){ const dt = new Date(d); dt.setHours(0,0,0,0); return dt.toISOString().slice(0,10); }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function startOfWeek(d){ const x=new Date(d); const dow=(x.getDay()+6)%7; return addDays(x,-dow); }
  function formatMonth(d){ return new Date(d).toLocaleString(undefined,{month:'long', year:'numeric'}); }
  function formatLabel(iso){ return new Date(iso).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}); }

  // Calories
  const METS = { light: 3.5, moderate: 6.0, vigorous: 8.0 };
  function kcalForEntry(e, prefs){
    const bw = Number(prefs.weightKg || 75);
    const setSec = Number(prefs.setTimeSec || 40);
    const restSec = Number(prefs.restTimeSec || 90);
    const sets = e.sets?.length || 1;
    const minutes = sets * (setSec + restSec) / 60;
    const met = METS[e.intensity || 'moderate'] || METS.moderate;
    return Math.round(met * 3.5 * bw / 200 * minutes);
  }

  // PR (Epley)
  function epley1RM(w, r){ if (w===''||w==null) return 0; return Number(w) * (1 + Number(r)/30); }
  function best1RM(exName, excludeISO, excludeId){
    const all = loadAll(); let best = 0;
    Object.entries(all).forEach(([date, day]) => {
      const entries = day.entries || [];
      entries.forEach(e => {
        if ((e.exercise||'').toLowerCase() === (exName||'').toLowerCase()){
          if (date===excludeISO && e.id===excludeId) return;
          e.sets.forEach(s => { best = Math.max(best, epley1RM(s.weight, s.reps)); });
        }
      });
    });
    return best;
  }

  // Week strip
  function renderWeekStrip(anchor){
    weekList.innerHTML='';
    const start = startOfWeek(anchor);
    monthLabel.textContent = formatMonth(anchor);
    for (let i=0;i<7;i++){
      const d = addDays(start,i); const iso = toISO(d);
      const li = document.createElement('li');
      const btn = document.createElement('button'); btn.className='daybtn';
      if (iso===selectedISO) btn.classList.add('active');
      if (iso===toISO(new Date())) btn.classList.add('today');
      const day = getDay(iso);
      if (day.entries.length) btn.classList.add('has');
      btn.innerHTML = `<div class="wd">${d.toLocaleString(undefined,{weekday:'short'})}</div><div class="dt">${d.getDate()}</div>`;
      btn.addEventListener('click', ()=> selectDate(iso));
      li.appendChild(btn); weekList.appendChild(li);
    }
    selectedDateLabel.textContent = formatLabel(selectedISO);
  }

  function selectDate(iso){ selectedISO = iso; renderWeekStrip(viewAnchor); renderEntries(); }

  // Entries
  function renderEntries(){
    const prefs = loadPrefs(); const day = getDay(selectedISO);
    entriesList.innerHTML=''; let totalKcal=0; let anyPR=false;

    if (day.entries.length===0){
      const li=document.createElement('li'); li.className='entry';
      li.innerHTML='<div style="color:var(--muted)">No entries yet — tap ＋ to log.</div>';
      entriesList.appendChild(li);
    }

    day.entries.forEach((e, idx)=>{
      const li=document.createElement('li'); li.className='entry';
      const prevBest=best1RM(e.exercise, selectedISO, e.id);
      let setBest=0; e.sets.forEach(s=>{ setBest=Math.max(setBest, epley1RM(s.weight,s.reps)); });
      const isPR=setBest>prevBest && setBest>0; anyPR = anyPR || isPR;
      const kcal=kcalForEntry(e,prefs); totalKcal += kcal;

      const top=document.createElement('div'); top.className='entry-top';
      const title=document.createElement('div'); title.className='entry-title'; title.textContent=`${e.exercise} · ${e.sets.length} sets`;
      const badges=document.createElement('div'); badges.className='badges';
      const kcalB=document.createElement('span'); kcalB.className='badge'; kcalB.textContent=`~${kcal} kcal`; badges.appendChild(kcalB);
      if(isPR){ const pr=document.createElement('span'); pr.className='badge pr'; pr.textContent='PR'; badges.appendChild(pr); }
      top.appendChild(title); top.appendChild(badges);

      const details=document.createElement('div');
      const reps=e.sets.map(s=>s.reps).join('/');
      const wts=e.sets.map(s=>(s.weight===''||s.weight==null)?'–':s.weight).join('/');
      details.style.color='var(--muted)';
      details.textContent=`${reps} reps @ ${wts} kg · ${e.intensity}${e.notes?' · '+e.notes:''}`;

      const actions=document.createElement('div'); actions.className='entry-actions';
      const edit=document.createElement('button'); edit.className='btn'; edit.textContent='Edit';
      const del=document.createElement('button'); del.className='btn danger'; del.textContent='Delete';
      edit.addEventListener('click', ()=> openSheet(e));
      del.addEventListener('click', ()=>{
        if(confirm('Delete this entry?')){
          const d=getDay(selectedISO); d.entries.splice(idx,1); setDay(selectedISO,d);
          renderWeekStrip(viewAnchor); renderEntries();
        }
      });
      actions.appendChild(edit); actions.appendChild(del);

      li.appendChild(top); li.appendChild(details); li.appendChild(actions);
      entriesList.appendChild(li);
    });

    kcalChip.textContent=`${totalKcal} kcal`;
    prChip.classList.toggle('hidden', !anyPR);
    dayTypeSelect.value = getDay(selectedISO).dayType || '';
  }

  // Day type
  dayTypeSelect.addEventListener('change', ()=>{
    const d=getDay(selectedISO); d.dayType = dayTypeSelect.value || null; setDay(selectedISO,d);
    renderWeekStrip(viewAnchor);
  });

  // Sheet
  function openSheet(e){
    sheet.classList.add('open'); document.body.style.overflow='hidden';
    if(e){
      entryId.value=e.id; exercise.value=e.exercise; setCount.value=e.sets.length||3; intensity.value=e.intensity||'moderate';
      buildSetRows(setCount.value, e.sets); notes.value=e.notes||'';
    } else {
      entryId.value=''; exercise.value=''; setCount.value=3; intensity.value='moderate'; buildSetRows(3,null); notes.value='';
    }
    setTimeout(()=> exercise.focus(), 0);
  }
  function closeSheet(){ sheet.classList.remove('open'); document.body.style.overflow=''; }
  cancelBtn.addEventListener('click', closeSheet);
  sheet.addEventListener('click', (ev)=>{ if(ev.target===sheet) closeSheet(); });
  addBtn.addEventListener('click', ()=> openSheet(null));

  function buildSetRows(n, existing){
    setRows.innerHTML=''; const count=Math.max(1, Number(n||1));
    for(let i=0;i<count;i++){
      const row=document.createElement('div'); row.className='set-row';
      row.innerHTML=`
        <div class="idx">Set ${i+1}</div>
        <input type="number" class="reps" min="1" step="1" placeholder="Reps" inputmode="numeric" value="${existing?.[i]?.reps ?? ''}"/>
        <input type="number" class="weight" min="0" step="0.5" placeholder="Weight (kg)" inputmode="decimal" value="${existing?.[i]?.weight ?? ''}"/>
      `;
      setRows.appendChild(row);
    }
  }
  setCount.addEventListener('input', ()=> buildSetRows(setCount.value));

  entryForm.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const ex=(exercise.value||'').trim(); if(!ex){ alert('Exercise required.'); return; }
    const count=Math.max(1, Number(setCount.value||1)); const rows=$$('.set-row', entryForm); const sets=[];
    for(let i=0;i<Math.min(count, rows.length); i++){
      const r=rows[i].querySelector('.reps').value; const w=rows[i].querySelector('.weight').value;
      const repsVal=Number(r); if(isNaN(repsVal)||repsVal<1){ alert('Reps must be ≥ 1.'); return; }
      const weightVal=(w===''||w==null)?'':Number(w); if(weightVal!=='' && isNaN(weightVal)){ alert('Weight must be a number.'); return; }
      sets.push({reps: repsVal, weight: weightVal});
    }
    const rec={ id: entryId.value || uuid(), exercise: ex, sets, intensity: intensity.value, notes: (notes.value||'').trim(), timestamp: new Date().toISOString() };
    const d=getDay(selectedISO); const idx=d.entries.findIndex(x=>x.id===rec.id); if(idx>=0) d.entries[idx]=rec; else d.entries.push(rec);
    setDay(selectedISO,d); closeSheet(); renderWeekStrip(viewAnchor); renderEntries();
  });

  // Settings
  const prefs=loadPrefs(); if(prefs.theme) applyTheme(prefs.theme);
  if(prefs.weightKg) weightKgInput.value=prefs.weightKg;
  if(prefs.setTimeSec) setTimeSecInput.value=prefs.setTimeSec;
  if(prefs.restTimeSec) restTimeSecInput.value=prefs.restTimeSec;
  if(prefs.theme) themeSelect.value=prefs.theme;
  settingsBtn.addEventListener('click', ()=> settingsDlg.showModal());
  $('#savePrefs').addEventListener('click', (e)=>{
    e.preventDefault();
    const p={ weightKg:Number(weightKgInput.value||75), setTimeSec:Number(setTimeSecInput.value||40), restTimeSec:Number(restTimeSecInput.value||90), theme: themeSelect.value||'dark' };
    savePrefs(p); applyTheme(p.theme); settingsDlg.close(); renderEntries();
  });

  // Menu
  menuBtn.addEventListener('click', ()=> menu.hidden = !menu.hidden);
  document.addEventListener('click', (e)=>{ if(!menuBtn.contains(e.target) && !menu.contains(e.target)) menu.hidden=true; });

  // Export / Import / Clear
  exportBtn.addEventListener('click', ()=>{
    const blob=new Blob([JSON.stringify(loadAll(), null, 2)], {type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='workout-data-v3.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  importInput.addEventListener('change', async (e)=>{
    const file=e.target.files[0]; if(!file) return;
    try {
      const text=await file.text(); const data=JSON.parse(text);
      if(typeof data!=='object' || Array.isArray(data)) throw new Error('Invalid format');
      const cur=loadAll(); saveAll({...cur, ...data}); alert('Import successful.'); renderWeekStrip(viewAnchor); renderEntries();
    } catch(err){ alert('Import failed: '+err.message); } finally { importInput.value=''; }
  });
  clearAllBtn.addEventListener('click', ()=>{ if(confirm('Delete ALL workout data?')){ localStorage.removeItem(KEY); renderWeekStrip(viewAnchor); renderEntries(); } });

  // Week navigation
  prevWeekBtn.addEventListener('click', ()=>{ viewAnchor = addDays(viewAnchor, -7); renderWeekStrip(viewAnchor); });

  // Init
  function init(){ viewAnchor=new Date(); viewAnchor.setHours(0,0,0,0); selectedISO=toISO(new Date()); renderWeekStrip(viewAnchor); renderEntries(); }
  init();
})();