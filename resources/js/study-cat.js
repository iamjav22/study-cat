/* =========================================================
   STUDY CAT — app logic (pixel edition)
   ========================================================= */

const SETTINGS = {
  NUDGE_MIN_MS: 12000,
  NUDGE_MAX_MS: 20000,
  BREAK_AFTER_MS: 40000,
  BREAK_LENGTH_SECONDS: 300,
};
/* For real deployment, try:
   NUDGE_MIN_MS: 10*60*1000, NUDGE_MAX_MS: 18*60*1000,
   BREAK_AFTER_MS: 25*60*1000, BREAK_LENGTH_SECONDS: 300
*/

const STORAGE_KEY = 'studyCatState';

let tasks = [];
let parkingItems = [];
let currentTaskIndex = 0;
let sessionSeconds = 0;
let completedSubjects = [];
let spotifyOn = false;
let activeScreen = 'screen-planner';

let sessionTimerHandle = null;
let nudgeTimeoutHandle = null;
let breakTimeoutHandle = null;
let breakInterval = null;

/* ---------------- persistence ---------------- */
function saveState(){
  const state = { tasks, parkingItems, currentTaskIndex, sessionSeconds, completedSubjects, spotifyOn, activeScreen };
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch(e){ console.warn('Could not save state', e); }
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const state = JSON.parse(raw);
    tasks = state.tasks || [];
    parkingItems = state.parkingItems || [];
    currentTaskIndex = state.currentTaskIndex || 0;
    sessionSeconds = state.sessionSeconds || 0;
    completedSubjects = state.completedSubjects || [];
    spotifyOn = state.spotifyOn || false;
    activeScreen = state.activeScreen || 'screen-planner';
  }catch(e){ console.warn('Could not load saved state', e); }
}

/* ---------------- screens ---------------- */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  activeScreen = id;
  saveState();
}

/* ---------------- planner ---------------- */
function addTask(){
  const input = document.getElementById('task-input');
  const minutesInput = document.getElementById('task-minutes-input');
  const val = input.value.trim();
  if(!val) return;
  const minutes = parseInt(minutesInput.value, 10);
  tasks.push({ name: val, minutes: (minutes > 0 ? minutes : null) });
  input.value = '';
  minutesInput.value = '';
  renderTasks();
  saveState();
}
function removeTask(i){ tasks.splice(i,1); renderTasks(); saveState(); }
function renderTasks(){
  const list = document.getElementById('task-list');
  list.innerHTML = '';
  tasks.forEach((t,i)=>{
    const div = document.createElement('div');
    div.className = 'task-chip';
    const span = document.createElement('span');
    span.textContent = t.minutes ? `${t.name}  ·  ${t.minutes} min` : t.name;
    const btn = document.createElement('button');
    btn.textContent = 'X';
    btn.addEventListener('click', ()=>removeTask(i));
    div.appendChild(span); div.appendChild(btn);
    list.appendChild(div);
  });
  document.getElementById('start-btn').disabled = tasks.length === 0;
}

/* ---------------- session ---------------- */
function startSession(){
  currentTaskIndex = 0;
  completedSubjects = [];
  sessionSeconds = 0;
  setSubject();
  showScreen('screen-session');
  drawCatSprite(document.getElementById('cat-canvas'), 'nap', 18);
  runTimer();
  scheduleNudge();
  scheduleBreak();
}
function resumeSessionIfNeeded(){
  if((activeScreen === 'screen-session' || activeScreen === 'screen-break') && tasks.length){
    setSubject();
    showScreen('screen-session');
    drawCatSprite(document.getElementById('cat-canvas'), 'nap', 18);
    runTimer();
    scheduleNudge();
    scheduleBreak();
  } else {
    showScreen('screen-planner');
  }
}
function setSubject(){
  const task = tasks[currentTaskIndex];
  document.getElementById('current-subject').textContent = task.name.toUpperCase();
  const targetEl = document.getElementById('session-target');
  targetEl.textContent = task.minutes ? `TARGET: ${task.minutes} MIN` : '';
}
function runTimer(){
  clearInterval(sessionTimerHandle);
  sessionTimerHandle = setInterval(()=>{
    sessionSeconds++;
    updateTimerDisplay();
    if(sessionSeconds % 10 === 0) saveState();
  }, 1000);
  updateTimerDisplay();
}
function updateTimerDisplay(){
  const task = tasks[currentTaskIndex];
  const timerEl = document.getElementById('session-timer');
  if(task && task.minutes){
    const targetSeconds = task.minutes * 60;
    const remaining = targetSeconds - sessionSeconds;
    if(remaining >= 0){
      const m = String(Math.floor(remaining/60)).padStart(2,'0');
      const s = String(remaining%60).padStart(2,'0');
      timerEl.textContent = `${m}:${s}`;
      timerEl.classList.remove('overtime');
    } else {
      const over = Math.abs(remaining);
      const m = String(Math.floor(over/60)).padStart(2,'0');
      const s = String(over%60).padStart(2,'0');
      timerEl.textContent = `+${m}:${s}`;
      timerEl.classList.add('overtime');
    }
  } else {
    const m = String(Math.floor(sessionSeconds/60)).padStart(2,'0');
    const s = String(sessionSeconds%60).padStart(2,'0');
    timerEl.textContent = `${m}:${s}`;
    timerEl.classList.remove('overtime');
  }
}
function nextSubject(){
  completedSubjects.push(tasks[currentTaskIndex].name);
  currentTaskIndex = (currentTaskIndex+1) % tasks.length;
  sessionSeconds = 0;
  setSubject();
  setCatState('nap');
  saveState();
}
function endSession(){
  if(!completedSubjects.includes(tasks[currentTaskIndex].name)) completedSubjects.push(tasks[currentTaskIndex].name);
  clearInterval(sessionTimerHandle);
  clearTimeout(nudgeTimeoutHandle);
  clearTimeout(breakTimeoutHandle);
  renderSummary();
  showScreen('screen-end');
  drawCatSprite(document.getElementById('cat-canvas-end'), 'nap', 16);
}
function restart(){
  tasks = []; parkingItems = []; completedSubjects = [];
  currentTaskIndex = 0; sessionSeconds = 0;
  document.getElementById('task-list').innerHTML = '';
  document.getElementById('parking-list').innerHTML = '';
  document.getElementById('start-btn').disabled = true;
  showScreen('screen-planner');
  saveState();
}

/* ---------------- cat expressions ---------------- */
function setCatState(state){
  const caption = document.getElementById('cat-caption');
  const canvas = document.getElementById('cat-canvas');
  if(state === 'nap'){
    caption.textContent = 'zzz... working alongside you';
    drawCatSprite(canvas, 'nap', 18);
  } else if(state === 'alert'){
    caption.textContent = 'ears up — checking in';
    drawCatSprite(canvas, 'alert', 18);
  }
}

/* ---------------- nudges ---------------- */
function scheduleNudge(){
  clearTimeout(nudgeTimeoutHandle);
  const range = SETTINGS.NUDGE_MAX_MS - SETTINGS.NUDGE_MIN_MS;
  const delay = SETTINGS.NUDGE_MIN_MS + Math.random()*range;
  nudgeTimeoutHandle = setTimeout(()=>{
    document.getElementById('nudge-subject').textContent = tasks[currentTaskIndex].name.toUpperCase();
    setCatState('alert');
    drawCatSprite(document.getElementById('cat-canvas-nudge'), 'alert', 8);
    document.getElementById('nudge-overlay').classList.add('active');
  }, delay);
}
function closeNudge(stillOn){
  document.getElementById('nudge-overlay').classList.remove('active');
  setCatState('nap');
  if(!stillOn){ nextSubject(); }
  scheduleNudge();
}

/* ---------------- breaks ---------------- */
function scheduleBreak(){
  clearTimeout(breakTimeoutHandle);
  breakTimeoutHandle = setTimeout(()=>{
    clearInterval(sessionTimerHandle);
    clearTimeout(nudgeTimeoutHandle);
    showScreen('screen-break');
    drawCatSprite(document.getElementById('cat-canvas-break'), 'stretch', 16);
    startBreakCountdown();
  }, SETTINGS.BREAK_AFTER_MS);
}
function startBreakCountdown(){
  let secs = SETTINGS.BREAK_LENGTH_SECONDS;
  updateBreakDisplay(secs);
  clearInterval(breakInterval);
  breakInterval = setInterval(()=>{
    secs--;
    updateBreakDisplay(secs);
    if(secs<=0){ clearInterval(breakInterval); skipBreak(); }
  }, 1000);
}
function updateBreakDisplay(secs){
  const m = String(Math.floor(secs/60)).padStart(2,'0');
  const s = String(secs%60).padStart(2,'0');
  document.getElementById('break-timer').textContent = `${m}:${s}`;
}
function skipBreak(){
  clearInterval(breakInterval);
  showScreen('screen-session');
  drawCatSprite(document.getElementById('cat-canvas'), 'nap', 18);
  runTimer();
  scheduleNudge();
  scheduleBreak();
}

/* ---------------- parking lot ---------------- */
function openParkingLot(){ document.getElementById('parkinglot-overlay').classList.add('active'); }
function closeParkingLot(){ document.getElementById('parkinglot-overlay').classList.remove('active'); }
function addParkingItem(){
  const input = document.getElementById('park-input');
  const val = input.value.trim();
  if(!val) return;
  parkingItems.push(val);
  input.value = '';
  renderParkingList();
  saveState();
}
function renderParkingList(){
  const list = document.getElementById('parking-list');
  list.innerHTML = '';
  parkingItems.forEach((p)=>{
    const div = document.createElement('div');
    div.className = 'task-chip';
    const span = document.createElement('span');
    span.textContent = p;
    div.appendChild(span);
    list.appendChild(div);
  });
}

/* ---------------- spotify mock ---------------- */
function toggleSpotify(){
  spotifyOn = !spotifyOn;
  const strip = document.getElementById('spotify-strip');
  const label = document.getElementById('spotify-label');
  const btn = document.getElementById('spotify-btn');
  if(spotifyOn){
    strip.classList.remove('off');
    label.textContent = 'PLAYLIST: LO-FI MIX';
    btn.textContent = 'STOP';
  } else {
    strip.classList.add('off');
    label.textContent = 'SPOTIFY: OFFLINE';
    btn.textContent = 'CONNECT';
  }
  saveState();
}

/* ---------------- summary ---------------- */
function renderSummary(){
  const subjEl = document.getElementById('summary-subjects');
  subjEl.innerHTML = [...new Set(completedSubjects)].map(s=>`<div class="summary-line">* ${s.toUpperCase()}</div>`).join('') || '<div class="summary-line">-</div>';
  const parkBlock = document.getElementById('summary-parking-block');
  const parkEl = document.getElementById('summary-parking');
  if(parkingItems.length === 0){
    parkBlock.style.display = 'none';
  } else {
    parkBlock.style.display = 'block';
    parkEl.innerHTML = parkingItems.map(p=>`<div class="summary-line">- ${p}</div>`).join('');
  }
}

/* ---------------- boot ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderTasks();
  renderParkingList();

  document.getElementById('add-task-btn').addEventListener('click', addTask);
  document.getElementById('task-input').addEventListener('keydown', e=>{ if(e.key === 'Enter') addTask(); });
  document.getElementById('task-minutes-input').addEventListener('keydown', e=>{ if(e.key === 'Enter') addTask(); });
  document.getElementById('start-btn').addEventListener('click', startSession);

  document.getElementById('open-parking-btn').addEventListener('click', openParkingLot);
  document.getElementById('close-parking-btn').addEventListener('click', closeParkingLot);
  document.getElementById('add-parking-btn').addEventListener('click', addParkingItem);
  document.getElementById('park-input').addEventListener('keydown', e=>{ if(e.key === 'Enter') addParkingItem(); });

  document.getElementById('next-subject-btn').addEventListener('click', nextSubject);
  document.getElementById('end-session-btn').addEventListener('click', endSession);

  document.getElementById('nudge-yes-btn').addEventListener('click', ()=>closeNudge(true));
  document.getElementById('nudge-no-btn').addEventListener('click', ()=>closeNudge(false));

  document.getElementById('spotify-btn').addEventListener('click', toggleSpotify);
  document.getElementById('back-to-work-btn').addEventListener('click', skipBreak);
  document.getElementById('plan-tomorrow-btn').addEventListener('click', restart);

  if(spotifyOn){
    document.getElementById('spotify-strip').classList.remove('off');
    document.getElementById('spotify-label').textContent = 'PLAYLIST: LO-FI MIX';
    document.getElementById('spotify-btn').textContent = 'STOP';
  }

  resumeSessionIfNeeded();
});

window.addEventListener('beforeunload', saveState);
