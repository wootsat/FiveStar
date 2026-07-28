import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, Trophy, Plus, Minus, RefreshCw, Shield, Crown, PlayCircle, Lock, LogOut, CheckCircle2, RotateCcw, Search, Save, DollarSign, Wallet, Users, BarChart3, PieChart, Settings, ArrowRight, Copy, Swords, ChevronLeft, Calendar, Edit2, Trash2, User, Upload, X, ArrowUp, ArrowDown, ArrowUpDown, Medal, Sparkles, Activity, CircleDollarSign
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, writeBatch, getDoc, query, where, deleteDoc, getDocs 
} from 'firebase/firestore';

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

const LOGO_URL = "https://i.postimg.cc/WpxKS20L/5star.png";

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

const Panel = ({ icon: Icon, title, accent = 'gold', description, children }) => (
  <section className="surface relative overflow-hidden p-5 pl-6">
    <div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${PANEL_ACCENTS[accent]}`} />
    <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-white">
      {Icon && <Icon size={16} className="text-slate-400" />}
      {title}
    </h3>
    {description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

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
  const [showLeagueCreator, setShowLeagueCreator] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [enlargedAvatar, setEnlargedAvatar] = useState(null);

  // Sorting State
  const [marketSortBy, setMarketSortBy] = useState('mtd'); // 'mtd', 'total', 'alpha'
  const [marketSortDir, setMarketSortDir] = useState('desc'); // 'asc' or 'desc'

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

  // Real Data
  const [liveMarketData, setLiveMarketData] = useState(() => {
    const cached = localStorage.getItem('fivestar_market_data');
    return cached ? JSON.parse(cached) : {};
  });

  // --- Persistence Hooks ---
  
  useEffect(() => {
    localStorage.setItem('fivestar_view', currentView);
  }, [currentView]);

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

  const fetchStockData = async () => {
    if (trackedTickers.length === 0) return;
    if (FINNHUB_API_KEY === "YOUR_FINNHUB_KEY") {
       const newData = {};
       trackedTickers.forEach(id => {
         const current = 150 + Math.random()*10;
         newData[id] = { c: current, monthOpen: 145 };
       });
       setLiveMarketData(newData);
       return;
    }

    const newData = { ...liveMarketData };
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fromTime = Math.floor(startOfMonth.getTime() / 1000);
    const toTime = Math.floor(now.getTime() / 1000);

    let hasUpdates = false;
    for (const ticker of trackedTickers) {
      try {
        await sleep(200);
        const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
        const quoteData = await quoteRes.json();

        if (!quoteData.c && quoteData.c !== 0) continue;

        let monthOpen = newData[ticker]?.monthOpen;
        if (!monthOpen || monthOpen === 0) {
            await sleep(200);
            const candleRes = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${ticker}&resolution=D&from=${fromTime}&to=${toTime}&token=${FINNHUB_API_KEY}`);
            const candleData = await candleRes.json();
            if (candleData.s === "ok" && candleData.o?.length > 0) monthOpen = candleData.o[0];
            else monthOpen = quoteData.pc || quoteData.c;
        }

        newData[ticker] = { c: quoteData.c, monthOpen };
        hasUpdates = true;
      } catch (err) { console.error(`Error fetching ${ticker}:`, err); }
    }
    if (hasUpdates) setLiveMarketData(newData);
  };

  useEffect(() => {
    if (!user) return;
    fetchStockData();
    const interval = setInterval(fetchStockData, 60000);
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
      setShowProfile(false);
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

  const removeFromTeam = async (stockId) => {
      const roster = activeMembership.roster.filter((i) => i.id !== stockId);
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'league_players', `${activeMembership.leagueId}_${user.uid}`);
      await updateDoc(docRef, { roster });
  };

  const updateBasePrice = async (stockId) => {
      if (!activeMembership?.isAdmin) return;
      const currentStartPrice = activeLeague.startingPrices?.[stockId] || 0;
      const newVal = prompt(`Update Base Price for ${stockId}`, currentStartPrice);
      if (newVal === null) return;
      const price = parseFloat(newVal);
      if (isNaN(price)) return alert("Invalid Price");
      const newStartingPrices = { ...activeLeague.startingPrices, [stockId]: price };
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), { startingPrices: newStartingPrices });
  };

  // --- Calculations ---

  const calculateReturn = (roster, cash, basePrices, manualStartValue) => {
      let currentValue = parseFloat(cash) || 0;
      if (roster && Array.isArray(roster)) {
          roster.forEach(item => {
              const shares = parseFloat(item.shares) || 0;
              const currPrice = liveMarketData[item.id]?.c || basePrices[item.id] || 0;
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
                  const startPrice = basePrices[item.id] || 1; 
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
      await fetchStockData();
      const allowance = Number(activeLeague.monthlyAllowance) || 0;
      const pool = activeLeague.stockPool || [];
      const starts = {};
      pool.forEach(id => { starts[id] = liveMarketData[id]?.c || 0; });

      const leagueUpdate = { status: 'active', startingPrices: starts };
      if (!activeLeague.initialPrices || Object.keys(activeLeague.initialPrices).length === 0) {
          leagueUpdate.initialPrices = starts;
      }

      const batch = writeBatch(db);
      batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), leagueUpdate);

      leaguePlayers.filter(p => p.isPlayer).forEach(p => {
          const newCash = (parseFloat(p.cash) || 0) + allowance;
          let holdings = 0;
          (p.roster || []).forEach(item => {
              holdings += (parseFloat(item.shares) || 0) * (starts[item.id] || 0);
          });
          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', p.id), {
              cash: newCash,
              startValue: parseFloat((holdings + newCash).toFixed(2)),
          });
      });
      await batch.commit();
  };

  const endMonth = async () => {
      await fetchStockData();
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
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), {
          status: 'completed', matchups: updates, schedule: newSchedule
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
      setBackfillMonth(month);
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
          setBackfillMonth(null);
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
    <AuthShell
      eyebrow="Fantasy Stock League"
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
                  <button onClick={closeOnboarding} aria-label="Close" className="float-right -mr-1 -mt-1 text-slate-500 transition hover:text-white">
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
                              <input type="number" min="2" max="20" value={draft.maxPlayers} onChange={e => patch({ maxPlayers: e.target.value })} className="field text-center font-mono text-lg font-bold" />
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
                              <input type="number" min="1" value={draft.monthlyAllowance} onChange={e => patch({ monthlyAllowance: e.target.value })} className="field pl-8 font-mono text-lg font-bold" />
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
      const status = STATUS_META[activeLeague?.status] || STATUS_META.drafting;

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
              <button onClick={() => setShowLeagueCreator(true)} aria-label="Add league"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-slate-400 ring-1 ring-white/10 transition hover:bg-white/[0.09] hover:text-gold-300">
                  <Plus size={16}/>
              </button>
          </div>

          {!activeMembership ? (
              <EmptyState icon={Trophy} title="No leagues yet" body="Create a league and invite your friends, or join one with a six-digit code.">
                  <button onClick={() => { setOnboardingMode(null); setShowLeagueCreator(true); }} className="btn-gold">Create or join a league <ArrowRight size={16}/></button>
              </EmptyState>
          ) : (
              <>
              <div className="surface relative overflow-hidden bg-card-glow p-5">
                  <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                          <div className="eyebrow">Season standings</div>
                          <h2 className="mt-1 truncate text-2xl font-extrabold tracking-tightest text-white">{activeLeague?.name || 'League'}</h2>
                      </div>
                      <span className={`${status.chip} shrink-0`}>
                          {status.live && <span className="h-1.5 w-1.5 animate-ticker-pulse rounded-full bg-current" />}
                          {status.label}
                      </span>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2">
                      {[
                          { label: 'Month', value: monthLabel(activeLeague?.currentMonth, true) },
                          { label: 'Players', value: standings.length },
                          { label: 'Code', value: activeMembership.leagueId },
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
                      <span className="eyebrow">Return</span>
                  </div>
                  {standings.length === 0 ? (
                      <p className="px-4 py-10 text-center text-sm text-slate-500">No players have joined yet.</p>
                  ) : (
                  <div className="divide-y divide-white/[0.05]">
                      {standings.map((p, idx) => {
                          const currentReturn = calculateReturn(p.roster, p.cash, activeLeague?.startingPrices || {}, p.startValue);
                          const isMe = p.userId === user?.uid;
                          return (
                          <div key={p.userId} className={`flex items-center gap-3 px-4 py-3 transition ${isMe ? 'bg-gold-400/[0.05]' : ''}`}>
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${RANK_STYLES[idx] || 'bg-white/[0.06] text-slate-500'}`}>
                                  {idx + 1}
                              </div>
                              <Avatar url={p.avatar} name={p.name} size="md" onClick={() => setEnlargedAvatar({url: p.avatar, name: p.name})} />
                              <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                      <span className="truncate font-bold text-white">{p.name || 'Unknown'}</span>
                                      {isMe && <span className="eyebrow text-gold-400">You</span>}
                                      {p.isAdmin && <Crown size={12} className="shrink-0 text-gold-400"/>}
                                  </div>
                                  <div className="mt-0.5 font-mono text-xs text-slate-500">
                                      {p.wins || 0}<span className="text-slate-600">W</span> · {p.losses || 0}<span className="text-slate-600">L</span>
                                  </div>
                              </div>
                              <Pct value={currentReturn} className="text-base" />
                          </div>
                          );
                      })}
                  </div>
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
    let stocksToRender = masterStocks.filter(s => pool.includes(s.id) && s.id.includes(stockSearch.toUpperCase())).map(stock => {
      const live = liveMarketData[stock.id];
      const price = live?.c || 0;
      
      const mtdBase = activeLeague?.startingPrices?.[stock.id] || live?.monthOpen || price;
      const mtdChange = price && mtdBase ? ((price - mtdBase) / mtdBase) * 100 : 0;
      
      const initialBase = activeLeague?.initialPrices?.[stock.id] || mtdBase; 
      const totalChange = price && initialBase ? ((price - initialBase) / initialBase) * 100 : 0;

      const inRoster = activeMembership?.roster?.find((i) => i.id === stock.id);
      const owner = franchiseOwners[stock.id];
      const lockedBy = owner && owner.userId !== user?.uid ? owner : null;
      const isMyFranchise = owner && owner.userId === user?.uid;

      return { ...stock, price, mtdBase, mtdChange, totalChange, inRoster, lockedBy, isMyFranchise };
    });

    // 2. Sort Data
    stocksToRender.sort((a, b) => {
      if (marketSortBy === 'alpha') {
          return marketSortDir === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
      }
      const valA = marketSortBy === 'mtd' ? a.mtdChange : a.totalChange;
      const valB = marketSortBy === 'mtd' ? b.mtdChange : b.totalChange;
      return marketSortDir === 'asc' ? valA - valB : valB - valA;
    });

    const canDraft = activeMembership?.isPlayer && ['ready', 'active'].includes(activeLeague?.status);

    const toggleSort = (key, defaultDir) => {
      if (marketSortBy === key) setMarketSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      else { setMarketSortBy(key); setMarketSortDir(defaultDir); }
    };

    const SORTS = [
      { key: 'alpha', label: 'Ticker', dir: 'asc' },
      { key: 'mtd', label: 'MTD', dir: 'desc' },
      { key: 'total', label: 'Total', dir: 'desc' },
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
                const active = marketSortBy === s.key;
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
            </div>
          </div>

          {stocksToRender.length === 0 ? (
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
                          {stock.lockedBy ? (
                              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-slate-600">
                                  <Lock size={10}/> {stock.lockedBy.name}'s franchise
                              </div>
                          ) : (
                              <div className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-slate-600">
                                  Base ${stock.mtdBase.toFixed(2)}
                                  {activeMembership?.isAdmin && (
                                    <button onClick={()=>updateBasePrice(stock.id)} className="text-slate-600 transition hover:text-gold-400" aria-label={`Edit base price for ${stock.id}`}>
                                      <Edit2 size={10}/>
                                    </button>
                                  )}
                              </div>
                          )}
                      </div>

                      <div className="shrink-0 text-right">
                          <div className="font-mono text-base font-bold text-white">${stock.price.toFixed(2)}</div>
                          <div className="mt-1 flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-1.5">
                                  <span className="eyebrow">MTD</span>
                                  <Pct value={stock.mtdChange} className="text-[11px]" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                  <span className="eyebrow">TOT</span>
                                  <Pct value={stock.totalChange} className="text-[11px]" />
                              </div>
                          </div>
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
      let portfolioValue = cash;
      roster.forEach((i) => {
          const price = liveMarketData[i.id]?.c || 0;
          portfolioValue += (i.shares || 0) * price;
      });
      const holdingsValue = portfolioValue - cash;
      const monthReturn = calculateReturn(roster, cash, activeLeague?.startingPrices || {}, activeMembership.startValue);

      return (
          <div className="space-y-4">
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
                                          type="number"
                                          value={cash}
                                          onChange={e => updateCash(e.target.value)}
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
                      {isOpen && <button onClick={() => setCurrentView('market')} className="btn-gold">Browse the market <ArrowRight size={16}/></button>}
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
                                <div className="font-mono text-base font-bold text-white">${val.toFixed(2)}</div>
                                <div className="font-mono text-[11px] text-slate-500">${price.toFixed(2)} / sh</div>
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
                                    type="number"
                                    value={item.shares}
                                    onChange={(e) => updateShares(item.id, e.target.value)}
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
      const isLive = activeLeague?.status === 'active';
      const avatarFor = (uid) => leaguePlayers.find(p => p.userId === uid)?.avatar;

      if (selectedMatchup) {
        const m = selectedMatchup;
        const isBye = m.p2 === 'BYE';
        const p1Leads = !isBye && m.p1Score > m.p2Score;
        const p2Leads = !isBye && m.p2Score > m.p1Score;

        return (
            <div className="animate-fade-up space-y-4">
                <button onClick={() => setSelectedMatchup(null)} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 transition hover:text-white">
                    <ChevronLeft size={18} /> All matchups
                </button>

                <div className="surface relative overflow-hidden bg-card-glow p-6">
                    <div className="mb-8 text-center">
                        <div className="eyebrow text-gold-400/80">{m.type || 'Regular season'}</div>
                        <h2 className="mt-1 text-2xl font-extrabold tracking-tightest text-white">{monthLabel(activeLeague?.currentMonth)}</h2>
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
                            {p1Leads && <div className="eyebrow mt-2 text-gold-400">Leading</div>}
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
                                <div className={`font-mono text-4xl font-extrabold tracking-tightest ${m.p2Score >= 0 ? 'text-gain' : 'text-loss'}`}>
                                    {m.p2Score > 0 ? '+' : ''}{m.p2Score}%
                                </div>
                            ) : (
                                <div className="font-mono text-4xl font-extrabold text-slate-700">—</div>
                            )}
                            {p2Leads && <div className="eyebrow mt-2 text-gold-400">Leading</div>}
                        </div>
                    </div>
                </div>
            </div>
        );
      }

      return (
        <div className="space-y-3">
            <SectionHeading icon={Swords} title={monthLabel(activeLeague?.currentMonth)} meta={isLive ? 'Live scoring' : isPlayoffMonth ? 'Playoffs' : 'Head to head'} />

            {!activeLeague?.matchups?.length ? (
                <EmptyState icon={Swords} title="No matchups yet" body="The commissioner hasn't generated the schedule for this month." />
            ) : activeLeague.matchups.map((m, i) => {
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

                return (
                    <Card key={i} className={`p-4 ${mine ? 'ring-gold-400/25' : ''}`} onClick={() => setSelectedMatchup({...m, p1Score: p1LiveScore, p2Score: p2LiveScore})}>
                        {m.type && (
                            <div className="mb-3 flex items-center justify-center gap-2">
                                <span className="h-px flex-1 hairline" />
                                <span className="eyebrow text-gold-400/90">{m.type}</span>
                                <span className="h-px flex-1 hairline" />
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                <Avatar url={avatarFor(m.p1)} name={m.p1Name} size="sm" className={p1Leads ? 'ring-gold-400/60' : ''} />
                                <div className="min-w-0">
                                    <div className={`truncate text-sm font-bold ${p1Leads ? 'text-white' : 'text-slate-300'}`}>{m.p1Name}</div>
                                    <Pct value={p1LiveScore} className="text-sm" />
                                </div>
                            </div>

                            <span className="shrink-0 px-2 font-mono text-[10px] font-bold text-slate-600">VS</span>

                            <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 text-right">
                                <div className="min-w-0">
                                    <div className={`truncate text-sm font-bold ${p2Leads ? 'text-white' : 'text-slate-300'}`}>{m.p2Name}</div>
                                    {isBye ? <span className="font-mono text-sm font-bold text-slate-600">—</span> : <Pct value={p2LiveScore} className="text-sm" />}
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
          <SectionHeading icon={Shield} title="Commissioner" meta={STATUS_META[activeLeague?.status]?.label} />

          <Panel icon={Crown} title="Season controls" accent="gold"
            description={`${monthLabel(activeLeague?.seasonStart)} – ${monthLabel(activeLeague?.seasonEnd)}, playoffs ${monthLabel(activeLeague?.playoffMonth)}. $${Number(activeLeague?.monthlyAllowance || 0).toLocaleString()} deposited per player each month.`}>
             <div className="surface-sunken mb-3 flex items-center justify-between px-4 py-3">
                 <div>
                     <div className="eyebrow">Open month</div>
                     <div className="mt-0.5 text-lg font-extrabold tracking-tightest text-white">{monthLabel(activeLeague?.currentMonth)}</div>
                 </div>
                 <span className={STATUS_META[activeLeague?.status]?.chip || 'chip-muted'}>
                     {STATUS_META[activeLeague?.status]?.live && <span className="h-1.5 w-1.5 animate-ticker-pulse rounded-full bg-current" />}
                     {STATUS_META[activeLeague?.status]?.label || activeLeague?.status}
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
                                  type="number"
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
                                  <input type="number" defaultValue={p.wins} onBlur={(e) => handleUpdatePlayerStats(p.id, 'wins', e.target.value)} className="field-sm w-14 py-1.5 text-center font-mono" />
                              </label>
                              <label className="flex items-center gap-1.5">
                                  <span className="eyebrow">L</span>
                                  <input type="number" defaultValue={p.losses} onBlur={(e) => handleUpdatePlayerStats(p.id, 'losses', e.target.value)} className="field-sm w-14 py-1.5 text-center font-mono" />
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

          <Panel icon={Trash2} title="Danger zone" accent="rose" description="Deleting a league removes every roster, matchup and record in it. This cannot be undone.">
             <button onClick={handleDeleteLeague} disabled={isProcessing} className="btn-danger w-full py-3">
                {isProcessing ? 'Deleting…' : <><Trash2 size={15}/> Delete league</>}
             </button>
          </Panel>
      </div>
  );

  const navItems = [
    { key: 'dashboard', label: 'League',   icon: Trophy },
    { key: 'team',      label: 'Team',     icon: Users },
    { key: 'matchups',  label: 'Matchups', icon: Swords },
    { key: 'market',    label: 'Market',   icon: BarChart3 },
    ...(activeMembership?.isAdmin ? [{ key: 'admin', label: 'Admin', icon: Settings }] : []),
  ];

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
                <button onClick={() => { setEditingName(activeMembership?.name || ''); setEditingAvatar(''); setShowProfile(true); }} aria-label="Edit profile"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"><User size={18}/></button>
              )}
              <button onClick={() => { signOut(auth); setMemberships([]); setActiveMembership(null); }} aria-label="Sign out"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      {enlargedAvatar && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={() => setEnlargedAvatar(null)}>
              <div className="relative w-full max-w-sm animate-fade-up text-center" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setEnlargedAvatar(null)} aria-label="Close" className="absolute -top-11 right-0 text-slate-500 transition hover:text-white"><X size={22}/></button>
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
                      <button onClick={() => setBackfillMonth(null)} aria-label="Close" className="text-slate-500 transition hover:text-white"><X size={20}/></button>
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
                                                  type="number" step="0.01"
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
                                                      type="number" step="0.01"
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
                      <button onClick={() => setBackfillMonth(null)} className="btn-ghost flex-1">Cancel</button>
                  </div>
              </div>
          </div>
      )}

      {showProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
              <div className="surface w-full max-w-sm animate-fade-up p-6 shadow-lift">
                  <div className="mb-5 flex items-center justify-between">
                      <h3 className="text-lg font-extrabold tracking-tightest text-white">Edit profile</h3>
                      <button onClick={() => setShowProfile(false)} aria-label="Close" className="text-slate-500 transition hover:text-white"><X size={20}/></button>
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
                      <button onClick={() => setShowProfile(false)} className="btn-ghost flex-1">Cancel</button>
                  </div>
              </div>
          </div>
      )}

      <main className="mx-auto max-w-2xl p-4">
         {currentView === 'dashboard' && (memberships.length === 0 ? renderOnboarding(false) : renderLeagueHub())}
         {activeMembership && currentView === 'market' && renderMarket()}
         {activeMembership && currentView === 'team' && renderTeam()}
         {activeMembership && currentView === 'matchups' && renderMatchups()}
         {activeMembership?.isAdmin && currentView === 'admin' && renderAdmin()}
      </main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-lg items-stretch justify-between px-3">
          {navItems.map((item) => {
            const active = currentView === item.key;
            const disabled = item.key !== 'dashboard' && !activeMembership;
            return (
              <button
                key={item.key}
                disabled={disabled}
                onClick={() => { setCurrentView(item.key); if (item.key === 'matchups') setSelectedMatchup(null); }}
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