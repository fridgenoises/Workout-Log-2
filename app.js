// Workout Calendar — PWA v3 (Themes + Calories + PR highlighting)
(function(){
  const $ = (sel, root=document) => root.querySelector(sel);

  // Elements
  const monthLabel = $('#monthLabel');
  const grid = $('#calendarGrid');
  const selectedDateLabel = $('#selectedDateLabel');
  const dayTypeChip = $('#dayTypeChip');
  const dayTypeSelect = $('#dayTypeSelect');
  const entriesList = $('#entriesList');
  const addEntryBtn = $('#addEntryBtn');
  const entryForm = $('#entryForm');
  const exercise = $('#exercise');
  const setCount = $('#setCount');
  const setRows = $('#setRows');
  const notes = $('#notes');
  const entryIdInput = $('#entryId');
  const prevMonthBtn = $('#prevMonth');
  const nextMonthBtn = $('#nextMonth');
  const exportBtn = $('#exportBtn');
  const importInput = $('#importInput');
  const clearAllBtn = $('#clearAllBtn');
  const historyQuery = $('#historyQuery');
  const historyRefreshBtn = $('#historyRefreshBtn');
  const historyList = $('#historyList');
  const intensity = $('#intensity');
  const setTime = $('#setTime');
  const restTime = $('#restTime');
  const settingsBtn = $('#settingsBtn');
  const settingsDialog = $('#settingsDialog');
  const bodyWeight = $('#bodyWeight');
  const saveSettings = $('#saveSettings');
  const closeSettings = $('#closeSettings');
  const dayCaloriesEl = $('#dayCalories');
  const themeSelect = $('#themeSelect');

  function uuid(){
    if (window.crypto && 'randomUUID' in window.crypto) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  let view = new Date();
  view.setDate(1);
  let selectedISO = toISO(new Date());

  function toISO(d){
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function fromISO(s){
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m-1, d);
  }
  function startOfWeek(d){
    const date = new Date(d);
    const day = (date.getDay()+6)%7;
    date.setDate(date.getDate()-day);
    date.setHours(0,0,0,0);
    return date;
  }
  function endOfWeek(d){
    const s = startOfWeek(d);
    const e = new Date(s);
    e.setDate(s.getDate()+6);
    e.setHours(23,59,59,999);
    return e;
  }
  function getMonthMatrix(year, month){
    const first = new Date(year, month, 1);
    const last = new Date(year, month+1, 0);
    const start = startOfWeek(first);
    const end = endOfWeek(last);
    const days = [];
    for(let d = new Date(start); d <= end; d.setDate(d.getDate()+1)){
      days.push(new Date(d));
    }
    return days;
  }
  function fmtMonthYear(d){
    return d.toLocaleString(undefined, { month:'long', year:'numeric' });
  }

  const KEY = 'workout_log_v3';
  const PREFS = 'workout_prefs_v1';

  function loadPrefs(){
    try { return JSON.parse(localStorage.getItem(PREFS) || '{}'); } catch(e){ return {}; }
  }
  function savePrefs(p){ localStorage.setItem(PREFS, JSON.stringify(p)); }

  function applyTheme(){
    const prefs = loadPrefs();
    const theme = prefs.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    themeSelect.value = theme;
    if (prefs.bodyWeight) bodyWeight.value = prefs.bodyWeight;
  }

  function loadAll(){
    const v = localStorage.getItem(KEY);
    if (v) { try { return JSON.parse(v)||{}; } catch(e){ return {}; } }
    // migrate older keys
    const v2 = localStorage.getItem('workout_log_v2');
    if (v2) { try { const d = JSON.parse(v2)||{}; saveAll(d); return d; } catch(e){} }
    const v1 = localStorage.getItem('workout_log_v1');
    if (v1) { try { const d = JSON.parse(v1)||{}; saveAll(d); return d; } catch(e){} }
    return {};
  }
  function saveAll(data){ localStorage.setItem(KEY, JSON.stringify(data)); }
  function getDayData(dateISO){
    const data = loadAll();
    let day = data[dateISO];
    if (!day) day = { dayType: null, entries: [] };
    if (Array.isArray(day)) day = { dayType: null, entries: day };
    let mutated = false;
    day.entries = (day.entries||[]).map(e => {
      if (!e.id) { e.id = uuid(); mutated = true; }
      if (!Array.isArray(e.sets)) {
        const count = Math.max(1, Number(e.sets || 1));
        const reps = Math.max(1, Number(e.reps || 1));
        const weight = (e.weight === '' || e.weight == null) ? '' : Number(e.weight);
        e.sets = Array.from({length: count}, () => ({ reps, weight }));
        mutated = true;
      }
      if (!e.intensity) e.intensity = 6;
      if (!e.setTime) e.setTime = 45;
      if (!e.restTime) e.restTime = 90;
      return e;
    });
    if (mutated){ const all = loadAll(); all[dateISO] = day; saveAll(all); }
    return day;
  }
  function setDayData(dateISO, day){ const all = loadAll(); all[dateISO] = day; saveAll(all); }
  function getEntries(dateISO){ return getDayData(dateISO).entries; }
  function setEntries(dateISO, arr){ const d = getDayData(dateISO); d.entries = arr; setDayData(dateISO, d); }
  function getDayType(dateISO){ return getDayData(dateISO).dayType; }
  function setDayType(dateISO, type){ const d = getDayData(dateISO); d.dayType = type||null; setDayData(dateISO, d); }
  function hasEntries(dateISO){ const d = getDayData(dateISO); return Array.isArray(d.entries)&&d.entries.length>0; }

  function epley1RM(weight, reps){
    if (weight === '' || weight == null || reps == null) return null;
    return Number(weight) * (1 + Number(reps)/30);
  }
  function best1RMForExercise(name){
    const data = loadAll();
    let best = 0;
    Object.values(data).forEach(day => {
      const arr = (day && day.entries) ? day.entries : Array.isArray(day) ? day : [];
      arr.forEach(e => {
        if ((e.exercise||'').toLowerCase() === (name||'').toLowerCase()){
          (e.sets||[]).forEach(s => {
            const est = epley1RM(s.weight, s.reps);
            if (est && est > best) best = est;
          });
        }
      });
    });
    return best;
  }
  function estimateEntryCalories(entry){
    const prefs = loadPrefs();
    const weightKg = Number(prefs.bodyWeight || 80);
    const minutes = ((Number(entry.setTime)||45) + (Number(entry.restTime)||90)) * (entry.sets?.length||1) / 60;
    const MET = Number(entry.intensity || 6);
    const kcal = MET * 3.5 * weightKg / 200 * minutes;
    return Math.round(kcal);
  }
  function estimateDayCalories(dateISO){
    return getEntries(dateISO).reduce((s,e)=> s + estimateEntryCalories(e), 0);
  }

  function renderCalendar(){
    monthLabel.textContent = fmtMonthYear(view);
    grid.innerHTML = '';
    const days = getMonthMatrix(view.getFullYear(), view.getMonth());
    const thisMonth = view.getMonth();
    const todayISO = toISO(new Date());

    days.forEach(d => {
      const iso = toISO(d);
      const cell = document.createElement('div');
      cell.className = 'day' + (d.getMonth() !== thisMonth ? ' out' : '') + (iso === todayISO ? ' today' : '');
      cell.setAttribute('role','gridcell');
      cell.setAttribute('tabindex','0');
      cell.setAttribute('aria-label', `Day ${d.getDate()} ${fmtMonthYear(d)}`);

      const btn = document.createElement('button');
      btn.addEventListener('click', () => selectDate(iso));
      btn.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); selectDate(iso);} });

      const num = document.createElement('div');
      num.className = 'num';
      num.textContent = d.getDate();
      btn.appendChild(num);

      if(hasEntries(iso)){
        const badge = document.createElement('div');
        const count = getEntries(iso).length;
        badge.className = 'badge';
        badge.textContent = count;
        btn.appendChild(badge);
      }

      const dt = getDayType(iso);
      if (dt) {
        const tag = document.createElement('div');
        tag.className = 'daytag';
        tag.textContent = dt;
        btn.appendChild(tag);
      }

      cell.appendChild(btn);
      grid.appendChild(cell);
    });
  }

  function selectDate(iso){
    selectedISO = iso;
    selectedDateLabel.textContent = new Date(iso).toLocaleDateString(undefined, { weekday:'short', year:'numeric', month:'short', day:'numeric' });
    const dt = getDayType(iso);
    dayTypeChip.textContent = dt ? `• ${dt}` : '';
    dayTypeSelect.value = dt || '';
    renderEntries();
    entryForm.hidden = true;
    addEntryBtn.focus();
    dayCaloriesEl.textContent = `${estimateDayCalories(selectedISO)} kcal`;
    const d = fromISO(iso);
    if(d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()){
      view = new Date(d.getFullYear(), d.getMonth(), 1);
      renderCalendar();
    }
  }

  function buildSetRows(n, existing){
    setRows.innerHTML = '';
    const count = Math.max(1, Number(n||1));
    for (let i=0;i<count;i++){
      const row = document.createElement('div');
      row.className = 'set-row';
      row.innerHTML = `
        <div class="idx">Set ${i+1}</div>
        <input type="number" class="reps" min="1" step="1" placeholder="Reps" value="${existing?.[i]?.reps ?? ''}"/>
        <input type="number" class="weight" min="0" step="0.5" placeholder="Weight (kg)" value="${existing?.[i]?.weight ?? ''}"/>
      `;
      setRows.appendChild(row);
    }
  }
  setCount.addEventListener('input', () => buildSetRows(setCount.value));

  function summarizeSets(sets){
    if (!Array.isArray(sets) || sets.length === 0) return '';
    const reps = sets.map(s => s.reps ?? '?').join('/');
    const wts = sets.map(s => (s.weight===''||s.weight==null)?'–':s.weight).join('/');
    return `${reps} reps @ ${wts} kg`;
  }

  function renderEntries(){
    const entries = getEntries(selectedISO).map((e, i) => ({...e, __index: i}));
    entriesList.innerHTML = '';
    if(entries.length === 0){
      const li = document.createElement('li');
      li.className = 'entry-item';
      li.innerHTML = '<span class="entry-meta">No entries yet for this day. Log your first set! 💪</span>';
      entriesList.appendChild(li);
      updateHistory();
      renderCalendar();
      return;
    }
    entries.forEach(e => {
      const li = document.createElement('li');
      li.className = 'entry-item';
      li.dataset.index = e.__index;

      const top = document.createElement('div');
      top.className = 'entry-top';

      const title = document.createElement('div');
      title.className = 'entry-title';

      const best = best1RMForExercise(e.exercise);
      let isPR = false;
      (e.sets||[]).forEach(s => {
        const est = epley1RM(s.weight, s.reps);
        if (est && est > best) isPR = true;
      });

      const setSummary = summarizeSets(e.sets);
      title.textContent = `${e.exercise} · ${e.sets?.length || 0} sets${setSummary ? ' · ' + setSummary : ''}`;
      if (isPR){
        const pr = document.createElement('span');
        pr.className = 'pr-badge';
        pr.textContent = 'PR';
        title.prepend(pr);
      }

      const meta = document.createElement('div');
      meta.className = 'entry-meta';
      const time = new Date(e.timestamp || selectedISO);
      const kcal = estimateEntryCalories(e);
      meta.textContent = time.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) + ` • ~${kcal} kcal`;

      top.appendChild(title);
      top.appendChild(meta);

      const note = document.createElement('div');
      if(e.notes){ note.className = 'entry-meta'; note.textContent = e.notes; }

      const actions = document.createElement('div');
      actions.className = 'entry-actions';

      const editBtn = document.createElement('button'); editBtn.textContent = 'Edit'; editBtn.type = 'button';
      const delBtn = document.createElement('button'); delBtn.textContent = 'Delete'; delBtn.className='danger'; delBtn.type = 'button';

      editBtn.addEventListener('click', ()=>{
        entryForm.hidden = false;
        entryIdInput.value = e.id;
        exercise.value = e.exercise;
        setCount.value = e.sets?.length || 3;
        buildSetRows(setCount.value, e.sets);
        notes.value = e.notes ?? '';
        intensity.value = e.intensity || 6;
        setTime.value = e.setTime || 45;
        restTime.value = e.restTime || 90;
        exercise.focus();
      });

      delBtn.addEventListener('click', ()=>{
        if(confirm('Delete this entry?')){
          const arr = getEntries(selectedISO);
          const idx = e.__index;
          if (idx >= 0 && idx < arr.length){
            arr.splice(idx, 1);
            setEntries(selectedISO, arr);
            renderEntries();
            renderCalendar();
            dayCaloriesEl.textContent = `${estimateDayCalories(selectedISO)} kcal`;
          }
        }
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      li.appendChild(top);
      if(e.notes) li.appendChild(note);
      li.appendChild(actions);
      entriesList.appendChild(li);
    });
    updateHistory();
    renderCalendar();
    dayCaloriesEl.textContent = `${estimateDayCalories(selectedISO)} kcal`;
  }

  addEntryBtn.addEventListener('click', ()=>{
    entryForm.hidden = false;
    entryIdInput.value = '';
    exercise.value = '';
    setCount.value = 3;
    buildSetRows(3);
    notes.value = '';
    intensity.value = 6;
    setTime.value = 45;
    restTime.value = 90;
    exercise.focus();
  });
  $('#cancelEntryBtn').addEventListener('click', ()=>{
    entryForm.hidden = true;
  });

  entryForm.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    const ex = exercise.value.trim();
    const nSets = Math.max(1, Number(setCount.value || 1));
    if(!ex){ alert('Please enter an exercise name.'); return; }

    const setsData = [];
    const rows = Array.from(setRows.querySelectorAll('.set-row'));
    for (let i=0;i<Math.min(nSets, rows.length); i++){
      const r = rows[i].querySelector('.reps').value;
      const w = rows[i].querySelector('.weight').value;
      const repsVal = Number(r);
      if (isNaN(repsVal) || repsVal < 1) { alert('Please enter reps ≥ 1 for each set.'); return; }
      const weightVal = (w === '' || w == null) ? '' : Number(w);
      if (weightVal !== '' && isNaN(weightVal)) { alert('Weight must be a number.'); return; }
      setsData.push({ reps: repsVal, weight: weightVal });
    }

    const all = getEntries(selectedISO);
    const id = entryIdInput.value || uuid();
    const now = new Date();
    const record = {
      id, exercise: ex, sets: setsData, notes: notes.value.trim(),
      intensity: Number(intensity.value), setTime: Number(setTime.value), restTime: Number(restTime.value),
      timestamp: now.toISOString()
    };

    const idx = all.findIndex(x => x.id === id);
    if(idx >= 0){ all[idx] = record; } else { all.push(record); }
    setEntries(selectedISO, all);
    entryForm.hidden = true;
    renderEntries();
    renderCalendar();
    dayCaloriesEl.textContent = `${estimateDayCalories(selectedISO)} kcal`;
  });

  dayTypeSelect.addEventListener('change', () => {
    const v = dayTypeSelect.value || null;
    setDayType(selectedISO, v);
    dayTypeChip.textContent = v ? `• ${v}` : '';
    renderCalendar();
  });

  prevMonthBtn.addEventListener('click', ()=>{ view.setMonth(view.getMonth()-1); renderCalendar(); });
  nextMonthBtn.addEventListener('click', ()=>{ view.setMonth(view.getMonth()+1); renderCalendar(); });

  exportBtn.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(loadAll(), null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workout-data-v3.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importInput.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    try{
      const text = await file.text();
      const data = JSON.parse(text);
      if(typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid format');
      const current = loadAll();
      const merged = { ...current, ...data };
      saveAll(merged);
      alert('Import successful.');
      renderCalendar();
      selectDate(selectedISO);
    }catch(err){
      alert('Import failed: ' + err.message);
    }finally{
      importInput.value = '';
    }
  });

  clearAllBtn.addEventListener('click', ()=>{
    if(confirm('This will delete ALL workout data for this PWA version. Proceed?')){
      localStorage.removeItem(KEY);
      renderCalendar();
      renderEntries();
      dayTypeChip.textContent='';
      dayTypeSelect.value='';
      dayCaloriesEl.textContent = '0 kcal';
    }
  });

  function updateHistory(){
    const q = historyQuery.value.trim().toLowerCase();
    const data = loadAll();
    const items = [];
    Object.entries(data).forEach(([dateISO, day])=>{
      const arr = Array.isArray(day) ? day : (day.entries || []);
      arr.forEach(e=> items.push({dateISO, ...e}));
    });
    items.sort((a,b)=> new Date(b.timestamp||b.dateISO) - new Date(a.timestamp||a.dateISO));
    const filtered = q ? items.filter(i => (i.exercise||'').toLowerCase().includes(q)) : items;
    historyList.innerHTML = '';
    filtered.slice(0, 100).forEach(i=>{
      const li = document.createElement('li');
      li.className = 'hist-item';
      const dateStr = new Date(i.dateISO).toLocaleDateString(undefined, {weekday:'short', month:'short', day:'numeric', year:'numeric'});
      const setStr = i.sets ? '('+ (i.sets.map(s=>s.reps).join('/')) +' reps)' : '';
      const kcal = estimateEntryCalories(i);
      li.innerHTML = `<div><strong>${i.exercise}</strong> — ${i.sets?.length || 0} sets ${setStr} • ~${kcal} kcal</div><div class="small">${dateStr}${i.notes ? ' • '+i.notes : ''}</div>`;
      historyList.appendChild(li);
    });
  }
  historyRefreshBtn.addEventListener('click', updateHistory);
  historyQuery.addEventListener('input', updateHistory);

  // Settings & Theme
  settingsBtn.addEventListener('click', ()=> settingsDialog.showModal());
  saveSettings.addEventListener('click', (e)=>{
    e.preventDefault();
    const prefs = loadPrefs();
    prefs.bodyWeight = Number(bodyWeight.value || 80);
    savePrefs(prefs);
    settingsDialog.close();
    renderEntries();
    dayCaloriesEl.textContent = `${estimateDayCalories(selectedISO)} kcal`;
  });
  closeSettings.addEventListener('click', (e)=>{
    e.preventDefault();
    settingsDialog.close();
  });
  themeSelect.addEventListener('change', ()=>{
    const prefs = loadPrefs();
    prefs.theme = themeSelect.value;
    savePrefs(prefs);
    applyTheme();
  });

  function init(){
    applyTheme();
    monthLabel.textContent = fmtMonthYear(view);
    renderCalendar();
    selectDate(selectedISO);
    updateHistory();
  }
  init();
})();