import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  TrendingUp, Trophy, Plus, Minus, RefreshCw, Shield, Crown, PlayCircle, Lock, LogOut, CheckCircle2, RotateCcw, Search, Save, DollarSign, Wallet, Users, BarChart3, PieChart, Settings, ArrowRight, Copy, Swords, ChevronLeft, Calendar, Edit2, Trash2, User, Upload, X, ArrowUp, ArrowDown, ArrowUpDown, Medal, Sparkles, Activity, CircleDollarSign, BookOpen, TrendingDown, ChevronDown
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut 
} from 'firebase/auth';
import {
  getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, writeBatch, getDoc, query, where, deleteDoc, getDocs, runTransaction
} from 'firebase/firestore';
import { recapForMatchup, monthHasRecap } from './recaps';

// --- CONFIGURATION ---

const firebaseConfig = {
  apiKey: "AIzaSyBuq1tHxrV8sikf78yWP7cvtrijZZz0KJQ",
  authDomain: "fivestar-398be.firebaseapp.com",
  projectId: "fivestar-398be",
  storageBucket: "fivestar-398be.firebasestorage.app",
  messagingSenderId: "230644568836",
  appId: "1:230644568836:web:8bcd907a4985d54be53651"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

const FINNHUB_API_KEY = "d52p16hr01qggm5t4cegd52p16hr01qggm5t4cf0";

// --- Shared market prices ---------------------------------------------------
// Every quote the league scores against lives in one Firestore document that all
// clients read. Before this, each device fetched Finnhub itself and cached the
// results locally, so a phone and a desktop could show the same team two very
// different monthly returns. One client at a time takes a short lease and does
// the sweep on everyone's behalf; the rest just listen.
const PRICES_DOC = doc(db, 'artifacts', appId, 'public', 'data', 'market', 'prices');
const PRICE_REFRESH_MS = 5 * 60 * 1000;  // how stale the shared prices may get
const SWEEP_LEASE_MS = 3 * 60 * 1000;    // ceiling on one sweep, then the lease lapses
const PRICE_CHECK_MS = 60 * 1000;        // how often a client checks the age

// Served from public/ — regenerate the sizes with `npm run icons`.
const LOGO_URL = `${import.meta.env.BASE_URL}icon-192.png`;

const INITIAL_STOCKS = [
  { id: 'AAPL', name: 'Apple Inc.', sector: 'Tech' },
  { id: 'TSLA', name: 'Tesla, Inc.', sector: 'Auto' },
  { id: 'NVDA', name: 'NVIDIA Corp', sector: 'Tech' },
  { id: 'MSFT', name: 'Microsoft', sector: 'Tech' },
  { id: 'AMZN', name: 'Amazon', sector: 'Retail' },
  { id: 'GOOGL', name: 'Alphabet', sector: 'Tech' },
];

const FRANCHISE_SLOTS = 4;
const DEFAULT_ALLOWANCE = 10000;
const DEFAULT_MAX_PLAYERS = 8;

// --- Display Constants ---

const STATUS_META = {
  setup:      { label: 'Setup',   chip: 'chip-muted' },
  ready:      { label: 'Ready',   chip: 'chip bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/30' },
  active:     { label: 'Live',    chip: 'chip bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30', live: true },
  completed:  { label: 'Scored',  chip: 'chip-gold' },
};

// Always returns a usable shape: `activeLeague` is null until its snapshot lands,
// and leagues created before the season rewrite carry statuses not listed above.
const statusMeta = (status) => STATUS_META[status] || { label: status || 'Setup', chip: 'chip-muted' };

// Podium colours for the top three; everyone else gets the muted default.
const RANK_STYLES = [
  'bg-gold-sheen text-ink-950',
  'bg-slate-300/90 text-ink-950',
  'bg-amber-700/80 text-amber-100',
];

// --- Month Helpers ---
// Months are stored as sortable 'YYYY-MM' keys so a season can span any range.

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

const parseMonth = (key) => {
  const [year, month] = String(key || '').split('-').map(Number);
  return { year, month };
};

const monthLabel = (key, short = false) => {
  if (!key) return '—';
  const { year, month } = parseMonth(key);
  if (!year || !month) return '—';
  const name = MONTH_NAMES[month - 1] || '';
  return `${short ? name.slice(0, 3) : name} ${year}`;
};

const addMonths = (key, count) => {
  const { year, month } = parseMonth(key);
  const zeroBased = (year * 12) + (month - 1) + count;
  return monthKey(Math.floor(zeroBased / 12), (zeroBased % 12) + 1);
};

// Inclusive list of every month from start to end.
const monthRange = (start, end) => {
  if (!start || !end || start > end) return [];
  const months = [];
  let cursor = start;
  while (cursor <= end && months.length < 120) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }
  return months;
};

const currentMonthKey = () => {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth() + 1);
};

const dayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDays = (day, n) => {
  const [year, month, date] = String(day).split('-').map(Number);
  return dayKey(new Date(year, month - 1, date + n));
};

const lastDayOfMonth = (mKey) => {
  const { year, month } = parseMonth(mKey);
  return `${mKey}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
};

const shortDayLabel = (day) => {
  const { month } = parseMonth(day);
  return `${MONTH_NAMES[month - 1]?.slice(0, 3)} ${Number(String(day).slice(8))}`;
};

// Every calendar day of a month, stopping at `upTo` when the month is still running.
const daysOfMonth = (mKey, upTo) => {
  const { year, month } = parseMonth(mKey);
  if (!year || !month) return [];
  const lastDay = new Date(year, month, 0).getDate();
  const days = [];
  for (let d = 1; d <= lastDay; d++) {
    const key = `${mKey}-${String(d).padStart(2, '0')}`;
    if (upTo && key > upTo) break;
    days.push(key);
  }
  return days;
};

// --- Chart ---

// Validated against the dark chart surface (#101319): all slots inside the OKLCH
// lightness band, above the chroma floor, over 3:1 contrast, and separated under
// simulated protanopia/deuteranopia. Assigned by stable player order, never by
// rank, so a standings change never repaints a team.
const SERIES_COLORS = ['#d97706', '#0891b2', '#6366f1', '#e11d48', '#15803d', '#a855f7', '#0369a1', '#b45309'];

const fmtAxisMoney = (v) => Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;
const fmtFullMoney = (v) => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fmtPct = (v) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}%`;

// --- Seasons ---

// Seasons are named for the calendar years they touch: '2026' inside one year,
// '2026-27' when the schedule runs across New Year.
const seasonLabel = (start, end) => {
  const a = parseMonth(start).year;
  const b = parseMonth(end).year;
  if (!a) return '—';
  if (!b || a === b) return String(a);
  return `${a}-${String(b).slice(2)}`;
};

// A season's return compounds its monthly scores rather than summing them. Each
// month's percentage is measured against that month's own opening value, so they
// multiply — summing would flatter a good season and libel a bad one.
const compoundReturn = (scores) =>
  ((scores || []).reduce((acc, s) => acc * (1 + (Number(s) || 0) / 100), 1) - 1) * 100;

// Flattens a schedule into one row per team per scored month. Names are captured
// as they were at the time, so a later rename can't rewrite history.
const teamMonthsFromSchedule = (schedule) => {
  const rows = [];
  Object.entries(schedule || {}).forEach(([month, matchups]) => {
    (matchups || []).forEach(m => {
      if (!m.scored) return;
      if (m.p1) rows.push({ month, userId: m.p1, name: m.p1Name, score: Number(m.p1Score) || 0 });
      if (m.p2 && m.p2 !== 'BYE') rows.push({ month, userId: m.p2, name: m.p2Name, score: Number(m.p2Score) || 0 });
    });
  });
  return rows;
};

// The title goes to whoever wins the matchup the playoff generator tagged
// 'Championship'. An exact tie leaves the season without one.
const championFrom = (schedule, playoffMonth) => {
  const final = (schedule?.[playoffMonth] || []).find(m => m.type === 'Championship' && m.scored);
  if (!final || final.p2 === 'BYE') return null;
  if (Number(final.p1Score) === Number(final.p2Score)) return null;
  return Number(final.p1Score) > Number(final.p2Score)
    ? { userId: final.p1, name: final.p1Name }
    : { userId: final.p2, name: final.p2Name };
};

// `labels` are the x-axis tick captions, one per point. `format` switches the
// y-axis and tooltip between dollars and percentages.
// `ticks` optionally pins the x-axis captions to specific points (e.g. month
// boundaries on a weekly series); without it, captions are spaced evenly.
const PortfolioChart = ({ series, labels, ticks, format = 'money', axisLabel = 'Point', emptyMessage }) => {
  const [hover, setHover] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const isPercent = format === 'percent';
  const fmtAxis = isPercent ? (v) => `${v.toFixed(1)}%` : fmtAxisMoney;
  const fmtValue = isPercent
    ? (v) => `${v > 0 ? '+' : ''}${Number(v).toFixed(2)}%`
    : fmtFullMoney;

  const W = 360, H = 176;
  const pad = { l: 40, r: 46, t: 10, b: 22 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const days = labels;
  const allValues = series.flatMap(s => s.points.filter(v => v !== null));
  if (days.length < 2 || allValues.length === 0) {
    return (
      <p className="px-1 py-8 text-center text-sm text-slate-500">
        {emptyMessage || 'Not enough history yet — values are recorded each day the league is open.'}
      </p>
    );
  }

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin || Math.max(1, rawMax * 0.02);
  const yMin = rawMin - span * 0.15;
  const yMax = rawMax + span * 0.15;

  const x = (i) => pad.l + (days.length === 1 ? plotW / 2 : (i / (days.length - 1)) * plotW);
  const y = (v) => pad.t + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const gridValues = [0, 0.5, 1].map(t => yMin + t * (yMax - yMin));

  // Pinned ticks when supplied; otherwise roughly four evenly spaced captions,
  // always including the first and last point.
  const tickList = ticks?.length
    ? ticks.filter(t => t.i >= 0 && t.i < days.length)
    : (() => {
        const step = Math.max(1, Math.ceil(days.length / 4));
        return days
          .map((_, i) => i)
          .filter(i => i % step === 0 || i === days.length - 1)
          .map(i => ({ i, label: days[i] }));
      })();

  const pathFor = (points) => {
    let d = '';
    let open = false;
    points.forEach((v, i) => {
      if (v === null) { open = false; return; }
      d += `${open ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      open = true;
    });
    return d.trim();
  };

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = (px - pad.l) / plotW;
    const idx = Math.round(ratio * (days.length - 1));
    setHover(Math.max(0, Math.min(days.length - 1, idx)));
  };

  if (showTable) {
    return (
      <div>
        <div className="mb-2 flex justify-end">
          <button onClick={() => setShowTable(false)} className="eyebrow transition hover:text-gold-300">Show chart</button>
        </div>
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-ink-850">
              <tr>
                <th className="eyebrow py-1.5 pr-2">{axisLabel}</th>
                {series.map(s => <th key={s.id} className="eyebrow py-1.5 pr-2 text-right">{s.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {days.map((d, i) => (
                <tr key={d}>
                  <td className="py-1.5 pr-2 font-mono text-slate-500">{d}</td>
                  {series.map(s => (
                    <td key={s.id} className="py-1.5 pr-2 text-right font-mono text-slate-300">
                      {s.points[i] === null ? '—' : fmtValue(s.points[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const hoveredDay = hover !== null ? days[hover] : null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {series.map(s => (
            <span key={s.id} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
        <button onClick={() => setShowTable(true)} className="eyebrow transition hover:text-gold-300">Table</button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none" role="img"
        aria-label={`${isPercent ? 'Team monthly return' : 'Team value'} by ${axisLabel.toLowerCase()}, ${days[0]} to ${days[days.length - 1]}`}
        onMouseMove={handleMove} onMouseLeave={() => setHover(null)} onTouchMove={(e) => handleMove(e.touches[0])}>

        {gridValues.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} x2={pad.l + plotW} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="8" fill="rgba(148,163,184,0.75)" fontFamily="ui-monospace, monospace">
              {fmtAxis(v)}
            </text>
          </g>
        ))}

        {tickList.map(t => (
          <text key={t.i} x={x(t.i)} y={H - 6} textAnchor="middle" fontSize="8" fill="rgba(148,163,184,0.75)" fontFamily="ui-monospace, monospace">
            {t.label}
          </text>
        ))}

        {/* Break-even line — the only value that matters on a % chart. */}
        {isPercent && yMin < 0 && yMax > 0 && (
          <line x1={pad.l} x2={pad.l + plotW} y1={y(0)} y2={y(0)}
            stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeDasharray="3 3" />
        )}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
        )}

        {series.map(s => (
          <path key={s.id} d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Direct end labels — identity is never carried by colour alone. */}
        {series.map(s => {
          const lastIdx = s.points.reduce((acc, v, i) => (v !== null ? i : acc), -1);
          if (lastIdx < 0) return null;
          return (
            <text key={s.id} x={x(lastIdx) + 6} y={y(s.points[lastIdx]) + 3} fontSize="8" fill={s.color} fontWeight="700" fontFamily="ui-monospace, monospace">
              {s.name.slice(0, 6)}
            </text>
          );
        })}

        {hover !== null && series.map(s => s.points[hover] === null ? null : (
          <circle key={s.id} cx={x(hover)} cy={y(s.points[hover])} r="4" fill={s.color} stroke="#101319" strokeWidth="2" />
        ))}
      </svg>

      <div className="mt-2 min-h-[52px] rounded-lg bg-black/25 px-3 py-2 ring-1 ring-white/[0.05]">
        {hoveredDay ? (
          <>
            <div className="eyebrow mb-1">{hoveredDay}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {series.map(s => (
                <span key={s.id} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <span className="text-slate-500">{s.name}</span>
                  <span className="font-mono font-bold text-slate-200">
                    {s.points[hover] === null ? '—' : fmtValue(s.points[hover])}
                  </span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <p className="pt-2 text-center text-[11px] text-slate-600">Hover or drag across the chart for daily values.</p>
        )}
      </div>
    </div>
  );
};

// --- Helper Functions ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Components ---

const Card = ({ children, className = "", onClick }) => (
  <div
    onClick={onClick}
    className={`surface overflow-hidden ${onClick ? 'cursor-pointer transition duration-150 hover:ring-white/[0.16] hover:bg-ink-800/70 active:scale-[0.995]' : ''} ${className}`}
  >
    {children}
  </div>
);

const Avatar = ({ url, name, size = "md", onClick, className = "" }) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-[11px]",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-xl",
    xl: "w-32 h-32 text-3xl"
  };

  const interactive = onClick ? 'cursor-pointer hover:ring-gold-400/70' : '';
  const base = `rounded-full ring-2 ring-white/10 transition ${sizeClasses[size]} ${interactive} ${className}`;

  const content = url ? (
    <img src={url} alt={name} className={`object-cover ${base}`} />
  ) : (
    <div className={`flex items-center justify-center bg-ink-700 font-bold uppercase text-slate-400 ${base}`}>
      {name ? name.charAt(0) : '?'}
    </div>
  );

  return onClick ? <div onClick={onClick} className="shrink-0">{content}</div> : content;
};

// The percentage return is the app's headline number — always signed, always tabular.
const Pct = ({ value, className = "" }) => {
  const v = Number(value) || 0;
  const tone = v > 0 ? 'text-gain' : v < 0 ? 'text-loss' : 'text-slate-400';
  return (
    <span className={`font-mono font-bold tracking-tight ${tone} ${className}`}>
      {v > 0 ? '+' : ''}{v.toFixed(2)}%
    </span>
  );
};

const SectionHeading = ({ icon: Icon, title, meta }) => (
  <div className="mb-4 flex items-end justify-between gap-3">
    <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tightest text-white">
      {Icon && <Icon size={18} className="text-gold-400" />}
      {title}
    </h2>
    {meta && <span className="eyebrow">{meta}</span>}
  </div>
);

const EmptyState = ({ icon: Icon, title, body, children }) => (
  <div className="surface flex flex-col items-center px-6 py-14 text-center">
    {Icon && (
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
        <Icon size={24} className="text-slate-600" />
      </div>
    )}
    <h3 className="text-base font-bold text-white">{title}</h3>
    {body && <p className="mt-1 max-w-xs text-sm text-slate-500">{body}</p>}
    {children && <div className="mt-5">{children}</div>}
  </div>
);

// Admin panels: a coloured rail on the left carries the section's identity.
const PANEL_ACCENTS = {
  gold: 'from-gold-400 to-gold-600',
  cyan: 'from-cyan-300 to-cyan-600',
  orange: 'from-orange-300 to-orange-600',
  pink: 'from-pink-300 to-pink-600',
  purple: 'from-purple-300 to-purple-600',
  blue: 'from-blue-300 to-blue-600',
  rose: 'from-rose-300 to-rose-600',
};

// --- Install prompt ---

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const detectPlatform = () => {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  return { iOS, android, mobile: iOS || android };
};

const InstallBanner = ({ platform, canPrompt, onInstall, onDismiss, hasNav }) => (
  <div className={`pb-safe fixed inset-x-0 z-40 px-3 pb-2 ${hasNav ? 'bottom-[68px]' : 'bottom-0'}`}>
    <div className="surface mx-auto max-w-lg animate-fade-up p-4 shadow-lift">
      <div className="flex items-start gap-3">
        <img src={LOGO_URL} alt="" className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold tracking-tight text-white">Add FiveStar to your home screen</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {canPrompt ? (
              'Install it for full-screen access and a one-tap icon.'
            ) : platform.iOS ? (
              <>Tap the Share button <span className="font-bold text-slate-200">⎋</span> in Safari, then choose{' '}
              <span className="font-bold text-slate-200">Add to Home Screen</span>.</>
            ) : (
              <>Open your browser menu <span className="font-bold text-slate-200">⋮</span>, then choose{' '}
              <span className="font-bold text-slate-200">Install app</span> or{' '}
              <span className="font-bold text-slate-200">Add to Home screen</span>.</>
            )}
          </p>
          <div className="mt-3 flex gap-2">
            {canPrompt && <button onClick={onInstall} className="btn-gold px-3 py-1.5 text-xs">Install</button>}
            <button onClick={onDismiss} className="btn-ghost px-3 py-1.5 text-xs">
              {canPrompt ? 'Not now' : 'Got it'}
            </button>
          </div>
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 text-slate-600 transition hover:text-white">
          <X size={16}/>
        </button>
      </div>
    </div>
  </div>
);

// Number fields frequently sit at 0. Selecting on focus means typing replaces
// the value instead of appending to it — no more "05" when you meant 5.
//
// These are text inputs with a numeric keypad rather than type="number":
// the HTML spec gives number inputs no selection API, so select() is a no-op
// on them and the leading zero survives. Every handler already parses the
// string, so nothing downstream changes.
const selectOnFocus = (e) => {
  const el = e.target;
  // Defer: iOS Safari collapses the caret if you select during the focus event.
  setTimeout(() => { try { el.select(); } catch { /* not selectable */ } }, 0);
};

const logoFallback = (e) => {
  e.target.onerror = null;
  e.target.src = "https://placehold.co/100x100/fbbf24/08090c?text=5";
};

// Defined at module scope so the auth inputs keep focus between renders.
const AuthShell = ({ eyebrow, title, subtitle, children }) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
    <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-gold-400/10 blur-[100px]" />
    <div className="surface relative w-full max-w-md animate-fade-up p-8 shadow-lift">
      <div className="mb-7 flex flex-col items-center text-center">
        <div className="mb-4 rounded-2xl bg-gold-sheen p-[2px] shadow-gold">
          <img src={LOGO_URL} alt="FiveStar" className="h-14 w-14 rounded-[14px] bg-ink-950 object-contain p-1.5" onError={logoFallback} />
        </div>
        <div className="eyebrow text-gold-400/80">{eyebrow}</div>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-tightest text-white">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  </div>
);

const MonthPicker = ({ value, onChange }) => {
  const { year, month } = parseMonth(value);
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2];
  return (
    <div className="flex gap-2">
      <select value={month || ''} onChange={(e) => onChange(monthKey(year || thisYear, Number(e.target.value)))} className="field-sm flex-1 py-2.5">
        {MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
      <select value={year || ''} onChange={(e) => onChange(monthKey(Number(e.target.value), month || 1))} className="field-sm w-28 py-2.5">
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
};

const WizardSteps = ({ steps, current }) => (
  <div className="mb-6 flex items-center gap-2">
    {steps.map((label, i) => (
      <React.Fragment key={label}>
        <div className="flex items-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition ${
            i < current ? 'bg-gold-400/20 text-gold-300 ring-1 ring-gold-400/40'
            : i === current ? 'bg-gold-sheen text-ink-950'
            : 'bg-white/[0.06] text-slate-600'}`}>
            {i < current ? <CheckCircle2 size={13}/> : i + 1}
          </div>
          <span className={`text-[11px] font-bold ${i === current ? 'text-white' : 'text-slate-600'}`}>{label}</span>
        </div>
        {i < steps.length - 1 && <div className="h-px flex-1 hairline" />}
      </React.Fragment>
    ))}
  </div>
);

// Collapsible: the Admin tab is long, and most sections are touched rarely.
const Panel = ({ icon: Icon, title, accent = 'gold', description, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="surface relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${PANEL_ACCENTS[accent]}`} />
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 py-4 pl-6 pr-4 text-left transition hover:bg-white/[0.02]"
      >
        {Icon && <Icon size={16} className="shrink-0 text-slate-400" />}
        <span className="min-w-0 flex-1 text-sm font-extrabold uppercase tracking-wide text-white">{title}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="animate-fade-up pb-5 pl-6 pr-5">
          {description && <p className="mb-4 text-xs leading-relaxed text-slate-500">{description}</p>}
          {children}
        </div>
      )}
    </section>
  );
};

// --- Main App ---

export default function FiveStarApp() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // Data States
  const [memberships, setMemberships] = useState([]); 
  const [activeMembership, setActiveMembership] = useState(null); 
  const [activeLeague, setActiveLeague] = useState(null); 
  const [leaguePlayers, setLeaguePlayers] = useState([]); 
  const [masterStocks, setMasterStocks] = useState([]);
  
  // Navigation State
  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('fivestar_view') || 'dashboard';
  });

  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [matchupsMonth, setMatchupsMonth] = useState(null); // null = follow the open month
  const [showLeagueCreator, setShowLeagueCreator] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [enlargedAvatar, setEnlargedAvatar] = useState(null);

  // Sorting State
  const [marketSortBy, setMarketSortBy] = useState('mtd'); // 'mtd', 'total', 'alpha'
  const [marketSortDir, setMarketSortDir] = useState('desc'); // 'asc' or 'desc'
  const [marketMode, setMarketMode] = useState('list'); // 'list' or 'top5'

  // Measured so the Market's sticky filter bar parks exactly under the header.
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(57);

  // Input State
  const [loginName, setLoginName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hasProfile, setHasProfile] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Profile Editing
  const [editingName, setEditingName] = useState('');
  const [editingAvatar, setEditingAvatar] = useState('');
  
  const [joinLeagueId, setJoinLeagueId] = useState('');

  // League Creation Wizard
  const [onboardingMode, setOnboardingMode] = useState(null); // null | 'join' | 'create'
  const [setupStep, setSetupStep] = useState(0);
  const [setupDraft, setSetupDraft] = useState(() => {
    const thisMonth = currentMonthKey();
    return {
      name: '',
      maxPlayers: DEFAULT_MAX_PLAYERS,
      adminPlays: true,
      seasonStart: thisMonth,
      seasonEnd: addMonths(thisMonth, 6),
      monthlyAllowance: DEFAULT_ALLOWANCE,
      pool: [],
    };
  });
  const [poolSearch, setPoolSearch] = useState('');
  const [isSearchingPool, setIsSearchingPool] = useState(false);

  // Admin States
  const [newStockTicker, setNewStockTicker] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [newLeagueNameSetting, setNewLeagueNameSetting] = useState('');
  const [backfillMonth, setBackfillMonth] = useState(null);
  const [backfillScores, setBackfillScores] = useState({});
  const [nextSeason, setNextSeason] = useState({ seasonStart: '', seasonEnd: '' });
  const [pastTitle, setPastTitle] = useState({ label: '', name: '' });
  const [teamDrafts, setTeamDrafts] = useState({});

  // Tab swiping. `swipeNeighbor` is the only state the gesture touches, and only
  // twice per swipe — mounting the incoming tab, then unmounting it. The drag
  // itself writes transform straight to the node.
  const swipeWrapRef = useRef(null);
  const swipeTrackRef = useRef(null);
  const gestureRef = useRef(null);
  const settlingRef = useRef(false);
  const [swipeNeighbor, setSwipeNeighbor] = useState(null);
  const [isTouchDevice] = useState(() => {
    try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
  });


  // Install prompt
  const [showInstall, setShowInstall] = useState(false);
  const [installEvent, setInstallEvent] = useState(null);
  const platformRef = useRef(detectPlatform());

  // Real Data
  const rateLimitedUntilRef = useRef(0);
  const sweepInFlightRef = useRef(false);
  const lastLocalSweepRef = useRef(0);
  // Set if the shared price doc can't be read or written — most likely because
  // the Firestore rules don't cover `market/prices` yet. Clients then fall back
  // to sweeping for themselves, which is the old behaviour: the app keeps
  // working, it just can't guarantee two devices agree.
  const sharedPricesBrokenRef = useRef(false);
  const [liveMarketData, setLiveMarketData] = useState(() => {
    const cached = localStorage.getItem('fivestar_market_data');
    if (!cached) return {};
    try {
      // Only a seed for the first paint — the shared snapshot replaces this
      // wholesale as soon as it lands. Earlier builds cached zero prices from
      // failed reads, so drop those: a stale $0.00 must never score a team.
      const parsed = JSON.parse(cached);
      return Object.fromEntries(Object.entries(parsed).filter(([, v]) => Number(v?.c) > 0));
    } catch { return {}; }
  });

  // --- Persistence Hooks ---
  
  useEffect(() => {
    localStorage.setItem('fivestar_view', currentView);
  }, [currentView]);

  // --- Browser back navigation ---------------------------------------------
  // Each tab and each overlay gets its own history entry, so Back steps through
  // the app instead of leaving it. Overlays close by calling history.back(),
  // which keeps the stack and the UI from drifting apart.

  const pushScreen = (next) => {
    try { window.history.pushState({ fivestar: next }, ''); } catch { /* history unavailable */ }
  };
  const replaceScreen = (next) => {
    try { window.history.replaceState({ fivestar: next }, ''); } catch { /* history unavailable */ }
  };

  const navigateTo = (view) => {
    if (view === currentView) return;
    setSelectedMatchup(null);
    if (view === 'matchups') setMatchupsMonth(null);
    setCurrentView(view);
    pushScreen({ view, overlay: null });
  };

  const openOverlay = (name, apply) => {
    apply?.();
    pushScreen({ view: currentView, overlay: name });
  };

  // Prefer unwinding history so the entry is consumed; fall back to closing
  // directly if this overlay somehow isn't the current entry.
  const closeOverlay = (fallback) => {
    if (window.history.state?.fivestar?.overlay) window.history.back();
    else fallback?.();
  };

  useEffect(() => {
    if (!window.history.state?.fivestar) {
      replaceScreen({ view: currentView, overlay: null });
    }
    const onPop = (e) => {
      const screen = e.state?.fivestar;
      const view = screen?.view || 'dashboard';
      const overlay = screen?.overlay || null;
      setCurrentView(view);
      if (overlay !== 'matchup') setSelectedMatchup(null);
      if (overlay !== 'profile') setShowProfile(false);
      if (overlay !== 'leagues') setShowLeagueCreator(false);
      if (overlay !== 'avatar') setEnlargedAvatar(null);
      if (overlay !== 'backfill') setBackfillMonth(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Suggest installing to the home screen — mobile browsers only, once, and
  // never when the app is already running standalone.
  useEffect(() => {
    if (!platformRef.current.mobile) return;
    if (isStandalone()) return;
    if (localStorage.getItem('fivestar_install_dismissed') === '1') return;

    // Chrome/Edge fire this when the app meets the installability criteria; we
    // hold onto it so the banner's button can open the real install dialog.
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Give the first screen a moment before interrupting.
    const timer = setTimeout(() => setShowInstall(true), 2500);

    const onInstalled = () => {
      setShowInstall(false);
      localStorage.setItem('fivestar_install_dismissed', '1');
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      clearTimeout(timer);
    };
  }, []);

  const dismissInstall = () => {
    setShowInstall(false);
    localStorage.setItem('fivestar_install_dismissed', '1');
  };

  const acceptInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    try { await installEvent.userChoice; } catch { /* user dismissed */ }
    setInstallEvent(null);
    dismissInstall();
  };

  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setHeaderHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [user, hasProfile]);

  useEffect(() => {
    if (Object.keys(liveMarketData).length > 0) {
      localStorage.setItem('fivestar_market_data', JSON.stringify(liveMarketData));
    }
  }, [liveMarketData]);

  // The daily value chart has no historical source to draw on — Finnhub's candle
  // endpoint is not on this key's plan — so each client records today's value as
  // it goes. The commissioner records every team; a player records only their own.
  const lastSnapshotRef = useRef(0);
  useEffect(() => {
    if (!activeLeague || activeLeague.status !== 'active') return;
    if (!activeMembership || leaguePlayers.length === 0) return;
    if (Object.keys(liveMarketData).length === 0) return;
    if (Date.now() - lastSnapshotRef.current < 10 * 60 * 1000) return;

    const today = dayKey();
    const monthStart = `${activeLeague.currentMonth}-01`;
    const targets = activeMembership.isAdmin
        ? leaguePlayers.filter(p => p.isPlayer)
        : leaguePlayers.filter(p => p.isPlayer && p.userId === user?.uid);

    const batch = writeBatch(db);
    let writes = 0;
    targets.forEach(p => {
        const ref = doc(db, 'artifacts', appId, 'public', 'data', 'league_players', p.id);
        const update = {};
        // Anchor the line at the month's start value, whenever the month was opened.
        if (p.valueHistory?.[monthStart] === undefined && p.startValue) {
            update[`valueHistory.${monthStart}`] = parseFloat(Number(p.startValue).toFixed(2));
        }
        const value = parseFloat(portfolioValueOf(p).toFixed(2));
        const stored = p.valueHistory?.[today];
        if (stored === undefined || Math.abs(stored - value) > Math.max(0.01, Math.abs(stored) * 0.0025)) {
            update[`valueHistory.${today}`] = value;
        }
        if (Object.keys(update).length > 0) { batch.update(ref, update); writes++; }
    });

    if (writes > 0) {
      lastSnapshotRef.current = Date.now();
      batch.commit().catch(err => console.error('Value snapshot failed:', err));
    }
  }, [liveMarketData, activeLeague?.status, activeLeague?.currentMonth, leaguePlayers.length]);

  // --- 1. Authentication & Pre-fetching ---

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid));
        if (userDoc.exists()) {
          setHasProfile(true);
          setLoginName(userDoc.data().name);
        }

        const mQuery = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'league_players'), 
            where('userId', '==', u.uid)
        );
        const mSnap = await getDocs(mQuery);
        const mList = mSnap.docs.map(d => d.data());
        setMemberships(mList);
        if (mList.length > 0) setActiveMembership(mList[0]);

        const sSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'stocks'));
        setMasterStocks(sSnap.docs.map(d => d.data()));

        setIsDataLoaded(true);
      } else {
        setUser(null);
        setMemberships([]);
        setActiveMembership(null);
        setActiveLeague(null);
        setHasProfile(false);
        setIsDataLoaded(true); 
      }
      setIsLoading(false);
    });
    return unsub;
  }, []);

  // --- 2. Data Listeners ---

  useEffect(() => {
    if (!user || !hasProfile) return;
    const q = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'league_players'), 
        where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => d.data());
        setMemberships(list);
        if (list.length > 0 && !activeMembership) setActiveMembership(list[0]);
    });
    return unsub;
  }, [user, hasProfile]);

  useEffect(() => {
    if (!activeMembership) return;
    const leagueRef = doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId);
    const unsubLeague = onSnapshot(leagueRef, (docSnap) => {
        if (docSnap.exists()) {
            setActiveLeague(docSnap.data());
            if (!newLeagueNameSetting) setNewLeagueNameSetting(docSnap.data().name);
        } else {
            setActiveLeague(null);
            setActiveMembership(null);
            setLeaguePlayers([]);
            setCurrentView('dashboard');
        }
    });

    const playersQ = query(
        collection(db, 'artifacts', appId, 'public', 'data', 'league_players'), 
        where('leagueId', '==', activeMembership.leagueId)
    );
    const unsubPlayers = onSnapshot(playersQ, (snapshot) => {
        const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id })); 
        setLeaguePlayers(list);
        const me = list.find(p => p.userId === user?.uid);
        if (me) setActiveMembership(me);
    });
    return () => {
        unsubLeague();
        unsubPlayers();
    };
  }, [activeMembership?.leagueId]);

  useEffect(() => {
    const stocksRef = collection(db, 'artifacts', appId, 'public', 'data', 'stocks');
    const unsub = onSnapshot(stocksRef, (snapshot) => {
      const list = snapshot.docs.map(d => d.data());
      if (list.length === 0) {
        INITIAL_STOCKS.forEach(s => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stocks', s.id), s));
      }
      setMasterStocks(list);
    });
    return unsub;
  }, []);

  // --- 3. Real-time Data ---

  // Price only what this league can actually trade — the global catalogue grows
  // with every league and Finnhub is rate limited.
  const trackedTickers = activeLeague?.stockPool?.length
    ? activeLeague.stockPool
    : masterStocks.map(s => s.id);

  // One pass over the pool, merged onto the prices we already hold. Returns the
  // merged map, or null when nothing usable came back. Never publishes — the
  // caller decides whether this sweep is the league's or just this device's.
  const sweepQuotes = async () => {
    const newData = { ...liveMarketData };
    let hasUpdates = false;

    for (const ticker of trackedTickers) {
      try {
        await sleep(1100);
        const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`);

        if (quoteRes.status === 429) {
          // Back off for a full minute rather than burning the rest of the sweep.
          rateLimitedUntilRef.current = Date.now() + 60000;
          console.warn('Finnhub rate limit hit — keeping last known prices for this cycle.');
          break;
        }

        const quoteData = await quoteRes.json();
        const price = Number(quoteData.c);

        // A zero or missing quote means the read failed (unknown symbol, throttled,
        // or not covered by the plan) — it is never a real price. Keep the last
        // good value instead of overwriting it with something that scores as $0.
        if (!Number.isFinite(price) || price <= 0) {
          console.warn(`No usable quote for ${ticker} — keeping previous price.`);
          continue;
        }

        const prevClose = Number(quoteData.pc);
        const existingOpen = Number(newData[ticker]?.monthOpen);
        const monthOpen = existingOpen > 0 ? existingOpen : (prevClose > 0 ? prevClose : price);

        // `pc` is the previous close — keep it so we can show today's move.
        // Finnhub also sends `dp` (day change %); prefer it when present.
        newData[ticker] = {
          c: price,
          monthOpen,
          pc: prevClose > 0 ? prevClose : null,
          dp: Number.isFinite(Number(quoteData.dp)) ? Number(quoteData.dp) : null,
        };
        hasUpdates = true;
      } catch (err) { console.error(`Error fetching ${ticker}:`, err); }
    }
    return hasUpdates ? newData : null;
  };

  // Take a short lease so four open tabs don't all sweep at once. False means
  // someone else already refreshed recently, or is mid-sweep right now.
  const claimSweep = async () => {
    try {
      return await runTransaction(db, async (tx) => {
        const snap = await tx.get(PRICES_DOC);
        const data = snap.exists() ? snap.data() : {};
        const now = Date.now();
        if (now - Number(data.updatedAt || 0) < PRICE_REFRESH_MS) return false;
        if (now < Number(data.sweepingUntil || 0)) return false;
        tx.set(PRICES_DOC, { sweepingUntil: now + SWEEP_LEASE_MS }, { merge: true });
        return true;
      });
    } catch (err) {
      console.warn('Shared prices unavailable — falling back to a local sweep.', err);
      sharedPricesBrokenRef.current = true;
      return false;
    }
  };

  const publishQuotes = async (quotes) => {
    try {
      await setDoc(PRICES_DOC, {
        quotes,
        updatedAt: Date.now(),
        updatedBy: user?.uid || null,
        sweepingUntil: 0,
      }, { merge: true });
    } catch (err) {
      console.warn('Could not publish shared prices — keeping them on this device.', err);
      sharedPricesBrokenRef.current = true;
    }
  };

  // Refresh the league's prices if they've aged out. `force` skips both the age
  // check and the lease: opening or closing a month is the commissioner asking
  // for the freshest numbers there are, and it's worth the extra calls.
  const refreshPrices = async ({ force = false } = {}) => {
    if (trackedTickers.length === 0) return null;

    if (FINNHUB_API_KEY === "YOUR_FINNHUB_KEY") {
      // No key configured — simulate on this device only. Fake prices must never
      // reach the shared document, where they'd score everyone's month.
      const fake = {};
      trackedTickers.forEach(id => {
        const current = 150 + Math.random() * 10;
        fake[id] = { c: current, monthOpen: 145, pc: 148, dp: ((current - 148) / 148) * 100 };
      });
      setLiveMarketData(fake);
      return fake;
    }

    if (sweepInFlightRef.current) return null;
    // The free tier's 60 calls/minute are shared across every client using the
    // key, so stand down completely once we've tripped it.
    if (Date.now() < rateLimitedUntilRef.current) return null;

    const shared = !sharedPricesBrokenRef.current;
    if (!force) {
      // The lease is what paces us normally. Without it — shared prices are
      // unreachable — this client is on its own clock, and the checker runs every
      // minute, so throttle here or we'd sweep five times as often as before.
      if (shared) {
        if (!(await claimSweep())) return null;
      } else if (Date.now() - lastLocalSweepRef.current < PRICE_REFRESH_MS) {
        return null;
      }
    }
    lastLocalSweepRef.current = Date.now();

    sweepInFlightRef.current = true;
    try {
      const quotes = await sweepQuotes();
      if (!quotes) return null;
      if (shared && !sharedPricesBrokenRef.current) await publishQuotes(quotes);
      // The listener below will hand this back to us, but set it now so a forced
      // refresh can be read by its caller without waiting for the round trip.
      setLiveMarketData(quotes);
      return quotes;
    } finally {
      sweepInFlightRef.current = false;
    }
  };

  // The single source of truth. Whatever lands here replaces local state
  // outright, so every device scores the month off identical numbers — the
  // localStorage copy is only ever a seed for the first paint.
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(PRICES_DOC, (snap) => {
      const quotes = snap.data()?.quotes;
      if (!quotes || typeof quotes !== 'object') return;
      const clean = Object.fromEntries(Object.entries(quotes).filter(([, v]) => Number(v?.c) > 0));
      if (Object.keys(clean).length > 0) setLiveMarketData(clean);
    }, (err) => {
      console.warn('Cannot read shared prices — falling back to local sweeps.', err);
      sharedPricesBrokenRef.current = true;
    });
    return unsub;
  }, [user]);

  // Scoring is monthly, so five-minute freshness is plenty. Each client checks
  // the age of the shared prices every minute and only reaches for Finnhub when
  // they've gone stale and nobody else has claimed the sweep. Total API usage is
  // one sweep per five minutes no matter how many people have the app open.
  useEffect(() => {
    if (!user) return;
    refreshPrices();
    const interval = setInterval(() => { refreshPrices(); }, PRICE_CHECK_MS);
    return () => clearInterval(interval);
  }, [user, trackedTickers.length, activeLeague?.id]);

  // --- 4. User Actions ---

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (isSignUp) {
        if (!loginName) throw new Error("Name required.");
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', cred.user.uid), { 
            name: loginName, 
            email: email 
        });
        setHasProfile(true);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', cred.user.uid));
        if (userDoc.exists()) setHasProfile(true);
      }
    } catch (err) { alert(err.message); }
    setIsProcessing(false);
  };

  const handleCreateLeague = async (e) => {
      e?.preventDefault();
      const draft = setupDraft;
      if (!draft.name.trim()) return alert("Give the league a name.");
      if (draft.seasonEnd < draft.seasonStart) return alert("The season must end after it starts.");
      if (draft.pool.length === 0) return alert("Add at least one stock to the pool.");

      setIsProcessing(true);
      const newLeagueId = Math.floor(100000 + Math.random() * 900000).toString();
      const playoffMonth = addMonths(draft.seasonEnd, 1);
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', newLeagueId), {
              id: newLeagueId,
              name: draft.name.trim(),
              adminUid: user.uid,
              maxPlayers: Number(draft.maxPlayers) || DEFAULT_MAX_PLAYERS,
              seasonStart: draft.seasonStart,
              seasonEnd: draft.seasonEnd,
              playoffMonth,
              currentMonth: draft.seasonStart,
              monthlyAllowance: Number(draft.monthlyAllowance) || DEFAULT_ALLOWANCE,
              stockPool: draft.pool,
              status: 'setup',
              schedule: {},
              matchups: [],
              startingPrices: {},
              initialPrices: {},
              createdAt: Date.now(),
          });
          const playerDocId = `${newLeagueId}_${user.uid}`;
          const membershipData = {
              userId: user.uid, leagueId: newLeagueId, leagueName: draft.name.trim(),
              name: loginName || user.email?.split('@')[0] || 'Player',
              isAdmin: true, isPlayer: draft.adminPlays, roster: [], cash: 0,
              franchiseStocks: [], wins: 0, losses: 0, points: 0, avatar: ''
          };
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', playerDocId), membershipData);
          setActiveMembership(membershipData);
          closeOnboarding();
          setCurrentView('admin');
          // Overwrite the modal's history entry rather than leaving a dead one
          // behind, so Back goes to the screen before the modal opened.
          replaceScreen({ view: 'admin', overlay: null });
      } catch (err) { alert(err.message); }
      setIsProcessing(false);
  };

  const handleJoinLeague = async (e) => {
      e?.preventDefault();
      setIsProcessing(true);
      try {
          const leagueDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', joinLeagueId.trim()));
          if (!leagueDoc.exists()) throw new Error("No league found with that code.");
          const leagueData = leagueDoc.data();

          const playersQ = query(
              collection(db, 'artifacts', appId, 'public', 'data', 'league_players'),
              where('leagueId', '==', joinLeagueId.trim())
          );
          const existing = await getDocs(playersQ);
          const alreadyIn = existing.docs.some(d => d.data().userId === user.uid);
          const seatsTaken = existing.docs.filter(d => d.data().isPlayer).length;
          if (!alreadyIn && leagueData.maxPlayers && seatsTaken >= leagueData.maxPlayers) {
              throw new Error(`${leagueData.name} is full (${leagueData.maxPlayers} players).`);
          }

          const playerDocId = `${joinLeagueId.trim()}_${user.uid}`;
          const membershipData = {
              userId: user.uid, leagueId: joinLeagueId.trim(), leagueName: leagueData.name,
              name: loginName || user.email?.split('@')[0] || 'Player',
              isAdmin: false, isPlayer: true, roster: [], cash: 0,
              franchiseStocks: [], wins: 0, losses: 0, points: 0, avatar: ''
          };
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', playerDocId), membershipData);
          setActiveMembership(membershipData);
          setJoinLeagueId('');
          closeOnboarding();
          replaceScreen({ view: currentView, overlay: null });
      } catch (err) { alert(err.message); }
      setIsProcessing(false);
  };

  const closeOnboarding = () => {
      setShowLeagueCreator(false);
      setOnboardingMode(null);
      setSetupStep(0);
      setPoolSearch('');
  };

  // Look a ticker up on Finnhub so the pool stores a real company name.
  const searchTicker = async (raw) => {
      const ticker = raw.trim().toUpperCase();
      if (!ticker) return null;
      let name = ticker;
      try {
          const res = await fetch(`https://finnhub.io/api/v1/search?q=${ticker}&token=${FINNHUB_API_KEY}`);
          const data = await res.json();
          const exact = data.result?.find(r => r.symbol === ticker) || data.result?.[0];
          if (exact) name = exact.description || ticker;
      } catch (err) { console.error("Ticker lookup failed", err); }
      return { id: ticker, name, sector: 'Unknown' };
  };

  const addTickerToDraft = async () => {
      const ticker = poolSearch.trim().toUpperCase();
      if (!ticker) return;
      if (setupDraft.pool.includes(ticker)) { setPoolSearch(''); return; }
      setIsSearchingPool(true);
      const stock = await searchTicker(ticker);
      if (stock) {
          // Keep the global catalogue in sync so every league can reuse the lookup.
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stocks', stock.id), stock);
          setSetupDraft(d => ({ ...d, pool: [...d.pool, stock.id] }));
      }
      setPoolSearch('');
      setIsSearchingPool(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) return alert("File too large. Max 500KB.");
    const reader = new FileReader();
    reader.onloadend = () => setEditingAvatar(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!loginName.trim() || !user) return;
    setIsProcessing(true);
    try {
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid);
      await setDoc(userRef, { name: loginName, email: user.email, createdAt: Date.now() });
      setHasProfile(true);
      setLoginName(loginName); 
    } catch (err) { alert(err.message); }
    setIsProcessing(false);
  };

  const handleUpdateProfile = async (e) => {
      e.preventDefault();
      if (!activeMembership || !editingName.trim()) return;
      const playerDocId = `${activeMembership.leagueId}_${user.uid}`;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', playerDocId), {
          name: editingName,
          avatar: editingAvatar || activeMembership.avatar || ''
      });
      closeOverlay(() => setShowProfile(false));
  };

  const handleDeleteLeague = async () => {
    if (!activeMembership?.isAdmin) return;
    if (confirm("Are you sure you want to PERMANENTLY DELETE this league?")) {
        setIsProcessing(true);
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId));
            const batch = writeBatch(db);
            const playersQ = query(
                collection(db, 'artifacts', appId, 'public', 'data', 'league_players'), 
                where('leagueId', '==', activeMembership.leagueId)
            );
            const playerSnaps = await getDocs(playersQ);
            playerSnaps.forEach(d => batch.delete(d.ref));
            await batch.commit();
            setMemberships(prev => prev.filter(m => m.leagueId !== activeMembership.leagueId));
            setActiveMembership(null);
            setActiveLeague(null);
            setCurrentView('dashboard');
        } catch (err) { alert("Error deleting league: " + err.message); }
        setIsProcessing(false);
    }
  };

  // --- ADMIN: MATCHUP & STATS EDITING ---

  // The open month lives in two places — the live `matchups` array and its slot in
  // `schedule` — so every edit has to write both or the results editor goes stale.
  const saveCurrentMatchups = async (newMatchups) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
        matchups: newMatchups,
        schedule: { ...(activeLeague.schedule || {}), [activeLeague.currentMonth]: newMatchups },
    });
  };

  const handleUpdateMatchup = async (index, field, value) => {
    if (!activeLeague || !activeMembership?.isAdmin) return;
    const newMatchups = [...(activeLeague.matchups || [])];
    newMatchups[index] = { ...newMatchups[index], [field]: value };

    if (field === 'p1' || field === 'p2') {
         const p = leaguePlayers.find(player => player.userId === value);
         const nameField = field === 'p1' ? 'p1Name' : 'p2Name';
         newMatchups[index][nameField] = p ? p.name : 'BYE';
         const scoreField = field === 'p1' ? 'p1Score' : 'p2Score';
         if (value === 'BYE') newMatchups[index][scoreField] = 0;
    }
    await saveCurrentMatchups(newMatchups);
  };

  const handleAddMatchup = async () => {
    if (!activeLeague || !activeMembership?.isAdmin) return;
    const newMatchups = [...(activeLeague.matchups || [])];
    newMatchups.push({
        p1: 'BYE', p1Name: 'Select Player',
        p2: 'BYE', p2Name: 'Select Player',
        p1Score: 0, p2Score: 0,
        type: 'Custom Matchup'
    });
    await saveCurrentMatchups(newMatchups);
  };

  const handleDeleteMatchup = async (index) => {
    if (!activeLeague || !activeMembership?.isAdmin) return;
    if (!confirm("Delete this matchup?")) return;
    const newMatchups = [...(activeLeague.matchups || [])];
    newMatchups.splice(index, 1);
    await saveCurrentMatchups(newMatchups);
  };

  const handleUpdatePlayerStats = async (playerId, field, value) => {
      const val = parseInt(value);
      if (isNaN(val)) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', playerId), { [field]: val });
  };

  // --- 5. Game Logic ---

  const addToTeam = async (stockId) => {
    if (!activeMembership?.isPlayer) return;
    const roster = activeMembership.roster || [];
    if (roster.find((i) => i.id === stockId)) return alert("Already owned!");
    if (roster.length >= 30) return alert("Roster full! Max 30 stocks.");
    const owner = franchiseOwners[stockId];
    if (owner && owner.userId !== user.uid) return alert(`${stockId} is ${owner.name}'s franchise stock.`);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'league_players', `${activeMembership.leagueId}_${user.uid}`);
    await updateDoc(docRef, { roster: [...roster, { id: stockId, shares: 0 }] });
  };

  const updateShares = async (stockId, newShares) => {
    if (!activeMembership?.isPlayer) return;
    const shares = parseFloat(newShares);
    if (isNaN(shares) || shares < 0) return;
    const roster = activeMembership.roster || [];
    const newRoster = roster.map((i) => i.id === stockId ? { ...i, shares } : i);
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'league_players', `${activeMembership.leagueId}_${user.uid}`);
    await updateDoc(docRef, { roster: newRoster });
  };

  const updateCash = async (newCash) => {
      if (!activeMembership?.isPlayer) return;
      const cash = parseFloat(newCash);
      if (isNaN(cash) || cash < 0) return;
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'league_players', `${activeMembership.leagueId}_${user.uid}`);
      await updateDoc(docRef, { cash: cash });
  };

  // Cash and share fields write to Firestore as you type and display whatever
  // came back, which makes a decimal point impossible to enter: parseFloat('12.')
  // is 12, so the dot is erased the moment it's typed. Hold the raw text while
  // the field is focused and let go of it on blur, so the number still commits on
  // every keystroke but the caret keeps whatever was actually typed.
  const draftField = (key, stored, commit) => ({
      value: teamDrafts[key] ?? String(stored ?? ''),
      onChange: (e) => {
          const raw = e.target.value;
          setTeamDrafts(d => ({ ...d, [key]: raw }));
          commit(raw);
      },
      onBlur: () => setTeamDrafts(d => {
          const next = { ...d };
          delete next[key];
          return next;
      }),
  });

  const removeFromTeam = async (stockId) => {
      const roster = activeMembership.roster.filter((i) => i.id !== stockId);
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'league_players', `${activeMembership.leagueId}_${user.uid}`);
      await updateDoc(docRef, { roster });
  };

  // `startingPrices` — the opening price on the first trading day of the current
  // month. Drives MTD.
  const updateMonthOpenPrice = async (stockId) => {
      if (!activeMembership?.isAdmin) return;
      const current = activeLeague.startingPrices?.[stockId] || '';
      const newVal = prompt(`${stockId} — opening price for ${monthLabel(activeLeague.currentMonth)}`, current);
      if (newVal === null) return;
      const price = parseFloat(newVal);
      if (isNaN(price) || price <= 0) return alert("Enter a price greater than zero.");
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
          [`startingPrices.${stockId}`]: price,
      });
  };

  // `initialPrices` — the opening price on the first trading day of the league's
  // first month. Drives TOT, and never changes once the season is under way.
  const updateSeasonOpenPrice = async (stockId) => {
      if (!activeMembership?.isAdmin) return;
      const current = activeLeague.initialPrices?.[stockId] || '';
      const newVal = prompt(`${stockId} — opening price at the start of the season (${monthLabel(activeLeague.seasonStart)})`, current);
      if (newVal === null) return;
      const price = parseFloat(newVal);
      if (isNaN(price) || price <= 0) return alert("Enter a price greater than zero.");
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
          [`initialPrices.${stockId}`]: price,
      });
  };

  // --- Calculations ---

  // Live quote first, then the month's base price, then the league's opening
  // price. Returns 0 only when nothing is known — callers show that as "no quote"
  // rather than pricing the position at zero.
  const priceOf = (stockId) => {
      const live = Number(liveMarketData[stockId]?.c);
      if (live > 0) return live;
      const base = Number(activeLeague?.startingPrices?.[stockId]);
      if (base > 0) return base;
      const initial = Number(activeLeague?.initialPrices?.[stockId]);
      return initial > 0 ? initial : 0;
  };

  const hasPrice = (stockId) => priceOf(stockId) > 0;

  const portfolioValueOf = (player) => {
      let total = parseFloat(player?.cash) || 0;
      (player?.roster || []).forEach(item => {
          total += (parseFloat(item.shares) || 0) * priceOf(item.id);
      });
      return total;
  };

  // How much a team's book moved today: current prices against yesterday's
  // closes, with cash held constant. Null until quotes carry a previous close,
  // or when the team holds nothing priced.
  const dayChangeOf = (player) => {
      const cash = parseFloat(player?.cash) || 0;
      let today = cash;
      let yesterday = cash;
      let priced = false;
      (player?.roster || []).forEach(item => {
          const shares = parseFloat(item.shares) || 0;
          const now = Number(liveMarketData[item.id]?.c) || 0;
          const prev = Number(liveMarketData[item.id]?.pc) || 0;
          if (now > 0 && prev > 0) {
              priced = true;
              today += shares * now;
              yesterday += shares * prev;
          } else {
              // Unknown mover — carry it at one price so it cancels out.
              const flat = priceOf(item.id);
              today += shares * flat;
              yesterday += shares * flat;
          }
      });
      if (!priced || yesterday <= 0) return null;
      return ((today - yesterday) / yesterday) * 100;
  };

  // A stock's move since the month opened, used in the matchup breakdown.
  const stockMonthChange = (stockId) => {
      const base = activeLeague?.startingPrices?.[stockId] || liveMarketData[stockId]?.monthOpen;
      const price = liveMarketData[stockId]?.c;
      if (!base || !price) return null;
      return ((price - base) / base) * 100;
  };

  const calculateReturn = (roster, cash, basePrices, manualStartValue) => {
      let currentValue = parseFloat(cash) || 0;
      if (roster && Array.isArray(roster)) {
          roster.forEach(item => {
              const shares = parseFloat(item.shares) || 0;
              // Live quote, else this month's base, else the league open — a
              // failed price read must not value the position at zero.
              const live = Number(liveMarketData[item.id]?.c);
              const base = Number(basePrices?.[item.id]);
              const currPrice = live > 0 ? live : (base > 0 ? base : priceOf(item.id));
              currentValue += shares * currPrice;
          });
      }
      let startValue = 0;
      if (manualStartValue !== undefined && manualStartValue !== null && manualStartValue !== "") {
          startValue = parseFloat(manualStartValue);
      } else {
          startValue = parseFloat(cash) || 0;
          if (roster && Array.isArray(roster)) {
              roster.forEach(item => {
                  const shares = parseFloat(item.shares) || 0;
                  // Falling back to $1 here would read as a ~10,000% gain. With no
                  // base price, use the current price so the holding scores flat.
                  const base = Number(basePrices?.[item.id]);
                  const startPrice = base > 0 ? base : priceOf(item.id);
                  startValue += shares * startPrice;
              });
          }
      }
      if (startValue === 0) return 0;
      return ((currentValue - startValue) / startValue) * 100;
  };

  // --- Schedule & Sim ---

  const seasonMonths = monthRange(activeLeague?.seasonStart, activeLeague?.seasonEnd);
  const allMonths = activeLeague?.playoffMonth ? [...seasonMonths, activeLeague.playoffMonth] : seasonMonths;
  const isPlayoffMonth = activeLeague?.currentMonth && activeLeague.currentMonth === activeLeague.playoffMonth;

  // --- Record book ---------------------------------------------------------
  // Archived seasons live on the league document; the season in progress is
  // assembled from the live schedule so a record set this month appears at once.
  const currentSeasonRecord = activeLeague ? {
      label: seasonLabel(activeLeague.seasonStart, activeLeague.playoffMonth || activeLeague.seasonEnd),
      seasonStart: activeLeague.seasonStart,
      seasonEnd: activeLeague.seasonEnd,
      playoffMonth: activeLeague.playoffMonth || null,
      champion: championFrom(activeLeague.schedule, activeLeague.playoffMonth),
      standings: leaguePlayers.filter(p => p.isPlayer)
          .map(p => ({ userId: p.userId, name: p.name, wins: Number(p.wins) || 0, losses: Number(p.losses) || 0, points: Number(p.points) || 0 }))
          .sort((a, b) => b.wins - a.wins || b.points - a.points),
      months: teamMonthsFromSchedule(activeLeague.schedule),
      inProgress: true,
  } : null;

  const allSeasons = [...(activeLeague?.seasons || []), ...(currentSeasonRecord ? [currentSeasonRecord] : [])];

  const recordBook = (() => {
      const months = [];
      const seasonReturns = [];
      const titles = new Map();
      const careers = new Map();

      allSeasons.forEach(s => {
          (s.months || []).forEach(r => months.push({ ...r, season: s.label }));

          const byTeam = new Map();
          (s.months || []).forEach(r => {
              if (!byTeam.has(r.userId)) byTeam.set(r.userId, { name: r.name, scores: [] });
              byTeam.get(r.userId).scores.push(r.score);
          });
          // A season still being played has months left to change it, so it can't
          // hold a season record yet — its individual months still count.
          if (!s.inProgress) {
              byTeam.forEach((v, userId) => seasonReturns.push({
                  userId, name: v.name, season: s.label, pct: compoundReturn(v.scores),
              }));
          }

          // A backfilled title may name a team that predates the app and has no
          // account, so fall back to the name itself as the identity.
          const champKey = s.champion?.userId
              || (s.champion?.name ? `name:${String(s.champion.name).trim().toLowerCase()}` : null);
          if (champKey) {
              const t = titles.get(champKey) || { name: s.champion.name, userId: s.champion.userId || null, seasons: [] };
              t.name = s.champion.name;
              t.seasons.push(s.label);
              titles.set(champKey, t);
          }

          (s.standings || []).forEach(st => {
              const c = careers.get(st.userId) || { name: st.name, userId: st.userId, wins: 0, losses: 0, seasons: 0, titles: 0 };
              c.name = st.name;
              c.wins += st.wins;
              c.losses += st.losses;
              c.seasons += 1;
              careers.set(st.userId, c);
          });
      });

      titles.forEach((t, key) => {
          const careerKey = t.userId || key;
          const c = careers.get(careerKey);
          // A team whose only appearances are backfilled titles still belongs in
          // the all-time list — with the trophies and nothing else.
          if (c) c.titles = t.seasons.length;
          else careers.set(careerKey, { name: t.name, userId: t.userId, wins: 0, losses: 0, seasons: 0, titles: t.seasons.length });
      });

      const byScore = [...months].sort((a, b) => b.score - a.score);
      const byPct = [...seasonReturns].sort((a, b) => b.pct - a.pct);

      return {
          months,
          bestMonth: byScore[0] || null,
          worstMonth: byScore.length ? byScore[byScore.length - 1] : null,
          bestSeason: byPct[0] || null,
          worstSeason: byPct.length ? byPct[byPct.length - 1] : null,
          titles: [...titles.entries()].map(([key, t]) => ({ key, ...t }))
              .sort((a, b) => b.seasons.length - a.seasons.length || a.name.localeCompare(b.name)),
          careers: [...careers.entries()].map(([key, c]) => ({ key, ...c }))
              .sort((a, b) => b.titles - a.titles || b.wins - a.wins || a.name.localeCompare(b.name)),
      };
  })();

  const generateSeasonSchedule = () => {
      const playingMembers = leaguePlayers.filter(p => p.isPlayer);
      const schedule = {};
      monthRange(activeLeague.seasonStart, activeLeague.seasonEnd).forEach(month => {
          const shuffled = [...playingMembers].sort(() => 0.5 - Math.random());
          const pairs = [];
          for(let i=0; i<shuffled.length; i+=2) {
              if (i+1 < shuffled.length) pairs.push({ p1: shuffled[i].userId, p2: shuffled[i+1].userId, p1Name: shuffled[i].name, p2Name: shuffled[i+1].name, p1Score:0, p2Score:0 });
              else pairs.push({ p1: shuffled[i].userId, p2: 'BYE', p1Name: shuffled[i].name, p2Name: 'Bye Week', p1Score:0, p2Score:0 });
          }
          schedule[month] = pairs;
      });
      return schedule;
  };

  const generatePlayoffs = () => {
      const sorted = [...leaguePlayers].filter(p => p.isPlayer).sort((a,b) => b.wins - a.wins || b.points - a.points);
      const matchups = [];
      if (sorted.length >= 2) matchups.push({ p1: sorted[0].userId, p2: sorted[1].userId, p1Name: sorted[0].name, p2Name: sorted[1].name, p1Score:0, p2Score:0, type: 'Championship' });
      if (sorted.length >= 4) matchups.push({ p1: sorted[2].userId, p2: sorted[3].userId, p1Name: sorted[2].name, p2Name: sorted[3].name, p1Score:0, p2Score:0, type: 'Consolation' });
      else if (sorted.length === 3) matchups.push({ p1: sorted[2].userId, p2: 'BYE', p1Name: sorted[2].name, p2Name: 'Bye Week', p1Score:0, p2Score:0, type: 'Consolation' });
      for (let i = 4; i < sorted.length; i+=2) {
          if (i+1 < sorted.length) matchups.push({ p1: sorted[i].userId, p2: sorted[i+1].userId, p1Name: sorted[i].name, p2Name: sorted[i+1].name, p1Score:0, p2Score:0, type: 'Exhibition' });
          else matchups.push({ p1: sorted[i].userId, p2: 'BYE', p1Name: sorted[i].name, p2Name: 'Bye Week', p1Score:0, p2Score:0, type: 'Exhibition' });
      }
      return matchups;
  };

  const startLeague = async () => {
      if (leaguePlayers.filter(p => p.isPlayer).length < 2) return alert("You need at least 2 players before generating a schedule.");
      const sched = generateSeasonSchedule();
      const first = activeLeague.seasonStart;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
          status: 'ready', schedule: sched, currentMonth: first, matchups: sched[first] || []
      });
  };

  // Seasons the league played before it was ever in the app. They carry a
  // champion and nothing else — there are no scores behind them, so they add to
  // the trophy count without being able to set month or season records.
  const addPastChampionship = async () => {
      if (!activeMembership?.isAdmin) return;
      const label = pastTitle.label.trim();
      const name = pastTitle.name.trim();
      if (!label || !name) return alert('Enter both a season and a champion.');
      if ((activeLeague?.seasons || []).some(s => String(s.label) === label)) {
          return alert(`${label} is already in the book. Remove it first if you want to change it.`);
      }
      // Link to a current player when the name matches one, so their avatar and
      // all-time row pick the title up rather than it standing on its own.
      const match = leaguePlayers.find(p => p.isPlayer && String(p.name).trim().toLowerCase() === name.toLowerCase());
      const entry = {
          label,
          manual: true,
          champion: { userId: match?.userId || null, name: match?.name || name },
          standings: [],
          months: [],
          seasonStart: null,
          seasonEnd: null,
          playoffMonth: null,
          addedAt: Date.now(),
      };
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
          seasons: [...(activeLeague?.seasons || []), entry],
      });
      setPastTitle({ label: '', name: '' });
  };

  // Only hand-added seasons can be removed — an archived season is the sole
  // surviving copy of the months it holds.
  const removePastChampionship = async (label) => {
      if (!activeMembership?.isAdmin) return;
      if (!confirm(`Remove the ${label} championship from the record book?`)) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
          seasons: (activeLeague?.seasons || []).filter(s => !(s.manual && String(s.label) === String(label))),
      });
  };

  // Rolls the league into a new year. The finished season is archived onto the
  // league document in the same batch that clears the schedule it was built from
  // — the archive is the only copy once this commits, so it cannot be a
  // follow-up write that might not land.
  const startNextSeason = async () => {
      if (!activeMembership?.isAdmin || !activeLeague) return;
      const start = nextSeason.seasonStart || addMonths(activeLeague.seasonStart, 12);
      const end = nextSeason.seasonEnd || addMonths(activeLeague.seasonEnd, 12);
      if (!start || !end || end < start) return alert('The new season must end after it starts.');

      const played = teamMonthsFromSchedule(activeLeague.schedule);
      const record = {
          label: seasonLabel(activeLeague.seasonStart, activeLeague.playoffMonth || activeLeague.seasonEnd),
          seasonStart: activeLeague.seasonStart || null,
          seasonEnd: activeLeague.seasonEnd || null,
          playoffMonth: activeLeague.playoffMonth || null,
          champion: championFrom(activeLeague.schedule, activeLeague.playoffMonth),
          standings: leaguePlayers.filter(p => p.isPlayer)
              .map(p => ({ userId: p.userId, name: p.name, wins: Number(p.wins) || 0, losses: Number(p.losses) || 0, points: Number(p.points) || 0 }))
              .sort((a, b) => b.wins - a.wins || b.points - a.points),
          months: played,
          // The raw schedule is small and is the only surviving copy of who
          // played whom once the live one is cleared. Month snapshots are
          // deliberately not archived — they carry a full price book per month
          // and would grow the league document without bound.
          schedule: activeLeague.schedule || {},
          archivedAt: Date.now(),
      };

      const newPlayoff = addMonths(end, 1);
      const warning = record.champion
          ? `${record.champion.name} goes into the book as ${record.label} champion.`
          : `No championship was scored, so ${record.label} is archived without a champion.`;
      const ok = confirm(
          `Archive ${record.label} and start ${seasonLabel(start, newPlayoff)}?\n\n${warning}\n\n` +
          `Every team's roster, cash, franchise stocks and W-L record will be cleared for a fresh start. ` +
          `The archived season stays in the Records tab permanently. This cannot be undone.`
      );
      if (!ok) return;

      const batch = writeBatch(db);
      batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
          seasons: [...(activeLeague.seasons || []), record],
          seasonStart: start,
          seasonEnd: end,
          playoffMonth: newPlayoff,
          currentMonth: start,
          status: 'setup',
          schedule: {},
          matchups: [],
          monthSnapshots: {},
          startingPrices: {},
          initialPrices: {},
      });
      leaguePlayers.filter(p => p.isPlayer).forEach(p => {
          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', p.id), {
              wins: 0, losses: 0, points: 0, roster: [], cash: 0,
              startValue: 0, franchiseStocks: [], valueHistory: {},
          });
      });
      await batch.commit();
      setNextSeason({ seasonStart: '', seasonEnd: '' });
  };

  // Every player's standings are derived from the recorded schedule rather than
  // incremented in place, so backfilled or corrected months always add up.
  const recomputeStandings = async (schedule) => {
      const totals = {};
      leaguePlayers.filter(p => p.isPlayer).forEach(p => { totals[p.userId] = { wins: 0, losses: 0, points: 0 }; });

      Object.values(schedule || {}).forEach(monthMatchups => {
          (monthMatchups || []).forEach(m => {
              if (!m.scored) return;
              const p1 = totals[m.p1];
              const p2 = m.p2 === 'BYE' ? null : totals[m.p2];
              if (p1) {
                  p1.points += Number(m.p1Score) || 0;
                  if (m.p2 === 'BYE') p1.wins += 1;
                  else if (m.p1Score > m.p2Score) p1.wins += 1;
                  else if (m.p1Score < m.p2Score) p1.losses += 1;
              }
              if (p2) {
                  p2.points += Number(m.p2Score) || 0;
                  if (m.p2Score > m.p1Score) p2.wins += 1;
                  else if (m.p2Score < m.p1Score) p2.losses += 1;
              }
          });
      });

      const batch = writeBatch(db);
      leaguePlayers.filter(p => p.isPlayer).forEach(p => {
          const t = totals[p.userId] || { wins: 0, losses: 0, points: 0 };
          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', p.id), {
              wins: t.wins, losses: t.losses, points: parseFloat(t.points.toFixed(2))
          });
      });
      await batch.commit();
  };

  // Opens a month: deposits everyone's allowance, then snapshots the value they
  // have to beat. Positions carry over from the previous month.
  const startMonth = async () => {
      // Read the sweep's own return value: setLiveMarketData won't have landed in
      // this closure yet, and these prices become the month's baseline.
      const fresh = (await refreshPrices({ force: true })) || liveMarketData;
      const allowance = Number(activeLeague.monthlyAllowance) || 0;
      const pool = activeLeague.stockPool || [];

      // A base price of 0 would make every holding of that ticker score as a total
      // loss, so carry the last good price forward and never write a zero.
      const starts = {};
      const missing = [];
      pool.forEach(id => {
          const live = Number(fresh[id]?.c);
          const prevBase = Number(activeLeague.startingPrices?.[id]);
          const prevInitial = Number(activeLeague.initialPrices?.[id]);
          if (live > 0) starts[id] = live;
          else if (prevBase > 0) starts[id] = prevBase;
          else if (prevInitial > 0) starts[id] = prevInitial;
          else missing.push(id);
      });

      if (missing.length > 0) {
          const proceed = confirm(
              `No price available for ${missing.join(', ')} — the market data feed didn't return one.\n\n` +
              `Open the month anyway? Those tickers will have no month-open price until you set one from the Market tab (pencil icon).`
          );
          if (!proceed) return;
      }

      const leagueUpdate = { status: 'active', startingPrices: starts };

      // Season-open prices are per-ticker and set once. Fill in any ticker that
      // doesn't have one yet — a stock added in August gets its August open,
      // which the commissioner can correct from Admin if it should be earlier.
      const seasonOpens = { ...(activeLeague.initialPrices || {}) };
      let addedSeasonOpens = false;
      Object.entries(starts).forEach(([id, price]) => {
          if (!(Number(seasonOpens[id]) > 0) && price > 0) {
              seasonOpens[id] = price;
              addedSeasonOpens = true;
          }
      });
      if (addedSeasonOpens) leagueUpdate.initialPrices = seasonOpens;

      const batch = writeBatch(db);
      batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), leagueUpdate);

      // Each team's baseline is the value captured when last month closed, plus
      // this month's allowance. Using the frozen close rather than revaluing at
      // click time means nothing falls between the two months, and the number
      // doesn't drift with how long the commissioner takes to open the month.
      const prevSnapshot = activeLeague.monthSnapshots?.[addMonths(activeLeague.currentMonth, -1)];

      leaguePlayers.filter(p => p.isPlayer).forEach(p => {
          const newCash = (parseFloat(p.cash) || 0) + allowance;

          const closedAt = Number(prevSnapshot?.teams?.[p.userId]?.endValue);
          let baseline;
          if (closedAt > 0) {
              // endValue already includes last month's cash, so only the new
              // allowance is added on top.
              baseline = closedAt + allowance;
          } else {
              // First month of the season, or a month with no snapshot: value the
              // book at this month's opening prices.
              let holdings = 0;
              (p.roster || []).forEach(item => {
                  holdings += (parseFloat(item.shares) || 0) * (starts[item.id] || 0);
              });
              baseline = holdings + newCash;
          }

          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', p.id), {
              cash: newCash,
              startValue: parseFloat(baseline.toFixed(2)),
          });
      });
      await batch.commit();
  };

  const endMonth = async () => {
      await refreshPrices({ force: true });
      const prices = activeLeague.startingPrices || {};
      const updates = (activeLeague.matchups || []).map((m) => {
          const p1 = leaguePlayers.find(p=>p.userId===m.p1);
          const p2 = leaguePlayers.find(p=>p.userId===m.p2);
          return {
              ...m,
              scored: true,
              p1Score: parseFloat(calculateReturn(p1?.roster, p1?.cash, prices, p1?.startValue).toFixed(2)),
              p2Score: m.p2 === 'BYE' ? 0 : parseFloat(calculateReturn(p2?.roster, p2?.cash, prices, p2?.startValue).toFixed(2))
          }
      });
      const newSchedule = { ...activeLeague.schedule, [activeLeague.currentMonth]: updates };

      // Freeze what the month actually looked like — closing prices and each
      // team's book. Rosters keep changing after this, so the recap writer has
      // no other way to describe a past month accurately.
      const closingPrices = {};
      (activeLeague.stockPool || []).forEach(id => {
          const price = priceOf(id);
          if (price > 0) closingPrices[id] = price;
      });
      const teams = {};
      leaguePlayers.filter(p => p.isPlayer).forEach(p => {
          teams[p.userId] = {
              name: p.name || 'Player',
              roster: (p.roster || []).map(i => ({ id: i.id, shares: parseFloat(i.shares) || 0 })),
              cash: parseFloat(p.cash) || 0,
              startValue: parseFloat(p.startValue) || 0,
              endValue: parseFloat(portfolioValueOf(p).toFixed(2)),
          };
      });

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
          status: 'completed',
          matchups: updates,
          schedule: newSchedule,
          [`monthSnapshots.${activeLeague.currentMonth}`]: {
              startPrices: prices,
              endPrices: closingPrices,
              teams,
              closedAt: Date.now(),
          },
      });
      await recomputeStandings(newSchedule);
  };

  const nextMonth = async () => {
      const nm = addMonths(activeLeague.currentMonth, 1);
      if (activeLeague.playoffMonth && nm > activeLeague.playoffMonth) return alert("Season complete — that was the final month.");
      const nextMatchups = nm === activeLeague.playoffMonth ? generatePlayoffs() : (activeLeague.schedule?.[nm] || []);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
          currentMonth: nm, status: 'ready', matchups: nextMatchups, startingPrices: {}
      });
  };

  // Skip the pointer to any month — used when a league starts partway through a
  // real-life season and the earlier months are being backfilled.
  const jumpToMonth = async (month) => {
      if (!activeMembership?.isAdmin || !month) return;
      const matchups = month === activeLeague.playoffMonth
          ? (activeLeague.schedule?.[month] || generatePlayoffs())
          : (activeLeague.schedule?.[month] || []);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
          currentMonth: month, status: 'ready', matchups, startingPrices: {}
      });
  };

  const resetToDraft = async () => {
    if (!activeMembership?.isAdmin) return;
    if (confirm("Reset this month? Matchups stay, but the month reopens and scores are cleared.")) {
      const cleared = (activeLeague.matchups || []).map(m => ({ ...m, scored: false, p1Score: 0, p2Score: 0 }));
      const newSchedule = { ...activeLeague.schedule, [activeLeague.currentMonth]: cleared };
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
        status: 'ready', matchups: cleared, schedule: newSchedule, startingPrices: {}
      });
      await recomputeStandings(newSchedule);
    }
  };

  // --- Backfill: record a past month's real results by hand ---

  const openBackfill = (month) => {
      const existing = activeLeague?.schedule?.[month] || [];
      const scores = {};
      existing.forEach((m, i) => {
          scores[`${i}_p1`] = m.p1Score ?? '';
          scores[`${i}_p2`] = m.p2Score ?? '';
      });
      setBackfillScores(scores);
      openOverlay('backfill', () => setBackfillMonth(month));
  };

  const saveBackfill = async () => {
      if (!activeMembership?.isAdmin || !backfillMonth) return;
      setIsProcessing(true);
      try {
          const monthMatchups = (activeLeague.schedule?.[backfillMonth] || []).map((m, i) => {
              const p1Raw = backfillScores[`${i}_p1`];
              const p2Raw = backfillScores[`${i}_p2`];
              return {
                  ...m,
                  scored: true,
                  p1Score: parseFloat(p1Raw) || 0,
                  p2Score: m.p2 === 'BYE' ? 0 : (parseFloat(p2Raw) || 0),
              };
          });
          const newSchedule = { ...activeLeague.schedule, [backfillMonth]: monthMatchups };
          const leagueUpdate = { schedule: newSchedule };
          // Keep the live matchup list in sync if we just edited the open month.
          if (backfillMonth === activeLeague.currentMonth) leagueUpdate.matchups = monthMatchups;
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), leagueUpdate);
          await recomputeStandings(newSchedule);
          closeOverlay(() => setBackfillMonth(null));
      } catch (err) { alert(err.message); }
      setIsProcessing(false);
  };

  // --- Franchise stocks ---

  const franchiseOwners = {};
  leaguePlayers.forEach(p => {
      (p.franchiseStocks || []).forEach(id => { franchiseOwners[id] = p; });
  });

  const toggleFranchiseStock = async (player, stockId) => {
      if (!activeMembership?.isAdmin) return;
      const current = player.franchiseStocks || [];
      const owned = current.includes(stockId);
      if (!owned) {
          if (current.length >= FRANCHISE_SLOTS) return alert(`${player.name} already has ${FRANCHISE_SLOTS} franchise stocks.`);
          const takenBy = franchiseOwners[stockId];
          if (takenBy && takenBy.userId !== player.userId) return alert(`${stockId} is already ${takenBy.name}'s franchise stock.`);
      }
      const next = owned ? current.filter(id => id !== stockId) : [...current, stockId];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', player.id), { franchiseStocks: next });
  };

  // --- League stock pool ---

  const updateStockPool = async (nextPool) => {
      if (!activeMembership?.isAdmin) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), { stockPool: nextPool });
  };

  const addTickerToPool = async () => {
      const ticker = newStockTicker.trim().toUpperCase();
      if (!ticker) return;
      const pool = activeLeague?.stockPool || [];
      if (pool.includes(ticker)) { setNewStockTicker(''); return; }
      setIsProcessing(true);
      const stock = await searchTicker(ticker);
      if (stock) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stocks', stock.id), stock);
          await updateStockPool([...pool, stock.id]);
      }
      setNewStockTicker('');
      setIsProcessing(false);
  };

  const removeFromPool = async (stockId) => {
      const owner = franchiseOwners[stockId];
      const message = owner
          ? `${stockId} is ${owner.name}'s franchise stock. Remove it from the pool anyway?`
          : `Remove ${stockId} from this league's pool?`;
      if (!confirm(message)) return;
      await updateStockPool((activeLeague?.stockPool || []).filter(id => id !== stockId));
  };

  // --- Views ---

  // Rendered on the signed-out screens too — a brand-new visitor is exactly who
  // this is for, and they haven't got past the login form yet.
  const installBanner = (hasNav) => showInstall ? (
      <InstallBanner
        platform={platformRef.current}
        canPrompt={!!installEvent}
        onInstall={acceptInstall}
        onDismiss={dismissInstall}
        hasNav={hasNav}
      />
  ) : null;

  if (isLoading || (user && hasProfile && !isDataLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gold-400/20 blur-xl" />
            <RefreshCw className="relative h-9 w-9 animate-spin text-gold-400" />
          </div>
          <p className="eyebrow animate-ticker-pulse">Loading FiveStar</p>
        </div>
      </div>
    );
  }

  if (!user) return (
    <>
    <AuthShell
      eyebrow="Five Star Fantasy Investment League"
      title={isSignUp ? 'Join the league' : 'Welcome back'}
      subtitle={isSignUp ? 'Draft tickers, run your book, beat your friends.' : 'Sign in to check your standings.'}
    >
      <form onSubmit={handleAuth} className="space-y-3">
        {isSignUp && <input value={loginName} onChange={e=>setLoginName(e.target.value)} className="field" placeholder="Player name" required />}
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="field" placeholder="Email" required />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="field" placeholder="Password" required />
        <button className="btn-gold w-full py-3.5" disabled={isProcessing}>
          {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <>{isSignUp ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></>}
        </button>
      </form>
      <div className="mt-6 border-t border-white/[0.07] pt-5 text-center">
        <button type="button" onClick={()=>setIsSignUp(!isSignUp)} className="text-sm text-slate-500 transition hover:text-gold-300">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <span className="font-bold text-slate-300">{isSignUp ? 'Sign in' : 'Sign up'}</span>
        </button>
      </div>
    </AuthShell>
    {/* Outside AuthShell: its card carries a transform, which would trap a fixed child. */}
    {installBanner(false)}
    </>
  );

  if (!hasProfile) return (
    <AuthShell eyebrow="One last step" title="Pick your name" subtitle="This is how you'll show up on the leaderboard.">
      <form onSubmit={handleCreateProfile} className="space-y-3">
        <input value={loginName} onChange={e=>setLoginName(e.target.value)} className="field text-center text-lg font-bold" placeholder="Your player name" required />
        <button className="btn-gold w-full py-3.5" disabled={isProcessing}>
          {isProcessing ? <RefreshCw size={16} className="animate-spin" /> : <>Start playing <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthShell>
  );

  // The first thing a new signup sees: pick a lane, then either enter a code or
  // walk the three-step league setup.
  const renderOnboarding = (inModal = false) => {
      const draft = setupDraft;
      const patch = (changes) => setSetupDraft(d => ({ ...d, ...changes }));
      const playoff = addMonths(draft.seasonEnd, 1);
      const regularMonths = monthRange(draft.seasonStart, draft.seasonEnd);
      const stockName = (id) => masterStocks.find(s => s.id === id)?.name || id;

      // A plain function, not a component — an inline component type would remount
      // on every keystroke and the inputs below would lose focus.
      const shell = (children) => (
          <div className={`surface p-6 ${inModal ? 'shadow-lift' : 'animate-fade-up'}`}>
              {inModal && (
                  <button onClick={() => closeOverlay(closeOnboarding)} aria-label="Close" className="float-right -mr-1 -mt-1 text-slate-500 transition hover:text-white">
                      <X size={20}/>
                  </button>
              )}
              {children}
          </div>
      );

      if (!onboardingMode) return shell(
          <>
              <div className="mb-6">
                  <div className="eyebrow text-gold-400/80">Get started</div>
                  <h2 className="mt-1 text-2xl font-extrabold tracking-tightest text-white">Join a league</h2>
                  <p className="mt-1.5 text-sm text-slate-500">Start your own and invite friends, or hop into one with a code.</p>
              </div>
              <div className="space-y-3">
                  <button onClick={() => setOnboardingMode('create')}
                    className="group flex w-full items-center gap-4 rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10 transition hover:bg-white/[0.07] hover:ring-gold-400/40">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-sheen text-ink-950"><Crown size={20}/></div>
                      <div className="min-w-0 flex-1">
                          <div className="font-bold text-white">Create a league</div>
                          <div className="text-xs text-slate-500">Set the season, budget and stock pool. You'll be commissioner.</div>
                      </div>
                      <ArrowRight size={18} className="shrink-0 text-slate-600 transition group-hover:text-gold-300"/>
                  </button>
                  <button onClick={() => setOnboardingMode('join')}
                    className="group flex w-full items-center gap-4 rounded-2xl bg-white/[0.04] p-4 text-left ring-1 ring-white/10 transition hover:bg-white/[0.07] hover:ring-gold-400/40">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-slate-300 ring-1 ring-white/10"><Users size={20}/></div>
                      <div className="min-w-0 flex-1">
                          <div className="font-bold text-white">Join a league</div>
                          <div className="text-xs text-slate-500">Enter the six-digit code your commissioner shared.</div>
                      </div>
                      <ArrowRight size={18} className="shrink-0 text-slate-600 transition group-hover:text-gold-300"/>
                  </button>
              </div>
          </>
      );

      if (onboardingMode === 'join') return shell(
          <>
              <button onClick={() => setOnboardingMode(null)} className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-500 transition hover:text-white">
                  <ChevronLeft size={16}/> Back
              </button>
              <div className="mb-6">
                  <div className="eyebrow text-gold-400/80">Join a league</div>
                  <h2 className="mt-1 text-2xl font-extrabold tracking-tightest text-white">Enter your code</h2>
                  <p className="mt-1.5 text-sm text-slate-500">Your commissioner can find this on their Admin tab.</p>
              </div>
              <form onSubmit={handleJoinLeague} className="space-y-3">
                  <input
                      value={joinLeagueId}
                      onChange={e => setJoinLeagueId(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      className="field py-4 text-center font-mono text-2xl font-bold tracking-[0.4em]"
                      placeholder="000000"
                      required
                  />
                  <button className="btn-gold w-full py-3" disabled={isProcessing || joinLeagueId.length < 6}>
                      {isProcessing ? <RefreshCw size={16} className="animate-spin"/> : <>Join league <ArrowRight size={16}/></>}
                  </button>
              </form>
          </>
      );

      // --- Create wizard ---
      const canAdvance = setupStep === 0
          ? draft.name.trim().length > 0
          : setupStep === 1
          ? draft.seasonEnd >= draft.seasonStart && Number(draft.monthlyAllowance) > 0
          : draft.pool.length > 0;

      return shell(
          <>
              <button onClick={() => setupStep === 0 ? setOnboardingMode(null) : setSetupStep(s => s - 1)}
                className="mb-4 flex items-center gap-1.5 text-sm font-bold text-slate-500 transition hover:text-white">
                  <ChevronLeft size={16}/> Back
              </button>
              <WizardSteps steps={['Basics', 'Season', 'Stocks']} current={setupStep} />

              {setupStep === 0 && (
                  <div className="space-y-4">
                      <div>
                          <label className="eyebrow mb-1.5 block">League name</label>
                          <input value={draft.name} onChange={e => patch({ name: e.target.value })} className="field" placeholder="e.g. Wall Street Warriors" autoFocus />
                      </div>
                      <div>
                          <label className="eyebrow mb-1.5 block">Number of players</label>
                          <div className="flex items-center gap-2">
                              <button type="button" onClick={() => patch({ maxPlayers: Math.max(2, Number(draft.maxPlayers) - 1) })} className="btn-ghost h-11 w-11 p-0"><Minus size={16}/></button>
                              <input type="text" inputMode="decimal" onFocus={selectOnFocus} min="2" max="20" value={draft.maxPlayers} onChange={e => patch({ maxPlayers: e.target.value })} className="field text-center font-mono text-lg font-bold" />
                              <button type="button" onClick={() => patch({ maxPlayers: Math.min(20, Number(draft.maxPlayers) + 1) })} className="btn-ghost h-11 w-11 p-0"><Plus size={16}/></button>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-600">The league stops accepting joins once it's full.</p>
                      </div>
                      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-400">
                          <input type="checkbox" checked={draft.adminPlays} onChange={e => patch({ adminPlays: e.target.checked })} className="h-4 w-4 rounded accent-gold-400"/>
                          I'm playing too, not just running it
                      </label>
                  </div>
              )}

              {setupStep === 1 && (
                  <div className="space-y-4">
                      <div>
                          <label className="eyebrow mb-1.5 block">Season starts</label>
                          <MonthPicker value={draft.seasonStart} onChange={v => patch({ seasonStart: v })} />
                      </div>
                      <div>
                          <label className="eyebrow mb-1.5 block">Regular season ends</label>
                          <MonthPicker value={draft.seasonEnd} onChange={v => patch({ seasonEnd: v })} />
                      </div>
                      <div className="surface-sunken px-4 py-3">
                          <div className="flex items-center justify-between">
                              <span className="eyebrow">Playoffs</span>
                              <span className="font-mono text-sm font-bold text-gold-300">{monthLabel(playoff)}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                              {regularMonths.length > 0
                                  ? `${regularMonths.length} regular month${regularMonths.length === 1 ? '' : 's'} (${monthLabel(draft.seasonStart, true)} – ${monthLabel(draft.seasonEnd, true)}), then playoffs the month after.`
                                  : 'The season must end on or after it starts.'}
                          </p>
                      </div>
                      <div>
                          <label className="eyebrow mb-1.5 block">Monthly allowance per player</label>
                          <div className="relative">
                              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-slate-500">$</span>
                              <input type="text" inputMode="decimal" onFocus={selectOnFocus} min="1" value={draft.monthlyAllowance} onChange={e => patch({ monthlyAllowance: e.target.value })} className="field pl-8 font-mono text-lg font-bold" />
                          </div>
                          <p className="mt-1.5 text-xs text-slate-600">Deposited into every player's cash at the start of each month. Holdings carry over.</p>
                      </div>
                  </div>
              )}

              {setupStep === 2 && (
                  <div className="space-y-4">
                      <div>
                          <label className="eyebrow mb-1.5 block">Add a ticker</label>
                          <div className="flex gap-2">
                              <input
                                  value={poolSearch}
                                  onChange={e => setPoolSearch(e.target.value.toUpperCase())}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTickerToDraft(); } }}
                                  className="field flex-1 uppercase"
                                  placeholder="AAPL"
                              />
                              <button type="button" onClick={addTickerToDraft} disabled={isSearchingPool} className="btn-ghost px-4">
                                  {isSearchingPool ? <RefreshCw size={15} className="animate-spin"/> : <Plus size={15}/>}
                              </button>
                          </div>
                      </div>

                      {masterStocks.filter(s => !draft.pool.includes(s.id)).length > 0 && (
                          <div>
                              <div className="eyebrow mb-1.5">Quick add</div>
                              <div className="flex flex-wrap gap-1.5">
                                  {masterStocks.filter(s => !draft.pool.includes(s.id)).slice(0, 12).map(s => (
                                      <button key={s.id} type="button" onClick={() => patch({ pool: [...draft.pool, s.id] })}
                                        className="chip-muted transition hover:bg-white/[0.12] hover:text-white">
                                          <Plus size={11}/> {s.id}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}

                      <div>
                          <div className="mb-1.5 flex items-center justify-between">
                              <span className="eyebrow">Stock pool</span>
                              <span className="eyebrow">{draft.pool.length} picked</span>
                          </div>
                          {draft.pool.length === 0 ? (
                              <div className="surface-sunken px-4 py-8 text-center text-sm text-slate-600">
                                  Nothing yet — add the tickers your league can invest in.
                              </div>
                          ) : (
                              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                                  {draft.pool.map(id => (
                                      <div key={id} className="surface-sunken flex items-center justify-between px-3 py-2">
                                          <div className="min-w-0">
                                              <span className="font-mono text-sm font-bold text-white">{id}</span>
                                              <span className="ml-2 truncate text-xs text-slate-500">{stockName(id)}</span>
                                          </div>
                                          <button type="button" onClick={() => patch({ pool: draft.pool.filter(p => p !== id) })}
                                            className="shrink-0 text-slate-600 transition hover:text-rose-400"><X size={14}/></button>
                                      </div>
                                  ))}
                              </div>
                          )}
                          <p className="mt-1.5 text-xs text-slate-600">You can edit this pool any month from the Admin tab.</p>
                      </div>
                  </div>
              )}

              <div className="mt-6">
                  {setupStep < 2 ? (
                      <button type="button" onClick={() => setSetupStep(s => s + 1)} disabled={!canAdvance} className="btn-gold w-full py-3">
                          Continue <ArrowRight size={16}/>
                      </button>
                  ) : (
                      <button type="button" onClick={handleCreateLeague} disabled={!canAdvance || isProcessing} className="btn-gold w-full py-3">
                          {isProcessing ? <RefreshCw size={16} className="animate-spin"/> : <>Create league <Crown size={16}/></>}
                      </button>
                  )}
              </div>
          </>
      );
  };

  const renderLeagueHub = () => {
      const standings = [...leaguePlayers].filter(p => p.isPlayer).sort((a,b) => b.wins - a.wins || b.points - a.points);

      // Colour is keyed to a stable player order, never to standings position.
      const charted = [...leaguePlayers].filter(p => p.isPlayer).sort((a, b) => a.userId.localeCompare(b.userId));
      const palette = (i) => SERIES_COLORS[i];

      // --- Season chart: one point per week, x-axis captioned by month ------
      const today = dayKey();
      const seasonEndDay = activeLeague?.playoffMonth ? lastDayOfMonth(activeLeague.playoffMonth) : today;

      const weekDays = [];
      if (activeLeague?.seasonStart) {
          let cursor = `${activeLeague.seasonStart}-01`;
          const stop = today < seasonEndDay ? today : seasonEndDay;
          while (cursor <= stop && weekDays.length < 80) {
              weekDays.push(cursor);
              cursor = addDays(cursor, 7);
          }
          // Keep the line current when today isn't itself a checkpoint.
          if (weekDays.length && weekDays[weekDays.length - 1] !== stop) weekDays.push(stop);
      }

      // Every value we know for a player, keyed by day: the daily readings plus
      // each closed month's final value pinned to that month's last day.
      const knownValues = (p) => {
          const map = {};
          Object.entries(p.valueHistory || {}).forEach(([d, v]) => {
              if (Number(v) > 0) map[d] = Number(v);
          });
          Object.entries(activeLeague?.monthSnapshots || {}).forEach(([m, snap]) => {
              const v = Number(snap?.teams?.[p.userId]?.endValue);
              if (v > 0) map[lastDayOfMonth(m)] = v;
          });
          return map;
      };

      const seasonSeries = charted.slice(0, SERIES_COLORS.length).map((p, i) => {
          const known = knownValues(p);
          const dates = Object.keys(known).sort();
          let cursor = 0;
          let carried = null;
          const points = weekDays.map(w => {
              while (cursor < dates.length && dates[cursor] <= w) carried = known[dates[cursor++]];
              return carried; // most recent known value at or before this week
          });
          // The final point reflects the live portfolio rather than a stale reading.
          if (points.length && p.isPlayer) {
              const live = portfolioValueOf(p);
              if (live > 0) points[points.length - 1] = live;
          }
          return { id: p.userId, name: p.name || 'Player', color: palette(i), points };
      });

      const seasonLabels = weekDays.map(shortDayLabel);
      // One caption per month, placed on that month's first weekly point.
      const seasonTicks = [];
      weekDays.forEach((w, i) => {
          const m = w.slice(0, 7);
          if (!seasonTicks.some(t => t.month === m)) {
              seasonTicks.push({ i, month: m, label: MONTH_NAMES[parseMonth(m).month - 1]?.slice(0, 3) || '' });
          }
      });
      const hasSeasonData = seasonSeries.some(s => s.points.filter(v => v !== null).length > 1);

      // --- Month chart: the % return that decides each head-to-head --------
      const chartDays = daysOfMonth(activeLeague?.currentMonth, dayKey());
      const monthSeries = charted.slice(0, SERIES_COLORS.length).map((p, i) => {
          const start = Number(p.startValue);
          let carried = null;
          const points = chartDays.map(d => {
              const v = p.valueHistory?.[d];
              if (v !== undefined && start > 0) carried = ((Number(v) - start) / start) * 100;
              return carried;
          });
          return { id: p.userId, name: p.name || 'Player', color: palette(i), points };
      });
      const monthLabels = chartDays.map(d => d.slice(8));
      const hasMonthData = monthSeries.some(s => s.points.some(v => v !== null));

      return (
      <div className="space-y-5">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {memberships.map(m => {
                  const isActive = activeMembership?.leagueId === m.leagueId;
                  return (
                  <button key={m.leagueId} onClick={() => setActiveMembership(m)}
                    className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${isActive ? 'bg-gold-sheen text-ink-950 shadow-gold' : 'bg-white/[0.05] text-slate-400 ring-1 ring-white/10 hover:bg-white/[0.09] hover:text-slate-200'}`}
                  >
                      {m.leagueName || `League ${m.leagueId.substring(0,4)}`}
                  </button>
                  );
              })}
              <button onClick={() => openOverlay('leagues', () => setShowLeagueCreator(true))} aria-label="Add league"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-slate-400 ring-1 ring-white/10 transition hover:bg-white/[0.09] hover:text-gold-300">
                  <Plus size={16}/>
              </button>
          </div>

          {!activeMembership ? (
              <EmptyState icon={Trophy} title="No leagues yet" body="Create a league and invite your friends, or join one with a six-digit code.">
                  <button onClick={() => openOverlay('leagues', () => { setOnboardingMode(null); setShowLeagueCreator(true); })} className="btn-gold">Create or join a league <ArrowRight size={16}/></button>
              </EmptyState>
          ) : (
              <>
              <div className="surface relative overflow-hidden bg-card-glow p-5">
                  <div className="min-w-0">
                      <div className="eyebrow">Season standings</div>
                      <h2 className="mt-1 truncate text-2xl font-extrabold tracking-tightest text-white">{activeLeague?.name || 'League'}</h2>
                  </div>
                  {/* League status and invite code live on the Admin tab — players
                      don't need either here. */}
                  <div className="mt-5 grid grid-cols-2 gap-2">
                      {[
                          { label: 'Month', value: monthLabel(activeLeague?.currentMonth, true) },
                          { label: 'Players', value: standings.length },
                      ].map(s => (
                          <div key={s.label} className="surface-sunken px-3 py-2.5 text-center">
                              <div className="eyebrow">{s.label}</div>
                              <div className="mt-0.5 truncate font-mono text-sm font-bold text-white">{s.value}</div>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="surface overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                      <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-white">
                          <Trophy size={15} className="text-gold-400"/> Leaderboard
                      </h3>
                      <span className="eyebrow shrink-0">
                          {activeLeague?.currentMonth ? `Return for ${monthLabel(activeLeague.currentMonth)}` : 'Return'}
                      </span>
                  </div>
                  {standings.length === 0 ? (
                      <p className="px-4 py-10 text-center text-sm text-slate-500">No players have joined yet.</p>
                  ) : (
                  <div className="divide-y divide-white/[0.05]">
                      {standings.map((p, idx) => {
                          const currentReturn = calculateReturn(p.roster, p.cash, activeLeague?.startingPrices || {}, p.startValue);
                          const dayChange = dayChangeOf(p);
                          const isMe = p.userId === user?.uid;
                          return (
                          <div key={p.userId} className={`flex items-center gap-3 px-4 py-3 transition ${isMe ? 'bg-gold-400/[0.05]' : ''}`}>
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${RANK_STYLES[idx] || 'bg-white/[0.06] text-slate-500'}`}>
                                  {idx + 1}
                              </div>
                              <Avatar url={p.avatar} name={p.name} size="md" onClick={() => openOverlay('avatar', () => setEnlargedAvatar({url: p.avatar, name: p.name}))} />
                              <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                      <span className="truncate font-bold text-white">{p.name || 'Unknown'}</span>
                                      {isMe && <span className="eyebrow text-gold-400">You</span>}
                                      {p.isAdmin && <Crown size={12} className="shrink-0 text-gold-400"/>}
                                  </div>
                                  <div className="mt-0.5 font-mono text-sm font-medium text-slate-300">
                                      {p.wins || 0}<span className="text-slate-500">W</span>
                                      <span className="text-slate-600"> · </span>
                                      {p.losses || 0}<span className="text-slate-500">L</span>
                                  </div>
                              </div>
                              <div className="shrink-0 text-right">
                                  <Pct value={currentReturn} className="text-base" />
                                  {dayChange !== null && (
                                      <div className="mt-0.5 flex items-center justify-end gap-1">
                                          <span className="eyebrow">Today</span>
                                          <Pct value={dayChange} className="text-[11px]" />
                                      </div>
                                  )}
                              </div>
                          </div>
                          );
                      })}
                  </div>
                  )}
              </div>

              <div className="surface p-4">
                  <div className="mb-3 flex items-end justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-white">
                          <Activity size={15} className="text-gold-400"/> This month's race
                      </h3>
                      <span className="eyebrow">{monthLabel(activeLeague?.currentMonth)}</span>
                  </div>
                  {monthSeries.length === 0 || !hasMonthData ? (
                      <p className="px-1 py-8 text-center text-sm text-slate-500">
                          No daily readings yet. They start accumulating once the commissioner opens the month.
                      </p>
                  ) : (
                      <PortfolioChart
                          series={monthSeries}
                          labels={monthLabels}
                          format="percent"
                          axisLabel="Day"
                          emptyMessage="No daily returns recorded for this month yet."
                      />
                  )}
              </div>

              <div className="surface p-4">
                  <div className="mb-3 flex items-end justify-between gap-3">
                      <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-white">
                          <Trophy size={15} className="text-gold-400"/> Chase for the Terminator
                      </h3>
                      <span className="eyebrow">Season</span>
                  </div>
                  {seasonSeries.length === 0 || !hasSeasonData ? (
                      <p className="px-1 py-8 text-center text-sm text-slate-500">
                          The season chart fills in as months are scored — one point per month.
                      </p>
                  ) : (
                      <PortfolioChart
                          series={seasonSeries}
                          labels={seasonLabels}
                          ticks={seasonTicks}
                          format="money"
                          axisLabel="Week"
                          emptyMessage="Not enough of the season has been played yet."
                      />
                  )}
              </div>
              </>
          )}
          {showLeagueCreator && (
              <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm">
                  <div className="my-auto w-full max-w-md animate-fade-up">
                      {renderOnboarding(true)}
                  </div>
              </div>
          )}
      </div>
      );
  };

  const renderMarket = () => {
    // 1. Prepare Data
    // Only this league's pool is investable, not the global catalogue.
    const pool = activeLeague?.stockPool || [];
    const poolStocks = masterStocks.filter(s => pool.includes(s.id)).map(stock => {
      const live = liveMarketData[stock.id];
      const price = live?.c || 0;
      
      // Month open: the price at the first opening bell of the current month.
      const monthOpen = Number(activeLeague?.startingPrices?.[stock.id]) || Number(live?.monthOpen) || price;
      const mtdChange = price > 0 && monthOpen > 0 ? ((price - monthOpen) / monthOpen) * 100 : null;

      // Season open: the price at the first opening bell of the league's first
      // month. No guessed fallback — an unknown baseline reads as "—" rather
      // than quietly repeating MTD.
      const seasonOpen = Number(activeLeague?.initialPrices?.[stock.id]) || 0;
      const totalChange = price > 0 && seasonOpen > 0 ? ((price - seasonOpen) / seasonOpen) * 100 : null;

      // Today's move: Finnhub's own day-change percent, else derived from the
      // previous close. Null until a quote with `pc`/`dp` has been fetched.
      const prevClose = Number(live?.pc) || 0;
      const dayChange = Number.isFinite(Number(live?.dp)) && live?.dp !== null
          ? Number(live.dp)
          : (price > 0 && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : null);

      const inRoster = activeMembership?.roster?.find((i) => i.id === stock.id);
      const owner = franchiseOwners[stock.id];
      const lockedBy = owner && owner.userId !== user?.uid ? owner : null;
      const isMyFranchise = owner && owner.userId === user?.uid;

      return { ...stock, price, monthOpen, seasonOpen, mtdChange, totalChange, dayChange, inRoster, lockedBy, isMyFranchise };
    });

    // 2. Sort Data — search narrows the list, but never the Top 5s summary.
    const stocksToRender = poolStocks.filter(s => s.id.includes(stockSearch.toUpperCase()));
    stocksToRender.sort((a, b) => {
      if (marketSortBy === 'alpha') {
          return marketSortDir === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
      }
      const valA = marketSortBy === 'mtd' ? a.mtdChange : a.totalChange;
      const valB = marketSortBy === 'mtd' ? b.mtdChange : b.totalChange;
      // Tickers with no baseline have no figure to rank — park them at the
      // bottom either way rather than letting them sort as 0%.
      if (valA === null && valB === null) return a.id.localeCompare(b.id);
      if (valA === null) return 1;
      if (valB === null) return -1;
      return marketSortDir === 'asc' ? valA - valB : valB - valA;
    });

    const canDraft = activeMembership?.isPlayer && ['ready', 'active'].includes(activeLeague?.status);

    const toggleSort = (key, defaultDir) => {
      setMarketMode('list');
      if (marketSortBy === key) setMarketSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      else { setMarketSortBy(key); setMarketSortDir(defaultDir); }
    };

    const SORTS = [
      { key: 'alpha', label: 'Ticker', dir: 'asc' },
      { key: 'mtd', label: 'MTD', dir: 'desc' },
      { key: 'total', label: 'Total', dir: 'desc' },
    ];

    // Ranked over the whole pool — a ticker with no figure for a period is left
    // out of that board rather than ranked as 0%.
    const leaderboard = (field, best) => poolStocks
      .filter(s => s[field] !== null && s[field] !== undefined)
      .sort((a, b) => best ? b[field] - a[field] : a[field] - b[field])
      .slice(0, 5);

    const BOARDS = [
      { title: 'Best today',        field: 'dayChange',   best: true },
      { title: 'Worst today',       field: 'dayChange',   best: false },
      { title: 'Best this month',   field: 'mtdChange',   best: true },
      { title: 'Worst this month',  field: 'mtdChange',   best: false },
      { title: 'Best this season',  field: 'totalChange', best: true },
      { title: 'Worst this season', field: 'totalChange', best: false },
    ];

    return (
      <div className="space-y-4">
          <div style={{ top: headerHeight }} className="sticky z-10 -mx-4 space-y-2.5 bg-ink-950/90 px-4 pb-3 pt-3 backdrop-blur-md">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" size={15} />
                <input className="field py-2.5 pl-10" placeholder="Search tickers" value={stockSearch} onChange={e => setStockSearch(e.target.value)} />
            </div>

            <div className="flex gap-1 rounded-xl bg-black/30 p-1 ring-1 ring-white/[0.06]">
              {SORTS.map(s => {
                const active = marketMode === 'list' && marketSortBy === s.key;
                return (
                  <button key={s.key} onClick={() => toggleSort(s.key, s.dir)}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition ${active ? 'bg-white/[0.10] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {s.label}
                    {active
                      ? (marketSortDir === 'desc' ? <ArrowDown size={11} className="text-gold-400"/> : <ArrowUp size={11} className="text-gold-400"/>)
                      : <ArrowUpDown size={11} className="opacity-40"/>}
                  </button>
                );
              })}
              <button onClick={() => setMarketMode('top5')}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold transition ${marketMode === 'top5' ? 'bg-white/[0.10] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Top 5s
                <Trophy size={11} className={marketMode === 'top5' ? 'text-gold-400' : 'opacity-40'}/>
              </button>
            </div>
          </div>

          {marketMode === 'top5' ? (
            poolStocks.length === 0 ? (
              <EmptyState icon={Trophy} title="Nothing to rank yet" body="The commissioner hasn't added any stocks to the pool." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {BOARDS.map(board => {
                  const rows = leaderboard(board.field, board.best);
                  return (
                    <div key={board.title} className="surface overflow-hidden">
                      <div className="flex items-center justify-between border-b border-white/[0.07] px-3.5 py-2.5">
                        <h3 className="text-xs font-extrabold uppercase tracking-wide text-white">{board.title}</h3>
                        {board.best
                          ? <TrendingUp size={13} className="text-gain"/>
                          : <TrendingDown size={13} className="text-loss"/>}
                      </div>
                      {rows.length === 0 ? (
                        <p className="px-3.5 py-5 text-center text-xs text-slate-600">
                          {board.field === 'dayChange'
                            ? 'Waiting on today\'s quotes.'
                            : board.field === 'totalChange'
                            ? 'No season opening prices set yet.'
                            : 'No month opening prices yet.'}
                        </p>
                      ) : (
                        <div className="divide-y divide-white/[0.05]">
                          {rows.map((s, i) => (
                            <div key={s.id} className="flex items-center gap-2.5 px-3.5 py-2">
                              <span className="w-3 shrink-0 font-mono text-[11px] font-bold text-slate-600">{i + 1}</span>
                              <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-white">{s.id}</span>
                              <Pct value={s[board.field]} className="shrink-0 text-xs" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : stocksToRender.length === 0 ? (
            <EmptyState icon={BarChart3} title="No tickers found" body={stockSearch ? `Nothing in the pool matches "${stockSearch}".` : 'The commissioner has not added any stocks yet.'} />
          ) : (
          <div className="surface divide-y divide-white/[0.05] overflow-hidden">
              {stocksToRender.map(stock => (
                  <div key={stock.id} className="flex items-center gap-3 px-3.5 py-3 transition hover:bg-white/[0.02]">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] font-mono text-[11px] font-bold text-gold-300 ring-1 ring-white/[0.07]">
                          {stock.id.slice(0, 4)}
                      </div>

                      <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                              <span className="font-bold tracking-tight text-white">{stock.id}</span>
                              {stock.isMyFranchise && <span className="eyebrow text-gold-400">Franchise</span>}
                              {!stock.isMyFranchise && stock.sector && stock.sector !== 'Unknown' && <span className="eyebrow">{stock.sector}</span>}
                          </div>
                          <div className="truncate text-xs text-slate-500">{stock.name}</div>
                          {/* Ownership sits alongside the prices, not instead of
                              them — the commissioner still has to price a ticker
                              someone has claimed as a franchise stock. */}
                          {stock.lockedBy && (
                              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-slate-600">
                                  <Lock size={10}/> {stock.lockedBy.name}'s franchise
                              </div>
                          )}
                          <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-slate-600">
                              Month open ${stock.monthOpen.toFixed(2)}
                              {activeMembership?.isAdmin && (
                                <button onClick={()=>updateMonthOpenPrice(stock.id)} className="text-slate-600 transition hover:text-gold-400" aria-label={`Edit month open price for ${stock.id}`}>
                                  <Edit2 size={10}/>
                                </button>
                              )}
                          </div>
                          {/* Season baseline is commissioner plumbing — players just see TOT. */}
                          {activeMembership?.isAdmin && (
                              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                                  {stock.seasonOpen > 0
                                      ? `Season open $${stock.seasonOpen.toFixed(2)}`
                                      : <span className="text-amber-500/80">Season open not set</span>}
                                  <button onClick={()=>updateSeasonOpenPrice(stock.id)} className="text-slate-600 transition hover:text-gold-400" aria-label={`Edit season open price for ${stock.id}`}>
                                    <Edit2 size={10}/>
                                  </button>
                              </div>
                          )}
                      </div>

                      <div className="shrink-0 text-right">
                          {stock.price > 0 ? (
                            <>
                              <div className="font-mono text-base font-bold text-white">${stock.price.toFixed(2)}</div>
                              <div className="mt-1 flex flex-col items-end gap-0.5">
                                  <div className="flex items-center gap-1.5">
                                      <span className="eyebrow">MTD</span>
                                      {stock.mtdChange === null
                                          ? <span className="font-mono text-[11px] text-slate-600">—</span>
                                          : <Pct value={stock.mtdChange} className="text-[11px]" />}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                      <span className="eyebrow">TOT</span>
                                      {stock.totalChange === null
                                          ? <span className="font-mono text-[11px] text-slate-600">—</span>
                                          : <Pct value={stock.totalChange} className="text-[11px]" />}
                                  </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-mono text-base font-bold text-slate-600">—</div>
                              <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-500/80">No quote</div>
                            </>
                          )}
                      </div>

                      {canDraft && (
                        <div className="w-8 shrink-0 text-center">
                          {stock.lockedBy
                            ? <Lock size={16} className="mx-auto text-slate-700" aria-label={`Locked to ${stock.lockedBy.name}`} />
                            : stock.inRoster
                            ? <CheckCircle2 size={18} className="mx-auto text-gold-400" aria-label="Owned" />
                            : <button onClick={() => addToTeam(stock.id)} aria-label={`Add ${stock.id} to team`}
                                className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-slate-300 ring-1 ring-white/10 transition hover:bg-gold-400 hover:text-ink-950 hover:ring-gold-400 active:scale-95">
                                <Plus size={16}/>
                              </button>}
                        </div>
                      )}
                  </div>
              ))}
          </div>
          )}
      </div>
    );
  };

  const renderTeam = () => {
      if (!activeMembership?.isPlayer) return (
        <EmptyState icon={Crown} title="You're the commissioner" body="Commissioners who sit out the season don't run a portfolio. Head to Admin to manage the league." />
      );
      const roster = activeMembership.roster || [];
      const cash = activeMembership.cash || 0;
      const isOpen = ['ready', 'active'].includes(activeLeague?.status);
      const portfolioValue = portfolioValueOf(activeMembership);
      const holdingsValue = portfolioValue - cash;
      const unpriced = roster.filter(i => !hasPrice(i.id));
      const monthReturn = calculateReturn(roster, cash, activeLeague?.startingPrices || {}, activeMembership.startValue);

      return (
          <div className="space-y-4">
              {unpriced.length > 0 && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 px-4 py-3 ring-1 ring-amber-500/25">
                      <Activity size={15} className="mt-0.5 shrink-0 text-amber-400" />
                      <p className="text-xs leading-relaxed text-amber-200/90">
                          No price for <span className="font-mono font-bold">{unpriced.map(i => i.id).join(', ')}</span> —
                          those holdings are excluded from your total, so your return is understated. Ask your commissioner
                          to set a base price from the Market tab.
                      </p>
                  </div>
              )}
              <div className="surface relative overflow-hidden p-6">
                  <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-gold-400/[0.13] blur-3xl" />
                  <div className="relative">
                      <div className="eyebrow">Portfolio value</div>
                      <div className="mt-1 flex items-baseline gap-3">
                          <span className="font-mono text-4xl font-extrabold tracking-tightest text-white">
                              ${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </span>
                          <Pct value={monthReturn} className="text-sm" />
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                          <div className="surface-sunken px-3.5 py-3">
                              <div className="eyebrow">Holdings</div>
                              <div className="mt-1 font-mono text-sm font-bold text-white">
                                  ${holdingsValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </div>
                          </div>
                          <div className="surface-sunken px-3.5 py-3">
                              <div className="eyebrow">Cash on hand</div>
                              {isOpen ? (
                                  <div className="mt-1 flex items-center font-mono text-sm font-bold text-white">
                                      <span className="text-slate-500">$</span>
                                      <input
                                          type="text" inputMode="decimal" onFocus={selectOnFocus}
                                          {...draftField('cash', cash, updateCash)}
                                          className="w-full border-b border-gold-400/50 bg-transparent pb-px focus:border-gold-400 focus:outline-none"
                                      />
                                  </div>
                              ) : (
                                  <div className="mt-1 font-mono text-sm font-bold text-white">${cash.toLocaleString()}</div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>

              <div className="flex items-center justify-between px-1">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-white">
                      <Wallet size={15} className="text-gold-400"/> Holdings
                  </h3>
                  <span className="eyebrow">{roster.length} / 30</span>
              </div>

              {roster.length === 0 ? (
                  <EmptyState icon={PieChart} title="Nothing drafted yet" body={isOpen ? 'Head to the Market tab and add tickers to build your book.' : 'Your roster is locked until the commissioner opens the month.'}>
                      {isOpen && <button onClick={() => navigateTo('market')} className="btn-gold">Browse the market <ArrowRight size={16}/></button>}
                  </EmptyState>
              ) : (
                <div className="space-y-2">
                {roster.map((item) => {
                  const stock = masterStocks.find(s => s.id === item.id);
                  const price = liveMarketData[item.id]?.c || 0;
                  const val = (item.shares || 0) * price;
                  return (
                    <Card key={item.id} className="p-3.5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] font-mono text-[11px] font-bold text-gold-300 ring-1 ring-white/[0.07]">
                                {item.id.slice(0, 4)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-bold tracking-tight text-white">{item.id}</div>
                                <div className="truncate text-xs text-slate-500">{stock?.name || item.id}</div>
                            </div>
                            <div className="shrink-0 text-right">
                                {price > 0 ? (
                                  <>
                                    <div className="font-mono text-base font-bold text-white">${val.toFixed(2)}</div>
                                    <div className="font-mono text-[11px] text-slate-500">${price.toFixed(2)} / sh</div>
                                  </>
                                ) : (
                                  <>
                                    <div className="font-mono text-base font-bold text-slate-600">—</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-amber-500/80">No quote</div>
                                  </>
                                )}
                            </div>
                            {isOpen && (
                              <button onClick={() => removeFromTeam(item.id)} aria-label={`Remove ${item.id}`}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-slate-500 ring-1 ring-white/[0.07] transition hover:bg-rose-500/20 hover:text-rose-300 hover:ring-rose-500/30">
                                  <Minus size={15}/>
                              </button>
                            )}
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 ring-1 ring-white/[0.05]">
                            <span className="eyebrow">{isOpen ? 'Shares' : 'Shares — locked'}</span>
                            {isOpen ? (
                                <input
                                    type="text" inputMode="decimal" onFocus={selectOnFocus}
                                    {...draftField(`shares_${item.id}`, item.shares, (v) => updateShares(item.id, v))}
                                    className="w-28 rounded bg-transparent text-right font-mono text-sm font-bold text-white focus:outline-none"
                                    placeholder="0"
                                />
                            ) : (
                                <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-400">
                                    <Lock size={11} className="text-slate-600"/>{item.shares}
                                </span>
                            )}
                        </div>
                    </Card>
                  );
                })}
                </div>
              )}
          </div>
      )
  };

  const renderMatchups = () => {
      // The tab defaults to the open month but can look back at any scored one.
      const viewedMonth = matchupsMonth || activeLeague?.currentMonth;
      const isCurrent = viewedMonth === activeLeague?.currentMonth;
      const isLive = activeLeague?.status === 'active' && isCurrent;
      const avatarFor = (uid) => leaguePlayers.find(p => p.userId === uid)?.avatar;
      const monthMatchups = isCurrent
          ? (activeLeague?.matchups || [])
          : (activeLeague?.schedule?.[viewedMonth] || []);
      // Write-ups live per matchup in src/recaps.js, keyed by the two team names.
      const recapFor2 = (mu) => recapForMatchup(activeLeague?.id, viewedMonth, mu?.p1Name, mu?.p2Name);

      // Bare month names keep the chips narrow enough to fit; the year is only
      // needed when a season straddles New Year.
      const spansYears = new Set(allMonths.map(m => parseMonth(m).year)).size > 1;
      const monthChipLabel = (m) => {
          const { year, month } = parseMonth(m);
          const name = MONTH_NAMES[month - 1]?.slice(0, 3) || '—';
          return spansYears ? `${name} '${String(year).slice(2)}` : name;
      };

      if (selectedMatchup) {
        const m = selectedMatchup;
        const isBye = m.p2 === 'BYE';
        const p1Leads = !isBye && m.p1Score > m.p2Score;
        const p2Leads = !isBye && m.p2Score > m.p1Score;
        // A scored month has a winner; an open one only has someone in front.
        const isFinal = !!m.scored;

        const detailDay = (uid) => dayChangeOf(leaguePlayers.find(p => p.userId === uid));

        // A closed month has its books frozen at close. Read those rather than
        // live rosters and prices, which have moved on since.
        const snap = activeLeague?.monthSnapshots?.[viewedMonth];
        const priceIn = (id) => snap ? (Number(snap.endPrices?.[id]) || 0) : priceOf(id);
        const changeIn = (id) => {
            if (!snap) return stockMonthChange(id);
            const open = Number(snap.startPrices?.[id]);
            const close = Number(snap.endPrices?.[id]);
            return open > 0 && close > 0 ? ((close - open) / open) * 100 : null;
        };

        return (
            <div className="animate-fade-up space-y-4">
                <button onClick={() => closeOverlay(() => setSelectedMatchup(null))} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 transition hover:text-white">
                    <ChevronLeft size={18} /> All matchups
                </button>

                <div className="surface relative overflow-hidden bg-card-glow p-6">
                    <div className="mb-8 text-center">
                        <div className="eyebrow text-gold-400/80">{m.type || 'Regular season'}</div>
                        <h2 className="mt-1 text-2xl font-extrabold tracking-tightest text-white">{monthLabel(viewedMonth)}</h2>
                        {isLive && (
                          <span className="chip mt-2 bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30">
                            <span className="h-1.5 w-1.5 animate-ticker-pulse rounded-full bg-current" /> Live
                          </span>
                        )}
                    </div>

                    <div className="relative flex items-start justify-between">
                        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

                        <div className="z-10 w-5/12 text-center">
                            <Avatar url={avatarFor(m.p1)} name={m.p1Name} size="lg" className={`mx-auto mb-3 ${p1Leads ? 'ring-gold-400/70' : ''}`} />
                            <div className="mb-2 truncate text-base font-bold text-white">{m.p1Name}</div>
                            <div className={`font-mono text-4xl font-extrabold tracking-tightest ${m.p1Score >= 0 ? 'text-gain' : 'text-loss'}`}>
                                {m.p1Score > 0 ? '+' : ''}{m.p1Score}%
                            </div>
                            {!isFinal && detailDay(m.p1) !== null && (
                                <div className="mt-1 flex items-center justify-center gap-1">
                                    <span className="eyebrow">Today</span>
                                    <Pct value={detailDay(m.p1)} className="text-[11px]" />
                                </div>
                            )}
                            {p1Leads && (isFinal
                                ? <div className="mt-2 flex items-center justify-center gap-1 text-gold-400"><Trophy size={13}/><span className="eyebrow text-gold-400">Winner</span></div>
                                : <div className="eyebrow mt-2 text-gold-400">Leading</div>)}
                        </div>

                        <div className="z-10 w-2/12 pt-5 text-center">
                            <div className="mx-auto flex h-11 w-11 rotate-45 items-center justify-center rounded-xl bg-ink-900 ring-1 ring-white/10">
                                <span className="-rotate-45 font-mono text-[11px] font-bold text-slate-500">VS</span>
                            </div>
                        </div>

                        <div className="z-10 w-5/12 text-center">
                            <Avatar url={avatarFor(m.p2)} name={m.p2Name} size="lg" className={`mx-auto mb-3 ${p2Leads ? 'ring-gold-400/70' : ''}`} />
                            <div className="mb-2 truncate text-base font-bold text-white">{m.p2Name}</div>
                            {!isBye ? (
                                <>
                                <div className={`font-mono text-4xl font-extrabold tracking-tightest ${m.p2Score >= 0 ? 'text-gain' : 'text-loss'}`}>
                                    {m.p2Score > 0 ? '+' : ''}{m.p2Score}%
                                </div>
                                {!isFinal && detailDay(m.p2) !== null && (
                                    <div className="mt-1 flex items-center justify-center gap-1">
                                        <span className="eyebrow">Today</span>
                                        <Pct value={detailDay(m.p2)} className="text-[11px]" />
                                    </div>
                                )}
                                </>
                            ) : (
                                <div className="font-mono text-4xl font-extrabold text-slate-700">—</div>
                            )}
                            {p2Leads && (isFinal
                                ? <div className="mt-2 flex items-center justify-center gap-1 text-gold-400"><Trophy size={13}/><span className="eyebrow text-gold-400">Winner</span></div>
                                : <div className="eyebrow mt-2 text-gold-400">Leading</div>)}
                        </div>
                    </div>
                </div>

                {(() => {
                    const rc = recapFor2(m);
                    if (!rc) return null;
                    return (
                        <Card className="bg-card-glow p-5">
                            <div className="mb-3 flex items-center gap-2">
                                <BookOpen size={15} className="shrink-0 text-gold-400"/>
                                <h3 className="text-base font-extrabold tracking-tightest text-white">
                                    {rc.title || 'The recap'}
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {String(rc.text).split(/\n\s*\n/).filter(Boolean).map((para, i) => (
                                    <p key={i} className="text-sm leading-relaxed text-slate-300">{para}</p>
                                ))}
                            </div>
                        </Card>
                    );
                })()}

                <div className="flex items-center justify-between gap-2 px-1">
                    <span className="eyebrow">Team books</span>
                    <span className="eyebrow">{snap ? 'As of month close' : 'Live'}</span>
                </div>

                {/* Both books side by side so the two teams read as a comparison
                    rather than two unrelated lists. */}
                <div className="grid grid-cols-2 gap-2">
                    {[m.p1, m.p2].filter(uid => uid && uid !== 'BYE').map(uid => {
                        const player = leaguePlayers.find(p => p.userId === uid);
                        const frozen = snap?.teams?.[uid];
                        if (!player && !frozen) return null;
                        const name = frozen?.name || player?.name || 'Player';
                        // A ticker with no shares is an empty slot, not a position.
                        // Listed alongside real holdings it reads as one — with a
                        // price move attached that never touched the team's score.
                        const roster = (frozen?.roster || player?.roster || [])
                            .filter(item => (parseFloat(item.shares) || 0) > 0);
                        const cash = frozen ? (Number(frozen.cash) || 0) : (parseFloat(player?.cash) || 0);
                        const total = frozen ? (Number(frozen.endValue) || 0) : portfolioValueOf(player);
                        const isWinner = m.scored && (uid === m.p1 ? m.p1Score > m.p2Score : m.p2Score > m.p1Score);
                        return (
                            <div key={uid} className={`surface flex flex-col overflow-hidden ${isWinner ? 'ring-gold-400/40' : ''}`}>
                                <div className="border-b border-white/[0.07] px-3 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <Avatar url={player?.avatar} name={name} size="sm" />
                                        <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">{name}</span>
                                        {isWinner && <Trophy size={13} className="shrink-0 text-gold-400" aria-label="Winner" />}
                                    </div>
                                    <div className="mt-1.5">
                                        <div className="eyebrow">Portfolio</div>
                                        <div className="font-mono text-sm font-bold text-white">{fmtFullMoney(total)}</div>
                                    </div>
                                </div>

                                {roster.length === 0 ? (
                                    <p className="flex-1 px-3 py-6 text-center text-xs text-slate-500">No holdings.</p>
                                ) : (
                                    <div className="flex-1 divide-y divide-white/[0.05]">
                                        {roster.map(item => {
                                            const change = changeIn(item.id);
                                            const price = priceIn(item.id);
                                            const value = (parseFloat(item.shares) || 0) * price;
                                            return (
                                                <div key={item.id} className="px-3 py-2">
                                                    <div className="flex items-center gap-1">
                                                        <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-white">{item.id}</span>
                                                        {(player?.franchiseStocks || []).includes(item.id) && <span className="eyebrow shrink-0 text-gold-400">F</span>}
                                                    </div>
                                                    <div className="truncate font-mono text-[10px] text-slate-500">
                                                        {item.shares} @ ${price.toFixed(2)}
                                                    </div>
                                                    <div className="mt-0.5 flex items-baseline justify-between gap-1">
                                                        <span className="truncate font-mono text-[11px] font-bold text-slate-200">{fmtFullMoney(value)}</span>
                                                        {change === null
                                                            ? <span className="font-mono text-[10px] text-slate-600">—</span>
                                                            : <Pct value={change} className="shrink-0 text-[10px]" />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="mt-auto flex items-center justify-between gap-1 border-t border-white/[0.07] bg-black/20 px-3 py-2">
                                    <span className="eyebrow">Cash</span>
                                    <span className="truncate font-mono text-xs font-bold text-white">{fmtFullMoney(cash)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
      }

      return (
        <div className="space-y-3">
            <SectionHeading icon={Swords} title={monthLabel(viewedMonth)} meta={isLive ? 'Live scoring' : isPlayoffMonth && isCurrent ? 'Playoffs' : 'Head to head'} />

            {allMonths.length > 1 && (
                // Wraps rather than scrolls — with a season this long the last
                // month sat off-screen with nothing to indicate it was there.
                <div className="flex flex-wrap gap-1.5">
                    {allMonths.map(m => {
                        const scored = (activeLeague?.schedule?.[m] || []).some(x => x.scored);
                        const active = m === viewedMonth;
                        return (
                            <button key={m} onClick={() => { setMatchupsMonth(m); setSelectedMatchup(null); }}
                              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold transition ${active
                                  ? 'bg-gold-sheen text-ink-950'
                                  : 'bg-white/[0.05] text-slate-300 ring-1 ring-white/10 hover:bg-white/[0.10] hover:text-white'}`}>
                                {monthChipLabel(m)}
                                {monthHasRecap(activeLeague?.id, m) && <BookOpen size={11} className={active ? '' : 'text-gold-400'} />}
                                {!scored && m !== activeLeague?.currentMonth && <span className={`h-1 w-1 rounded-full ${active ? 'bg-ink-950/40' : 'bg-slate-600'}`} />}
                            </button>
                        );
                    })}
                </div>
            )}

            {!monthMatchups.length ? (
                <EmptyState icon={Swords} title="No matchups yet" body="The commissioner hasn't generated the schedule for this month." />
            ) : monthMatchups.map((m, i) => {
                let p1LiveScore = m.p1Score;
                let p2LiveScore = m.p2Score;
                if (isLive) {
                    const p1 = leaguePlayers.find(p => p.userId === m.p1);
                    const p2 = leaguePlayers.find(p => p.userId === m.p2);
                    const basePrices = activeLeague.startingPrices || {};
                    p1LiveScore = parseFloat(calculateReturn(p1?.roster, p1?.cash, basePrices, p1?.startValue).toFixed(2));
                    p2LiveScore = m.p2 === 'BYE' ? 0 : parseFloat(calculateReturn(p2?.roster, p2?.cash, basePrices, p2?.startValue).toFixed(2));
                }
                const isBye = m.p2 === 'BYE';
                const p1Leads = !isBye && p1LiveScore > p2LiveScore;
                const p2Leads = !isBye && p2LiveScore > p1LiveScore;
                const mine = m.p1 === user?.uid || m.p2 === user?.uid;
                // Scored months get a trophy on the winner; a bye is a free win.
                const final = !!m.scored;
                const p1Won = final && (isBye || p1Leads);
                const p2Won = final && p2Leads;
                // "Today" only means something while the month is still running.
                const p1Day = final ? null : dayChangeOf(leaguePlayers.find(p => p.userId === m.p1));
                const p2Day = final || isBye ? null : dayChangeOf(leaguePlayers.find(p => p.userId === m.p2));

                return (
                    <Card key={i} className={`p-4 ${mine ? 'ring-gold-400/25' : ''}`}
                      onClick={() => openOverlay('matchup', () => setSelectedMatchup({...m, p1Score: p1LiveScore, p2Score: p2LiveScore}))}>
                        {m.type && (
                            <div className="mb-3 flex items-center justify-center gap-2">
                                <span className="h-px flex-1 hairline" />
                                <span className="eyebrow text-gold-400/90">{m.type}</span>
                                <span className="h-px flex-1 hairline" />
                            </div>
                        )}
                        {recapFor2(m) && (
                            <div className="mb-2 flex items-center justify-center gap-1 text-gold-400/90">
                                <BookOpen size={11}/>
                                <span className="eyebrow text-gold-400/90">Recap</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                <Avatar url={avatarFor(m.p1)} name={m.p1Name} size="sm" className={p1Leads ? 'ring-gold-400/60' : ''} />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1">
                                        <span className={`truncate text-sm font-bold ${p1Leads ? 'text-white' : 'text-slate-300'}`}>{m.p1Name}</span>
                                        {p1Won && <Trophy size={12} className="shrink-0 text-gold-400" aria-label="Winner" />}
                                    </div>
                                    <Pct value={p1LiveScore} className="text-sm" />
                                    {p1Day !== null && (
                                        <div className="mt-0.5 flex items-center gap-1">
                                            <span className="eyebrow">Today</span>
                                            <Pct value={p1Day} className="text-[10px]" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <span className="shrink-0 px-2 font-mono text-[10px] font-bold text-slate-600">VS</span>

                            <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 text-right">
                                <div className="min-w-0">
                                    <div className="flex items-center justify-end gap-1">
                                        {p2Won && <Trophy size={12} className="shrink-0 text-gold-400" aria-label="Winner" />}
                                        <span className={`truncate text-sm font-bold ${p2Leads ? 'text-white' : 'text-slate-300'}`}>{m.p2Name}</span>
                                    </div>
                                    {isBye ? <span className="font-mono text-sm font-bold text-slate-600">—</span> : <Pct value={p2LiveScore} className="text-sm" />}
                                    {p2Day !== null && (
                                        <div className="mt-0.5 flex items-center justify-end gap-1">
                                            <span className="eyebrow">Today</span>
                                            <Pct value={p2Day} className="text-[10px]" />
                                        </div>
                                    )}
                                </div>
                                <Avatar url={avatarFor(m.p2)} name={m.p2Name} size="sm" className={p2Leads ? 'ring-gold-400/60' : ''} />
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
      );
  };

  const renderAdmin = () => (
      <div className="space-y-4">
          <SectionHeading icon={Shield} title="Commissioner" meta={statusMeta(activeLeague?.status).label} />

          <Panel icon={Crown} title="Season controls" accent="gold" defaultOpen
            description={`${monthLabel(activeLeague?.seasonStart)} – ${monthLabel(activeLeague?.seasonEnd)}, playoffs ${monthLabel(activeLeague?.playoffMonth)}. $${Number(activeLeague?.monthlyAllowance || 0).toLocaleString()} deposited per player each month. Opening a month sets each team's baseline to their value at last month's close plus the allowance.`}>
             <div className="surface-sunken mb-3 flex items-center justify-between px-4 py-3">
                 <div>
                     <div className="eyebrow">Open month</div>
                     <div className="mt-0.5 text-lg font-extrabold tracking-tightest text-white">{monthLabel(activeLeague?.currentMonth)}</div>
                 </div>
                 <span className={statusMeta(activeLeague?.status).chip}>
                     {statusMeta(activeLeague?.status).live && <span className="h-1.5 w-1.5 animate-ticker-pulse rounded-full bg-current" />}
                     {statusMeta(activeLeague?.status).label}
                 </span>
             </div>
             <div className="grid gap-2">
                {activeLeague?.status === 'setup' && <button onClick={startLeague} className="btn-gold w-full py-3"><PlayCircle size={16}/> Start league &amp; generate schedule</button>}
                {activeLeague?.status === 'ready' && <button onClick={startMonth} className="btn-gold w-full py-3"><PlayCircle size={16}/> Open {monthLabel(activeLeague.currentMonth, true)} for trading</button>}
                {activeLeague?.status === 'active' && <button onClick={endMonth} className="btn-gold w-full py-3"><Lock size={16}/> Close &amp; score {monthLabel(activeLeague.currentMonth, true)}</button>}
                {activeLeague?.status === 'completed' && <button onClick={nextMonth} className="btn-gold w-full py-3"><ArrowRight size={16}/> Advance to {monthLabel(addMonths(activeLeague.currentMonth, 1), true)}</button>}
                {['active','completed'].includes(activeLeague?.status) && <button onClick={resetToDraft} className="btn-ghost w-full"><RotateCcw size={14}/> Reopen this month</button>}
             </div>

             {activeLeague?.status !== 'setup' && allMonths.length > 0 && (
               <div className="mt-4 border-t border-white/[0.07] pt-4">
                  <div className="eyebrow mb-2">Jump to a month</div>
                  <div className="flex flex-wrap gap-1.5">
                      {allMonths.map(m => (
                          <button key={m} onClick={() => jumpToMonth(m)}
                            className={`chip transition ${m === activeLeague.currentMonth
                                ? 'bg-gold-sheen text-ink-950'
                                : 'bg-white/[0.06] text-slate-400 ring-1 ring-white/10 hover:bg-white/[0.12] hover:text-white'}`}>
                              {monthLabel(m, true)}{m === activeLeague.playoffMonth && ' 🏆'}
                          </button>
                      ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Starting a league mid-season? Jump the pointer forward once you've backfilled the earlier months below.</p>
               </div>
             )}
          </Panel>

          <Panel icon={Calendar} title="Month results" accent="orange"
            description="Enter each player's real % return for a month. Wins, losses and points are recalculated from every scored month.">
              {allMonths.length === 0 || !activeLeague?.schedule || Object.keys(activeLeague.schedule).length === 0 ? (
                  <p className="text-xs text-slate-500">Generate the schedule first — then every month becomes editable here.</p>
              ) : (
                  <div className="space-y-1.5">
                      {allMonths.map(m => {
                          const matchupsForMonth = activeLeague.schedule?.[m] || [];
                          const scored = matchupsForMonth.some(x => x.scored);
                          return (
                              <button key={m} onClick={() => openBackfill(m)} disabled={matchupsForMonth.length === 0}
                                className="surface-sunken flex w-full items-center justify-between px-3 py-2.5 text-left transition hover:bg-white/[0.06] disabled:opacity-40">
                                  <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-white">{monthLabel(m)}</span>
                                      {m === activeLeague.currentMonth && <span className="eyebrow text-gold-400">Open</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <span className={`eyebrow ${scored ? 'text-emerald-400' : 'text-slate-600'}`}>
                                          {matchupsForMonth.length === 0 ? 'No matchups' : scored ? 'Scored' : 'Not scored'}
                                      </span>
                                      <Edit2 size={13} className="text-slate-600"/>
                                  </div>
                              </button>
                          );
                      })}
                  </div>
              )}
          </Panel>

          <Panel icon={Shield} title="Franchise stocks" accent="pink"
            description={`Each player locks ${FRANCHISE_SLOTS} stocks only they can invest in. Assign them here until the draft exists.`}>
              {leaguePlayers.filter(p => p.isPlayer).length === 0 ? (
                  <p className="text-xs text-slate-500">No players yet.</p>
              ) : (
                  <div className="space-y-3">
                      {leaguePlayers.filter(p => p.isPlayer).map(p => {
                          const picks = p.franchiseStocks || [];
                          const available = (activeLeague?.stockPool || []).filter(id => !franchiseOwners[id] || franchiseOwners[id].userId === p.userId);
                          return (
                              <div key={p.id} className="surface-sunken p-3">
                                  <div className="mb-2 flex items-center justify-between">
                                      <span className="truncate text-sm font-bold text-white">{p.name}</span>
                                      <span className={`eyebrow ${picks.length === FRANCHISE_SLOTS ? 'text-gold-400' : ''}`}>{picks.length} / {FRANCHISE_SLOTS}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                      {available.map(id => {
                                          const chosen = picks.includes(id);
                                          return (
                                              <button key={id} onClick={() => toggleFranchiseStock(p, id)}
                                                className={`chip transition ${chosen
                                                    ? 'bg-gold-sheen text-ink-950'
                                                    : 'bg-white/[0.05] text-slate-500 ring-1 ring-white/10 hover:bg-white/[0.10] hover:text-white'}`}>
                                                  {chosen && <CheckCircle2 size={11}/>}{id}
                                              </button>
                                          );
                                      })}
                                      {available.length === 0 && <span className="text-xs text-slate-600">Every pool stock is taken by someone else.</span>}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </Panel>

          <Panel icon={Settings} title="League info" accent="cyan">
             <div className="surface-sunken mb-3 flex items-center justify-between px-4 py-3">
                 <div>
                     <div className="eyebrow">Invite code</div>
                     <div className="font-mono text-2xl font-bold tracking-[0.25em] text-gold-300">{activeMembership?.leagueId}</div>
                 </div>
                 <button onClick={()=>{navigator.clipboard.writeText(activeMembership.leagueId);alert("Copied");}} aria-label="Copy invite code"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400 ring-1 ring-white/10 transition hover:text-white">
                     <Copy size={16}/>
                 </button>
             </div>
             <div className="flex gap-2">
                 <input value={newLeagueNameSetting} onChange={e=>setNewLeagueNameSetting(e.target.value)} className="field-sm flex-1 py-2.5" placeholder="League name" />
                 <button onClick={() => updateDoc(doc(db,'artifacts', appId, 'public', 'data', 'leagues',activeMembership.leagueId), {name:newLeagueNameSetting})} className="btn-ghost px-4"><Save size={14}/> Save</button>
             </div>
          </Panel>

          <Panel icon={CircleDollarSign} title="Starting values" accent="cyan"
            description="Each player's total portfolio value at the start of the month — this is the denominator for their % return.">
              <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                  {leaguePlayers.filter(p => p.isPlayer).map(p => (
                      <div key={p.id} className="surface-sunken flex items-center justify-between px-3 py-2">
                          <div className="truncate text-sm font-bold text-white">{p.name}</div>
                          <div className="flex items-center gap-1">
                              <span className="font-mono text-xs text-slate-500">$</span>
                              <input
                                  type="text" inputMode="decimal" onFocus={selectOnFocus}
                                  defaultValue={p.startValue}
                                  onBlur={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', p.id), { startValue: parseFloat(e.target.value) })}
                                  className="field-sm w-28 py-1.5 text-right font-mono"
                                  placeholder="0"
                              />
                          </div>
                      </div>
                  ))}
              </div>
          </Panel>

          <Panel icon={Trophy} title="Player records" accent="orange">
              <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                  {leaguePlayers.filter(p => p.isPlayer).map(p => (
                      <div key={p.id} className="surface-sunken flex items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0 flex-1 truncate text-sm font-bold text-white">{p.name}</div>
                          <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5">
                                  <span className="eyebrow">W</span>
                                  <input type="text" inputMode="decimal" onFocus={selectOnFocus} defaultValue={p.wins} onBlur={(e) => handleUpdatePlayerStats(p.id, 'wins', e.target.value)} className="field-sm w-14 py-1.5 text-center font-mono" />
                              </label>
                              <label className="flex items-center gap-1.5">
                                  <span className="eyebrow">L</span>
                                  <input type="text" inputMode="decimal" onFocus={selectOnFocus} defaultValue={p.losses} onBlur={(e) => handleUpdatePlayerStats(p.id, 'losses', e.target.value)} className="field-sm w-14 py-1.5 text-center font-mono" />
                              </label>
                          </div>
                      </div>
                  ))}
              </div>
          </Panel>

          <Panel icon={Swords} title="Current matchups" accent="pink">
            <div className="mb-3 space-y-1.5">
                {activeLeague?.matchups?.map((m, i) => (
                    <div key={i} className="surface-sunken flex items-center gap-2 p-2">
                        <select value={m.p1} onChange={(e) => handleUpdateMatchup(i, 'p1', e.target.value)} className="field-sm min-w-0 flex-1 py-1.5">
                            <option value="BYE">BYE</option>
                            {leaguePlayers.map(p => <option key={p.userId} value={p.userId}>{p.name}</option>)}
                        </select>
                        <span className="shrink-0 font-mono text-[10px] font-bold text-slate-600">VS</span>
                        <select value={m.p2} onChange={(e) => handleUpdateMatchup(i, 'p2', e.target.value)} className="field-sm min-w-0 flex-1 py-1.5">
                            <option value="BYE">BYE</option>
                            {leaguePlayers.map(p => <option key={p.userId} value={p.userId}>{p.name}</option>)}
                        </select>
                        <button onClick={() => handleDeleteMatchup(i)} aria-label="Delete matchup" className="shrink-0 p-1 text-slate-600 transition hover:text-rose-400"><Trash2 size={14}/></button>
                    </div>
                ))}
            </div>
            <button onClick={handleAddMatchup} className="btn-ghost w-full"><Plus size={14}/> Add matchup</button>
          </Panel>

          <Panel icon={Calendar} title="Season schedule" accent="purple">
              <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
                  {[4,5,6,7,8,9,10,11].map(m => {
                      const mMatchups = activeLeague?.schedule?.[m];
                      if (!mMatchups) return null;
                      return (
                          <div key={m}>
                              <div className="eyebrow mb-1.5">Month {m}</div>
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                  {mMatchups.map((match, i) => (
                                    <div key={i} className="surface-sunken truncate px-2.5 py-1.5 text-xs text-slate-400">
                                      <span className="text-slate-200">{match.p1Name}</span> vs <span className="text-slate-200">{match.p2Name}</span>
                                    </div>
                                  ))}
                              </div>
                          </div>
                      );
                  })}
                  <div className="border-t border-white/[0.07] pt-3">
                      <div className="eyebrow mb-1 text-gold-400">Month 12 — Playoffs</div>
                      <p className="text-xs text-slate-500">Seeded automatically from the standings at the end of month 11.</p>
                  </div>
              </div>
          </Panel>

          <Panel icon={CircleDollarSign} title="Season opening prices" accent="purple"
            description={`Each ticker's price at the first opening bell of ${monthLabel(activeLeague?.seasonStart)}. This is the baseline for TOT — set it once. Players don't see these; they only see the resulting percentage.`}>
              {(activeLeague?.stockPool || []).length === 0 ? (
                  <p className="text-xs text-slate-500">Add tickers to the pool first.</p>
              ) : (
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                      {(activeLeague.stockPool).map(id => {
                          const seasonOpen = Number(activeLeague?.initialPrices?.[id]) || 0;
                          return (
                              <div key={id} className="surface-sunken flex items-center justify-between gap-2 px-3 py-2">
                                  <div className="min-w-0">
                                      <span className="font-mono text-sm font-bold text-white">{id}</span>
                                      {seasonOpen <= 0 && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-amber-500/80">not set</span>}
                                  </div>
                                  <div className="flex items-center gap-1">
                                      <span className="font-mono text-xs text-slate-500">$</span>
                                      <input
                                          type="text" inputMode="decimal" onFocus={selectOnFocus} step="0.01" min="0"
                                          defaultValue={seasonOpen > 0 ? seasonOpen : ''}
                                          placeholder="0.00"
                                          onBlur={(e) => {
                                              const v = parseFloat(e.target.value);
                                              if (isNaN(v) || v <= 0 || v === seasonOpen) return;
                                              updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
                                                  [`initialPrices.${id}`]: v,
                                              });
                                          }}
                                          className="field-sm w-28 py-1.5 text-right font-mono"
                                      />
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </Panel>

          <Panel icon={BarChart3} title="Stock pool" accent="blue" description="The tickers this league can invest in. Edit it whenever — usually between months.">
             <div className="mb-3 flex gap-2">
                 <input
                   placeholder="Add ticker (e.g. KO)"
                   value={newStockTicker}
                   onChange={e=>setNewStockTicker(e.target.value.toUpperCase())}
                   onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTickerToPool(); } }}
                   className="field-sm flex-1 py-2.5 uppercase"
                 />
                 <button onClick={addTickerToPool} disabled={isProcessing} className="btn-ghost px-4">{isProcessing ? <RefreshCw size={14} className="animate-spin"/> : <Plus size={14}/>} Add</button>
             </div>
             {(activeLeague?.stockPool || []).length === 0 ? (
                 <p className="text-xs text-slate-500">The pool is empty — nobody can invest until you add tickers.</p>
             ) : (
             <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
                 {(activeLeague?.stockPool || []).map(id => {
                     const s = masterStocks.find(m => m.id === id);
                     const owner = franchiseOwners[id];
                     return (
                         <div key={id} className="surface-sunken flex items-center justify-between px-3 py-2">
                             <div className="min-w-0">
                                <span className="font-mono text-sm font-bold text-white">{id}</span>
                                <span className="ml-2 truncate text-xs text-slate-500">{s?.name || ''}</span>
                                {owner && <span className="ml-2 eyebrow text-gold-400">{owner.name}</span>}
                             </div>
                             <button onClick={() => removeFromPool(id)} aria-label={`Remove ${id}`} className="shrink-0 text-slate-600 transition hover:text-rose-400"><Trash2 size={14}/></button>
                         </div>
                     );
                 })}
             </div>
             )}
          </Panel>

          <Panel icon={Crown} title="Past champions" accent="gold"
            description="Titles the league won before it was in the app. These count toward the championship tally and the all-time list. They carry no monthly scores, so they can't set month or season records.">
             <div className="space-y-4">
                {(activeLeague?.seasons || []).some(s => s.manual) && (
                   <div className="divide-y divide-white/[0.05]">
                      {(activeLeague?.seasons || []).filter(s => s.manual)
                        .sort((a, b) => String(a.label).localeCompare(String(b.label)))
                        .map(s => (
                         <div key={s.label} className="flex items-center gap-2.5 py-2">
                            <Trophy size={14} className="shrink-0 text-gold-400"/>
                            <span className="shrink-0 font-mono text-sm font-bold text-white">{s.label}</span>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{s.champion?.name}</span>
                            <button onClick={() => removePastChampionship(s.label)} aria-label={`Remove ${s.label}`}
                              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-white/[0.06] hover:text-rose-300">
                               <Trash2 size={14}/>
                            </button>
                         </div>
                      ))}
                   </div>
                )}
                <div className="grid grid-cols-[104px_1fr] gap-2">
                   <input className="field-sm" placeholder="2024" value={pastTitle.label}
                     onChange={(e) => setPastTitle(t => ({ ...t, label: e.target.value }))} />
                   <input className="field-sm" list="fivestar-team-names" placeholder="Champion" value={pastTitle.name}
                     onChange={(e) => setPastTitle(t => ({ ...t, name: e.target.value }))} />
                </div>
                <datalist id="fivestar-team-names">
                   {leaguePlayers.filter(p => p.isPlayer).map(p => <option key={p.id} value={p.name} />)}
                </datalist>
                <p className="text-xs leading-relaxed text-slate-500">
                   Type a season and the team that won it. Matching a current team's name exactly links the title to them; any other name is recorded as written.
                </p>
                <button onClick={addPastChampionship} className="btn-ghost w-full py-2.5">
                   <Plus size={15}/> Add championship
                </button>
             </div>
          </Panel>

          <Panel icon={RotateCcw} title="Roll into next season" accent="purple"
            description="Files the current season in the record book — champion, final standings and every monthly score — then clears each team's roster, cash, franchise stocks and W-L record for a fresh start. The stock pool is kept. Run this once the playoff month has been scored.">
             <div className="space-y-4">
                <div>
                   <div className="eyebrow mb-1.5">First month of the new season</div>
                   <MonthPicker
                     value={nextSeason.seasonStart || (activeLeague?.seasonStart ? addMonths(activeLeague.seasonStart, 12) : currentMonthKey())}
                     onChange={(v) => setNextSeason(s => ({ ...s, seasonStart: v }))} />
                </div>
                <div>
                   <div className="eyebrow mb-1.5">Last regular month</div>
                   <MonthPicker
                     value={nextSeason.seasonEnd || (activeLeague?.seasonEnd ? addMonths(activeLeague.seasonEnd, 12) : currentMonthKey())}
                     onChange={(v) => setNextSeason(s => ({ ...s, seasonEnd: v }))} />
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                   Playoffs are the month after the last regular month, same as when the league was created.
                   {(activeLeague?.seasons?.length || 0) > 0 &&
                     ` ${activeLeague.seasons.length} season${activeLeague.seasons.length === 1 ? '' : 's'} already in the book.`}
                </p>
                <button onClick={startNextSeason} className="btn-ghost w-full py-3">
                   <RotateCcw size={15}/> Archive season &amp; start the next one
                </button>
             </div>
          </Panel>

          <Panel icon={Trash2} title="Danger zone" accent="rose" description="Deleting a league removes every roster, matchup and record in it. This cannot be undone.">
             <button onClick={handleDeleteLeague} disabled={isProcessing} className="btn-danger w-full py-3">
                {isProcessing ? 'Deleting…' : <><Trash2 size={15}/> Delete league</>}
             </button>
          </Panel>
      </div>
  );

  // The league's permanent history: titles, all-time records, and every season
  // played. Archived seasons and the one in progress are treated identically,
  // except that an unfinished season can't yet hold a season record.
  const renderRecords = () => {
      const rb = recordBook;
      const avatarOf = (uid) => leaguePlayers.find(p => p.userId === uid)?.avatar;

      // Month rows carry `score` and `month`; season rows carry `pct` and `season`.
      const recordTile = (label, row) => {
          const value = row ? (row.score !== undefined ? row.score : row.pct) : null;
          return (
              <div className="surface p-4">
                  <div className="eyebrow">{label}</div>
                  {!row ? (
                      <div className="mt-1.5 font-mono text-2xl font-extrabold text-slate-700">—</div>
                  ) : (
                      <>
                          <div className={`mt-1.5 font-mono text-2xl font-extrabold tracking-tightest ${value >= 0 ? 'text-gain' : 'text-loss'}`}>
                              {fmtPct(value)}
                          </div>
                          <div className="mt-1 truncate text-sm font-bold text-white">{row.name}</div>
                          <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                              {row.month ? `${monthLabel(row.month, true)}` : `${row.season} season`}
                          </div>
                      </>
                  )}
              </div>
          );
      };

      if (rb.months.length === 0) {
          return <EmptyState icon={BookOpen} title="The book is empty"
              body="Once the first month is closed and scored, records start going in here — and they stay, season after season." />;
      }

      return (
          <div className="space-y-5">
              <Card className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                      <Crown size={15} className="shrink-0 text-gold-400" />
                      <h2 className="text-base font-extrabold tracking-tightest text-white">Championships</h2>
                  </div>
                  {rb.titles.length === 0 ? (
                      <p className="text-sm text-slate-500">
                          None awarded yet. The title goes to the winner of the championship matchup
                          {activeLeague?.playoffMonth ? ` in ${monthLabel(activeLeague.playoffMonth)}` : ''}.
                      </p>
                  ) : (
                      <div className="divide-y divide-white/[0.05]">
                          {rb.titles.map(t => (
                              <div key={t.key} className="flex items-center gap-3 py-2.5">
                                  <Avatar url={avatarOf(t.userId)} name={t.name} size="sm" />
                                  <div className="min-w-0 flex-1">
                                      <div className="truncate text-sm font-bold text-white">{t.name}</div>
                                      <div className="truncate font-mono text-[11px] text-slate-500">{t.seasons.join(', ')}</div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                      <Trophy size={14} className="text-gold-400" />
                                      <span className="font-mono text-sm font-extrabold text-gold-300">{t.seasons.length}</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </Card>

              <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="eyebrow">Record book</span>
                      <span className="eyebrow">{rb.months.length} team month{rb.months.length === 1 ? '' : 's'} on file</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                      {recordTile('Best month', rb.bestMonth)}
                      {recordTile('Worst month', rb.worstMonth)}
                      {recordTile('Best season', rb.bestSeason)}
                      {recordTile('Worst season', rb.worstSeason)}
                  </div>
                  {!rb.bestSeason && (
                      <p className="mt-2 px-1 text-[11px] leading-relaxed text-slate-500">
                          Season records are set when a season is archived — the one in progress still has months left to change it.
                      </p>
                  )}
              </div>

              <div>
                  <span className="eyebrow">Season by season</span>
                  <div className="mt-2 space-y-2">
                      {[...allSeasons]
                        .sort((a, b) => String(b.seasonStart || b.label).localeCompare(String(a.seasonStart || a.label)))
                        .map((s, i) => (
                          <Card key={`${s.label}-${i}`} className="p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-sm font-extrabold text-white">{s.label}</span>
                                  {s.inProgress
                                      ? <span className="chip-muted">In progress</span>
                                      : s.champion
                                          ? <span className="chip-gold"><Trophy size={11}/>{s.champion.name}</span>
                                          : <span className="chip-muted">No champion</span>}
                                  <span className="ml-auto shrink-0 font-mono text-[11px] text-slate-500">
                                      {s.manual
                                          ? 'Recorded by hand'
                                          : `${monthLabel(s.seasonStart, true)} – ${monthLabel(s.playoffMonth || s.seasonEnd, true)}`}
                                  </span>
                              </div>
                              {(s.standings || []).length > 0 && (
                                  <div className="mt-3 divide-y divide-white/[0.05]">
                                      {s.standings.map((st, idx) => (
                                          <div key={st.userId} className="flex items-center gap-2 py-1.5">
                                              <span className="w-4 shrink-0 font-mono text-[11px] text-slate-600">{idx + 1}</span>
                                              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">{st.name}</span>
                                              <span className="shrink-0 font-mono text-[11px] text-slate-400">{st.wins}W – {st.losses}L</span>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </Card>
                      ))}
                  </div>
              </div>

              {rb.careers.length > 0 && (
                  <div>
                      <span className="eyebrow">All-time</span>
                      <Card className="mt-2 divide-y divide-white/[0.05]">
                          {rb.careers.map(c => (
                              <div key={c.key} className="flex items-center gap-3 px-4 py-2.5">
                                  <Avatar url={avatarOf(c.userId)} name={c.name} size="sm" />
                                  <div className="min-w-0 flex-1">
                                      <div className="truncate text-sm font-bold text-white">{c.name}</div>
                                      <div className="font-mono text-[11px] text-slate-500">
                                          {c.seasons > 0 ? `${c.seasons} season${c.seasons === 1 ? '' : 's'}` : 'Before the app'}
                                      </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                      {c.seasons > 0 && <div className="font-mono text-sm font-bold text-slate-200">{c.wins}W – {c.losses}L</div>}
                                      {c.titles > 0 && (
                                          <div className="flex items-center justify-end gap-1 font-mono text-[11px] font-bold text-gold-400">
                                              <Trophy size={10}/>{c.titles}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          ))}
                      </Card>
                  </div>
              )}
          </div>
      );
  };

  // One tab's content by key, so a swipe can mount the neighbouring tab alongside
  // the current one without duplicating the routing.
  const renderView = (key) => {
      if (key === 'dashboard') return memberships.length === 0 ? renderOnboarding(false) : renderLeagueHub();
      if (!activeMembership) return null;
      if (key === 'market') return renderMarket();
      if (key === 'team') return renderTeam();
      if (key === 'matchups') return renderMatchups();
      if (key === 'records') return renderRecords();
      if (key === 'admin') return activeMembership.isAdmin ? renderAdmin() : null;
      return null;
  };

  const navItems = [
    { key: 'dashboard', label: 'League',   icon: Trophy },
    { key: 'team',      label: 'Team',     icon: Users },
    { key: 'matchups',  label: 'Matchups', icon: Swords },
    { key: 'market',    label: 'Market',   icon: BarChart3 },
    { key: 'records',   label: 'Records',  icon: BookOpen },
    ...(activeMembership?.isAdmin ? [{ key: 'admin', label: 'Admin', icon: Settings }] : []),
  ];

  // --- Swipe between tabs (touch only) -------------------------------------
  // The content follows the finger rather than firing on release. The neighbouring
  // tab is mounted the instant the gesture locks horizontal, and the track is
  // moved by writing `transform` straight to the node — a React state update per
  // touchmove is what makes this kind of gesture feel gluey, so there isn't one.
  const swipeEnabled = isTouchDevice && !!activeMembership
    && !selectedMatchup && !showProfile && !showLeagueCreator;

  // Carousels and wide tables own their horizontal drags; stealing them would
  // make those unusable.
  const insideHorizontalScroller = (node) => {
    let el = node;
    while (el && el !== swipeWrapRef.current) {
      if (el.scrollWidth > el.clientWidth + 1) {
        const ox = getComputedStyle(el).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      el = el.parentElement;
    }
    return false;
  };

  // Animate the track to a resting place, then hand back to React. The timeout is
  // a backstop: transitionend never fires when the value doesn't actually change.
  const settleTrack = (toPx, ms, after) => {
    const el = swipeTrackRef.current;
    if (!el) { after(); return; }
    settlingRef.current = true;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener('transitionend', onEnd);
      settlingRef.current = false;
      after();
    };
    // transitionend bubbles, and nearly every Card and button in the app carries
    // its own transform transition. Without this guard a card releasing its
    // :active state mid-swipe ends the settle early, wherever the track happens
    // to be, which looks like the outgoing tab flashing back.
    const onEnd = (e) => {
      if (e.target !== el || e.propertyName !== 'transform') return;
      finish();
    };
    el.addEventListener('transitionend', onEnd);
    setTimeout(finish, ms + 100);
    requestAnimationFrame(() => {
      el.style.transition = `transform ${ms}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
      el.style.transform = `translate3d(${toPx}px, 0, 0)`;
    });
  };

  const clearTrack = () => {
    const el = swipeTrackRef.current;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.willChange = '';
    }
    setSwipeNeighbor(null);
  };

  const onSwipeStart = (e) => {
    if (!swipeEnabled || settlingRef.current || e.touches.length !== 1) return;
    if (insideHorizontalScroller(e.target)) return;
    const t = e.touches[0];
    gestureRef.current = {
      x0: t.clientX, y0: t.clientY, t0: Date.now(),
      dx: 0, axis: null, dir: 0, neighbor: null,
      width: swipeWrapRef.current?.clientWidth || window.innerWidth,
    };
  };

  const onSwipeMove = (e) => {
    const g = gestureRef.current;
    if (!g || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x0;
    const dy = t.clientY - g.y0;

    if (g.axis === null) {
      // Wait for enough travel to tell a scroll from a swipe, then commit to one
      // for the rest of the gesture so the page can't wobble diagonally.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.2) { g.axis = 'y'; return; }

      const keys = navItems.map(i => i.key);
      const dir = dx < 0 ? 1 : -1;
      const neighbor = keys[keys.indexOf(currentView) + dir];
      if (!neighbor) { g.axis = 'y'; return; }   // no tab that way — let it scroll

      g.axis = 'x';
      g.dir = dir;
      g.neighbor = neighbor;
      if (swipeTrackRef.current) swipeTrackRef.current.style.willChange = 'transform';
      // Park the incoming tab's top at the top of the viewport rather than at the
      // track's, or a page scrolled halfway down would slide in mid-article.
      const rect = swipeWrapRef.current?.getBoundingClientRect();
      setSwipeNeighbor({ key: neighbor, dir, top: Math.max(0, -(rect?.top || 0)) });
    }
    if (g.axis !== 'x') return;

    g.dx = dx;
    if (swipeTrackRef.current) {
      swipeTrackRef.current.style.transition = '';
      swipeTrackRef.current.style.transform = `translate3d(${dx}px, 0, 0)`;
    }
  };

  const onSwipeEnd = () => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g || g.axis !== 'x' || !g.neighbor) return;

    // Either drag it most of the way, or flick it — a short fast swipe should
    // count, which distance alone would reject.
    const speed = Math.abs(g.dx) / Math.max(1, Date.now() - g.t0);
    const commit = Math.abs(g.dx) > g.width * 0.28 || (speed > 0.45 && Math.abs(g.dx) > 40);

    if (!commit) { settleTrack(0, 180, clearTrack); return; }
    settleTrack(-g.dir * g.width, 200, () => {
      // flushSync renders and commits the tab swap to the DOM before this line
      // returns, so the transform can be cleared immediately after with no paint
      // in between. Relying on React to batch the two updates isn't enough: if it
      // splits them, the first render still holds the outgoing tab and clearing
      // the transform then snaps it back into view for a frame.
      flushSync(() => {
        setSwipeNeighbor(null);
        navigateTo(g.neighbor);
      });
      const el = swipeTrackRef.current;
      if (el) {
        el.style.transition = '';
        el.style.transform = '';
        el.style.willChange = '';
      }
      window.scrollTo(0, 0);
    });
  };

  return (
    <div className="relative min-h-screen pb-28">
      <header ref={headerRef} className="sticky top-0 z-20 border-b border-white/[0.07] bg-ink-950/80 px-4 py-2.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="rounded-xl bg-gold-sheen p-[1.5px]">
              <img src={LOGO_URL} alt="FiveStar" className="h-8 w-8 rounded-[10px] bg-ink-950 object-contain p-1" onError={logoFallback} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-extrabold leading-tight tracking-tight text-white">{activeLeague?.name || "FiveStar"}</div>
              <div className="flex items-center gap-1.5 truncate text-xs leading-tight text-slate-500">
                {activeMembership?.name || 'No league selected'}
                {activeMembership?.isAdmin && <Crown size={11} className="shrink-0 text-gold-400"/>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
              {activeMembership && (
                <button onClick={() => openOverlay('profile', () => { setEditingName(activeMembership?.name || ''); setEditingAvatar(''); setShowProfile(true); })} aria-label="Edit profile"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"><User size={18}/></button>
              )}
              <button onClick={() => { signOut(auth); setMemberships([]); setActiveMembership(null); }} aria-label="Sign out"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      {enlargedAvatar && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => closeOverlay(() => setEnlargedAvatar(null))}>
              <div className="relative w-full max-w-sm animate-fade-up text-center" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => closeOverlay(() => setEnlargedAvatar(null))} aria-label="Close" className="absolute -top-11 right-0 text-slate-500 transition hover:text-white"><X size={22}/></button>
                  {enlargedAvatar.url ? (
                    <img src={enlargedAvatar.url} alt={enlargedAvatar.name} className="mb-4 aspect-square w-full rounded-3xl object-cover shadow-lift ring-1 ring-white/10" />
                  ) : (
                    <div className="mb-4 flex aspect-square w-full items-center justify-center rounded-3xl bg-ink-800 text-7xl font-extrabold uppercase text-slate-600 ring-1 ring-white/10">
                      {enlargedAvatar.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="text-2xl font-extrabold tracking-tightest text-white">{enlargedAvatar.name}</div>
              </div>
          </div>
      )}

      {backfillMonth && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm">
              <div className="surface my-auto w-full max-w-md animate-fade-up p-6 shadow-lift">
                  <div className="mb-1 flex items-start justify-between">
                      <div>
                          <div className="eyebrow text-gold-400/80">Record results</div>
                          <h3 className="mt-0.5 text-xl font-extrabold tracking-tightest text-white">{monthLabel(backfillMonth)}</h3>
                      </div>
                      <button onClick={() => closeOverlay(() => setBackfillMonth(null))} aria-label="Close" className="text-slate-500 transition hover:text-white"><X size={20}/></button>
                  </div>
                  <p className="mb-5 text-xs leading-relaxed text-slate-500">
                      Enter each player's % return for the month. Wins and points recalculate across the whole season when you save.
                  </p>

                  {(activeLeague?.schedule?.[backfillMonth] || []).length === 0 ? (
                      <p className="text-sm text-slate-500">No matchups were generated for this month.</p>
                  ) : (
                      <div className="space-y-2">
                          {(activeLeague.schedule[backfillMonth]).map((m, i) => (
                              <div key={i} className="surface-sunken p-3">
                                  {m.type && <div className="eyebrow mb-2 text-center text-gold-400/90">{m.type}</div>}
                                  <div className="flex items-center gap-2">
                                      <div className="min-w-0 flex-1">
                                          <div className="truncate text-xs font-bold text-slate-300">{m.p1Name}</div>
                                          <div className="mt-1 flex items-center">
                                              <input
                                                  type="text" inputMode="decimal" onFocus={selectOnFocus} step="0.01"
                                                  value={backfillScores[`${i}_p1`] ?? ''}
                                                  onChange={e => setBackfillScores(s => ({ ...s, [`${i}_p1`]: e.target.value }))}
                                                  className="field-sm w-full py-1.5 text-right font-mono"
                                                  placeholder="0.00"
                                              />
                                              <span className="ml-1 font-mono text-xs text-slate-500">%</span>
                                          </div>
                                      </div>
                                      <span className="shrink-0 pt-4 font-mono text-[10px] font-bold text-slate-600">VS</span>
                                      <div className="min-w-0 flex-1">
                                          <div className="truncate text-xs font-bold text-slate-300">{m.p2Name}</div>
                                          {m.p2 === 'BYE' ? (
                                              <div className="mt-1 py-1.5 text-right font-mono text-xs text-slate-600">bye</div>
                                          ) : (
                                              <div className="mt-1 flex items-center">
                                                  <input
                                                      type="text" inputMode="decimal" onFocus={selectOnFocus} step="0.01"
                                                      value={backfillScores[`${i}_p2`] ?? ''}
                                                      onChange={e => setBackfillScores(s => ({ ...s, [`${i}_p2`]: e.target.value }))}
                                                      className="field-sm w-full py-1.5 text-right font-mono"
                                                      placeholder="0.00"
                                                  />
                                                  <span className="ml-1 font-mono text-xs text-slate-500">%</span>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}

                  <div className="mt-6 flex gap-2">
                      <button onClick={saveBackfill} disabled={isProcessing} className="btn-gold flex-1">
                          {isProcessing ? <RefreshCw size={15} className="animate-spin"/> : <><Save size={15}/> Save results</>}
                      </button>
                      <button onClick={() => closeOverlay(() => setBackfillMonth(null))} className="btn-ghost flex-1">Cancel</button>
                  </div>
              </div>
          </div>
      )}

      {showProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="surface w-full max-w-sm animate-fade-up p-6 shadow-lift">
                  <div className="mb-5 flex items-center justify-between">
                      <h3 className="text-lg font-extrabold tracking-tightest text-white">Edit profile</h3>
                      <button onClick={() => closeOverlay(() => setShowProfile(false))} aria-label="Close" className="text-slate-500 transition hover:text-white"><X size={20}/></button>
                  </div>

                  <div className="mb-6 flex justify-center">
                      <Avatar url={editingAvatar || activeMembership?.avatar} name={editingName} size="xl" />
                  </div>

                  <label className="eyebrow mb-1.5 block">Display name</label>
                  <input value={editingName} onChange={e => setEditingName(e.target.value)} className="field mb-4" placeholder="Display name" />

                  <label className="eyebrow mb-1.5 block">Profile picture</label>
                  <label className="btn-ghost mb-6 w-full cursor-pointer">
                      <Upload size={15}/> Upload image
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>

                  <div className="flex gap-2">
                      <button onClick={handleUpdateProfile} className="btn-gold flex-1">Save changes</button>
                      <button onClick={() => closeOverlay(() => setShowProfile(false))} className="btn-ghost flex-1">Cancel</button>
                  </div>
              </div>
          </div>
      )}

      <main
        ref={swipeWrapRef}
        onTouchStart={onSwipeStart}
        onTouchMove={onSwipeMove}
        onTouchEnd={onSwipeEnd}
        onTouchCancel={onSwipeEnd}
        className="relative"
        style={{
          // `pan-y` hands vertical scrolling back to the browser and reserves
          // horizontal for us. React attaches touch listeners passively, so
          // preventDefault is not available — this is what replaces it.
          touchAction: swipeEnabled ? 'pan-y' : undefined,
          // Clip only while a neighbour is mounted. `clip` rather than `hidden`:
          // hidden would make this a scroll container and strand the Market tab's
          // sticky filter bar.
          overflowX: swipeNeighbor ? 'clip' : undefined,
        }}
      >
         <div ref={swipeTrackRef} className="relative">
            <div className="mx-auto max-w-2xl p-4">{renderView(currentView)}</div>
            {swipeNeighbor && (
               <div
                 aria-hidden="true"
                 className="absolute w-full"
                 style={{ top: swipeNeighbor.top, left: swipeNeighbor.dir > 0 ? '100%' : '-100%' }}
               >
                  <div className="mx-auto max-w-2xl p-4">{renderView(swipeNeighbor.key)}</div>
               </div>
            )}
         </div>
      </main>

      {installBanner(true)}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-lg items-stretch justify-between px-3">
          {navItems.map((item) => {
            const active = currentView === item.key;
            const disabled = item.key !== 'dashboard' && !activeMembership;
            return (
              <button
                key={item.key}
                disabled={disabled}
                onClick={() => navigateTo(item.key)}
                className={`group relative flex flex-1 flex-col items-center justify-center gap-1 transition disabled:opacity-30 ${active ? 'text-gold-300' : 'text-slate-600 hover:text-slate-400'}`}
              >
                <span className={`absolute top-0 h-[2px] w-8 rounded-full bg-gold-sheen transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
                <item.icon size={21} strokeWidth={active ? 2.4 : 2} />
                <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}