/* =========================================================================
   সংকল্প OS v3 — Single-file offline-first productivity vault
   Developed by Md. Wadud Hossain, NDC 26, 12606098
   ========================================================================= */
const {
  useState,
  useEffect,
  useMemo,
  useRef,
  useReducer,
  useCallback,
  createContext,
  useContext
} = React;

/* ---------- Constants ---------- */
const STORAGE_KEY = 'focus-vault-v1';
const CREDIT = 'Developed by Md. Wadud Hossain, NDC 26, 12606098';
const BRAND = 'সংকল্প OS';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const DEFAULT_MOTIVATIONS = [{
  bn: 'ছোট ছোট পদক্ষেপ বড় স্বপ্ন গড়ে।',
  en: 'Small steps build big dreams.'
}, {
  bn: 'আজকের সংকল্পই কালকের সাফল্য।',
  en: "Today's resolve is tomorrow's success."
}, {
  bn: 'ধৈর্য হারিও না, সময় সব জবাব দেবে।',
  en: 'Stay patient—time answers everything.'
}, {
  bn: 'শৃঙ্খলা প্রতিভার চেয়ে শক্তিশালী।',
  en: 'Discipline outlasts talent.'
}, {
  bn: 'একটি অধ্যায় শেষ করো, একটি জয় বাড়ুক।',
  en: 'Finish one chapter, earn one win.'
}];
const REMINDER_LINES = ['ভুলে গেছ নাকি? এখনই কাজটা শেষ করো, না হলে কিন্তু রাগ করব! 🥺', 'পড়াশোনার সময় হয়ে গেছে! আজ একটু বেশি কষ্ট করো, আগামী কালকের সাফল্যটা তো তোমারই হবে! ✨', 'হেয়ি, এই কাজটা তো তোমারই করার কথা ছিল! অলসতা সরিয়ে একটু শুরু তো করে দাও! 💪🌸', 'আরেকটু পরেই বিরতি নিও, আগে এই টাস্কটা শেষ করে মিষ্টি একটা হাসি দাও! 😊', 'আমি জানি তোমার ক্লান্তি লাগছে, কিন্তু তুমি তো বিজয়ী হতে চাও, তাই না? উঠে পড়ো! 🚀', 'একটু একটু করেই তো বড় স্বপ্ন সত্যি হয়। আজকের এই ছোট কাজটা ফিনিশ করে ফেলো তো লক্ষ্মীটি! 🧸', 'সময়টা চলে যাচ্ছে কিন্তু! ঝটপট কাজটা শেষ করে ফেলো, আমি তোমার জন্য রুটিন ধরে বসে আছি! ⏳', 'স্বপ্নের পথে আর একটা ছোট পদক্ষেপ! টাস্কটা কমপ্লিট করে টিক মার্ক বসিয়ে দাও তো! 🎯'];
const SPLASH_LINES = ['তুমিই পারবে — শুরু করে দাও এখনই ✨', 'সংকল্প যেখানে, সাফল্য সেখানে 💫', 'আজকের পরিশ্রমই কালকের গর্ব 🌸'];
const DEFAULT_STATE = {
  profile: {
    name: '',
    xp: 0,
    level: 1,
    streak: 0,
    shield: false,
    lastActive: ''
  },
  mcqs: [],
  attempts: [],
  mistakeVault: [],
  flashcards: [],
  schedule: [],
  todos: [],
  notes: [],
  habits: [],
  timerSessions: [],
  subjects: [],
  // [{id,name,topics:[{id,name,subtopics:[{id,name}]}]}]
  information: [],
  // [{id,subjectId,topicId,subtopicId,title,body,difficulty,updated}]
  quotes: [],
  // user-added quotes [{bn,en}]
  alarms: [],
  // [{id,time,label,ringtone,active,days:[0..6]}]
  notifiedIds: [],
  // ids of schedule/todo that already fired today {id, date}
  records: {
    weekly: {},
    monthly: {},
    badges: []
  },
  // gamification
  ui: {
    theme: 'light',
    tourDone: false,
    motivationIdx: 0,
    lang: 'bn',
    notif: {
      popup: true,
      beep: true
    },
    reminderIdx: 0
  }
};

/* ---------- Storage ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    const merged = {
      ...structuredClone(DEFAULT_STATE),
      ...parsed
    };
    for (const k of Object.keys(DEFAULT_STATE)) {
      if (typeof DEFAULT_STATE[k] === 'object' && !Array.isArray(DEFAULT_STATE[k]) && DEFAULT_STATE[k] !== null) {
        merged[k] = {
          ...DEFAULT_STATE[k],
          ...(parsed[k] || {})
        };
        // deep-merge ui.notif
        if (k === 'ui') {
          merged.ui.notif = {
            ...DEFAULT_STATE.ui.notif,
            ...((parsed.ui || {}).notif || {})
          };
        }
      }
    }
    return merged;
  } catch (e) {
    return structuredClone(DEFAULT_STATE);
  }
}
let saveTimer = null;
function saveState(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (window.NativeBridge && window.NativeBridge.syncAlarms) window.NativeBridge.syncAlarms(state);
    } catch (e) {
      toast('Storage full — export a backup.', 'error');
    }
  }, 250);
}

/* ---------- Toast ---------- */
let toastRoot = null,
  toastId = 0;
function toast(msg, kind = 'info') {
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.className = 'fixed z-[200] top-4 right-4 flex flex-col gap-2';
    document.body.appendChild(toastRoot);
  }
  const id = ++toastId;
  const el = document.createElement('div');
  const color = kind === 'error' ? 'bg-rose-600' : kind === 'success' ? 'bg-emerald-600' : 'bg-slate-900';
  el.className = `text-white ${color} px-4 py-2 rounded-xl shadow-soft text-sm animate-fadeIn`;
  el.textContent = msg;
  el.dataset.id = id;
  toastRoot.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

/* ---------- XP & Streak ---------- */
function xpForLevel(lv) {
  return 100 + (lv - 1) * 80;
}
function addXP(profile, delta) {
  let {
    xp,
    level
  } = profile;
  xp += delta;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
    toast(`লেভেল আপ! Level ${level}`, 'success');
  }
  return {
    ...profile,
    xp,
    level
  };
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowHM() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5]; // Sat, Sun, Mon..Fri
function todayDow() {
  return new Date().getDay();
}
function scheduleMatchesToday(s) {
  if (s.day != null) return s.day === todayDow();
  return s.date === todayISO();
}
function weekKey(d = new Date()) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - day);
  return dt.toISOString().slice(0, 10);
}
function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}
function monthName(k) {
  const [y, m] = k.split('-');
  return new Date(+y, +m - 1, 1).toLocaleString('en', {
    month: 'long'
  });
}
function updateStreak(profile) {
  const today = todayISO();
  if (profile.lastActive === today) return profile;
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (profile.lastActive === yest) return {
    ...profile,
    streak: profile.streak + 1,
    lastActive: today
  };
  if (profile.lastActive === '') return {
    ...profile,
    streak: 1,
    lastActive: today
  };
  if (profile.shield) return {
    ...profile,
    streak: profile.streak + 1,
    shield: false,
    lastActive: today
  };
  return {
    ...profile,
    streak: 1,
    lastActive: today
  };
}

/* ---------- Reducer ---------- */
function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;
    case 'SET_PROFILE':
      return {
        ...state,
        profile: {
          ...state.profile,
          ...action.patch
        }
      };
    case 'SET_UI':
      return {
        ...state,
        ui: {
          ...state.ui,
          ...action.patch
        }
      };
    case 'SET_NOTIF':
      return {
        ...state,
        ui: {
          ...state.ui,
          notif: {
            ...state.ui.notif,
            ...action.patch
          }
        }
      };
    case 'ADD_XP':
      {
        let p = addXP(state.profile, action.amount);
        p = updateStreak(p);
        return {
          ...state,
          profile: p
        };
      }
    case 'SET_LIST':
      return {
        ...state,
        [action.key]: action.list
      };
    case 'ADD_ITEM':
      return {
        ...state,
        [action.key]: [action.item, ...state[action.key]]
      };
    case 'ADD_MANY':
      return {
        ...state,
        [action.key]: [...action.items, ...state[action.key]]
      };
    case 'UPDATE_ITEM':
      return {
        ...state,
        [action.key]: state[action.key].map(x => x.id === action.item.id ? {
          ...x,
          ...action.item
        } : x)
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        [action.key]: state[action.key].filter(x => x.id !== action.id)
      };
    case 'RESET':
      return structuredClone(DEFAULT_STATE);
    default:
      return state;
  }
}
const VaultCtx = createContext(null);
function useVault() {
  return useContext(VaultCtx);
}
function VaultProvider({
  children
}) {
  const [state, dispatch] = useReducer(reducer, null, loadState);
  useEffect(() => {
    saveState(state);
  }, [state]);
  useEffect(() => {
    if (state.ui.theme === 'dark') document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');
  }, [state.ui.theme]);
  return /*#__PURE__*/React.createElement(VaultCtx.Provider, {
    value: {
      state,
      dispatch
    }
  }, children);
}

/* ---------- Icons ---------- */
function Icon({
  name,
  size = 18,
  className = ''
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = '';
      const el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      ref.current.appendChild(el);
      window.lucide.createIcons({
        attrs: {
          width: size,
          height: size,
          'stroke-width': 2
        }
      });
    }
  }, [name, size]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    className: 'inline-flex ' + className,
    style: {
      width: size,
      height: size
    }
  });
}

/* ---------- App Logo (brand mark) ---------- */
function Logo({
  size = 32,
  ring = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "relative inline-flex items-center justify-center rounded-2xl brand-mark shadow-soft text-white font-display font-extrabold " + (ring ? 'ring-2 ring-white/40' : ''),
    style: {
      width: size,
      height: size
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "relative",
    style: {
      fontSize: size * 0.5,
      lineHeight: 1
    }
  }, "সং"));
}

/* ---------- UI Primitives ---------- */
function Card({
  children,
  className = ''
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: 'bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl ' + className
  }, children);
}
function Btn({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled
}) {
  const styles = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200',
    outline: 'border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    subtle: 'bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-200 hover:bg-brand-100'
  };
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    disabled: disabled,
    onClick: onClick,
    className: `inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition ${styles[variant]} disabled:opacity-40 ${className}`
  }, children);
}
function FormatBlock({
  text,
  label = 'Format'
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const done = () => {
      setCopied(true);
      toast('Format copied', 'success');
      setTimeout(() => setCopied(false), 1500);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => fallback());
      } else fallback();
    } catch (e) {
      fallback();
    }
    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        done();
      } catch (_) {
        toast('Copy failed', 'error');
      }
      document.body.removeChild(ta);
    }
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: copy,
    className: "absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 hover:bg-brand-50 dark:hover:bg-brand-900/40 text-slate-700 dark:text-slate-200 shadow-sm"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: copied ? 'check' : 'copy',
    size: 12
  }), copied ? 'Copied' : 'Copy'), /*#__PURE__*/React.createElement("pre", {
    className: "p-3 pr-16 rounded-xl bg-slate-50 dark:bg-slate-800 text-xs overflow-auto whitespace-pre-wrap"
  }, text));
}
function Input(props) {
  return /*#__PURE__*/React.createElement("input", {
    ...props,
    className: 'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 ' + (props.className || '')
  });
}
function TextArea(props) {
  return /*#__PURE__*/React.createElement("textarea", {
    ...props,
    className: 'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 ' + (props.className || '')
  });
}
function Select({
  children,
  ...props
}) {
  return /*#__PURE__*/React.createElement("select", {
    ...props,
    className: 'px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 ' + (props.className || '')
  }, children);
}
function Chip({
  children,
  tone = 'slate',
  className = ''
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200'
  };
  return /*#__PURE__*/React.createElement("span", {
    className: `text-[10px] px-1.5 py-0.5 rounded ${tones[tone]} ${className}`
  }, children);
}
function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  xl
}) {
  if (!open) return null;
  const w = xl ? 'max-w-5xl' : wide ? 'max-w-3xl' : 'max-w-md';
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur flex items-start sm:items-start justify-center p-3 sm:p-4 overflow-y-auto",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: 'bg-white dark:bg-slate-900 rounded-2xl shadow-soft w-full mt-3 sm:mt-8 mb-6 ' + w + ' animate-pop max-h-[calc(100vh-2rem)] overflow-auto scrollbar-thin',
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur z-10"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "font-semibold"
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    className: "p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "p-5"
  }, children)));
}

/* ---------- Audio Engine (procedural + alarm ringtones) ---------- */
const AudioEngine = (() => {
  let ctx = null,
    master = null,
    nodes = [];
  let alarmTimers = [];
  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.15;
      master.connect(ctx.destination);
    }
  }
  function stop() {
    nodes.forEach(n => {
      try {
        n.stop && n.stop();
        n.disconnect && n.disconnect();
      } catch (e) {}
    });
    nodes = [];
  }
  function whiteNoise() {
    ensure();
    stop();
    const bufferSize = 2 * ctx.sampleRate;
    const noise = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = noise.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) out[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.connect(master);
    src.start();
    nodes.push(src);
  }
  function brownNoise() {
    ensure();
    stop();
    const bufferSize = 2 * ctx.sampleRate;
    const noise = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const out = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      out[i] = (last + 0.02 * w) / 1.02;
      last = out[i];
      out[i] *= 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.connect(master);
    src.start();
    nodes.push(src);
  }
  function binaural(base = 200, beat = 8) {
    ensure();
    stop();
    const merger = ctx.createChannelMerger(2);
    const oscL = ctx.createOscillator();
    oscL.frequency.value = base;
    const oscR = ctx.createOscillator();
    oscR.frequency.value = base + beat;
    const gL = ctx.createGain();
    gL.gain.value = 0.5;
    const gR = ctx.createGain();
    gR.gain.value = 0.5;
    oscL.connect(gL).connect(merger, 0, 0);
    oscR.connect(gR).connect(merger, 0, 1);
    merger.connect(master);
    oscL.start();
    oscR.start();
    nodes.push(oscL, oscR, gL, gR, merger);
  }
  function volume(v) {
    ensure();
    master.gain.value = v;
  }
  // Short attention beep for reminders
  function beep(freq = 880, dur = 0.15) {
    ensure();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }
  function reminderChime() {
    beep(880, .15);
    setTimeout(() => beep(1175, .18), 160);
    setTimeout(() => beep(1480, .22), 340);
  }
  // Ringtones (patterns of tones)
  const RINGTONES = {
    'Classic Bell': () => {
      [880, 660, 880, 660].forEach((f, i) => setTimeout(() => beep(f, .3), i * 350));
    },
    'Digital Alarm': () => {
      for (let i = 0; i < 8; i++) setTimeout(() => beep(i % 2 ? 880 : 1200, .12), i * 160);
    },
    'Gentle Chime': () => {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, .4), i * 220));
    },
    'Rise & Shine': () => {
      [400, 500, 600, 700, 800, 900, 1000].forEach((f, i) => setTimeout(() => beep(f, .14), i * 130));
    },
    'Cosmic Ping': () => {
      [1568, 1319, 1046, 784].forEach((f, i) => setTimeout(() => beep(f, .35), i * 260));
    },
    'Soft Marimba': () => {
      [523, 659, 784, 659, 523, 784].forEach((f, i) => setTimeout(() => beep(f, .25), i * 180));
    }
  };
  function playRingtone(name, times = 3) {
    const fn = RINGTONES[name] || RINGTONES['Classic Bell'];
    for (let i = 0; i < times; i++) {
      const t = setTimeout(fn, i * 1800);
      alarmTimers.push(t);
    }
  }
  function stopAlarm() {
    alarmTimers.forEach(clearTimeout);
    alarmTimers = [];
  }
  return {
    whiteNoise,
    brownNoise,
    binaural,
    stop,
    volume,
    beep,
    reminderChime,
    playRingtone,
    stopAlarm,
    ringtones: () => Object.keys(RINGTONES)
  };
})();

/* ---------- Premium Splash ---------- */
function Splash({
  onDone
}) {
  const [line] = useState(() => SPLASH_LINES[Math.floor(Math.random() * SPLASH_LINES.length)]);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const dur = 2400;
    const t = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / dur);
      setProgress(p);
      if (p >= 1) {
        clearInterval(t);
        setTimeout(onDone, 250);
      }
    }, 30);
    return () => clearInterval(t);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "splash-bg fixed inset-0 flex items-center justify-center overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute w-[500px] h-[500px] rounded-full opacity-25 blur-3xl grad-premium animate-gradientMove"
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute w-[300px] h-[300px] rounded-full opacity-30 blur-2xl grad-premium animate-orbit",
    style: {
      animationDuration: '12s'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "relative text-center px-6 animate-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative mx-auto mb-6",
    style: {
      width: 120,
      height: 120
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 rounded-3xl grad-premium animate-gradientMove shadow-glow"
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-[6px] rounded-[20px] bg-white/10 backdrop-blur-md"
  }), /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 flex items-center justify-center text-white font-display font-extrabold text-5xl animate-floaty"
  }, "সং"), /*#__PURE__*/React.createElement("div", {
    className: "absolute -inset-2 rounded-3xl border border-white/30 animate-pulseRing"
  })), /*#__PURE__*/React.createElement("h1", {
    className: "font-display text-4xl md:text-5xl font-extrabold text-gradient tracking-tight"
  }, BRAND), /*#__PURE__*/React.createElement("p", {
    className: "mt-2 text-xs md:text-sm uppercase tracking-[0.35em] text-slate-500 dark:text-slate-400"
  }, "Resolve · Focus · Achieve"), /*#__PURE__*/React.createElement("p", {
    className: "mt-6 font-bn text-lg md:text-xl text-slate-700 dark:text-slate-200 animate-fadeIn max-w-md mx-auto"
  }, line), /*#__PURE__*/React.createElement("div", {
    className: "mt-8 mx-auto w-56 h-1.5 rounded-full bg-slate-200/60 dark:bg-slate-800 overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full grad-premium animate-gradientMove transition-all",
    style: {
      width: progress * 100 + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-2 text-[10px] text-slate-400 tracking-widest"
  }, "LOADING YOUR VAULT")));
}

/* ---------- Onboarding ---------- */
function Onboarding({
  onDone
}) {
  const {
    state,
    dispatch
  } = useVault();
  const [name, setName] = useState(state.profile.name || '');
  return /*#__PURE__*/React.createElement("div", {
    className: "splash-bg fixed inset-0 flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "max-w-md w-full p-6 animate-pop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement(Logo, {
    size: 44
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", {
    className: "font-bn text-xl font-bold"
  }, BRAND, " — স্বাগতম"), /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "Welcome, achiever."))), /*#__PURE__*/React.createElement("p", {
    className: "mt-4 text-sm text-slate-600 dark:text-slate-400"
  }, "তোমার নাম কী? / What should we call you?"), /*#__PURE__*/React.createElement(Input, {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: "তোমার নাম / Your name",
    className: "mt-2"
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-5 flex justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      dispatch({
        type: 'SET_PROFILE',
        patch: {
          name: name.trim() || 'Achiever'
        }
      });
      dispatch({
        type: 'SET_UI',
        patch: {
          tourDone: true
        }
      });
      onDone();
    }
  }, "শুরু করি ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right"
  })))));
}

/* ---------- Views registry ---------- */
const VIEWS = [{
  key: 'dashboard',
  label: 'Dashboard',
  bn: 'ড্যাশবোর্ড',
  icon: 'layout-dashboard'
}, {
  key: 'subjects',
  label: 'Subjects',
  bn: 'বিষয়',
  icon: 'library'
}, {
  key: 'mcq',
  label: 'MCQ Bank',
  bn: 'এমসিকিউ',
  icon: 'list-checks'
}, {
  key: 'exam',
  label: 'Exam Mode',
  bn: 'পরীক্ষা',
  icon: 'graduation-cap'
}, {
  key: 'mistakes',
  label: 'Mistake Vault',
  bn: 'ভুল ভান্ডার',
  icon: 'alert-triangle'
}, {
  key: 'cards',
  label: 'Flashcards',
  bn: 'ফ্ল্যাশকার্ড',
  icon: 'layers'
}, {
  key: 'schedule',
  label: 'Schedule',
  bn: 'সময়সূচি',
  icon: 'calendar-days'
}, {
  key: 'todos',
  label: 'To-dos',
  bn: 'কাজের তালিকা',
  icon: 'check-square'
}, {
  key: 'notes',
  label: 'Notes',
  bn: 'নোট',
  icon: 'notebook-pen'
}, {
  key: 'habits',
  label: 'Habits',
  bn: 'অভ্যাস',
  icon: 'repeat'
}, {
  key: 'alarm',
  label: 'Alarms',
  bn: 'অ্যালার্ম',
  icon: 'alarm-clock'
}, {
  key: 'timer',
  label: 'Focus Timer',
  bn: 'ফোকাস টাইমার',
  icon: 'timer'
}, {
  key: 'quotes',
  label: 'Motivation',
  bn: 'অনুপ্রেরণা',
  icon: 'quote'
}, {
  key: 'analytics',
  label: 'Analytics',
  bn: 'বিশ্লেষণ',
  icon: 'bar-chart-3'
}, {
  key: 'settings',
  label: 'Settings',
  bn: 'সেটিংস',
  icon: 'settings'
}];

/* ---------- Helpers: subjects/topics/subtopics ---------- */
function findSubject(state, id) {
  return state.subjects.find(s => s.id === id);
}
function findTopic(subj, id) {
  return subj?.topics.find(t => t.id === id);
}
function findSubtopic(topic, id) {
  return topic?.subtopics.find(s => s.id === id);
}
function subjectName(state, id) {
  return findSubject(state, id)?.name || '—';
}
function topicName(state, sid, tid) {
  return findTopic(findSubject(state, sid), tid)?.name || '—';
}
function subtopicName(state, sid, tid, stid) {
  return findSubtopic(findTopic(findSubject(state, sid), tid), stid)?.name || '—';
}

/* ---------- Shell ---------- */
function Shell() {
  const {
    state,
    dispatch
  } = useVault();
  const [view, setView] = useState('dashboard');
  const [sideOpen, setSideOpen] = useState(false);
  const [subjectPath, setSubjectPath] = useState({}); // for cross-view drill
  const lang = state.ui.lang || 'bn';
  const active = VIEWS.find(v => v.key === view);

  // ---------- Notification/Reminder engine ----------
  const notifiedRef = useRef(new Set()); // in-memory keys "sched:ID:HH:MM" per day
  useEffect(() => {
    const t = setInterval(() => {
      const hm = nowHM();
      const today = todayISO();
      // schedule
      state.schedule.forEach(s => {
        if (scheduleMatchesToday(s) && s.time === hm) {
          const key = 'sched:' + s.id + ':' + today;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            fireReminder(s.title, state.ui.notif);
          }
        }
      });
      // todos with due date+time
      state.todos.forEach(t => {
        if (!t.done && t.due === today && t.time === hm) {
          const key = 'todo:' + t.id + ':' + today;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            fireReminder(t.title, state.ui.notif);
          }
        }
      });
      // alarms
      state.alarms.forEach(a => {
        if (!a.active) return;
        const dow = new Date().getDay();
        if (a.days && a.days.length && !a.days.includes(dow)) return;
        if (a.time === hm) {
          const key = 'alarm:' + a.id + ':' + today + ':' + hm;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            fireAlarm(a);
          }
        }
      });
    }, 15000); // check every 15s
    return () => clearInterval(t);
  }, [state.schedule, state.todos, state.alarms, state.ui.notif]);
  function fireReminder(title, notif) {
    const line = REMINDER_LINES[Math.floor(Math.random() * REMINDER_LINES.length)];
    if (notif.beep) AudioEngine.reminderChime();
    if (notif.popup) {
      window.__reminderQueue = window.__reminderQueue || [];
      window.dispatchEvent(new CustomEvent('sonkolpo:remind', {
        detail: {
          title,
          line
        }
      }));
    }
  }
  function fireAlarm(alarm) {
    AudioEngine.playRingtone(alarm.ringtone || 'Classic Bell', 4);
    window.dispatchEvent(new CustomEvent('sonkolpo:alarm', {
      detail: alarm
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "min-h-screen flex flex-col"
  }, /*#__PURE__*/React.createElement(ReminderOverlay, null), /*#__PURE__*/React.createElement(AlarmOverlay, null), /*#__PURE__*/React.createElement("header", {
    className: "sticky top-0 z-40 glass bg-white/80 dark:bg-slate-900/70 border-b border-slate-200/70 dark:border-slate-800"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    className: "hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800",
    onClick: () => setSideOpen(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu"
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setView('dashboard'),
    className: "flex items-center gap-2 group"
  }, /*#__PURE__*/React.createElement(Logo, {
    size: 30
  }), /*#__PURE__*/React.createElement("div", {
    className: "leading-tight text-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-bn font-semibold text-base text-slate-900 dark:text-white"
  }, BRAND))), /*#__PURE__*/React.createElement("div", {
    className: "ml-auto flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(StreakChip, null), /*#__PURE__*/React.createElement(XPChip, null), /*#__PURE__*/React.createElement("button", {
    onClick: () => dispatch({
      type: 'SET_UI',
      patch: {
        theme: state.ui.theme === 'dark' ? 'light' : 'dark'
      }
    }),
    className: "p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800",
    title: "Toggle theme"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: state.ui.theme === 'dark' ? 'sun' : 'moon'
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => dispatch({
      type: 'SET_UI',
      patch: {
        lang: lang === 'bn' ? 'en' : 'bn'
      }
    }),
    className: "px-2 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
  }, lang === 'bn' ? 'বাং' : 'EN')))), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 max-w-[1400px] w-full mx-auto px-4 pt-4 pb-28 md:pb-6 grid md:grid-cols-[240px_1fr] gap-6"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "hidden md:block"
  }, /*#__PURE__*/React.createElement("nav", {
    className: "sticky top-20 space-y-1 max-h-[calc(100vh-6rem)] overflow-auto scrollbar-thin pr-1"
  }, VIEWS.map(v => /*#__PURE__*/React.createElement("button", {
    key: v.key,
    onClick: () => setView(v.key),
    className: `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${view === v.key ? 'bg-brand-600 text-white shadow-soft' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`
  }, /*#__PURE__*/React.createElement(Icon, {
    name: v.icon
  }), /*#__PURE__*/React.createElement("span", {
    className: lang === 'bn' ? 'font-bn' : ''
  }, lang === 'bn' ? v.bn : v.label))))), sideOpen && /*#__PURE__*/React.createElement("div", {
    className: "md:hidden fixed inset-0 bottom-16 z-50 bg-slate-900/40 backdrop-blur-sm",
    onClick: () => setSideOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute left-0 right-0 bottom-0 max-h-[80vh] rounded-t-3xl bg-white dark:bg-slate-900 p-4 pb-8 overflow-auto grid grid-cols-3 gap-2 content-start animate-fadeIn more-sheet",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "col-span-3 flex justify-center pb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700"
  })), VIEWS.map(v => /*#__PURE__*/React.createElement("button", {
    key: v.key,
    onClick: () => {
      setView(v.key);
      setSideOpen(false);
    },
    className: `flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl text-[11px] font-medium text-center ${view === v.key ? 'bg-brand-600 text-white' : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300'}`
  }, /*#__PURE__*/React.createElement(Icon, {
    name: v.icon,
    size: 20
  }), /*#__PURE__*/React.createElement("span", { className: "font-bn leading-tight" }, lang === 'bn' ? v.bn : v.label))))), /*#__PURE__*/React.createElement("main", {
    className: "min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mb-4 flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("h1", {
    className: 'text-lg font-semibold tracking-tight ' + (lang === 'bn' ? 'font-bn' : '')
  }, lang === 'bn' ? active.bn : active.label), /*#__PURE__*/React.createElement("span", {
    className: "ml-auto text-xs text-slate-400 hidden md:inline"
  }, new Date().toLocaleDateString(), " · ", nowHM())), /*#__PURE__*/React.createElement("div", {
    className: "animate-fadeIn"
  }, view === 'dashboard' && /*#__PURE__*/React.createElement(Dashboard, {
    go: setView,
    setSubjectPath: setSubjectPath
  }), view === 'subjects' && /*#__PURE__*/React.createElement(SubjectsView, {
    initialPath: subjectPath,
    clearPath: () => setSubjectPath({})
  }), view === 'mcq' && /*#__PURE__*/React.createElement(MCQView, null), view === 'exam' && /*#__PURE__*/React.createElement(ExamView, null), view === 'mistakes' && /*#__PURE__*/React.createElement(MistakeView, null), view === 'cards' && /*#__PURE__*/React.createElement(FlashcardsView, null), view === 'schedule' && /*#__PURE__*/React.createElement(ScheduleView, null), view === 'todos' && /*#__PURE__*/React.createElement(TodosView, null), view === 'notes' && /*#__PURE__*/React.createElement(NotesView, null), view === 'habits' && /*#__PURE__*/React.createElement(HabitsView, null), view === 'alarm' && /*#__PURE__*/React.createElement(AlarmView, null), view === 'timer' && /*#__PURE__*/React.createElement(TimerView, null), view === 'quotes' && /*#__PURE__*/React.createElement(QuotesView, null), view === 'analytics' && /*#__PURE__*/React.createElement(AnalyticsView, null), view === 'settings' && /*#__PURE__*/React.createElement(SettingsView, null)))), /*#__PURE__*/React.createElement(Footer, null), /*#__PURE__*/React.createElement(BottomNav, {
    view: view,
    setView: v => { setSideOpen(false); setView(v); },
    openMore: () => setSideOpen(!sideOpen),
    moreOpen: sideOpen,
    lang: lang
  }));
}
const NAV_MAIN = [
  { key: 'dashboard', bn: 'হোম', en: 'Home', icon: 'house' },
  { key: 'subjects', bn: 'বিষয়', en: 'Study', icon: 'book-open' },
  { key: 'cards', bn: 'কার্ড', en: 'Cards', icon: 'layers' },
  { key: 'todos', bn: 'কাজ', en: 'Tasks', icon: 'check-circle-2' }
];
function BottomNav({ view, setView, openMore, moreOpen, lang }) {
  const inMain = NAV_MAIN.some(n => n.key === view);
  const item = (active, icon, label, onClick, key) => /*#__PURE__*/React.createElement("button", {
    key: key,
    onClick: onClick,
    className: "bnav-item flex-1 flex flex-col items-center justify-center gap-1 py-1.5 " + (active ? 'is-active' : '')
  }, /*#__PURE__*/React.createElement("span", { className: "bnav-pill" }, /*#__PURE__*/React.createElement(Icon, { name: icon, size: 20 })), /*#__PURE__*/React.createElement("span", { className: "text-[10.5px] font-medium font-bn leading-none" }, label));
  return /*#__PURE__*/React.createElement("nav", {
    className: "bnav md:hidden fixed bottom-0 inset-x-0 z-[60] flex px-2 pt-1.5"
  }, NAV_MAIN.map(n => item(!moreOpen && view === n.key, n.icon, lang === 'bn' ? n.bn : n.en, () => setView(n.key), n.key)), item(moreOpen || !inMain, 'layout-grid', lang === 'bn' ? 'আরও' : 'More', openMore, 'more'));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    className: "hidden md:block border-t border-slate-200/70 dark:border-slate-800 py-4 text-center text-[11px] text-slate-400 select-none"
  }, CREDIT);
}
function StreakChip() {
  const {
    state
  } = useVault();
  return /*#__PURE__*/React.createElement("div", {
    className: "hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-medium"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "flame",
    size: 14
  }), " ", state.profile.streak, " day", state.profile.streak === 1 ? '' : 's');
}
function XPChip() {
  const {
    state
  } = useVault();
  const need = xpForLevel(state.profile.level);
  const pct = Math.min(100, Math.round(state.profile.xp / need * 100));
  return /*#__PURE__*/React.createElement("div", {
    className: "hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-200 text-xs font-medium"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "zap",
    size: 14
  }), " Lv ", state.profile.level, /*#__PURE__*/React.createElement("div", {
    className: "w-16 h-1.5 bg-brand-200/70 dark:bg-brand-900 rounded-full overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full grad-bar transition-all",
    style: {
      width: pct + '%'
    }
  })));
}

/* ---------- Reminder & Alarm overlays ---------- */
function ReminderOverlay() {
  const [q, setQ] = useState([]);
  useEffect(() => {
    function h(e) {
      setQ(x => [...x, {
        id: uid(),
        ...e.detail
      }]);
    }
    window.addEventListener('sonkolpo:remind', h);
    return () => window.removeEventListener('sonkolpo:remind', h);
  }, []);
  if (q.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed z-[150] bottom-4 right-4 space-y-2 max-w-sm"
  }, q.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    className: "animate-pop bg-white dark:bg-slate-900 border border-brand-300 dark:border-brand-700 rounded-2xl shadow-glow p-4 relative overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 opacity-10 grad-premium animate-gradientMove pointer-events-none"
  }), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-brand-600 dark:text-brand-300 text-xs font-semibold uppercase tracking-widest"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell-ring",
    size: 14
  }), " Reminder"), /*#__PURE__*/React.createElement("div", {
    className: "mt-1 font-semibold"
  }, r.title), /*#__PURE__*/React.createElement("div", {
    className: "font-bn text-sm text-slate-600 dark:text-slate-300 mt-1"
  }, r.line), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 flex justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "subtle",
    onClick: () => setQ(x => x.filter(i => i.id !== r.id))
  }, "ঠিক আছে"))))));
}
function AlarmOverlay() {
  const [a, setA] = useState(null);
  useEffect(() => {
    function h(e) {
      setA(e.detail);
    }
    window.addEventListener('sonkolpo:alarm', h);
    return () => window.removeEventListener('sonkolpo:alarm', h);
  }, []);
  if (!a) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed z-[180] inset-0 bg-slate-900/70 backdrop-blur flex items-center justify-center p-4"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-8 text-center max-w-md w-full animate-pop relative overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 opacity-20 grad-premium animate-gradientMove"
  }), /*#__PURE__*/React.createElement("div", {
    className: "relative"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mx-auto w-20 h-20 rounded-full grad-premium animate-gradientMove flex items-center justify-center text-white animate-floaty"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alarm-clock",
    size: 40
  })), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 text-3xl font-bold tabular-nums"
  }, a.time), /*#__PURE__*/React.createElement("div", {
    className: "mt-1 text-lg font-medium"
  }, a.label || 'Alarm'), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mt-1"
  }, "Ringtone · ", a.ringtone || 'Classic Bell'), /*#__PURE__*/React.createElement("div", {
    className: "mt-6 flex gap-2 justify-center"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: () => {
      AudioEngine.stopAlarm();
      setA(null);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x"
  }), "Stop"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    onClick: () => {
      AudioEngine.stopAlarm();
      setTimeout(() => AudioEngine.playRingtone(a.ringtone || 'Classic Bell', 3), 5 * 60 * 1000);
      setA(null);
      toast('Snoozed 5 min', 'success');
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "timer-reset"
  }), "Snooze 5m")))));
}

/* ---------- Dashboard ---------- */
function Dashboard({
  go,
  setSubjectPath
}) {
  const {
    state,
    dispatch
  } = useVault();
  const p = state.profile;
  const need = xpForLevel(p.level);
  const today = todayISO();
  const now = nowHM();
  const todaySchedule = state.schedule.filter(scheduleMatchesToday);
  const openTodos = state.todos.filter(t => !t.done).length;
  const mistakes = state.mistakeVault.length;
  const totalFocus = state.timerSessions.reduce((a, s) => a + (s.minutes || 0), 0);
  const combined = [...DEFAULT_MOTIVATIONS, ...state.quotes];
  const m = combined[state.ui.motivationIdx % combined.length];

  // Currently-due tasks (highlight)
  function isDueNowTime(timeStr) {
    if (!timeStr) return false;
    const [h, mn] = timeStr.split(':').map(Number);
    const [nh, nm] = now.split(':').map(Number);
    const target = h * 60 + mn,
      cur = nh * 60 + nm;
    return cur >= target && cur <= target + 30;
  }
  const [dismissedDue, setDismissedDue] = useState({});
  const dueNow = [...todaySchedule.filter(s => isDueNowTime(s.time)).map(s => ({
    ...s,
    kind: 'schedule'
  })), ...state.todos.filter(t => !t.done && t.due === today && isDueNowTime(t.time)).map(t => ({
    ...t,
    kind: 'todo'
  }))].filter(x => !dismissedDue[x.kind + x.id]);

  // Focus area: mistakes by subject/topic
  const focusArea = useMemo(() => {
    const map = {};
    state.mistakeVault.forEach(mv => {
      const sid = mv.mcq.subjectId || '';
      const tid = mv.mcq.topicId || '';
      const k = sid + '|' + tid;
      map[k] = map[k] || {
        subjectId: sid,
        topicId: tid,
        count: 0,
        items: []
      };
      map[k].count++;
      map[k].items.push(mv);
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [state.mistakeVault]);
  const [focusOpen, setFocusOpen] = useState(null);
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, dueNow.length > 0 && /*#__PURE__*/React.createElement(Card, {
    className: "p-4 border-rose-300 dark:border-rose-800 task-due-glow"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-2 text-rose-600 dark:text-rose-300 font-semibold"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell-ring"
  }), " Right now / এখনকার কাজ"), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, dueNow.map(x => /*#__PURE__*/React.createElement("div", {
    key: x.kind + x.id,
    className: "flex items-center gap-2 p-2 rounded-xl bg-rose-50/60 dark:bg-rose-950/30"
  }, /*#__PURE__*/React.createElement(Chip, {
    tone: "rose"
  }, x.kind), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 truncate font-medium"
  }, x.title), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, x.time), /*#__PURE__*/React.createElement(Btn, {
    size: "sm",
    variant: "subtle",
    onClick: () => {
      if (x.kind === 'todo') {
        dispatch({
          type: 'UPDATE_ITEM',
          key: 'todos',
          item: {
            ...state.todos.find(t => t.id === x.id),
            done: true
          }
        });
      }
      setDismissedDue(d => ({
        ...d,
        [x.kind + x.id]: true
      }));
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check"
  }), "Done"))))), /*#__PURE__*/React.createElement(Card, {
    className: "p-5 relative overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-0 opacity-10 grad-premium animate-gradientMove pointer-events-none"
  }), /*#__PURE__*/React.createElement("div", {
    className: "relative flex flex-wrap items-center gap-6"
  }, /*#__PURE__*/React.createElement(Logo, {
    size: 56
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-[200px]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-500"
  }, "স্বাগতম / Welcome back"), /*#__PURE__*/React.createElement("div", {
    className: "text-xl font-semibold"
  }, p.name || 'Achiever'), /*#__PURE__*/React.createElement("div", {
    className: "mt-2 flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Level ", p.level), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden max-w-xs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h-full grad-bar transition-all",
    style: {
      width: Math.min(100, p.xp / need * 100) + '%'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, p.xp, "/", need, " XP"))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-3"
  }, /*#__PURE__*/React.createElement(Stat, {
    icon: "flame",
    label: "Streak",
    value: p.streak
  }), /*#__PURE__*/React.createElement(Stat, {
    icon: "zap",
    label: "Level",
    value: p.level
  }), /*#__PURE__*/React.createElement(Stat, {
    icon: "timer",
    label: "Focus",
    value: totalFocus + 'm'
  }))), /*#__PURE__*/React.createElement("div", {
    className: "relative mt-5 p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs uppercase tracking-widest text-slate-400 mb-1"
  }, "Motivation"), /*#__PURE__*/React.createElement("div", {
    className: "font-bn text-lg"
  }, m.bn), m.en && /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mt-0.5 italic"
  }, "\"", m.en, "\""), /*#__PURE__*/React.createElement("button", {
    className: "absolute right-2 top-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800",
    onClick: () => dispatch({
      type: 'SET_UI',
      patch: {
        motivationIdx: state.ui.motivationIdx + 1
      }
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh-cw",
    size: 14
  })))), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-3 gap-4"
  }, /*#__PURE__*/React.createElement(QuickCard, {
    title: "Today's Schedule",
    icon: "calendar-days",
    empty: todaySchedule.length === 0,
    onGo: () => go('schedule'),
    count: todaySchedule.length
  }, todaySchedule.slice(0, 4).map(s => {
    const due = isDueNowTime(s.time);
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      className: "flex items-center justify-between py-1 text-sm " + (due ? 'text-rose-600 font-semibold' : '')
    }, /*#__PURE__*/React.createElement("span", null, s.title), /*#__PURE__*/React.createElement("span", {
      className: "text-xs text-slate-500"
    }, s.time || '—'));
  })), /*#__PURE__*/React.createElement(QuickCard, {
    title: "Open To-dos",
    icon: "check-square",
    empty: openTodos === 0,
    onGo: () => go('todos'),
    count: openTodos
  }, state.todos.filter(t => !t.done).slice(0, 4).map(t => /*#__PURE__*/React.createElement("div", {
    key: t.id,
    className: "py-1 text-sm truncate"
  }, "• ", t.title))), /*#__PURE__*/React.createElement(QuickCard, {
    title: "Mistake Vault",
    icon: "alert-triangle",
    empty: mistakes === 0,
    onGo: () => go('mistakes'),
    count: mistakes
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-500"
  }, mistakes, " question", mistakes === 1 ? '' : 's', " to review."))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-2"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "target"
  }), /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, "Focus Area — Mistake Tracker"), /*#__PURE__*/React.createElement("span", {
    className: "ml-auto text-xs text-slate-500"
  }, "Sorted by errors")), focusArea.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-400 py-3"
  }, "No mistakes tracked yet.") : /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-2"
  }, focusArea.slice(0, 8).map((f, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => setFocusOpen(f),
    className: "text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-400 hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300 flex items-center justify-center font-bold"
  }, f.count), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 min-w-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium truncate"
  }, subjectName(state, f.subjectId) || 'Unassigned'), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 truncate"
  }, f.topicId ? topicName(state, f.subjectId, f.topicId) : '— topic')), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right"
  }))))), /*#__PURE__*/React.createElement(Modal, {
    open: !!focusOpen,
    onClose: () => setFocusOpen(null),
    title: focusOpen ? `Mistakes — ${subjectName(state, focusOpen.subjectId) || 'Unassigned'} / ${topicName(state, focusOpen.subjectId, focusOpen.topicId) || '—'}` : '',
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2 max-h-[60vh] overflow-auto scrollbar-thin"
  }, focusOpen?.items.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    className: "p-3 rounded-xl border border-slate-200 dark:border-slate-800"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium"
  }, m.mcq.question), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-emerald-600 mt-1"
  }, "Correct: ", m.mcq.options[m.mcq.correct]))))), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement(QuickAction, {
    icon: "graduation-cap",
    title: "Custom Exam",
    desc: "Filter by subject/topic/difficulty, timed mode",
    onClick: () => go('exam')
  }), /*#__PURE__*/React.createElement(QuickAction, {
    icon: "timer",
    title: "Start focus session",
    desc: "Pomodoro + ambient sound",
    onClick: () => go('timer')
  })));
}
function Stat({
  icon,
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-center min-w-[70px]"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-center text-brand-600 dark:text-brand-300"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-lg font-semibold leading-tight mt-0.5"
  }, value), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] uppercase tracking-widest text-slate-400"
  }, label));
}
function QuickCard({
  title,
  icon,
  children,
  empty,
  onGo
}) {
  return /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between mb-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-sm font-medium"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon
  }), " ", title), /*#__PURE__*/React.createElement("button", {
    onClick: onGo,
    className: "text-xs text-brand-600 hover:underline"
  }, "Open →")), empty ? /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-400 py-3"
  }, "Nothing here yet.") : /*#__PURE__*/React.createElement("div", null, children));
}
function QuickAction({
  icon,
  title,
  desc,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    className: "text-left p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 hover:border-brand-400 hover:shadow-soft transition group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-300 flex items-center justify-center group-hover:scale-105 transition"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, desc)), /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    className: "ml-auto text-slate-400 group-hover:text-brand-600"
  })));
}

/* ---------- Subjects hierarchical view ---------- */
function SubjectsView() {
  const {
    state,
    dispatch
  } = useVault();
  const [level, setLevel] = useState({}); // {subjectId, topicId, subtopicId, tool}
  const [add, setAdd] = useState(null); // {type,parent?}
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // {type, id, subjectId?, topicId?}

  function addSubject() {
    if (!name.trim()) return;
    dispatch({
      type: 'ADD_ITEM',
      key: 'subjects',
      item: {
        id: uid(),
        name: name.trim(),
        topics: []
      }
    });
    setName('');
    setAdd(null);
  }
  function addTopic(sid) {
    if (!name.trim()) return;
    const subj = findSubject(state, sid);
    const updated = {
      ...subj,
      topics: [{
        id: uid(),
        name: name.trim(),
        subtopics: []
      }, ...subj.topics]
    };
    dispatch({
      type: 'UPDATE_ITEM',
      key: 'subjects',
      item: updated
    });
    setName('');
    setAdd(null);
  }
  function addSubtopic(sid, tid) {
    if (!name.trim()) return;
    const subj = findSubject(state, sid);
    const updated = {
      ...subj,
      topics: subj.topics.map(t => t.id === tid ? {
        ...t,
        subtopics: [{
          id: uid(),
          name: name.trim()
        }, ...t.subtopics]
      } : t)
    };
    dispatch({
      type: 'UPDATE_ITEM',
      key: 'subjects',
      item: updated
    });
    setName('');
    setAdd(null);
  }
  function renameItem() {
    if (!editing || !name.trim()) return;
    if (editing.type === 'subject') {
      const subj = findSubject(state, editing.id);
      dispatch({
        type: 'UPDATE_ITEM',
        key: 'subjects',
        item: {
          ...subj,
          name: name.trim()
        }
      });
    } else if (editing.type === 'topic') {
      const subj = findSubject(state, editing.subjectId);
      dispatch({
        type: 'UPDATE_ITEM',
        key: 'subjects',
        item: {
          ...subj,
          topics: subj.topics.map(t => t.id === editing.id ? {
            ...t,
            name: name.trim()
          } : t)
        }
      });
    } else {
      const subj = findSubject(state, editing.subjectId);
      dispatch({
        type: 'UPDATE_ITEM',
        key: 'subjects',
        item: {
          ...subj,
          topics: subj.topics.map(t => t.id === editing.topicId ? {
            ...t,
            subtopics: t.subtopics.map(s => s.id === editing.id ? {
              ...s,
              name: name.trim()
            } : s)
          } : t)
        }
      });
    }
    setEditing(null);
    setName('');
  }
  function delSubject(id) {
    if (confirm('Delete this subject and all its topics?')) dispatch({
      type: 'REMOVE_ITEM',
      key: 'subjects',
      id
    });
  }
  function delTopic(sid, tid) {
    if (!confirm('Delete this topic?')) return;
    const subj = findSubject(state, sid);
    dispatch({
      type: 'UPDATE_ITEM',
      key: 'subjects',
      item: {
        ...subj,
        topics: subj.topics.filter(t => t.id !== tid)
      }
    });
  }
  function delSubtopic(sid, tid, stid) {
    if (!confirm('Delete this subtopic?')) return;
    const subj = findSubject(state, sid);
    dispatch({
      type: 'UPDATE_ITEM',
      key: 'subjects',
      item: {
        ...subj,
        topics: subj.topics.map(t => t.id === tid ? {
          ...t,
          subtopics: t.subtopics.filter(s => s.id !== stid)
        } : t)
      }
    });
  }
  const subj = level.subjectId ? findSubject(state, level.subjectId) : null;
  const topic = subj && level.topicId ? findTopic(subj, level.topicId) : null;
  const subtopic = topic && level.subtopicId ? findSubtopic(topic, level.subtopicId) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-1 text-sm flex-wrap"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setLevel({}),
    className: "hover:underline text-brand-600"
  }, "Subjects"), subj && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 14
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setLevel({
      subjectId: subj.id
    }),
    className: "hover:underline text-brand-600"
  }, subj.name)), topic && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 14
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setLevel({
      subjectId: subj.id,
      topicId: topic.id
    }),
    className: "hover:underline text-brand-600"
  }, topic.name)), subtopic && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 14
  }), /*#__PURE__*/React.createElement("span", {
    className: "font-medium"
  }, subtopic.name))), !subj && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setAdd({
      type: 'subject'
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add Subject")), state.subjects.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    icon: "library",
    text: "No subjects yet. Create your first subject."
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-3 gap-2"
  }, state.subjects.map(s => /*#__PURE__*/React.createElement(Card, {
    key: s.id,
    className: "p-4 group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setLevel({
      subjectId: s.id
    }),
    className: "flex-1 text-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-10 h-10 rounded-xl grad-premium animate-gradientMove text-white flex items-center justify-center font-bold mb-2"
  }, s.name.slice(0, 1).toUpperCase()), /*#__PURE__*/React.createElement("div", {
    className: "font-semibold"
  }, s.name), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mt-0.5"
  }, s.topics.length, " topics")), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditing({
        type: 'subject',
        id: s.id
      });
      setName(s.name);
    },
    className: "p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => delSubject(s.id),
    className: "p-1 text-rose-500 hover:bg-rose-50 rounded"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  })))))))), subj && !topic && subj.topics.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setAdd({
      type: 'topic',
      parent: subj.id
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add Topic")), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-2"
  }, subj.topics.map(t => /*#__PURE__*/React.createElement(Card, {
    key: t.id,
    className: "p-3 group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setLevel({
      subjectId: subj.id,
      topicId: t.id
    }),
    className: "flex-1 text-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, t.name), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, t.subtopics.length, " subtopics")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditing({
        type: 'topic',
        id: t.id,
        subjectId: subj.id
      });
      setName(t.name);
    },
    className: "p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => delTopic(subj.id, t.id),
    className: "p-1 text-rose-500"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mt-2"
  }, "Items saved directly under this subject (or across all its topics):"), /*#__PURE__*/React.createElement(SubtopicTools, {
    subjectId: subj.id,
    showScope: true
  })), subj && !topic && subj.topics.length === 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setAdd({
      type: 'topic',
      parent: subj.id
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add Topic")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "No topics yet — you can still add MCQ / Flashcard / Information directly under this subject."), /*#__PURE__*/React.createElement(SubtopicTools, {
    subjectId: subj.id
  })), subj && topic && !subtopic && topic.subtopics.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setAdd({
      type: 'subtopic',
      parent: topic.id
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add Subtopic")), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-2"
  }, topic.subtopics.map(st => /*#__PURE__*/React.createElement(Card, {
    key: st.id,
    className: "p-3 group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setLevel({
      subjectId: subj.id,
      topicId: topic.id,
      subtopicId: st.id
    }),
    className: "flex-1 text-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, st.name), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Tap to view MCQ / Flashcard / Info")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditing({
        type: 'subtopic',
        id: st.id,
        subjectId: subj.id,
        topicId: topic.id
      });
      setName(st.name);
    },
    className: "p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => delSubtopic(subj.id, topic.id, st.id),
    className: "p-1 text-rose-500"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mt-2"
  }, "Items saved directly under this topic (or across all its subtopics):"), /*#__PURE__*/React.createElement(SubtopicTools, {
    subjectId: subj.id,
    topicId: topic.id,
    showScope: true
  })), subj && topic && !subtopic && topic.subtopics.length === 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setAdd({
      type: 'subtopic',
      parent: topic.id
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add Subtopic")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "No subtopics — you can add MCQ / Flashcard / Information directly under this topic."), /*#__PURE__*/React.createElement(SubtopicTools, {
    subjectId: subj.id,
    topicId: topic.id
  })), subj && topic && subtopic && /*#__PURE__*/React.createElement(SubtopicTools, {
    subjectId: subj.id,
    topicId: topic.id,
    subtopicId: subtopic.id
  }), /*#__PURE__*/React.createElement(Modal, {
    open: !!add,
    onClose: () => {
      setAdd(null);
      setName('');
    },
    title: add?.type === 'subject' ? 'New Subject' : add?.type === 'topic' ? 'New Topic' : 'New Subtopic'
  }, /*#__PURE__*/React.createElement(Input, {
    autoFocus: true,
    placeholder: "Name",
    value: name,
    onChange: e => setName(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mt-3 gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      setAdd(null);
      setName('');
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      if (add.type === 'subject') addSubject();else if (add.type === 'topic') addTopic(add.parent);else addSubtopic(subj.id, add.parent);
    }
  }, "Add"))), /*#__PURE__*/React.createElement(Modal, {
    open: !!editing,
    onClose: () => {
      setEditing(null);
      setName('');
    },
    title: "Rename"
  }, /*#__PURE__*/React.createElement(Input, {
    autoFocus: true,
    value: name,
    onChange: e => setName(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mt-3 gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      setEditing(null);
      setName('');
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    onClick: renameItem
  }, "Save"))));
}
function SubtopicTools({
  subjectId,
  topicId,
  subtopicId,
  showScope
}) {
  const {
    state
  } = useVault();
  const [tool, setTool] = useState(null); // 'mcq' | 'flash' | 'info'
  // scope: 'direct' = items saved exactly at this level; 'all' = cumulative (this level + all descendants)
  const [scope, setScope] = useState('direct');
  const isLeaf = !!subtopicId;
  const effectiveScope = isLeaf ? 'direct' : scope;
  function pred(item) {
    if (effectiveScope === 'direct') {
      return (item.subjectId || null) === (subjectId || null) && (item.topicId || null) === (topicId || null) && (item.subtopicId || null) === (subtopicId || null);
    }
    if (subjectId && item.subjectId !== subjectId) return false;
    if (topicId && item.topicId !== topicId) return false;
    return true;
  }
  const mcqs = state.mcqs.filter(pred);
  const flash = state.flashcards.filter(pred);
  const info = state.information.filter(pred);
  const listFilter = {
    subjectId,
    topicId,
    subtopicId,
    _scope: effectiveScope
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, showScope && !isLeaf && /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1 text-xs"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setScope('direct'),
    className: "px-2 py-1 rounded-lg border " + (scope === 'direct' ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700')
  }, "Direct only"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setScope('all'),
    className: "px-2 py-1 rounded-lg border " + (scope === 'all' ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700')
  }, "Include nested")), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setTool('mcq'),
    className: "p-4 rounded-2xl border transition text-center " + (tool === 'mcq' ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-slate-200 dark:border-slate-700 hover:border-brand-400')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "list-checks",
    size: 22
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-1 font-medium"
  }, "MCQ"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, mcqs.length, " items")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setTool('flash'),
    className: "p-4 rounded-2xl border transition text-center " + (tool === 'flash' ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-slate-200 dark:border-slate-700 hover:border-brand-400')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "layers",
    size: 22
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-1 font-medium"
  }, "Flashcard"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, flash.length, " items")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setTool('info'),
    className: "p-4 rounded-2xl border transition text-center " + (tool === 'info' ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-slate-200 dark:border-slate-700 hover:border-brand-400')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "info",
    size: 22
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-1 font-medium"
  }, "Information"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, info.length, " items"))), tool === 'mcq' && /*#__PURE__*/React.createElement(MCQList, {
    filter: listFilter,
    inline: true
  }), tool === 'flash' && /*#__PURE__*/React.createElement(FlashList, {
    filter: listFilter,
    inline: true
  }), tool === 'info' && /*#__PURE__*/React.createElement(InfoList, {
    filter: listFilter,
    inline: true
  }));
}

/* ---------- Shared: Subject/Topic/Subtopic selector ---------- */
function SubjectPicker({
  value,
  onChange,
  allowEmpty = false
}) {
  const {
    state
  } = useVault();
  const {
    subjectId,
    topicId,
    subtopicId
  } = value || {};
  const subj = findSubject(state, subjectId);
  const topic = findTopic(subj, topicId);
  return /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2"
  }, /*#__PURE__*/React.createElement(Select, {
    value: subjectId || '',
    onChange: e => onChange({
      subjectId: e.target.value || undefined,
      topicId: undefined,
      subtopicId: undefined
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, allowEmpty ? 'All subjects' : '— Subject —'), state.subjects.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name))), /*#__PURE__*/React.createElement(Select, {
    value: topicId || '',
    onChange: e => onChange({
      subjectId,
      topicId: e.target.value || undefined,
      subtopicId: undefined
    }),
    disabled: !subj
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, allowEmpty ? 'All topics' : '— Topic —'), subj?.topics.map(t => /*#__PURE__*/React.createElement("option", {
    key: t.id,
    value: t.id
  }, t.name))), /*#__PURE__*/React.createElement(Select, {
    value: subtopicId || '',
    onChange: e => onChange({
      subjectId,
      topicId,
      subtopicId: e.target.value || undefined
    }),
    disabled: !topic
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, allowEmpty ? 'All subtopics' : '— Subtopic —'), topic?.subtopics.map(s => /*#__PURE__*/React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name))));
}
function matchFilter(item, f) {
  if (f && f._scope === 'direct') {
    return (item.subjectId || null) === (f.subjectId || null) && (item.topicId || null) === (f.topicId || null) && (item.subtopicId || null) === (f.subtopicId || null) && (!f.difficulty || item.difficulty === f.difficulty);
  }
  if (f.subjectId && item.subjectId !== f.subjectId) return false;
  if (f.topicId && item.topicId !== f.topicId) return false;
  if (f.subtopicId && item.subtopicId !== f.subtopicId) return false;
  if (f.difficulty && item.difficulty !== f.difficulty) return false;
  return true;
}

/* ---------- MCQ ---------- */
function MCQView() {
  const {
    state,
    dispatch
  } = useVault();
  const [mode, setMode] = useState('list');
  const [editing, setEditing] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [filter, setFilter] = useState({});
  const [showBulk, setShowBulk] = useState(false);
  const list = state.mcqs.filter(m => matchFilter(m, filter));
  function startQuiz() {
    if (list.length === 0) {
      toast('No MCQs match your filter.', 'error');
      return;
    }
    const pool = [...list].sort(() => Math.random() - .5).slice(0, Math.min(10, list.length));
    setQuiz({
      pool,
      idx: 0,
      answers: []
    });
    setMode('quiz');
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, mode === 'list' && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    className: "p-3 grid gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 font-medium"
  }, "Filter"), /*#__PURE__*/React.createElement(SubjectPicker, {
    value: filter,
    onChange: p => setFilter({
      ...filter,
      ...p
    }),
    allowEmpty: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2 items-center"
  }, /*#__PURE__*/React.createElement(Select, {
    value: filter.difficulty || '',
    onChange: e => setFilter({
      ...filter,
      difficulty: e.target.value || undefined
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Any difficulty"), /*#__PURE__*/React.createElement("option", {
    value: "easy"
  }, "Easy"), /*#__PURE__*/React.createElement("option", {
    value: "hard"
  }, "Hard")), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setFilter({})
  }, "Clear"), /*#__PURE__*/React.createElement("span", {
    className: "ml-auto text-xs text-slate-500"
  }, list.length, " shown / ", state.mcqs.length, " total"))), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      setEditing({
        id: uid(),
        question: '',
        options: ['', '', '', ''],
        correct: 0,
        tag: '',
        difficulty: 'easy',
        ...filter
      });
      setMode('create');
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add MCQ"), /*#__PURE__*/React.createElement(Btn, {
    variant: "subtle",
    onClick: startQuiz
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play"
  }), "Quick Quiz"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    onClick: () => setShowBulk(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload"
  }), "Bulk Add")), list.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    icon: "list-checks",
    text: "No MCQs match this filter."
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, list.map(m => /*#__PURE__*/React.createElement(Card, {
    key: m.id,
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, m.question), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mt-1"
  }, "Answer: ", m.options[m.correct]), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1 mt-1"
  }, m.difficulty && /*#__PURE__*/React.createElement(Chip, {
    tone: m.difficulty === 'hard' ? 'rose' : 'emerald'
  }, m.difficulty), m.subjectId && /*#__PURE__*/React.createElement(Chip, {
    tone: "brand"
  }, subjectName(state, m.subjectId)), m.topicId && /*#__PURE__*/React.createElement(Chip, null, topicName(state, m.subjectId, m.topicId)), m.subtopicId && /*#__PURE__*/React.createElement(Chip, null, subtopicName(state, m.subjectId, m.topicId, m.subtopicId)), m.tag && /*#__PURE__*/React.createElement(Chip, null, m.tag))), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditing(m);
      setMode('create');
    },
    className: "p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => dispatch({
      type: 'REMOVE_ITEM',
      key: 'mcqs',
      id: m.id
    }),
    className: "p-1.5 rounded hover:bg-rose-50 text-rose-600"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  }))))))), mode === 'create' && /*#__PURE__*/React.createElement(MCQEditor, {
    item: editing,
    onCancel: () => setMode('list'),
    onSave: item => {
      const exists = state.mcqs.find(x => x.id === item.id);
      if (exists) dispatch({
        type: 'UPDATE_ITEM',
        key: 'mcqs',
        item
      });else dispatch({
        type: 'ADD_ITEM',
        key: 'mcqs',
        item
      });
      setMode('list');
    }
  }), mode === 'quiz' && /*#__PURE__*/React.createElement(QuizRunner, {
    quiz: quiz,
    onDone: answers => {
      const score = answers.filter(a => a.correct).length;
      dispatch({
        type: 'ADD_ITEM',
        key: 'attempts',
        item: {
          id: uid(),
          date: todayISO(),
          score,
          total: answers.length
        }
      });
      answers.filter(a => !a.correct).forEach(a => {
        if (!state.mistakeVault.find(x => x.mcqId === a.mcq.id)) dispatch({
          type: 'ADD_ITEM',
          key: 'mistakeVault',
          item: {
            id: uid(),
            mcqId: a.mcq.id,
            mcq: a.mcq,
            addedAt: todayISO()
          }
        });
      });
      dispatch({
        type: 'ADD_XP',
        amount: score * 10
      });
      setQuiz({
        ...quiz,
        answers,
        done: true
      });
      setMode('result');
    }
  }), mode === 'result' && /*#__PURE__*/React.createElement(QuizResult, {
    quiz: quiz,
    onClose: () => setMode('list')
  }), /*#__PURE__*/React.createElement(Modal, {
    open: showBulk,
    onClose: () => setShowBulk(false),
    title: "Bulk add MCQs",
    wide: true
  }, /*#__PURE__*/React.createElement(BulkMCQ, {
    onDone: items => {
      dispatch({
        type: 'ADD_MANY',
        key: 'mcqs',
        items
      });
      setShowBulk(false);
      toast(`Added ${items.length} MCQs`, 'success');
    }
  })));
}

// Reusable MCQ list (inline mode used inside Subjects drill)
function MCQList({
  filter,
  inline
}) {
  const {
    state,
    dispatch
  } = useVault();
  const [editing, setEditing] = useState(null);
  const list = state.mcqs.filter(m => matchFilter(m, filter));
  if (list.length === 0) return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Empty, {
    icon: "list-checks",
    text: "No MCQs in this subtopic. Add one from MCQ Bank."
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-center mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setEditing({
      id: uid(),
      question: '',
      options: ['', '', '', ''],
      correct: 0,
      difficulty: 'easy',
      ...filter
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add here")), editing && /*#__PURE__*/React.createElement(Modal, {
    open: true,
    onClose: () => setEditing(null),
    title: "Add MCQ",
    wide: true
  }, /*#__PURE__*/React.createElement(MCQEditor, {
    item: editing,
    onCancel: () => setEditing(null),
    onSave: item => {
      dispatch({
        type: 'ADD_ITEM',
        key: 'mcqs',
        item
      });
      setEditing(null);
    }
  })));
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setEditing({
      id: uid(),
      question: '',
      options: ['', '', '', ''],
      correct: 0,
      difficulty: 'easy',
      ...filter
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add MCQ")), list.map(m => /*#__PURE__*/React.createElement(Card, {
    key: m.id,
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, m.question), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-emerald-600 mt-1"
  }, "Correct: ", m.options[m.correct]), m.difficulty && /*#__PURE__*/React.createElement(Chip, {
    tone: m.difficulty === 'hard' ? 'rose' : 'emerald',
    className: "mt-1"
  }, m.difficulty)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditing(m),
    className: "p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => dispatch({
      type: 'REMOVE_ITEM',
      key: 'mcqs',
      id: m.id
    }),
    className: "p-1.5 text-rose-600"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  }))))), editing && /*#__PURE__*/React.createElement(Modal, {
    open: true,
    onClose: () => setEditing(null),
    title: "Edit MCQ",
    wide: true
  }, /*#__PURE__*/React.createElement(MCQEditor, {
    item: editing,
    onCancel: () => setEditing(null),
    onSave: item => {
      const exists = state.mcqs.find(x => x.id === item.id);
      if (exists) dispatch({
        type: 'UPDATE_ITEM',
        key: 'mcqs',
        item
      });else dispatch({
        type: 'ADD_ITEM',
        key: 'mcqs',
        item
      });
      setEditing(null);
    }
  })));
}
function MCQEditor({
  item,
  onSave,
  onCancel
}) {
  const [q, setQ] = useState(item);
  return /*#__PURE__*/React.createElement(Card, {
    className: "p-4 grid gap-3"
  }, /*#__PURE__*/React.createElement(TextArea, {
    rows: "2",
    placeholder: "Question",
    value: q.question,
    onChange: e => setQ({
      ...q,
      question: e.target.value
    })
  }), q.options.map((o, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: "correct",
    checked: q.correct === i,
    onChange: () => setQ({
      ...q,
      correct: i
    }),
    className: "accent-brand-600"
  }), /*#__PURE__*/React.createElement(Input, {
    placeholder: 'Option ' + (i + 1),
    value: o,
    onChange: e => {
      const opts = [...q.options];
      opts[i] = e.target.value;
      setQ({
        ...q,
        options: opts
      });
    }
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mb-1"
  }, "Categorize (optional)"), /*#__PURE__*/React.createElement(SubjectPicker, {
    value: {
      subjectId: q.subjectId,
      topicId: q.topicId,
      subtopicId: q.subtopicId
    },
    onChange: p => setQ({
      ...q,
      ...p
    }),
    allowEmpty: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, /*#__PURE__*/React.createElement(Select, {
    value: q.difficulty || 'easy',
    onChange: e => setQ({
      ...q,
      difficulty: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "easy"
  }, "Easy"), /*#__PURE__*/React.createElement("option", {
    value: "hard"
  }, "Hard")), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Tag",
    value: q.tag || '',
    onChange: e => setQ({
      ...q,
      tag: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: onCancel
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      if (!q.question.trim() || q.options.some(o => !o.trim())) {
        toast('Fill all fields', 'error');
        return;
      }
      onSave(q);
    }
  }, "Save")));
}
function BulkMCQ({
  onDone
}) {
  const [text, setText] = useState('');
  const [filter, setFilter] = useState({});
  const [diff, setDiff] = useState('easy');
  const example = `Q: What is the capital of Bangladesh?
A) Chittagong
B) Dhaka *
C) Sylhet
D) Rajshahi
---
Q: 2 + 2 = ?
A) 3
B) 4 *
C) 5
D) 6`;
  function parse() {
    const blocks = text.split(/^-{3,}$/m).map(b => b.trim()).filter(Boolean);
    const items = [];
    for (const b of blocks) {
      const lines = b.split(/\n+/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;
      const qLine = lines[0].replace(/^Q\s*[:.\-)]\s*/i, '');
      const opts = [];
      let correct = 0;
      lines.slice(1).forEach((l, i) => {
        let clean = l.replace(/^[A-Da-d1-4]\s*[\).:\-]\s*/, '');
        const star = /\*\s*$/.test(clean);
        if (star) {
          correct = opts.length;
          clean = clean.replace(/\*\s*$/, '').trim();
        }
        opts.push(clean);
      });
      if (opts.length >= 2) {
        items.push({
          id: uid(),
          question: qLine,
          options: opts.slice(0, 6),
          correct,
          difficulty: diff,
          ...filter
        });
      }
    }
    if (items.length === 0) {
      toast('Nothing parsed. Check format.', 'error');
      return;
    }
    onDone(items);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Paste multiple MCQs, separated by ", /*#__PURE__*/React.createElement("code", null, "---"), ". Mark the correct option with a trailing ", /*#__PURE__*/React.createElement("code", null, "*"), "."), /*#__PURE__*/React.createElement(FormatBlock, {
    text: example,
    label: "MCQ format"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mb-1"
  }, "Assign to (optional)"), /*#__PURE__*/React.createElement(SubjectPicker, {
    value: filter,
    onChange: p => setFilter({
      ...filter,
      ...p
    }),
    allowEmpty: true
  })), /*#__PURE__*/React.createElement(Select, {
    value: diff,
    onChange: e => setDiff(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "easy"
  }, "Easy"), /*#__PURE__*/React.createElement("option", {
    value: "hard"
  }, "Hard")), /*#__PURE__*/React.createElement(TextArea, {
    rows: "10",
    value: text,
    onChange: e => setText(e.target.value),
    placeholder: "Paste here..."
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: parse
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check"
  }), "Parse & Add")));
}
function QuizRunner({
  quiz,
  onDone
}) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const mcq = quiz.pool[idx];
  const [timeLeft, setTimeLeft] = useState(quiz.timePerQ || null);
  const [totalLeft, setTotalLeft] = useState(quiz.totalSec || null);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  useEffect(() => {
    if (!quiz.timePerQ) return;
    setTimeLeft(quiz.timePerQ);
    const t = setInterval(() => {
      setTimeLeft(x => {
        if (x <= 1) {
          clearInterval(t);
          pick(-1);
          return 0;
        }
        return x - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [idx]);
  useEffect(() => {
    if (!quiz.totalSec) return;
    const t = setInterval(() => {
      setTotalLeft(x => {
        if (x <= 1) {
          clearInterval(t);
          finishAll();
          return 0;
        }
        return x - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);
  function finishAll() {
    // fill remaining with unanswered
    const cur = answersRef.current;
    const rest = quiz.pool.slice(cur.length).map(m => ({
      mcq: m,
      chosen: -1,
      correct: false
    }));
    onDone([...cur, ...rest]);
  }
  function pick(i) {
    const a = {
      mcq,
      chosen: i,
      correct: i === mcq.correct
    };
    const next = [...answers, a];
    setAnswers(next);
    if (idx + 1 >= quiz.pool.length) onDone(next);else setIdx(idx + 1);
  }
  const mm = totalLeft !== null ? String(Math.floor(totalLeft / 60)).padStart(2, '0') + ':' + String(totalLeft % 60).padStart(2, '0') : null;
  return /*#__PURE__*/React.createElement(Card, {
    className: "p-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between mb-2 text-xs text-slate-500"
  }, /*#__PURE__*/React.createElement("span", null, "Question ", idx + 1, " / ", quiz.pool.length), /*#__PURE__*/React.createElement("span", {
    className: "flex gap-3"
  }, mm && /*#__PURE__*/React.createElement("span", {
    className: totalLeft <= 30 ? 'text-rose-600 font-semibold' : ''
  }, "Exam ⏱ ", mm), timeLeft !== null && /*#__PURE__*/React.createElement("span", {
    className: timeLeft <= 5 ? 'text-rose-600 font-semibold' : ''
  }, "Q ⏱ ", timeLeft, "s"))), /*#__PURE__*/React.createElement("div", {
    className: "text-lg font-medium"
  }, mcq.question), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2 mt-4"
  }, mcq.options.map((o, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => pick(i),
    className: "text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:bg-brand-50/40 dark:hover:bg-brand-950/30 transition"
  }, /*#__PURE__*/React.createElement("span", {
    className: "font-semibold text-brand-600 mr-2"
  }, String.fromCharCode(65 + i), "."), o))));
}
function QuizResult({
  quiz,
  onClose
}) {
  const score = quiz.answers.filter(a => a.correct).length;
  return /*#__PURE__*/React.createElement(Card, {
    className: "p-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-500"
  }, "Result"), /*#__PURE__*/React.createElement("div", {
    className: "text-4xl font-bold my-2"
  }, score, " / ", quiz.answers.length), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "+", score * 10, " XP earned")), /*#__PURE__*/React.createElement("div", {
    className: "mt-5 grid gap-2"
  }, quiz.answers.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: `p-3 rounded-xl border ${a.correct ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-rose-300 bg-rose-50/50 dark:bg-rose-950/20'}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium"
  }, a.mcq.question), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mt-1"
  }, "Your: ", a.chosen >= 0 ? a.mcq.options[a.chosen] : '—', " ", a.correct ? '✓' : `✗ — Correct: ${a.mcq.options[a.mcq.correct]}`)))), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 flex justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: onClose
  }, "Done")));
}

/* ---------- Exam engine ---------- */
function ExamView() {
  const {
    state,
    dispatch
  } = useVault();
  const [mode, setMode] = useState('config'); // config | quiz | result
  const [filter, setFilter] = useState({});
  const [difficulty, setDifficulty] = useState('');
  const [source, setSource] = useState('all'); // all | filter | mistakes
  const [count, setCount] = useState(10);
  const [timerMode, setTimerMode] = useState('none'); // none | perq | full
  const [timePerQ, setTimePerQ] = useState(30);
  const [totalMin, setTotalMin] = useState(15);
  const [quiz, setQuiz] = useState(null);
  function start() {
    let pool = [];
    if (source === 'mistakes') {
      pool = state.mistakeVault.map(m => m.mcq).filter(m => matchFilter(m, {
        ...filter,
        difficulty: difficulty || undefined
      }));
    } else if (source === 'all') {
      pool = state.mcqs.filter(m => !difficulty || m.difficulty === difficulty);
    } else {
      pool = state.mcqs.filter(m => matchFilter(m, {
        ...filter,
        difficulty: difficulty || undefined
      }));
    }
    if (pool.length === 0) {
      toast('No questions match.', 'error');
      return;
    }
    const n = Math.max(1, +count || 10);
    pool = [...pool].sort(() => Math.random() - .5).slice(0, Math.min(n, pool.length));
    setQuiz({
      pool,
      timePerQ: timerMode === 'perq' ? +timePerQ || 30 : null,
      totalSec: timerMode === 'full' ? (+totalMin || 15) * 60 : null
    });
    setMode('quiz');
  }
  if (mode === 'config') {
    return /*#__PURE__*/React.createElement("div", {
      className: "grid gap-4"
    }, /*#__PURE__*/React.createElement(Card, {
      className: "p-4 grid gap-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "font-medium"
    }, "Exam configuration"), /*#__PURE__*/React.createElement("div", {
      className: "grid md:grid-cols-3 gap-2"
    }, /*#__PURE__*/React.createElement("label", {
      className: "flex flex-col text-xs text-slate-500 gap-1"
    }, "Source", /*#__PURE__*/React.createElement(Select, {
      value: source,
      onChange: e => setSource(e.target.value)
    }, /*#__PURE__*/React.createElement("option", {
      value: "all"
    }, "Full mixed (all MCQs)"), /*#__PURE__*/React.createElement("option", {
      value: "filter"
    }, "Filtered (subject/topic/subtopic)"), /*#__PURE__*/React.createElement("option", {
      value: "mistakes"
    }, "Mistaken questions only"))), /*#__PURE__*/React.createElement("label", {
      className: "flex flex-col text-xs text-slate-500 gap-1"
    }, "Difficulty", /*#__PURE__*/React.createElement(Select, {
      value: difficulty,
      onChange: e => setDifficulty(e.target.value)
    }, /*#__PURE__*/React.createElement("option", {
      value: ""
    }, "Any"), /*#__PURE__*/React.createElement("option", {
      value: "easy"
    }, "Easy"), /*#__PURE__*/React.createElement("option", {
      value: "hard"
    }, "Hard"))), /*#__PURE__*/React.createElement("label", {
      className: "flex flex-col text-xs text-slate-500 gap-1"
    }, "Question count", /*#__PURE__*/React.createElement(Input, {
      type: "number",
      min: "1",
      max: "200",
      value: count,
      onChange: e => setCount(e.target.value)
    }))), (source === 'filter' || source === 'mistakes') && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-500 mb-1"
    }, source === 'mistakes' ? 'Narrow mistakes by' : 'Filter by', " Subject / Topic / Subtopic"), /*#__PURE__*/React.createElement(SubjectPicker, {
      value: filter,
      onChange: p => setFilter({
        ...filter,
        ...p
      }),
      allowEmpty: true
    })), /*#__PURE__*/React.createElement("div", {
      className: "grid md:grid-cols-3 gap-2 items-end"
    }, /*#__PURE__*/React.createElement("label", {
      className: "flex flex-col text-xs text-slate-500 gap-1"
    }, "Timer mode", /*#__PURE__*/React.createElement(Select, {
      value: timerMode,
      onChange: e => setTimerMode(e.target.value)
    }, /*#__PURE__*/React.createElement("option", {
      value: "none"
    }, "No timer"), /*#__PURE__*/React.createElement("option", {
      value: "perq"
    }, "Per question"), /*#__PURE__*/React.createElement("option", {
      value: "full"
    }, "Full exam time"))), timerMode === 'perq' && /*#__PURE__*/React.createElement("label", {
      className: "text-xs text-slate-500 flex flex-col gap-1"
    }, "Seconds / question", /*#__PURE__*/React.createElement(Input, {
      type: "number",
      min: "5",
      value: timePerQ,
      onChange: e => setTimePerQ(e.target.value)
    })), timerMode === 'full' && /*#__PURE__*/React.createElement("label", {
      className: "text-xs text-slate-500 flex flex-col gap-1"
    }, "Total minutes", /*#__PURE__*/React.createElement(Input, {
      type: "number",
      min: "1",
      value: totalMin,
      onChange: e => setTotalMin(e.target.value)
    }))), /*#__PURE__*/React.createElement("div", {
      className: "flex justify-end"
    }, /*#__PURE__*/React.createElement(Btn, {
      onClick: start
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "play"
    }), "Start Exam"))));
  }
  if (mode === 'quiz') return /*#__PURE__*/React.createElement(QuizRunner, {
    quiz: quiz,
    onDone: answers => {
      const score = answers.filter(a => a.correct).length;
      const attempt = {
        id: uid(),
        date: todayISO(),
        score,
        total: answers.length,
        source,
        filter: {
          ...filter
        },
        difficulty
      };
      dispatch({
        type: 'ADD_ITEM',
        key: 'attempts',
        item: attempt
      });
      // add new mistakes
      answers.filter(a => !a.correct).forEach(a => {
        if (!state.mistakeVault.find(x => x.mcqId === a.mcq.id)) dispatch({
          type: 'ADD_ITEM',
          key: 'mistakeVault',
          item: {
            id: uid(),
            mcqId: a.mcq.id,
            mcq: a.mcq,
            addedAt: todayISO()
          }
        });
      });
      // auto-remove mistakes answered correctly
      answers.filter(a => a.correct).forEach(a => {
        const mv = state.mistakeVault.find(x => x.mcqId === a.mcq.id);
        if (mv) dispatch({
          type: 'REMOVE_ITEM',
          key: 'mistakeVault',
          id: mv.id
        });
      });
      dispatch({
        type: 'ADD_XP',
        amount: score * 10
      });
      setQuiz({
        ...quiz,
        answers
      });
      setMode('result');
    }
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(QuizResult, {
    quiz: quiz,
    onClose: () => setMode('config')
  }));
}

/* ---------- Mistake Vault ---------- */
function MistakeView() {
  const {
    state,
    dispatch
  } = useVault();
  const [filter, setFilter] = useState({});
  const list = state.mistakeVault.filter(m => matchFilter(m.mcq, filter));
  if (state.mistakeVault.length === 0) return /*#__PURE__*/React.createElement(Empty, {
    icon: "alert-triangle",
    text: "No mistakes yet. Take a quiz to populate."
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-3"
  }, /*#__PURE__*/React.createElement(SubjectPicker, {
    value: filter,
    onChange: p => setFilter({
      ...filter,
      ...p
    }),
    allowEmpty: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Mistakes are removed automatically when answered correctly in an exam."), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, list.map(m => /*#__PURE__*/React.createElement(Card, {
    key: m.id,
    className: "p-3 flex items-start gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, m.mcq.question), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mt-1"
  }, "Correct: ", /*#__PURE__*/React.createElement("span", {
    className: "text-emerald-600"
  }, m.mcq.options[m.mcq.correct])), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-slate-400 mt-0.5"
  }, "Added ", m.addedAt)), /*#__PURE__*/React.createElement("button", {
    onClick: () => dispatch({
      type: 'REMOVE_ITEM',
      key: 'mistakeVault',
      id: m.id
    }),
    className: "p-1 text-rose-500",
    title: "Remove"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  }))))));
}

/* ---------- Flashcards ---------- */
function FlashcardsView() {
  const {
    state,
    dispatch
  } = useVault();
  const [add, setAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({});
  const [studying, setStudying] = useState(false);
  const list = state.flashcards.filter(c => matchFilter(c, filter));
  const due = list.filter(c => !c.due || c.due <= todayISO());
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-3 grid gap-2"
  }, /*#__PURE__*/React.createElement(SubjectPicker, {
    value: filter,
    onChange: p => setFilter({
      ...filter,
      ...p
    }),
    allowEmpty: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Select, {
    value: filter.difficulty || '',
    onChange: e => setFilter({
      ...filter,
      difficulty: e.target.value || undefined
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Any difficulty"), /*#__PURE__*/React.createElement("option", {
    value: "easy"
  }, "Easy"), /*#__PURE__*/React.createElement("option", {
    value: "hard"
  }, "Hard")), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setFilter({})
  }, "Clear"), /*#__PURE__*/React.createElement("span", {
    className: "ml-auto text-xs text-slate-500"
  }, list.length, " shown"))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      setEditing({
        id: uid(),
        front: '',
        back: '',
        ease: 2.5,
        interval: 0,
        due: todayISO(),
        difficulty: 'easy',
        ...filter
      });
      setAdd(true);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "New Card"), /*#__PURE__*/React.createElement(Btn, {
    variant: "subtle",
    disabled: due.length === 0,
    onClick: () => setStudying(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play"
  }), "Study (", due.length, " due)"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    onClick: () => setShowBulk(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload"
  }), "Bulk Add")), list.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    icon: "layers",
    text: "No flashcards match."
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-2"
  }, list.map(c => /*#__PURE__*/React.createElement(FlashTile, {
    key: c.id,
    c: c,
    subject: c.subjectId ? subjectName(state, c.subjectId) : null,
    onEdit: () => { setEditing(c); setAdd(true); },
    onDelete: () => dispatch({ type: 'REMOVE_ITEM', key: 'flashcards', id: c.id })
  }))), /*#__PURE__*/React.createElement(Modal, {
    open: add,
    onClose: () => {
      setAdd(false);
      setEditing(null);
    },
    title: editing && state.flashcards.find(f => f.id === editing.id) ? 'Edit flashcard' : 'New flashcard',
    wide: true
  }, editing && /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Front",
    value: editing.front,
    onChange: e => setEditing({
      ...editing,
      front: e.target.value
    })
  }), /*#__PURE__*/React.createElement(TextArea, {
    placeholder: "Back",
    rows: "3",
    value: editing.back,
    onChange: e => setEditing({
      ...editing,
      back: e.target.value
    })
  }), /*#__PURE__*/React.createElement(SubjectPicker, {
    value: editing,
    onChange: p => setEditing({
      ...editing,
      ...p
    }),
    allowEmpty: true
  }), /*#__PURE__*/React.createElement(Select, {
    value: editing.difficulty || 'easy',
    onChange: e => setEditing({
      ...editing,
      difficulty: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "easy"
  }, "Easy"), /*#__PURE__*/React.createElement("option", {
    value: "hard"
  }, "Hard")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2 mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      setAdd(false);
      setEditing(null);
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      if (!editing.front || !editing.back) return;
      const exists = state.flashcards.find(x => x.id === editing.id);
      if (exists) dispatch({
        type: 'UPDATE_ITEM',
        key: 'flashcards',
        item: editing
      });else dispatch({
        type: 'ADD_ITEM',
        key: 'flashcards',
        item: editing
      });
      setAdd(false);
      setEditing(null);
    }
  }, "Save")))), /*#__PURE__*/React.createElement(Modal, {
    open: showBulk,
    onClose: () => setShowBulk(false),
    title: "Bulk add Flashcards",
    wide: true
  }, /*#__PURE__*/React.createElement(BulkFlash, {
    onDone: items => {
      dispatch({
        type: 'ADD_MANY',
        key: 'flashcards',
        items
      });
      setShowBulk(false);
      toast(`Added ${items.length} cards`, 'success');
    }
  })), studying && /*#__PURE__*/React.createElement(StudyRunner, {
    cards: due,
    onExit: () => setStudying(false)
  }));
}

// Inline flash list for Subjects drill
function FlashTile({ c, subject, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const isDue = !c.due || c.due <= todayISO();
  return /*#__PURE__*/React.createElement("div", {
    className: "fc-tile",
    onClick: () => setOpen(!open)
  }, /*#__PURE__*/React.createElement("div", { className: "flex items-center gap-2 mb-2" },
    /*#__PURE__*/React.createElement("span", { className: "fc-dot " + (c.difficulty === 'hard' ? 'is-hard' : '') }),
    subject && /*#__PURE__*/React.createElement("span", { className: "text-[11px] text-slate-500 truncate" }, subject),
    /*#__PURE__*/React.createElement("span", { className: "ml-auto text-[11px] " + (isDue ? 'text-brand-600 font-medium' : 'text-slate-400') }, isDue ? 'Due' : c.due)),
    /*#__PURE__*/React.createElement("div", { className: "font-bn text-[15px] font-medium leading-snug text-slate-900 dark:text-slate-100 whitespace-pre-wrap" }, c.front),
    open ? /*#__PURE__*/React.createElement("div", { className: "fc-answer font-bn whitespace-pre-wrap" }, c.back)
         : /*#__PURE__*/React.createElement("div", { className: "mt-2 text-[11px] text-slate-400" }, "Tap to reveal"),
    open && /*#__PURE__*/React.createElement("div", { className: "mt-3 flex gap-1 justify-end", onClick: e => e.stopPropagation() },
      /*#__PURE__*/React.createElement("button", { onClick: onEdit, className: "fc-act" }, /*#__PURE__*/React.createElement(Icon, { name: "pencil", size: 14 })),
      /*#__PURE__*/React.createElement("button", { onClick: () => { if (confirm('Delete this card?')) onDelete(); }, className: "fc-act text-rose-500" }, /*#__PURE__*/React.createElement(Icon, { name: "trash-2", size: 14 }))));
}
function FlashList({
  filter
}) {
  const {
    state,
    dispatch
  } = useVault();
  const list = state.flashcards.filter(c => matchFilter(c, filter));
  const [editing, setEditing] = useState(null);
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setEditing({
      id: uid(),
      front: '',
      back: '',
      ease: 2.5,
      interval: 0,
      due: todayISO(),
      difficulty: 'easy',
      ...filter
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add Card")), list.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    icon: "layers",
    text: "No flashcards here yet."
  }), list.map(c => /*#__PURE__*/React.createElement(FlashTile, {
    key: c.id,
    c: c,
    onEdit: () => setEditing(c),
    onDelete: () => dispatch({ type: 'REMOVE_ITEM', key: 'flashcards', id: c.id })
  })), editing && /*#__PURE__*/React.createElement(Modal, {
    open: true,
    onClose: () => setEditing(null),
    title: "Flashcard",
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Front",
    value: editing.front,
    onChange: e => setEditing({
      ...editing,
      front: e.target.value
    })
  }), /*#__PURE__*/React.createElement(TextArea, {
    rows: "3",
    placeholder: "Back",
    value: editing.back,
    onChange: e => setEditing({
      ...editing,
      back: e.target.value
    })
  }), /*#__PURE__*/React.createElement(SubjectPicker, {
    value: editing,
    onChange: p => setEditing({
      ...editing,
      ...p
    }),
    allowEmpty: true
  }), /*#__PURE__*/React.createElement(Select, {
    value: editing.difficulty || 'easy',
    onChange: e => setEditing({
      ...editing,
      difficulty: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "easy"
  }, "Easy"), /*#__PURE__*/React.createElement("option", {
    value: "hard"
  }, "Hard")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setEditing(null)
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      const exists = state.flashcards.find(x => x.id === editing.id);
      if (exists) dispatch({
        type: 'UPDATE_ITEM',
        key: 'flashcards',
        item: editing
      });else dispatch({
        type: 'ADD_ITEM',
        key: 'flashcards',
        item: editing
      });
      setEditing(null);
    }
  }, "Save")))));
}
function BulkFlash({
  onDone
}) {
  const [text, setText] = useState('');
  const [filter, setFilter] = useState({});
  const [diff, setDiff] = useState('easy');
  const example = `Front :: Back
Bangla capital :: Dhaka
Speed of light :: 3x10^8 m/s`;
  function parse() {
    const items = text.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
      const [f, b] = l.split(/::|\|/).map(s => s?.trim());
      if (!f || !b) return null;
      return {
        id: uid(),
        front: f,
        back: b,
        ease: 2.5,
        interval: 0,
        due: todayISO(),
        difficulty: diff,
        ...filter
      };
    }).filter(Boolean);
    if (!items.length) {
      toast('Nothing parsed', 'error');
      return;
    }
    onDone(items);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "One card per line. Separate front and back with ", /*#__PURE__*/React.createElement("code", null, "::"), " or ", /*#__PURE__*/React.createElement("code", null, "|"), "."), /*#__PURE__*/React.createElement(FormatBlock, {
    text: example,
    label: "Flashcard format"
  }), /*#__PURE__*/React.createElement(SubjectPicker, {
    value: filter,
    onChange: p => setFilter({
      ...filter,
      ...p
    }),
    allowEmpty: true
  }), /*#__PURE__*/React.createElement(Select, {
    value: diff,
    onChange: e => setDiff(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "easy"
  }, "Easy"), /*#__PURE__*/React.createElement("option", {
    value: "hard"
  }, "Hard")), /*#__PURE__*/React.createElement(TextArea, {
    rows: "8",
    value: text,
    onChange: e => setText(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: parse
  }, "Parse & Add")));
}
function StudyRunner({
  cards,
  onExit
}) {
  const {
    dispatch
  } = useVault();
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  if (i >= cards.length) {
    return /*#__PURE__*/React.createElement(Modal, {
      open: true,
      onClose: onExit,
      title: "Study complete"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-center py-6"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-4xl"
    }, "🎉"), /*#__PURE__*/React.createElement("div", {
      className: "mt-2"
    }, "Reviewed ", cards.length, " cards.")), /*#__PURE__*/React.createElement("div", {
      className: "flex justify-end"
    }, /*#__PURE__*/React.createElement(Btn, {
      onClick: onExit
    }, "Done")));
  }
  const c = cards[i];
  function grade(q) {
    let ease = c.ease || 2.5,
      interval = c.interval || 0;
    if (q === 0) {
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
    } else if (q === 1) {
      interval = Math.max(1, Math.round((interval || 1) * 1.2));
      ease = Math.max(1.3, ease - 0.15);
    } else if (q === 2) {
      interval = interval === 0 ? 1 : Math.round(interval * ease);
    } else {
      interval = interval === 0 ? 3 : Math.round(interval * ease * 1.3);
      ease += 0.15;
    }
    const due = new Date(Date.now() + interval * 86400000).toISOString().slice(0, 10);
    dispatch({
      type: 'UPDATE_ITEM',
      key: 'flashcards',
      item: {
        ...c,
        ease,
        interval,
        due
      }
    });
    dispatch({
      type: 'ADD_XP',
      amount: q >= 2 ? 4 : 2
    });
    setFlip(false);
    setI(i + 1);
  }
  const pct = Math.round(i / cards.length * 100);
  const face = (label, text, back) => /*#__PURE__*/React.createElement("div", {
    className: "flip-face " + (back ? 'flip-back fc-face-back' : 'fc-face-front')
  }, /*#__PURE__*/React.createElement("span", { className: "fc-label" }, label), /*#__PURE__*/React.createElement("div", {
    className: "font-bn text-xl leading-relaxed font-medium whitespace-pre-wrap max-h-full overflow-auto"
  }, text));
  const gbtn = (q, label, sub, cls) => /*#__PURE__*/React.createElement("button", {
    onClick: () => grade(q), className: "fc-grade " + cls
  }, /*#__PURE__*/React.createElement("span", { className: "text-sm font-semibold" }, label), /*#__PURE__*/React.createElement("span", { className: "text-[10px] opacity-70" }, sub));
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-[120] fc-study flex flex-col",
    "data-native-overlay": "1"
  }, /*#__PURE__*/React.createElement("div", { className: "flex items-center gap-3 px-4 pt-4 pb-3", style: { paddingTop: 'max(1rem, env(safe-area-inset-top))' } },
    /*#__PURE__*/React.createElement("button", { onClick: onExit, className: "fc-act" }, /*#__PURE__*/React.createElement(Icon, { name: "x", size: 18 })),
    /*#__PURE__*/React.createElement("div", { className: "flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden" }, /*#__PURE__*/React.createElement("div", { className: "h-full bg-brand-600 transition-all", style: { width: pct + '%' } })),
    /*#__PURE__*/React.createElement("span", { className: "text-xs tabular-nums text-slate-500" }, i + 1, "/", cards.length)),
  /*#__PURE__*/React.createElement("div", { className: "flex-1 flex items-center px-5" }, /*#__PURE__*/React.createElement("div", {
    className: "flip-scene w-full", onClick: () => setFlip(!flip)
  }, /*#__PURE__*/React.createElement("div", { className: "flip-card fc-big " + (flip ? 'is-flipped' : '') }, face('প্রশ্ন', c.front, false), face('উত্তর', c.back, true)))),
  /*#__PURE__*/React.createElement("div", { className: "px-4 pb-6", style: { paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' } },
    flip ? /*#__PURE__*/React.createElement("div", { className: "grid grid-cols-4 gap-2" },
      gbtn(0, 'Again', '1d', 'g-again'), gbtn(1, 'Hard', 'kom', 'g-hard'), gbtn(2, 'Good', 'thik', 'g-good'), gbtn(3, 'Easy', 'shohoj', 'g-easy'))
    : /*#__PURE__*/React.createElement("button", { onClick: () => setFlip(true), className: "w-full py-3.5 rounded-2xl bg-brand-600 text-white font-medium" }, "উত্তর দেখুন")));
}

/* ---------- Information ---------- */
function InfoList({
  filter
}) {
  const {
    state,
    dispatch
  } = useVault();
  const [editing, setEditing] = useState(null);
  const list = state.information.filter(m => matchFilter(m, filter));
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setEditing({
      id: uid(),
      title: '',
      body: '',
      difficulty: 'easy',
      ...filter
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add Info")), list.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    icon: "info",
    text: "No information notes here yet."
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-2"
  }, list.map(inf => /*#__PURE__*/React.createElement(Card, {
    key: inf.id,
    className: "p-3 cursor-pointer",
    onClick: () => setEditing(inf)
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, inf.title || 'Untitled'), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 whitespace-pre-wrap line-clamp-3 mt-1"
  }, inf.body), inf.difficulty && /*#__PURE__*/React.createElement(Chip, {
    tone: inf.difficulty === 'hard' ? 'rose' : 'emerald',
    className: "mt-1"
  }, inf.difficulty)))), editing && /*#__PURE__*/React.createElement(Modal, {
    open: true,
    onClose: () => setEditing(null),
    title: "Information",
    wide: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Title",
    value: editing.title,
    onChange: e => setEditing({
      ...editing,
      title: e.target.value
    })
  }), /*#__PURE__*/React.createElement(TextArea, {
    rows: "10",
    placeholder: "Content...",
    value: editing.body,
    onChange: e => setEditing({
      ...editing,
      body: e.target.value
    })
  }), /*#__PURE__*/React.createElement(SubjectPicker, {
    value: editing,
    onChange: p => setEditing({
      ...editing,
      ...p
    }),
    allowEmpty: true
  }), /*#__PURE__*/React.createElement(Select, {
    value: editing.difficulty || 'easy',
    onChange: e => setEditing({
      ...editing,
      difficulty: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "easy"
  }, "Easy"), /*#__PURE__*/React.createElement("option", {
    value: "hard"
  }, "Hard")), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: () => {
      dispatch({
        type: 'REMOVE_ITEM',
        key: 'information',
        id: editing.id
      });
      setEditing(null);
    }
  }, "Delete"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setEditing(null)
  }, "Close"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      const item = {
        ...editing,
        updated: todayISO()
      };
      const exists = state.information.find(x => x.id === editing.id);
      if (exists) dispatch({
        type: 'UPDATE_ITEM',
        key: 'information',
        item
      });else dispatch({
        type: 'ADD_ITEM',
        key: 'information',
        item
      });
      setEditing(null);
    }
  }, "Save"))))));
}

/* ---------- Schedule (bulk + edit) ---------- */
function ScheduleView() {
  const {
    state,
    dispatch
  } = useVault();
  const [add, setAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({});
  const list = state.schedule.filter(s => matchFilter(s, filter));
  const grouped = useMemo(() => {
    const g = {};
    list.forEach(s => {
      const d = s.day != null ? s.day : new Date(s.date || todayISO()).getDay();
      (g[d] = g[d] || []).push(s);
    });
    return DAY_ORDER.filter(d => g[d]).map(d => [d, g[d]]);
  }, [list]);
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-3"
  }, /*#__PURE__*/React.createElement(SubjectPicker, {
    value: filter,
    onChange: p => setFilter({
      ...filter,
      ...p
    }),
    allowEmpty: true
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      setEditing({
        id: uid(),
        title: '',
        day: todayDow(),
        time: '',
        notes: '',
        ...filter
      });
      setAdd(true);
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add event"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    onClick: () => setShowBulk(true)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload"
  }), "Bulk Add (7-day)")), grouped.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    icon: "calendar-days",
    text: "No scheduled items."
  }), grouped.map(([day, items]) => /*#__PURE__*/React.createElement(Card, {
    key: day,
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold mb-2"
  }, DAY_NAMES[day], " ", day === todayDow() && /*#__PURE__*/React.createElement(Chip, {
    tone: "brand",
    className: "ml-1"
  }, "TODAY")), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, items.sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    className: "flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-14 text-xs text-slate-500"
  }, s.time || '—'), /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium text-sm"
  }, s.title), s.notes && /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, s.notes)), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setEditing({
        ...s,
        day: s.day != null ? s.day : new Date(s.date || todayISO()).getDay()
      });
      setAdd(true);
    },
    className: "p-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => dispatch({
      type: 'REMOVE_ITEM',
      key: 'schedule',
      id: s.id
    }),
    className: "text-rose-500 p-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  }))))))), /*#__PURE__*/React.createElement(Modal, {
    open: add,
    onClose: () => {
      setAdd(false);
      setEditing(null);
    },
    title: state.schedule.find(x => x.id === editing?.id) ? 'Edit event' : 'New event'
  }, editing && /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Title",
    value: editing.title,
    onChange: e => setEditing({
      ...editing,
      title: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2"
  }, /*#__PURE__*/React.createElement("select", {
    className: "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2",
    value: editing.day,
    onChange: e => setEditing({
      ...editing,
      day: +e.target.value,
      date: undefined
    })
  }, DAY_ORDER.map(d => /*#__PURE__*/React.createElement("option", {
    key: d,
    value: d
  }, DAY_NAMES[d]))), /*#__PURE__*/React.createElement(Input, {
    type: "time",
    value: editing.time || '',
    onChange: e => setEditing({
      ...editing,
      time: e.target.value
    })
  })), /*#__PURE__*/React.createElement(SubjectPicker, {
    value: editing,
    onChange: p => setEditing({
      ...editing,
      ...p
    }),
    allowEmpty: true
  }), /*#__PURE__*/React.createElement(TextArea, {
    rows: "2",
    placeholder: "Notes",
    value: editing.notes || '',
    onChange: e => setEditing({
      ...editing,
      notes: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      setAdd(false);
      setEditing(null);
    }
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      if (!editing.title) return;
      const it = {
        ...editing
      };
      delete it.date;
      const exists = state.schedule.find(x => x.id === editing.id);
      if (exists) dispatch({
        type: 'UPDATE_ITEM',
        key: 'schedule',
        item: it
      });else dispatch({
        type: 'ADD_ITEM',
        key: 'schedule',
        item: it
      });
      setAdd(false);
      setEditing(null);
    }
  }, "Save")))), /*#__PURE__*/React.createElement(Modal, {
    open: showBulk,
    onClose: () => setShowBulk(false),
    title: "Bulk add weekly schedule",
    wide: true
  }, /*#__PURE__*/React.createElement(BulkSchedule, {
    onDone: items => {
      dispatch({
        type: 'ADD_MANY',
        key: 'schedule',
        items
      });
      setShowBulk(false);
      toast(`Added ${items.length} events`, 'success');
    }
  })));
}
function BulkSchedule({
  onDone
}) {
  const [text, setText] = useState('');
  const example = `Saturday
09:00 Math practice
11:00 English reading
Sunday
10:00 Physics MCQ
15:00 History revision
Monday
09:30 Bio flashcards`;
  function dayFromName(s) {
    const l = s.toLowerCase();
    const idx = DAY_NAMES.findIndex(n => n.toLowerCase() === l || n.toLowerCase().startsWith(l));
    return idx;
  }
  function parse() {
    const items = [];
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    let day = todayDow();
    for (const l of lines) {
      const dm = dayFromName(l);
      if (dm >= 0) {
        day = dm;
        continue;
      }
      const tm = l.match(/^(\d{1,2}):(\d{2})\s+(.+)$/);
      if (tm) {
        const hh = String(tm[1]).padStart(2, '0');
        items.push({
          id: uid(),
          title: tm[3].trim(),
          day,
          time: `${hh}:${tm[2]}`,
          notes: ''
        });
      }
    }
    if (!items.length) {
      toast('Nothing parsed', 'error');
      return;
    }
    onDone(items);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Use day names (", /*#__PURE__*/React.createElement("code", null, "Saturday"), ", ", /*#__PURE__*/React.createElement("code", null, "Sunday"), ", ...) as headers. Each event: ", /*#__PURE__*/React.createElement("code", null, "HH:MM Title"), "."), /*#__PURE__*/React.createElement(FormatBlock, {
    text: example,
    label: "Schedule format"
  }), /*#__PURE__*/React.createElement(TextArea, {
    rows: "10",
    value: text,
    onChange: e => setText(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: parse
  }, "Parse & Add")));
}

/* ---------- To-dos (edit + due time) ---------- */
function TodosView() {
  const {
    state,
    dispatch
  } = useVault();
  const [title, setTitle] = useState('');
  const [pri, setPri] = useState('med');
  const [due, setDue] = useState('');
  const [time, setTime] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const list = state.todos.filter(t => filter === 'all' ? true : filter === 'open' ? !t.done : t.done);
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-[1fr_100px_130px_110px_auto] gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "What needs doing?",
    value: title,
    onChange: e => setTitle(e.target.value)
  }), /*#__PURE__*/React.createElement(Select, {
    value: pri,
    onChange: e => setPri(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "low"
  }, "Low"), /*#__PURE__*/React.createElement("option", {
    value: "med"
  }, "Medium"), /*#__PURE__*/React.createElement("option", {
    value: "high"
  }, "High")), /*#__PURE__*/React.createElement(Input, {
    type: "date",
    value: due,
    onChange: e => setDue(e.target.value)
  }), /*#__PURE__*/React.createElement(Input, {
    type: "time",
    value: time,
    onChange: e => setTime(e.target.value)
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      if (!title.trim()) return;
      dispatch({
        type: 'ADD_ITEM',
        key: 'todos',
        item: {
          id: uid(),
          title,
          priority: pri,
          due,
          time,
          done: false,
          createdAt: todayISO()
        }
      });
      setTitle('');
      setDue('');
      setTime('');
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add"))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 text-sm"
  }, ['all', 'open', 'done'].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    onClick: () => setFilter(f),
    className: `px-3 py-1 rounded-full ${filter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`
  }, f))), list.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    icon: "check-square",
    text: "Nothing here."
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, list.map(t => /*#__PURE__*/React.createElement(Card, {
    key: t.id,
    className: "p-3 flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: t.done,
    onChange: () => {
      const done = !t.done;
      dispatch({
        type: 'UPDATE_ITEM',
        key: 'todos',
        item: {
          ...t,
          done
        }
      });
      if (done) dispatch({
        type: 'ADD_XP',
        amount: 5
      });
    },
    className: "w-4 h-4 accent-brand-600"
  }), /*#__PURE__*/React.createElement("div", {
    className: 'flex-1 ' + (t.done ? 'line-through text-slate-400' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium"
  }, t.title), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-slate-500 flex gap-2"
  }, /*#__PURE__*/React.createElement(Chip, {
    tone: t.priority === 'high' ? 'rose' : t.priority === 'med' ? 'amber' : 'slate'
  }, t.priority), t.due && /*#__PURE__*/React.createElement("span", null, "Due ", t.due, " ", t.time || ''))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditing(t),
    className: "p-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => dispatch({
      type: 'REMOVE_ITEM',
      key: 'todos',
      id: t.id
    }),
    className: "text-rose-500 p-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  }))))), /*#__PURE__*/React.createElement(Modal, {
    open: !!editing,
    onClose: () => setEditing(null),
    title: "Edit to-do"
  }, editing && /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    value: editing.title,
    onChange: e => setEditing({
      ...editing,
      title: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2"
  }, /*#__PURE__*/React.createElement(Select, {
    value: editing.priority,
    onChange: e => setEditing({
      ...editing,
      priority: e.target.value
    })
  }, /*#__PURE__*/React.createElement("option", {
    value: "low"
  }, "Low"), /*#__PURE__*/React.createElement("option", {
    value: "med"
  }, "Medium"), /*#__PURE__*/React.createElement("option", {
    value: "high"
  }, "High")), /*#__PURE__*/React.createElement(Input, {
    type: "date",
    value: editing.due || '',
    onChange: e => setEditing({
      ...editing,
      due: e.target.value
    })
  }), /*#__PURE__*/React.createElement(Input, {
    type: "time",
    value: editing.time || '',
    onChange: e => setEditing({
      ...editing,
      time: e.target.value
    })
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setEditing(null)
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      dispatch({
        type: 'UPDATE_ITEM',
        key: 'todos',
        item: editing
      });
      setEditing(null);
    }
  }, "Save")))));
}

/* ---------- Notes (subject/topic/subtopic + preview cards) ---------- */
function NotesView() {
  const {
    state,
    dispatch
  } = useVault();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState({});
  const list = state.notes.filter(n => matchFilter(n, filter) && (!q || (n.title + ' ' + n.body + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase())));
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-3 grid gap-2"
  }, /*#__PURE__*/React.createElement(SubjectPicker, {
    value: filter,
    onChange: p => setFilter({
      ...filter,
      ...p
    }),
    allowEmpty: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search notes...",
    value: q,
    onChange: e => setQ(e.target.value)
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setEditing({
      id: uid(),
      title: '',
      body: '',
      tags: [],
      updated: todayISO(),
      ...filter
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "New"))), list.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    icon: "notebook-pen",
    text: "No notes match."
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 lg:grid-cols-3 gap-3"
  }, list.map(n => /*#__PURE__*/React.createElement(Card, {
    key: n.id,
    className: "p-4 cursor-pointer hover:border-brand-400 transition group",
    onClick: () => setEditing(n)
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-start justify-between"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-semibold"
  }, n.title || 'Untitled'), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    className: "text-slate-300 group-hover:text-brand-600"
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 whitespace-pre-wrap line-clamp-4 mt-2 min-h-[3.5em]"
  }, n.body), /*#__PURE__*/React.createElement("div", {
    className: "mt-2 flex gap-1 flex-wrap"
  }, n.subjectId && /*#__PURE__*/React.createElement(Chip, {
    tone: "brand"
  }, subjectName(state, n.subjectId)), n.topicId && /*#__PURE__*/React.createElement(Chip, null, topicName(state, n.subjectId, n.topicId)), n.subtopicId && /*#__PURE__*/React.createElement(Chip, null, subtopicName(state, n.subjectId, n.topicId, n.subtopicId)), (n.tags || []).map(t => /*#__PURE__*/React.createElement(Chip, {
    key: t
  }, "#", t))), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-slate-400 mt-2"
  }, "Updated ", n.updated)))), editing && /*#__PURE__*/React.createElement(Modal, {
    open: true,
    onClose: () => setEditing(null),
    title: "Note",
    xl: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Title",
    value: editing.title,
    onChange: e => setEditing({
      ...editing,
      title: e.target.value
    })
  }), /*#__PURE__*/React.createElement(SubjectPicker, {
    value: editing,
    onChange: p => setEditing({
      ...editing,
      ...p
    }),
    allowEmpty: true
  }), /*#__PURE__*/React.createElement(TextArea, {
    rows: "14",
    placeholder: "Write here...",
    value: editing.body,
    onChange: e => setEditing({
      ...editing,
      body: e.target.value
    })
  }), /*#__PURE__*/React.createElement(Input, {
    placeholder: "tags (comma separated)",
    value: (editing.tags || []).join(', '),
    onChange: e => setEditing({
      ...editing,
      tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-between"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: () => {
      dispatch({
        type: 'REMOVE_ITEM',
        key: 'notes',
        id: editing.id
      });
      setEditing(null);
    }
  }, "Delete"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setEditing(null)
  }, "Close"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      const exists = state.notes.find(x => x.id === editing.id);
      const item = {
        ...editing,
        updated: todayISO()
      };
      if (exists) dispatch({
        type: 'UPDATE_ITEM',
        key: 'notes',
        item
      });else dispatch({
        type: 'ADD_ITEM',
        key: 'notes',
        item
      });
      setEditing(null);
    }
  }, "Save"))))));
}

/* ---------- Habits (edit) ---------- */
function HabitsView() {
  const {
    state,
    dispatch
  } = useVault();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  function toggle(h) {
    const today = todayISO();
    const log = new Set(h.log || []);
    if (log.has(today)) log.delete(today);else {
      log.add(today);
      dispatch({
        type: 'ADD_XP',
        amount: 6
      });
    }
    dispatch({
      type: 'UPDATE_ITEM',
      key: 'habits',
      item: {
        ...h,
        log: [...log]
      }
    });
  }
  const days = useMemo(() => Array.from({
    length: 14
  }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  }), []);
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-3 flex gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "New habit (e.g. Read 20 pages)",
    value: name,
    onChange: e => setName(e.target.value)
  }), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      if (!name.trim()) return;
      dispatch({
        type: 'ADD_ITEM',
        key: 'habits',
        item: {
          id: uid(),
          name,
          log: []
        }
      });
      setName('');
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "Add")), state.habits.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    icon: "repeat",
    text: "No habits yet."
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, state.habits.map(h => /*#__PURE__*/React.createElement(Card, {
    key: h.id,
    className: "p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => toggle(h),
    className: `w-9 h-9 rounded-xl flex items-center justify-center ${h.log.includes(todayISO()) ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium"
  }, h.name), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, h.log.length, " check-ins")), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditing(h),
    className: "p-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => dispatch({
      type: 'REMOVE_ITEM',
      key: 'habits',
      id: h.id
    }),
    className: "text-rose-500 p-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  }))), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 flex gap-1"
  }, days.map(d => {
    const on = h.log.includes(d);
    return /*#__PURE__*/React.createElement("div", {
      key: d,
      title: d,
      className: `flex-1 h-4 rounded ${on ? 'bg-emerald-500' : 'bg-slate-100 dark:bg-slate-800'}`
    });
  }))))), /*#__PURE__*/React.createElement(Modal, {
    open: !!editing,
    onClose: () => setEditing(null),
    title: "Edit habit"
  }, editing && /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    value: editing.name,
    onChange: e => setEditing({
      ...editing,
      name: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setEditing(null)
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      dispatch({
        type: 'UPDATE_ITEM',
        key: 'habits',
        item: editing
      });
      setEditing(null);
    }
  }, "Save")))));
}

/* ---------- Alarms ---------- */
function AlarmView() {
  const {
    state,
    dispatch
  } = useVault();
  const [editing, setEditing] = useState(null);
  const [test, setTest] = useState('Classic Bell');
  const ringtones = AudioEngine.ringtones();
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-3 flex flex-wrap gap-2 items-center"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => setEditing({
      id: uid(),
      time: '07:00',
      label: 'Wake up',
      ringtone: 'Classic Bell',
      active: true,
      days: [0, 1, 2, 3, 4, 5, 6]
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus"
  }), "New Alarm"), /*#__PURE__*/React.createElement("div", {
    className: "ml-auto flex items-center gap-2"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-slate-500"
  }, "Test:"), /*#__PURE__*/React.createElement(Select, {
    value: test,
    onChange: e => setTest(e.target.value)
  }, ringtones.map(r => /*#__PURE__*/React.createElement("option", {
    key: r
  }, r))), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    onClick: () => AudioEngine.playRingtone(test, 1)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play"
  }), "Preview"), /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => AudioEngine.stopAlarm()
  }, "Stop"))), state.alarms.length === 0 && /*#__PURE__*/React.createElement(Empty, {
    icon: "alarm-clock",
    text: "No alarms yet."
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-2"
  }, state.alarms.map(a => /*#__PURE__*/React.createElement(Card, {
    key: a.id,
    className: "p-4 flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-12 h-12 rounded-xl flex items-center justify-center " + (a.active ? 'grad-premium text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400')
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alarm-clock",
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold tabular-nums"
  }, a.time), /*#__PURE__*/React.createElement("div", {
    className: "text-sm"
  }, a.label), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, a.ringtone, " · ", (a.days || []).length === 7 ? 'Every day' : (a.days || []).map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') || 'Once')), /*#__PURE__*/React.createElement("label", {
    className: "text-xs flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: a.active,
    onChange: e => dispatch({
      type: 'UPDATE_ITEM',
      key: 'alarms',
      item: {
        ...a,
        active: e.target.checked
      }
    }),
    className: "accent-brand-600"
  }), "on"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setEditing(a),
    className: "p-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "pencil",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => dispatch({
      type: 'REMOVE_ITEM',
      key: 'alarms',
      id: a.id
    }),
    className: "text-rose-500 p-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  }))))), /*#__PURE__*/React.createElement(Modal, {
    open: !!editing,
    onClose: () => setEditing(null),
    title: "Alarm"
  }, editing && /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Label",
    value: editing.label,
    onChange: e => setEditing({
      ...editing,
      label: e.target.value
    })
  }), /*#__PURE__*/React.createElement(Input, {
    type: "time",
    value: editing.time,
    onChange: e => setEditing({
      ...editing,
      time: e.target.value
    })
  }), /*#__PURE__*/React.createElement(Select, {
    value: editing.ringtone,
    onChange: e => setEditing({
      ...editing,
      ringtone: e.target.value
    })
  }, ringtones.map(r => /*#__PURE__*/React.createElement("option", {
    key: r
  }, r))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mb-1"
  }, "Repeat days"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-1"
  }, ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => {
    const on = (editing.days || []).includes(i);
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => {
        const s = new Set(editing.days || []);
        if (on) s.delete(i);else s.add(i);
        setEditing({
          ...editing,
          days: [...s].sort()
        });
      },
      className: "w-8 h-8 rounded-lg text-xs " + (on ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800')
    }, d);
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => setEditing(null)
  }, "Cancel"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      const exists = state.alarms.find(x => x.id === editing.id);
      if (exists) dispatch({
        type: 'UPDATE_ITEM',
        key: 'alarms',
        item: editing
      });else dispatch({
        type: 'ADD_ITEM',
        key: 'alarms',
        item: editing
      });
      setEditing(null);
    }
  }, "Save")))));
}

/* ---------- Timer ---------- */
function TimerView() {
  const {
    dispatch
  } = useVault();
  const [work, setWork] = useState(25);
  const [brk, setBrk] = useState(5);
  const [mode, setMode] = useState('idle');
  const [remaining, setRemaining] = useState(25 * 60);
  const [sound, setSound] = useState('off');
  const [vol, setVol] = useState(0.15);
  const tickRef = useRef();
  useEffect(() => {
    AudioEngine.volume(vol);
  }, [vol]);
  useEffect(() => {
    if (mode === 'idle') return;
    tickRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(tickRef.current);
          if (mode === 'work') {
            dispatch({
              type: 'ADD_ITEM',
              key: 'timerSessions',
              item: {
                id: uid(),
                date: todayISO(),
                minutes: work
              }
            });
            dispatch({
              type: 'ADD_XP',
              amount: work
            });
            toast('Work session complete!', 'success');
            setMode('break');
            return brk * 60;
          } else {
            toast('Break over — back to it!', 'success');
            setMode('idle');
            return work * 60;
          }
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [mode]);
  function start() {
    setRemaining(work * 60);
    setMode('work');
  }
  function stop() {
    clearInterval(tickRef.current);
    setMode('idle');
    setRemaining(work * 60);
  }
  function pickSound(s) {
    setSound(s);
    if (s === 'off') AudioEngine.stop();else if (s === 'white') AudioEngine.whiteNoise();else if (s === 'brown') AudioEngine.brownNoise();else if (s === 'focus') AudioEngine.binaural(200, 10);else if (s === 'relax') AudioEngine.binaural(180, 6);
  }
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-6 text-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs uppercase tracking-widest text-slate-400"
  }, mode === 'idle' ? 'Ready' : mode), /*#__PURE__*/React.createElement("div", {
    className: "text-6xl font-bold my-4 tabular-nums"
  }, mm, ":", ss), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-center gap-2"
  }, mode === 'idle' ? /*#__PURE__*/React.createElement(Btn, {
    onClick: start
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "play"
  }), "Start") : /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: stop
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "square"
  }), "Stop")), /*#__PURE__*/React.createElement("div", {
    className: "mt-6 grid grid-cols-2 gap-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "text-xs text-slate-500 text-left"
  }, "Work (min)", /*#__PURE__*/React.createElement(Input, {
    type: "number",
    min: "1",
    value: work,
    onChange: e => {
      const v = e.target.value;
      setWork(v);
      const n = +v || 25;
      if (mode === 'idle') setRemaining(n * 60);
    }
  })), /*#__PURE__*/React.createElement("label", {
    className: "text-xs text-slate-500 text-left"
  }, "Break (min)", /*#__PURE__*/React.createElement(Input, {
    type: "number",
    min: "1",
    value: brk,
    onChange: e => setBrk(e.target.value)
  })))), /*#__PURE__*/React.createElement(Card, {
    className: "p-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 font-medium"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "music"
  }), "Ambient Sound (synthesized)"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-2 gap-2 mt-3"
  }, [['off', 'Off'], ['white', 'White noise'], ['brown', 'Brown noise'], ['focus', 'Binaural — Focus'], ['relax', 'Binaural — Relax']].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => pickSound(k),
    className: `px-3 py-2 rounded-xl text-sm border ${sound === k ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40' : 'border-slate-200 dark:border-slate-700'}`
  }, l))), /*#__PURE__*/React.createElement("label", {
    className: "block mt-4 text-xs text-slate-500"
  }, "Volume", /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "0.5",
    step: "0.01",
    value: vol,
    onChange: e => setVol(+e.target.value),
    className: "w-full accent-brand-600"
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-slate-400 mt-2"
  }, "Audio generated with Web Audio API — no external files.")));
}

/* ---------- Motivation quotes (bulk) ---------- */
function QuotesView() {
  const {
    state,
    dispatch
  } = useVault();
  const [text, setText] = useState('');
  const [bn, setBn] = useState('');
  const [en, setEn] = useState('');
  function bulk() {
    const items = text.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => {
      const [b, e] = l.split(/::|\|/).map(s => s?.trim());
      return {
        id: uid(),
        bn: b || l,
        en: e || ''
      };
    });
    if (!items.length) {
      toast('Nothing to add', 'error');
      return;
    }
    dispatch({
      type: 'ADD_MANY',
      key: 'quotes',
      items
    });
    setText('');
    toast(`Added ${items.length} quotes`, 'success');
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-3 max-w-3xl"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium mb-2"
  }, "Add single quote"), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, /*#__PURE__*/React.createElement(TextArea, {
    rows: "2",
    placeholder: "Bangla",
    value: bn,
    onChange: e => setBn(e.target.value)
  }), /*#__PURE__*/React.createElement(Input, {
    placeholder: "English (optional)",
    value: en,
    onChange: e => setEn(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      if (!bn.trim()) return;
      dispatch({
        type: 'ADD_ITEM',
        key: 'quotes',
        item: {
          id: uid(),
          bn: bn.trim(),
          en: en.trim()
        }
      });
      setBn('');
      setEn('');
      toast('Added', 'success');
    }
  }, "Add")))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium mb-2"
  }, "Bulk paste"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mb-2"
  }, "One per line. Optional English after ", /*#__PURE__*/React.createElement("code", null, "::"), "."), /*#__PURE__*/React.createElement(FormatBlock, {
    text: `স্বপ্ন সেটা নয় যা ঘুমিয়ে দেখো :: A dream is not what you see in sleep\nপরিশ্রমই সাফল্যের চাবিকাঠি :: Hard work is the key to success\nআজকের কষ্ট কালকের গৌরব`,
    label: "Quote format"
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-2"
  }), /*#__PURE__*/React.createElement(TextArea, {
    rows: "6",
    value: text,
    onChange: e => setText(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex justify-end mt-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: bulk
  }, "Bulk Add"))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium mb-2"
  }, "Your quotes (", state.quotes.length, ")"), state.quotes.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-500"
  }, "No custom quotes yet — defaults will show on dashboard."), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, state.quotes.map(q => /*#__PURE__*/React.createElement("div", {
    key: q.id,
    className: "p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-start gap-2"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex-1"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-bn"
  }, q.bn), q.en && /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 italic"
  }, "\"", q.en, "\"")), /*#__PURE__*/React.createElement("button", {
    onClick: () => dispatch({
      type: 'REMOVE_ITEM',
      key: 'quotes',
      id: q.id
    }),
    className: "text-rose-500 p-1"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2",
    size: 14
  })))))));
}

/* ---------- Analytics ---------- */
function AnalyticsView() {
  const {
    state
  } = useVault();
  const ref1 = useRef();
  const ref2 = useRef();
  const ref3 = useRef();
  const c1Ref = useRef();
  const c2Ref = useRef();
  const c3Ref = useRef();
  useEffect(() => {
    const days = Array.from({
      length: 14
    }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return d.toISOString().slice(0, 10);
    });
    const focusPerDay = days.map(d => state.timerSessions.filter(s => s.date === d).reduce((a, s) => a + (s.minutes || 0), 0));
    const attemptsPerDay = days.map(d => {
      const arr = state.attempts.filter(a => a.date === d);
      if (arr.length === 0) return 0;
      const total = arr.reduce((a, x) => a + x.total, 0);
      const score = arr.reduce((a, x) => a + x.score, 0);
      return total ? Math.round(score / total * 100) : 0;
    });
    const habitPerDay = days.map(d => state.habits.reduce((a, h) => a + (h.log?.includes(d) ? 1 : 0), 0));
    [c1Ref, c2Ref, c3Ref].forEach(r => {
      if (r.current) {
        r.current.destroy();
        r.current = null;
      }
    });
    const opts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            autoSkip: true
          }
        }
      }
    };
    c1Ref.current = new Chart(ref1.current, {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'Focus min',
          data: focusPerDay,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,.15)',
          fill: true,
          tension: .35
        }]
      },
      options: opts
    });
    c2Ref.current = new Chart(ref2.current, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Accuracy %',
          data: attemptsPerDay,
          backgroundColor: '#10b981'
        }]
      },
      options: opts
    });
    c3Ref.current = new Chart(ref3.current, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Habits',
          data: habitPerDay,
          backgroundColor: '#f59e0b'
        }]
      },
      options: opts
    });
    return () => {
      [c1Ref, c2Ref, c3Ref].forEach(r => {
        if (r.current) {
          r.current.destroy();
          r.current = null;
        }
      });
    };
  }, [state]);
  // Weekly + monthly reports
  const now = new Date();
  const wk = weekKey(now),
    mo = monthKey(now);
  const inRange = (dateStr, from) => dateStr && dateStr >= from;
  const weekAttempts = state.attempts.filter(a => inRange(a.date, wk));
  const monthAttempts = state.attempts.filter(a => a.date && a.date.startsWith(mo));
  const stat = arr => {
    const total = arr.reduce((a, x) => a + x.total, 0);
    const score = arr.reduce((a, x) => a + x.score, 0);
    return {
      exams: arr.length,
      questions: total,
      avg: total ? Math.round(score / total * 100) : 0
    };
  };
  const wStat = stat(weekAttempts),
    mStat = stat(monthAttempts);

  // Badges
  const badges = [];
  const totalXP = state.profile.xp + (state.profile.level - 1) * 100;
  if (state.profile.streak >= 7) badges.push({
    name: 'সাপ্তাহিক যোদ্ধা / Weekly Warrior',
    desc: '7-day streak',
    icon: 'flame'
  });
  if (state.profile.streak >= 30) badges.push({
    name: '৩০ দিনের রাজা / 30-day King',
    desc: '30-day streak',
    icon: 'crown'
  });
  const weekend = state.attempts.filter(a => {
    const d = new Date(a.date);
    return d.getDay() === 0 || d.getDay() === 6;
  }).length;
  if (weekend >= 5) badges.push({
    name: 'Weekend Master',
    desc: '5+ weekend exams',
    icon: 'trophy'
  });
  if (mStat.exams >= 20) badges.push({
    name: monthName(mo) + ' King',
    desc: '20+ exams this month',
    icon: 'award'
  });
  if (state.mcqs.length >= 100) badges.push({
    name: 'Century',
    desc: '100+ MCQs stored',
    icon: 'library'
  });
  if (totalXP >= 1000) badges.push({
    name: 'XP Titan',
    desc: '1000 XP earned',
    icon: 'zap'
  });

  // Exam history grouped by subject
  const bySub = {};
  state.attempts.forEach(a => {
    const k = a.filter?.subjectId || 'mixed';
    (bySub[k] = bySub[k] || []).push(a);
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-3 gap-4"
  }, /*#__PURE__*/React.createElement(StatBig, {
    label: "Total XP",
    value: totalXP,
    icon: "zap"
  }), /*#__PURE__*/React.createElement(StatBig, {
    label: "MCQ Attempts",
    value: state.attempts.length,
    icon: "list-checks"
  }), /*#__PURE__*/React.createElement(StatBig, {
    label: "Focus Minutes",
    value: state.timerSessions.reduce((a, s) => a + (s.minutes || 0), 0),
    icon: "timer"
  })), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-4"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium mb-2"
  }, "This week"), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2 text-center"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold"
  }, wStat.exams), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Exams")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold"
  }, wStat.questions), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Questions")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold"
  }, wStat.avg, "%"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Avg score")))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium mb-2"
  }, monthName(mo)), /*#__PURE__*/React.createElement("div", {
    className: "grid grid-cols-3 gap-2 text-center"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold"
  }, mStat.exams), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Exams")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold"
  }, mStat.questions), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Questions")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold"
  }, mStat.avg, "%"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Avg score"))))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium mb-3"
  }, "Badges"), badges.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Keep going — badges unlock as you build streaks and take exams."), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, badges.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.name,
    className: "flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-brand-50 to-brand-50 dark:from-brand-950/40 dark:to-brand-950/40 border border-brand-200 dark:border-brand-800"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: b.icon,
    size: 18
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium"
  }, b.name), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-slate-500"
  }, b.desc)))))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium mb-2"
  }, "Exam history by subject"), Object.keys(bySub).length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "No exams yet."), /*#__PURE__*/React.createElement("div", {
    className: "grid gap-2"
  }, Object.entries(bySub).map(([sid, arr]) => {
    const sub = state.subjects.find(s => s.id === sid);
    const name = sub ? sub.name : 'Mixed';
    const s = stat(arr);
    return /*#__PURE__*/React.createElement("div", {
      key: sid,
      className: "flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-sm font-medium"
    }, name), /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-500"
    }, s.exams, " exams · ", s.questions, " Qs · ", s.avg, "% avg"));
  }))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium mb-2"
  }, "Focus (last 14 days)"), /*#__PURE__*/React.createElement("div", {
    className: "h-56"
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: ref1
  }))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium mb-2"
  }, "Quiz accuracy (%)"), /*#__PURE__*/React.createElement("div", {
    className: "h-56"
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: ref2
  }))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-medium mb-2"
  }, "Habit check-ins"), /*#__PURE__*/React.createElement("div", {
    className: "h-56"
  }, /*#__PURE__*/React.createElement("canvas", {
    ref: ref3
  }))));
}
function StatBig({
  label,
  value,
  icon
}) {
  return /*#__PURE__*/React.createElement(Card, {
    className: "p-4 flex items-center gap-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/40 text-brand-600 flex items-center justify-center"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "text-2xl font-bold"
  }, value)));
}

/* ---------- Empty ---------- */
function Empty({
  icon,
  text
}) {
  return /*#__PURE__*/React.createElement(Card, {
    className: "p-10 text-center text-slate-400"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mx-auto w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon
  })), /*#__PURE__*/React.createElement("div", null, text));
}

/* ---------- Settings ---------- */
function SettingsView() {
  const {
    state,
    dispatch
  } = useVault();
  const fileRef = useRef();
  function exportJSON() {
    const fname = `sonkolpo-os-backup-${todayISO()}.json`;
    if (window.NativeBridge && window.NativeBridge.exportFile) {
      window.NativeBridge.exportFile(fname, JSON.stringify(state, null, 2)).then(where => toast('Saved: ' + where, 'success')).catch(err => toast('Export failed: ' + (err && err.message || err), 'error'));
      return;
    }
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sonkolpo-os-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup downloaded', 'success');
  }
  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        dispatch({
          type: 'HYDRATE',
          state: {
            ...structuredClone(DEFAULT_STATE),
            ...data
          }
        });
        toast('Restore complete', 'success');
      } catch (err) {
        toast('Invalid file', 'error');
      }
    };
    r.readAsText(file);
  }
  const notif = state.ui.notif;
  return /*#__PURE__*/React.createElement("div", {
    className: "grid gap-4 max-w-2xl"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium mb-2"
  }, "Profile"), /*#__PURE__*/React.createElement(Input, {
    value: state.profile.name,
    onChange: e => dispatch({
      type: 'SET_PROFILE',
      patch: {
        name: e.target.value
      }
    })
  })), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium mb-2"
  }, "Appearance"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: state.ui.theme === 'light' ? 'primary' : 'outline',
    onClick: () => dispatch({
      type: 'SET_UI',
      patch: {
        theme: 'light'
      }
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sun"
  }), "Light"), /*#__PURE__*/React.createElement(Btn, {
    variant: state.ui.theme === 'dark' ? 'primary' : 'outline',
    onClick: () => dispatch({
      type: 'SET_UI',
      patch: {
        theme: 'dark'
      }
    })
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "moon"
  }), "Dark")), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 flex gap-2"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: state.ui.lang === 'bn' ? 'primary' : 'outline',
    onClick: () => dispatch({
      type: 'SET_UI',
      patch: {
        lang: 'bn'
      }
    })
  }, "বাংলা"), /*#__PURE__*/React.createElement(Btn, {
    variant: state.ui.lang === 'en' ? 'primary' : 'outline',
    onClick: () => dispatch({
      type: 'SET_UI',
      patch: {
        lang: 'en'
      }
    })
  }, "English"))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium mb-2"
  }, "Notifications & Reminders"), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mb-2"
  }, "Choose how you get reminded when a scheduled task time hits."), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: notif.popup && !notif.beep ? 'primary' : 'outline',
    onClick: () => dispatch({
      type: 'SET_NOTIF',
      patch: {
        popup: true,
        beep: false
      }
    })
  }, "Popup Only"), /*#__PURE__*/React.createElement(Btn, {
    variant: !notif.popup && notif.beep ? 'primary' : 'outline',
    onClick: () => dispatch({
      type: 'SET_NOTIF',
      patch: {
        popup: false,
        beep: true
      }
    })
  }, "Beep Only"), /*#__PURE__*/React.createElement(Btn, {
    variant: notif.popup && notif.beep ? 'primary' : 'outline',
    onClick: () => dispatch({
      type: 'SET_NOTIF',
      patch: {
        popup: true,
        beep: true
      }
    })
  }, "Both")), /*#__PURE__*/React.createElement("div", {
    className: "mt-3"
  }, /*#__PURE__*/React.createElement(Btn, {
    variant: "ghost",
    onClick: () => {
      AudioEngine.reminderChime();
      window.dispatchEvent(new CustomEvent('sonkolpo:remind', {
        detail: {
          title: 'Test reminder',
          line: REMINDER_LINES[0]
        }
      }));
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell"
  }), "Test"))), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium mb-2"
  }, "Backup & Restore"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: exportJSON
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "download"
  }), "Export JSON"), /*#__PURE__*/React.createElement(Btn, {
    variant: "outline",
    onClick: () => fileRef.current.click()
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "upload"
  }), "Import JSON"), /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "application/json",
    ref: fileRef,
    onChange: importJSON,
    className: "hidden"
  })), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500 mt-2"
  }, "Your data lives only in this browser (localStorage key ", /*#__PURE__*/React.createElement("code", null, "focus-vault-v1"), "). Export regularly.")), /*#__PURE__*/React.createElement(Card, {
    className: "p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "font-medium mb-2 text-rose-600"
  }, "Danger zone"), /*#__PURE__*/React.createElement(Btn, {
    variant: "danger",
    onClick: () => {
      if (confirm('Reset all data?')) {
        dispatch({
          type: 'RESET'
        });
        toast('Reset done', 'success');
      }
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trash-2"
  }), "Reset all data")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-center text-slate-400 pt-2"
  }, BRAND, " · v3.0 · ", CREDIT));
}

/* ---------- Root ---------- */
function App() {
  const [phase, setPhase] = useState('splash');
  return /*#__PURE__*/React.createElement(VaultProvider, null, /*#__PURE__*/React.createElement(AppInner, {
    phase: phase,
    setPhase: setPhase
  }));
}
function AppInner({
  phase,
  setPhase
}) {
  const {
    state
  } = useVault();
  if (phase === 'splash') return /*#__PURE__*/React.createElement(Splash, {
    onDone: () => setPhase(state.ui.tourDone ? 'app' : 'onboard')
  });
  if (phase === 'onboard') return /*#__PURE__*/React.createElement(Onboarding, {
    onDone: () => setPhase('app')
  });
  return /*#__PURE__*/React.createElement(Shell, null);
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(App, null));