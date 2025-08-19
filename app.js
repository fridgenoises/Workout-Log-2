// Workout Log — Minimal Mobile UI, Themes, Calories, PRs
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // Elements
  const monthLabel = $('#monthLabel');
  const calendarGrid = $('#calendarGrid');
  const selectedDateLabel = $('#selectedDateLabel');
  const dayTypeSelect = $('#dayTypeSelect');
  const kcalChip = $('#kcalChip');
  const prChip = $('#prChip');
  const entriesList = $('#entriesList');
  const addEntryBtn = $('#addEntryBtn');
  const prevMonthBtn = $('#prevMonth');
  const moreBtn = $('#moreBtn');
  const moreMenu = $('#moreMenu');
  const exportBtn = $('#exportBtn');
  const importInput = $('#importInput');
  const clearAllBtn = $('#clearAllBtn');
  const settingsBtn = $('#settingsBtn');
  const settingsDialog = $('#settingsDialog');
  const settingsForm = $('#settingsForm');
  const weightKgInput = $('#weightKg');
  const setTimeSecInput = $('#setTimeSec');
  const restTimeSecInput = $('#restTimeSec');
  const themeSelect = $('#themeSelect');

  // Entry sheet
  const sheet = $('#sheet');
  const entryForm = $('#entryForm');
  const entryIdInput = $('#entryId');
  const exerciseInput = $('#exercise');
  const setCountInput = $('#setCount');
  const intensitySelect = $('#intensity');
  const setRows = $('#setRows');
  const notesInput = $('#notes');

  // State
  let view = new Date(); view.setDate(1);
  let selectedISO = toISO(new Date());

  // Themes / settings
  const PREF_KEY = 'workout_prefs_v1';
  function loadPrefs(){
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch(e){ return {}; }
  }
  function savePrefs(p){ localStorage.setItem(PREF_KEY, JSON.stringify(p)); }
  function applyTheme(theme){
    const t = theme || 'dark';
    document.documentElement.setAttribute('data-theme', t);
  }

  // Storage (v2 data format reused)
  const KEY = 'workout_log_v2';
  function loadAll(){
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch(e){ return {}; }
  }
  function saveAll(data){ localStorage.setItem(KEY, JSON.stringify(data)); }
  function getDay(dateISO){
    const all = loadAll();
    let day = all[dateISO];
    if (!day) day = { dayType: null, entries: [] };
    if (Array.isArray(day)) day = { dayType: null, entries: day };
    // ensure structure
    day.entries = (day.entries || []).map(e => {
      if (!Array.isArray(e.sets)) {
        const count = Math.max(1, Number(e.sets || 1));
        const reps = Math.max(1, Number(e.reps || 1));
        const weight = (e.weight === '' || e.weight == null) ? '' : Number(e.weight);
        e.sets = Array.from({length: count}, () => ({ reps, weight }));
      }
      if (!e.id) e.id = uuid();
      return e;
    });
    // persist fixes
    const all2 = loadAll(); all2[dateISO] = day; saveAll(all2);
    return day;
  }
  function setDay(dateISO, day){
    const all = loadAll();
    all[dateISO] = day;
    saveAll(all);
  }

  // Utils
  function uuid(){
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8); return v.toString(16);
    });
  }
  function toISO(d){ return d.toISOString().slice(0,10); }
  function fmtMonthYear(d){ return d.toLocaleString(undefined, {month:'long', year:'numeric'}); }
  function buildMonth(year, month){
    const first = new Date(year, month, 1);
    const start = new Date(first); start.setDate(first.getDate() - ((first.getDay()+6)%7));
    const end = new Date(year, month+1, 0); // last day
    const lastWeekEnd = new Date(end); lastWeekEnd.setDate(end.getDate() + (7-((end.getDay()+6)%7)-1));
    const days = [];
    for (let d = new Date(start); d <= lastWeekEnd; d.setDate(d.getDate()+1)) {
      days.push(new Date(d));
    }
    return days;
  }

  // Calories
  const METS = { light: 3.5, moderate: 6.0, vigorous: 8.0 };
  function estimateEntryKcal(entry, prefs){
    const bw = Number(prefs.weightKg || 75);
    const setSec = Number(prefs.setTimeSec || 40);
    const restSec = Number(prefs.restTimeSec || 90);
    const sets = Array.isArray(entry.sets) ? entry.sets.length : Number(entry.sets||1);
    const totalMin = (sets * (setSec + restSec)) / 60;
    const met = METS[entry.intensity || 'moderate'] || METS.moderate;
    // kcal = MET × 3.5 × BW / 200 × minutes
    return Math.round(met * 3.5 * bw / 200 * totalMin);
  }

  // PRs (Epley 1RM)
  function est1RM(weight, reps){
    if (weight === '' || weight == null) return 0;
    return Number(weight) * (1 + Number(reps)/30);
  }
  function best1RMForExercise(exercise, excludeDateISO, excludeId){
    const all = loadAll();
    let best = 0;
    Object.entries(all).forEach(([d, day]) => {
      const entries = Array.isArray(day) ? day : (day.entries||[]);
      entries.forEach(e => {
        if (e.exercise && e.exercise.toLowerCase() === exercise.toLowerCase()) {
          if (d === excludeDateISO && e.id === excludeId) return;
          (e.sets||[]).forEach(s => { best = Math.max(best, est1RM(s.weight, s.reps)); });
        }
      });
    });
    return best;
  }

  // Render calendar
  function renderCalendar(){
    monthLabel.textContent = fmtMonthYear(view);
    const days = buildMonth(view.getFullYear(), view.getMonth());
    const thisMonth = view.getMonth();
    const todayISO = toISO(new Date());
    calendarGrid.innerHTML='';
    days.forEach(d => {
      const iso = toISO(d);
      const btn = document.createElement('button');
      btn.className = 'day';
      const num = document.createElement('div'); num.className='num'; num.textContent = d.getDate();
      btn.appendChild(num);
      const day = getDay(iso);
      if ((day.entries||[]).length){
        const b = document.createElement('div'); b.className='badge'; b.textContent = day.entries.length; btn.appendChild(b);
      }
      if (day.dayType){
        const tag = document.createElement('div'); tag.className='tag'; tag.textContent = day.dayType; btn.appendChild(tag);
      }
      if (iso === todayISO) btn.classList.add('today');
      if (d.getMonth() !== thisMonth) btn.style.opacity = .45;
      btn.addEventListener('click', ()=> selectDate(iso));
      calendarGrid.appendChild(btn);
    });
  }

  function selectDate(iso){
    selectedISO = iso;
    selectedDateLabel.textContent = new Date(iso).toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric', year:'numeric'});
    const day = getDay(iso);
    dayTypeSelect.value = day.dayType || '';
    renderEntries();
  }

  function renderEntries(){
    const prefs = loadPrefs();
    const day = getDay(selectedISO);
    const entries = day.entries.map((e,i)=>({...e, __index:i}));
    entriesList.innerHTML = '';
    let dayKcal = 0;
    let prToday = false;

    if (entries.length === 0){
      const empty = document.createElement('li');
      empty.className = 'entry';
      empty.innerHTML = '<div class="entry-title" style="color:var(--muted)">No entries yet. Tap ＋ to log.</div>';
      entriesList.appendChild(empty);
    }

    entries.forEach(e => {
      const li = document.createElement('li');
      li.className = 'entry';

      // PR detection
      const best = best1RMForExercise(e.exercise, selectedISO, e.id);
      let maxSet = 0;
      (e.sets||[]).forEach(s => { maxSet = Math.max(maxSet, est1RM(s.weight, s.reps)); });
      const isPR = maxSet > best && maxSet > 0;
      if (isPR) prToday = true;

      // kcal
      const kcal = estimateEntryKcal(e, {...prefs, restTimeSec: prefs.restTimeSec});
      dayKcal += kcal;

      const top = document.createElement('div'); top.className='entry-top';
      const title = document.createElement('div'); title.className='entry-title';
      title.textContent = `${e.exercise} · ${e.sets.length} sets`;
      const badges = document.createElement('div'); badges.className='badges';
      const kcalBadge = document.createElement('span'); kcalBadge.className='badge'; kcalBadge.textContent = `~${kcal} kcal`;
      badges.appendChild(kcalBadge);
      if (isPR){ const pr = document.createElement('span'); pr.className='badge pr'; pr.textContent='PR'; badges.appendChild(pr); }
      top.appendChild(title); top.appendChild(badges);

      const details = document.createElement('div');
      const reps = e.sets.map(s=>s.reps ?? '?').join('/');
      const wts = e.sets.map(s=>(s.weight===''||s.weight==null)?'–':s.weight).join('/');
      const intensity = e.intensity ? ` · ${e.intensity}` : '';
      details.className='muted';
      details.textContent = `${reps} reps @ ${wts} kg${intensity}${e.notes? ' · '+e.notes: ''}`;

      const actions = document.createElement('div'); actions.className='badges';
      const editBtn = document.createElement('button'); editBtn.className='badge'; editBtn.textContent='Edit';
      const delBtn = document.createElement('button'); delBtn.className='badge'; delBtn.style.background='transparent'; delBtn.textContent='Delete';

      editBtn.addEventListener('click', ()=> openSheet(e));
      delBtn.addEventListener('click', ()=> {
        if (confirm('Delete this entry?')){
          const arr = getDay(selectedISO).entries;
          arr.splice(e.__index, 1);
          setDay(selectedISO, {...getDay(selectedISO), entries: arr});
          renderEntries(); renderCalendar();
        }
      });

      actions.appendChild(editBtn); actions.appendChild(delBtn);

      li.appendChild(top);
      li.appendChild(details);
      li.appendChild(actions);
      entriesList.appendChild(li);
    });

    kcalChip.textContent = `${dayKcal} kcal`
    prChip.classList.toggle('hidden', !prToday);
  }

  // Day type
  dayTypeSelect.addEventListener('change', ()=>{
    const d = getDay(selectedISO);
    d.dayType = dayTypeSelect.value || null;
    setDay(selectedISO, d);
    renderCalendar();
  });

  // Sheet (entry form)
  function openSheet(entry){
    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (entry){
      entryIdInput.value = entry.id;
      exerciseInput.value = entry.exercise;
      setCountInput.value = entry.sets.length || 3;
      intensitySelect.value = entry.intensity || 'moderate';
      buildSetRows(setCountInput.value, entry.sets);
      notesInput.value = entry.notes || '';
    } else {
      entryIdInput.value = '';
      exerciseInput.value = '';
      setCountInput.value = 3;
      intensitySelect.value = 'moderate';
      buildSetRows(3, null);
      notesInput.value = '';
    }
  }
  function closeSheet(){
    sheet.classList.remove('open');
    document.body.style.overflow = '';
  }
  $('#cancelEntryBtn').addEventListener('click', closeSheet);
  addEntryBtn.addEventListener('click', ()=> openSheet(null));
  sheet.addEventListener('click', (e)=>{ if(e.target === sheet) closeSheet(); });

  function buildSetRows(n, existing){
    setRows.innerHTML = '';
    const count = Math.max(1, Number(n||1));
    for (let i=0;i<count;i++){
      const row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML = `
        <div class="idx">Set ${i+1}</div>
        <input type="number" class="reps" min="1" step="1" placeholder="Reps" inputmode="numeric" value="${existing?.[i]?.reps ?? ''}"/>
        <input type="number" class="weight" min="0" step="0.5" placeholder="Weight (kg)" inputmode="decimal" value="${existing?.[i]?.weight ?? ''}"/>
      `;
      setRows.appendChild(row);
    }
  }
  setCountInput.addEventListener('input', ()=> buildSetRows(setCountInput.value));

  entryForm.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const ex = exerciseInput.value.trim();
    if(!ex){ alert('Exercise required.'); return; }
    const count = Math.max(1, Number(setCountInput.value || 1));
    const rows = $$('.set-row', entryForm);
    const sets = [];
    for (let i=0;i<Math.min(count, rows.length);i++){
      const r = rows[i].querySelector('.reps').value;
      const w = rows[i].querySelector('.weight').value;
      const repsVal = Number(r); if (isNaN(repsVal) || repsVal<1){ alert('Reps must be ≥1.'); return; }
      const weightVal = (w===''||w==null)?'':Number(w); if (weightVal!=='' && isNaN(weightVal)){ alert('Weight must be a number.'); return; }
      sets.push({reps: repsVal, weight: weightVal});
    }
    const record = {
      id: entryIdInput.value || uuid(),
      exercise: ex,
      sets,
      intensity: intensitySelect.value,
      notes: notesInput.value.trim(),
      timestamp: new Date().toISOString()
    };
    const d = getDay(selectedISO);
    const idx = d.entries.findIndex(x=>x.id===record.id);
    if (idx>=0) d.entries[idx] = record; else d.entries.push(record);
    setDay(selectedISO, d);
    closeSheet();
    renderEntries(); renderCalendar();
  });

  // Settings
  const prefs = loadPrefs();
  if (prefs.theme) applyTheme(prefs.theme);
  if (prefs.weightKg) weightKgInput.value = prefs.weightKg;
  if (prefs.setTimeSec) setTimeSecInput.value = prefs.setTimeSec;
  if (prefs.restTimeSec) restTimeSecInput.value = prefs.restTimeSec;
  if (prefs.theme) themeSelect.value = prefs.theme;

  settingsBtn.addEventListener('click', ()=> settingsDialog.showModal());
  $('#saveSettingsBtn').addEventListener('click', (e)=>{
    e.preventDefault();
    const p = {
      weightKg: Number(weightKgInput.value || 75),
      setTimeSec: Number(setTimeSecInput.value || 40),
      restTimeSec: Number(restTimeSecInput.value || 90),
      theme: themeSelect.value || 'dark'
    };
    savePrefs(p); applyTheme(p.theme);
    settingsDialog.close();
    renderEntries(); // recalc kcal with new prefs
  });

  // Overflow menu
  moreBtn.addEventListener('click', ()=>{
    moreMenu.hidden = !moreMenu.hidden;
  });
  document.addEventListener('click', (e)=>{
    if (!moreBtn.contains(e.target) && !moreMenu.contains(e.target)) moreMenu.hidden = true;
  });

  // Export / Import / Clear
  exportBtn.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(loadAll(), null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'workout-data-v2.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });
  importInput.addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid format');
      const current = loadAll();
      saveAll({ ...current, ...data });
      alert('Import successful.');
      renderCalendar(); renderEntries();
    } catch(err){ alert('Import failed: '+err.message); }
    finally { importInput.value=''; }
  });
  clearAllBtn.addEventListener('click', ()=>{
    if (confirm('Delete ALL workout data?')){
      localStorage.removeItem(KEY);
      renderCalendar(); renderEntries();
    }
  });

  // Navigation
  prevMonthBtn.addEventListener('click', ()=>{ view.setMonth(view.getMonth()-1); renderCalendar(); });

  // Init
  function init(){
    monthLabel.textContent = fmtMonthYear(view);
    renderCalendar();
    selectDate(selectedISO);
  }
  init();
})();