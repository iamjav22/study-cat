/* =========================================================
   STUDY CAT — app logic (pixel edition)
   ========================================================= */
import { drawCatSprite, playCatAnimation, WORKING_CAT_FRAMES, STARTING_CAT_FRAMES, ENDING_CAT_FRAMES, NUDGE_CAT_FRAMES, SESSION_ALERT_FRAMES, BREAK_CAT_FRAMES } from './pixelcat.js';
const SETTINGS = {
  NUDGE_MIN_MS: 8*60*1000,
  NUDGE_MAX_MS: 12*60*1000,
  WORK_LENGTH_MS: 25*60*1000,
  SHORT_BREAK_SECONDS: 5*60,
  LONG_BREAK_SECONDS: 20*60,
  POMODOROS_BEFORE_LONG_BREAK: 4,
};


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
let breakInterval = null; let pomodoroCount = 0;


/* ---------------- persistence ---------------- */
  function saveState(){
  const state = { tasks, parkingItems, currentTaskIndex, sessionSeconds, completedSubjects, spotifyOn, activeScreen, pomodoroCount };
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
    pomodoroCount = state.pomodoroCount || 0;
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
/* ---------------- planner ---------------- */
function addTask(){
  const input = document.getElementById('task-input');
  const val = input.value.trim();
  if(!val) return;
  tasks.push({ name: val, minutes: null, timeChosen: false, pickerOpen: false });
  input.value = '';
  renderTasks();
  saveState();
}
function removeTask(i){ tasks.splice(i,1); renderTasks(); saveState(); }

function renderTasks(){
  const list = document.getElementById('task-list');
  const hint = document.getElementById('time-hint');
  list.innerHTML = '';
  hint.style.display = tasks.length ? 'block' : 'none';

  tasks.forEach((t,i)=>{
    const wrap = document.createElement('div');
    wrap.className = 'task-chip-wrap';

    const chip = document.createElement('div');
    chip.className = 'task-chip';

    const name = document.createElement('span');
    name.className = 'task-chip-name';
    name.textContent = t.name.toUpperCase();
    chip.appendChild(name);

    if(t.timeChosen){
      const badge = document.createElement('span');
      badge.className = 'task-chip-badge';
      badge.textContent = '\u25CF ' + (t.minutes ? `${t.minutes} MIN` : 'NO LIMIT');
      chip.appendChild(badge);
    }

    const clockBtn = document.createElement('button');
    clockBtn.className = 'clock-btn';
    clockBtn.innerHTML = '&#9201;';
    clockBtn.addEventListener('click', ()=> toggleTimePicker(i));
    chip.appendChild(clockBtn);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'chip-remove-btn';
    removeBtn.textContent = 'X';
    removeBtn.addEventListener('click', ()=> removeTask(i));
    chip.appendChild(removeBtn);

    wrap.appendChild(chip);

    if(t.pickerOpen){
      wrap.appendChild(buildTimePicker(i));
    }

    list.appendChild(wrap);
  });

  document.getElementById('start-btn').disabled = tasks.length === 0;
}

function buildTimePicker(i){
  const picker = document.createElement('div');
  picker.className = 'time-picker';
  const presets = [
    ['15 MIN', 15], ['25 MIN', 25], ['45 MIN', 45], ['NO LIMIT', null]
  ];
  presets.forEach(([label, val])=>{
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = 'time-preset-btn';
    btn.addEventListener('click', ()=> selectTime(i, val));
    picker.appendChild(btn);
  });
  const customBtn = document.createElement('button');
  customBtn.textContent = 'CUSTOM';
  customBtn.className = 'time-preset-btn';
  customBtn.addEventListener('click', ()=> openCustomInput(i));
  picker.appendChild(customBtn);
  return picker;
}

function toggleTimePicker(i){
  const wasOpen = tasks[i].pickerOpen;
  tasks.forEach(t => t.pickerOpen = false); // only one open at a time
  tasks[i].pickerOpen = !wasOpen;
  renderTasks();
}

function selectTime(i, minutesValue){
  tasks[i].minutes = minutesValue;
  tasks[i].timeChosen = true;
  renderTasks();
  saveState();
  // auto-close this picker 4s after a choice is made, so the confirmation is visible first
  setTimeout(()=>{
    if(tasks[i]) { tasks[i].pickerOpen = false; renderTasks(); }
  }, 4000);
}

function openCustomInput(i){
  const val = prompt('Custom time in minutes:');
  const num = parseInt(val, 10);
  if(num > 0){
    selectTime(i, num);
  }
}
/* ---------------- session ---------------- */
function startSession(){
  currentTaskIndex = 0;
  completedSubjects = [];
  sessionSeconds = 0;
  setSubject();
    showScreen('screen-session');
  playCatAnimation(document.getElementById('cat-canvas'), WORKING_CAT_FRAMES, 18, 2);
  runTimer();
  scheduleNudge();
  scheduleBreak();
}
function resumeSessionIfNeeded(){
  if((activeScreen === 'screen-session' || activeScreen === 'screen-break') && tasks.length){
    setSubject();
        showScreen('screen-session');
    playCatAnimation(document.getElementById('cat-canvas'), WORKING_CAT_FRAMES, 18, 2);
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
  playCatAnimation(document.getElementById('cat-canvas-end'), ENDING_CAT_FRAMES, 16, 2);
}
function restart(){
  tasks = []; parkingItems = []; completedSubjects = [];
  currentTaskIndex = 0; sessionSeconds = 0;
  document.getElementById('task-list').innerHTML = '';
  document.getElementById('parking-list').innerHTML = '';
  document.getElementById('start-btn').disabled = true;
    showScreen('screen-planner');
  playCatAnimation(document.getElementById('cat-canvas-start'), STARTING_CAT_FRAMES, 18, 2);
  saveState();
}

/* ---------------- cat expressions ---------------- */
function setCatState(state){
  const caption = document.getElementById('cat-caption');
  const canvas = document.getElementById('cat-canvas');
  if(state === 'nap'){
    caption.textContent = 'working alongside you';
    playCatAnimation(canvas, WORKING_CAT_FRAMES, 18, 2);
  } else if(state === 'alert'){
    caption.textContent = 'ears up — checking in';
    playCatAnimation(canvas, SESSION_ALERT_FRAMES, 18, 1);
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
    drawCatSprite(document.getElementById('cat-canvas-nudge'), NUDGE_CAT_FRAMES[0], 8);
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
    startBreak();
  }, SETTINGS.WORK_LENGTH_MS);
}
function startBreak(){
  pomodoroCount++;
  const isLongBreak = pomodoroCount >= SETTINGS.POMODOROS_BEFORE_LONG_BREAK;
  const breakSeconds = isLongBreak ? SETTINGS.LONG_BREAK_SECONDS : SETTINGS.SHORT_BREAK_SECONDS;
  if(isLongBreak) pomodoroCount = 0;

  showScreen('screen-break');
  playCatAnimation(document.getElementById('cat-canvas-break'), BREAK_CAT_FRAMES, 16, 2);
  startBreakCountdown(breakSeconds);
  saveState();
}
function startBreakCountdown(seconds){
  let secs = seconds;
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
  playCatAnimation(document.getElementById('cat-canvas'), WORKING_CAT_FRAMES, 18, 2);
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
  if(activeScreen === 'screen-planner'){
    playCatAnimation(document.getElementById('cat-canvas-start'), STARTING_CAT_FRAMES, 18, 2);
  }
  resumeSessionIfNeeded();
});

window.addEventListener('beforeunload', saveState);
