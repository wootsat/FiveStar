import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Trophy, Plus, Minus, RefreshCw, Shield, Crown, PlayCircle, Lock, LogOut, CheckCircle2, RotateCcw, Search, Save, DollarSign, Wallet, Users, BarChart3, PieChart, Settings, ArrowRight, Copy, Swords, ChevronLeft, Calendar, Edit2, Trash2, User, Upload, X
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

// Use the user provided key
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

// --- Helper Functions ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- Components ---

const Card = ({ children, className = "", onClick }) => (
  <div onClick={onClick} className={`bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden ${className}`}>
    {children}
  </div>
);

const Avatar = ({ url, name, size = "md", onClick }) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-lg",
    xl: "w-32 h-32 text-2xl"
  };
  
  const content = url ? (
    <img src={url} alt={name} className={`rounded-full object-cover border-2 border-slate-700 ${sizeClasses[size]} ${onClick ? 'cursor-pointer hover:border-emerald-500 transition-colors' : ''}`} />
  ) : (
    <div className={`rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300 border-2 border-slate-600 ${sizeClasses[size]} ${onClick ? 'cursor-pointer hover:border-emerald-500 transition-colors' : ''}`}>
      {name ? name.charAt(0).toUpperCase() : '?'}
    </div>
  );

  return onClick ? <div onClick={onClick}>{content}</div> : content;
};

// --- Main App ---

export default function FiveStarApp() {
  const [user, setUser] = useState(null);
  
  // Data States
  const [memberships, setMemberships] = useState([]); 
  const [activeMembership, setActiveMembership] = useState(null); 
  const [activeLeague, setActiveLeague] = useState(null); 
  const [leaguePlayers, setLeaguePlayers] = useState([]); 
  const [masterStocks, setMasterStocks] = useState([]);
  
  // Navigation State
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [selectedMatchup, setSelectedMatchup] = useState(null);
  const [showLeagueCreator, setShowLeagueCreator] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [enlargedAvatar, setEnlargedAvatar] = useState(null);

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
  const [createLeagueName, setCreateLeagueName] = useState('');
  const [adminPlays, setAdminPlays] = useState(true);

  // Admin States
  const [newStockTicker, setNewStockTicker] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [newLeagueNameSetting, setNewLeagueNameSetting] = useState('');

  // Real Data
  const [liveMarketData, setLiveMarketData] = useState({});

  // --- 1. Authentication ---

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.uid));
        if (userDoc.exists()) {
          setHasProfile(true);
          setLoginName(userDoc.data().name);
        }
      } else {
        setMemberships([]);
        setActiveMembership(null);
        setActiveLeague(null);
        setHasProfile(false);
      }
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
        if (list.length > 0 && !activeMembership) {
            setActiveMembership(list[0]);
        }
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
        
        const me = list.find(p => p.userId === user.uid);
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

  const fetchStockData = async () => {
    if (masterStocks.length === 0) return;
    if (FINNHUB_API_KEY === "YOUR_FINNHUB_KEY") {
       const newData = {};
       masterStocks.forEach(s => {
         const current = 150 + Math.random()*10;
         newData[s.id] = { c: current, monthOpen: 145 };
       });
       setLiveMarketData(newData);
       return;
    }

    const newData = { ...liveMarketData };
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const fromTime = Math.floor(startOfMonth.getTime() / 1000);
    const toTime = Math.floor(now.getTime() / 1000);

    for (const stock of masterStocks) {
      try {
        await sleep(200);
        const quoteRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${stock.id}&token=${FINNHUB_API_KEY}`);
        const quoteData = await quoteRes.json();
        
        let monthOpen = newData[stock.id]?.monthOpen;
        if (!monthOpen || monthOpen === quoteData.pc) {
            await sleep(200);
            const candleRes = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${stock.id}&resolution=D&from=${fromTime}&to=${toTime}&token=${FINNHUB_API_KEY}`);
            const candleData = await candleRes.json();
            if (candleData.s === "ok" && candleData.o?.length > 0) monthOpen = candleData.o[0];
            else monthOpen = quoteData.pc;
        }

        if (quoteData.c) newData[stock.id] = { c: quoteData.c, monthOpen };
      } catch (err) { console.error(err); }
    }
    setLiveMarketData(newData);
  };

  useEffect(() => {
    if (!user) return;
    fetchStockData();
    const interval = setInterval(fetchStockData, 60000);
    return () => clearInterval(interval);
  }, [user, masterStocks.length]);

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
    } catch (err) { 
        alert(err.message); 
    }
    setIsProcessing(false);
  };

  const handleCreateLeague = async (e) => {
      e.preventDefault();
      setIsProcessing(true);
      const newLeagueId = Math.floor(100000 + Math.random() * 900000).toString();
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', newLeagueId), {
              id: newLeagueId, name: createLeagueName, adminUid: user.uid,
              month: 4, activeStockIds: [], 
              status: 'drafting', schedule: {}, matchups: [], startingPrices: {}, createdAt: Date.now()
          });
          
          const playerDocId = `${newLeagueId}_${user.uid}`;
          const membershipData = {
              userId: user.uid, leagueId: newLeagueId, leagueName: createLeagueName, 
              name: loginName || user.email?.split('@')[0] || 'Player',
              isAdmin: true, isPlayer: adminPlays, roster: [], cash: 0,
              wins: 0, losses: 0, points: 0, avatar: ''
          };
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', playerDocId), membershipData);
          
          setActiveMembership(membershipData);
          setShowLeagueCreator(false);
      } catch (err) { alert(err.message); }
      setIsProcessing(false);
  };

  const handleJoinLeague = async (e) => {
      e.preventDefault();
      setIsProcessing(true);
      try {
          const leagueDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', joinLeagueId));
          if (!leagueDoc.exists()) throw new Error("League not found");
          const leagueData = leagueDoc.data();

          const playerDocId = `${joinLeagueId}_${user.uid}`;
          const membershipData = {
              userId: user.uid, leagueId: joinLeagueId, leagueName: leagueData.name, 
              name: loginName || user.email?.split('@')[0] || 'Player',
              isAdmin: false, isPlayer: true, roster: [], cash: 0,
              wins: 0, losses: 0, points: 0, avatar: ''
          };
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', playerDocId), membershipData);
          
          setActiveMembership(membershipData);
          setJoinLeagueId('');
          setShowLeagueCreator(false);
      } catch (err) { alert(err.message); }
      setIsProcessing(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) return alert("File too large. Max 500KB.");
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setEditingAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!loginName.trim()) return;
    setIsProcessing(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), { 
        name: loginName, 
        createdAt: Date.now() 
      });
      setHasProfile(true);
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
    if (confirm("Are you sure you want to PERMANENTLY DELETE this league? This action cannot be undone.")) {
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
        } catch (err) {
            alert("Error deleting league: " + err.message);
        }
        setIsProcessing(false);
    }
  };

  // --- ADMIN: MATCHUP & STATS EDITING ---

  const handleUpdateMatchup = async (index, field, value) => {
    if (!activeLeague || !activeMembership?.isAdmin) return;
    const newMatchups = [...(activeLeague.matchups || [])];
    
    // Update the field
    newMatchups[index] = { ...newMatchups[index], [field]: value };

    // Update names for display consistency
    if (field === 'p1' || field === 'p2') {
         const p = leaguePlayers.find(player => player.userId === value);
         const nameField = field === 'p1' ? 'p1Name' : 'p2Name';
         newMatchups[index][nameField] = p ? p.name : 'BYE';
         
         const scoreField = field === 'p1' ? 'p1Score' : 'p2Score';
         if (value === 'BYE') newMatchups[index][scoreField] = 0;
    }

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), { matchups: newMatchups });
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
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), { matchups: newMatchups });
  };

  const handleDeleteMatchup = async (index) => {
    if (!activeLeague || !activeMembership?.isAdmin) return;
    if (!confirm("Delete this matchup?")) return;
    const newMatchups = [...(activeLeague.matchups || [])];
    newMatchups.splice(index, 1);
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), { matchups: newMatchups });
  };

  const handleUpdatePlayerStats = async (playerId, field, value) => {
      const val = parseInt(value);
      if (isNaN(val)) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', playerId), { [field]: val });
  };

  // --- 5. Game Logic ---

  const addNewStock = async (e) => {
    e.preventDefault();
    if (!newStockTicker) return;
    setIsProcessing(true);
    let stockName = newStockTicker;
    try {
        const res = await fetch(`https://finnhub.io/api/v1/search?q=${newStockTicker}&token=${FINNHUB_API_KEY}`);
        const data = await res.json();
        if (data.result && data.result.length > 0) {
            stockName = data.result[0].description;
        }
    } catch (err) { console.error("Could not fetch name", err); }

    const ticker = newStockTicker.toUpperCase();
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stocks', ticker), { id: ticker, name: stockName, sector: 'Unknown' });
    setNewStockTicker('');
    setIsProcessing(false);
    alert(`Added ${ticker}: ${stockName}`);
  };

  const deleteStock = async (stockId) => {
      if (!activeMembership?.isAdmin) return;
      if (confirm(`Delete ${stockId} from the master pool?`)) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stocks', stockId));
      }
  };

  const addToTeam = async (stockId) => {
    if (!activeMembership?.isPlayer) return;
    const roster = activeMembership.roster || [];
    if (roster.find((i) => i.id === stockId)) return alert("Already owned!");
    if (roster.length >= 30) return alert("Roster full! Max 30 stocks."); 
    
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

  const generateSeasonSchedule = () => {
      const playingMembers = leaguePlayers.filter(p => p.isPlayer);
      const schedule = {};
      const regularMonths = [4, 5, 6, 7, 8, 9, 10, 11];

      regularMonths.forEach(month => {
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
      const sched = generateSeasonSchedule();
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), { status: 'ready', schedule: sched, month: 4, matchups: sched[4] });
  };

  const startMonth = async () => {
      await fetchStockData();
      const starts = {};
      masterStocks.forEach(s => starts[s.id] = liveMarketData[s.id]?.c || 0);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), { status: 'active', startingPrices: starts });
  };

  const endMonth = async () => {
      await fetchStockData();
      const prices = activeLeague.startingPrices || {};
      const updates = activeLeague.matchups.map((m) => {
          const p1 = leaguePlayers.find(p=>p.userId===m.p1);
          const p2 = leaguePlayers.find(p=>p.userId===m.p2);
          
          return {
              ...m, 
              p1Score: parseFloat(calculateReturn(p1?.roster, p1?.cash, prices, p1?.startValue).toFixed(2)),
              p2Score: m.p2 === 'BYE' ? 0 : parseFloat(calculateReturn(p2?.roster, p2?.cash, prices, p2?.startValue).toFixed(2))
          }
      });
      
      const batch = writeBatch(db);
      const newSchedule = { ...activeLeague.schedule, [activeLeague.month]: updates };
      batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), { status: 'completed', matchups: updates, schedule: newSchedule });
      
      updates.forEach((m) => {
          const p1Doc = leaguePlayers.find(p=>p.userId===m.p1);
          if (p1Doc) batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', p1Doc.id), {
              wins: p1Doc.wins + (m.p1Score > m.p2Score ? 1 : 0),
              losses: p1Doc.losses + (m.p1Score < m.p2Score ? 1 : 0),
              points: p1Doc.points + m.p1Score
          });
          if (m.p2 !== 'BYE') {
              const p2Doc = leaguePlayers.find(p=>p.userId===m.p2);
              if (p2Doc) batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', p2Doc.id), {
                  wins: p2Doc.wins + (m.p2Score > m.p1Score ? 1 : 0),
                  losses: p2Doc.losses + (m.p2Score < m.p1Score ? 1 : 0),
                  points: p2Doc.points + m.p2Score
              });
          }
      });
      await batch.commit();
  };

  const nextMonth = async () => {
      const nm = (activeLeague.month || 4) + 1;
      if (nm > 12) return alert("Season Completed!");
      let nextMatchups = nm === 12 ? generatePlayoffs() : activeLeague.schedule?.[nm] || [];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), { month: nm, status: 'ready', matchups: nextMatchups, startingPrices: {} });
  };
  
  const resetToDraft = async () => {
    if (!activeMembership?.isAdmin) return;
    if (confirm("Reset current month? This will cancel current matchups and progress.")) {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leagues', activeMembership.leagueId), { status: 'ready_to_start_month' });
    }
  };

  // --- Views ---

  if (!user) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl">
         <div className="flex justify-center mb-6"><img src={LOGO_URL} alt="Logo" className="w-16 h-16 object-contain rounded-lg" onError={(e) => {e.target.onerror=null; e.target.src="https://placehold.co/100x100/10b981/ffffff?text=5Star"}} /></div>
         <h1 className="text-2xl font-bold text-white text-center mb-6">FiveStar Login</h1>
         <form onSubmit={handleAuth} className="space-y-4">
           {isSignUp && <input value={loginName} onChange={e=>setLoginName(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-white px-4 py-3 rounded-xl" placeholder="Player Name" required />}
           <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-white px-4 py-3 rounded-xl" placeholder="Email" required />
           <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-white px-4 py-3 rounded-xl" placeholder="Password" required />
           <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl">{isProcessing ? '...' : (isSignUp?'Sign Up':'Login')}</button>
           <button type="button" onClick={()=>setIsSignUp(!isSignUp)} className="w-full text-slate-400 text-sm">{isSignUp?'Have account? Login':'No account? Sign Up'}</button>
         </form>
      </div>
    </div>
  );

  if (!hasProfile) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl">
         <div className="flex justify-center mb-6"><img src={LOGO_URL} alt="Logo" className="w-16 h-16 object-contain rounded-lg" onError={(e) => {e.target.onerror=null; e.target.src="https://placehold.co/100x100/10b981/ffffff?text=5Star"}} /></div>
         <h1 className="text-2xl font-bold text-white text-center mb-6">Create Profile</h1>
         <form onSubmit={handleCreateProfile} className="space-y-4">
           <input value={loginName} onChange={e=>setLoginName(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-white px-4 py-3 rounded-xl" placeholder="Enter Your Player Name" required />
           <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl">{isProcessing ? 'Creating Profile...' : 'Start Playing'}</button>
         </form>
      </div>
    </div>
  );

  const renderLeagueHub = () => {
      return (
          <div className="space-y-6">
              <div className="flex gap-2 overflow-x-auto pb-2">
                  {memberships.map(m => (
                      <button 
                        key={m.leagueId} 
                        onClick={() => setActiveMembership(m)}
                        className={`flex-shrink-0 px-4 py-2 rounded-lg border text-sm font-bold whitespace-nowrap transition-colors ${activeMembership?.leagueId === m.leagueId ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                      >
                          {m.leagueName || `League ${m.leagueId.substring(0,4)}`}
                      </button>
                  ))}
                  <button onClick={() => setShowLeagueCreator(true)} className="flex-shrink-0 px-3 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm"><Plus/></button>
              </div>

              {!activeMembership ? (
                  <div className="text-center text-slate-500 mt-20">
                      <p>You are not in any leagues.</p>
                      <button onClick={() => setShowLeagueCreator(true)} className="mt-4 text-emerald-400 font-bold underline">Join or Create one</button>
                  </div>
              ) : (
                  <>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                        <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold text-white flex items-center gap-2"><Users size={18}/> {activeLeague?.name} Standings</h3>
                            <span className="text-xs text-slate-500">{leaguePlayers.length} Players</span>
                        </div>
                        <div className="divide-y divide-slate-700">
                            {[...leaguePlayers].filter(p => p.isPlayer).sort((a,b) => b.wins - a.wins || b.points - a.points).map((p, idx) => {
                                // Calculate live return for display on League Hub
                                const currentReturn = calculateReturn(p.roster, p.cash, activeLeague?.startingPrices || {}, p.startValue);
                                
                                return (
                                <div key={p.userId} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">{idx+1}</div>
                                        <Avatar url={p.avatar} name={p.name} size="md" onClick={() => setEnlargedAvatar({url: p.avatar, name: p.name})} />
                                        <div>
                                            <div className="font-bold text-white">{p.name || 'Unknown'} {p.isAdmin && '(Commish)'}</div>
                                            <div className="text-xs text-slate-500">{p.wins || 0}W - {p.losses || 0}L</div>
                                        </div>
                                    </div>
                                    <div className={`font-mono font-bold ${currentReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {currentReturn > 0 ? '+' : ''}{currentReturn.toFixed(2)}%
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                  </>
              )}

              {/* Creator Modal */}
              {showLeagueCreator && (
                  <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md space-y-6">
                          <h2 className="text-xl font-bold text-white">Start Playing</h2>
                          <div className="space-y-3">
                              <h3 className="text-sm font-bold text-slate-500 uppercase">Create New League</h3>
                              <input value={createLeagueName} onChange={e=>setCreateLeagueName(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-white px-4 py-2 rounded-lg" placeholder="League Name" />
                              <div className="flex items-center gap-2"><input type="checkbox" checked={adminPlays} onChange={e=>setAdminPlays(e.target.checked)} className="accent-emerald-500"/><label className="text-slate-400 text-sm">Commissioner Plays?</label></div>
                              <button onClick={handleCreateLeague} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg">Create</button>
                          </div>
                          <div className="h-px bg-slate-800"></div>
                          <div className="space-y-3">
                              <h3 className="text-sm font-bold text-slate-500 uppercase">Join Existing</h3>
                              <input value={joinLeagueId} onChange={e=>setJoinLeagueId(e.target.value)} className="w-full bg-slate-800 border-slate-700 text-white px-4 py-2 rounded-lg" placeholder="League ID" />
                              <button onClick={handleJoinLeague} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg">Join</button>
                          </div>
                          <button onClick={()=>setShowLeagueCreator(false)} className="w-full text-slate-500 py-2">Cancel</button>
                      </div>
                  </div>
              )}
          </div>
      );
  };

  const renderMarket = () => (
      <div className="space-y-4">
          <div className="flex gap-2 sticky top-0 bg-slate-950 z-10 py-2">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                  <input className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white" placeholder="Search..." value={stockSearch} onChange={e => setStockSearch(e.target.value)} />
              </div>
          </div>
          {masterStocks.filter(s=> s.id.includes(stockSearch.toUpperCase())).map(stock => {
              const live = liveMarketData[stock.id];
              const price = live?.c || 0;
              const base = activeLeague?.startingPrices?.[stock.id] || live?.monthOpen || price;
              const change = price && base ? ((price - base) / base) * 100 : 0;
              const inRoster = activeMembership?.roster?.find((i) => i.id === stock.id);

              return (
                  <Card key={stock.id} className="p-4">
                      <div className="flex justify-between items-start">
                          <div>
                              <div className="font-bold text-white">{stock.id}</div>
                              <div className="text-xs text-slate-400">{stock.name}</div>
                              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                  Base: ${base.toFixed(2)}
                                  {activeMembership?.isAdmin && <button onClick={()=>updateBasePrice(stock.id)} className="text-slate-400 hover:text-white"><Edit2 size={10}/></button>}
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="font-mono text-white font-bold">${price.toFixed(2)}</div>
                              <div className={`text-xs font-bold ${change>=0?'text-emerald-400':'text-rose-400'}`}>{change>0?'+':''}{change.toFixed(2)}% MTD</div>
                          </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between items-center">
                          <span className="text-[10px] uppercase text-slate-500 font-bold">{stock.sector}</span>
                          {/* Allowed during ready OR active states. No "banned" check. */}
                          {activeMembership?.isPlayer && ['ready', 'active'].includes(activeLeague?.status) && (
                              inRoster ? <span className="text-emerald-500 text-xs font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Owned</span> 
                              : <button onClick={() => addToTeam(stock.id)} className="bg-emerald-600 text-white px-3 py-1 rounded text-xs font-bold">Add</button>
                          )}
                      </div>
                  </Card>
              )
          })}
      </div>
  );

  const renderTeam = () => {
      if (!activeMembership?.isPlayer) return <div className="text-center text-slate-500 mt-20">Commissioners who do not play do not have a team.</div>;
      const roster = activeMembership.roster || [];
      const cash = activeMembership.cash || 0;
      
      let portfolioValue = cash;
      roster.forEach((i) => {
          const price = liveMarketData[i.id]?.c || 0;
          portfolioValue += (i.shares || 0) * price;
      });

      return (
          <div className="space-y-6">
              <div className="bg-gradient-to-r from-emerald-900 to-slate-900 p-6 rounded-2xl border border-emerald-500/30">
                  <div className="flex justify-between items-end mb-4">
                      <div><h2 className="text-slate-400 text-sm font-bold uppercase">Portfolio Value</h2><div className="text-4xl font-bold font-mono text-white">${portfolioValue.toLocaleString()}</div></div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 flex items-center justify-between">
                      <span className="text-slate-400 text-sm font-bold">Cash on Hand</span>
                      {['ready', 'active'].includes(activeLeague?.status) ? (
                          <div className="flex items-center gap-1 text-white font-mono">
                              $<input type="number" value={cash} onChange={e => updateCash(e.target.value)} className="bg-transparent border-b border-emerald-500 w-24 text-right focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                          </div>
                      ) : <span className="text-white font-mono font-bold">${cash}</span>}
                  </div>
              </div>
              
              {roster.map((item) => {
                  const stock = masterStocks.find(s => s.id === item.id);
                  const price = liveMarketData[item.id]?.c || 0;
                  const val = (item.shares || 0) * price;
                  
                  return (
                    <Card key={item.id} className="p-4">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center text-xs font-bold text-white">{item.id}</div>
                                <div>
                                    <div className="font-bold text-white">{stock?.name || item.id}</div>
                                    <div className="text-xs text-slate-400">Value: <span className="text-emerald-400 font-bold">${val.toFixed(2)}</span></div>
                                </div>
                            </div>
                            {['ready', 'active'].includes(activeLeague?.status) && <button onClick={() => removeFromTeam(item.id)} className="text-rose-500 bg-slate-900 p-2 rounded"><Minus size={16}/></button>}
                        </div>
                        {['ready', 'active'].includes(activeLeague?.status) ? (
                            <div className="flex items-center justify-between bg-slate-900 rounded p-2">
                                <span className="text-xs text-slate-500 font-bold uppercase">Shares</span>
                                <input 
                                    type="number" 
                                    value={item.shares} 
                                    onChange={(e) => updateShares(item.id, e.target.value)} 
                                    className="bg-transparent text-right font-mono text-white w-24 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="0"
                                />
                            </div>
                        ) : (
                            <div className="flex justify-between text-xs text-slate-500 uppercase font-bold text-center bg-slate-900 py-1 px-2 rounded">
                                <span>Shares Locked</span>
                                <span>{item.shares}</span>
                            </div>
                        )}
                    </Card>
                  );
              })}
          </div>
      )
  };

  const renderMatchups = () => {
      // Detail View
      if (selectedMatchup) {
        return (
            <div className="space-y-4">
                <button onClick={() => setSelectedMatchup(null)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors">
                    <ChevronLeft size={20} /> Back to Matchups
                </button>
                <Card className="p-6">
                    <div className="text-center mb-6">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-1">Matchup Detail</div>
                        <h2 className="text-2xl font-bold text-white">{selectedMatchup.type || 'Regular Season'}</h2>
                        <div className="text-slate-500 text-sm">Month {activeLeague?.month}</div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-8 relative">
                         <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700/50 -translate-x-1/2"></div>
                        
                        <div className="text-center w-5/12 z-10">
                            <Avatar name={selectedMatchup.p1Name} size="lg" className="mx-auto mb-3" />
                            <div className="text-xl font-bold text-white mb-1">{selectedMatchup.p1Name}</div>
                            <div className={`text-4xl font-mono font-bold ${selectedMatchup.p1Score >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {selectedMatchup.p1Score}%
                            </div>
                        </div>
                        
                        <div className="text-center w-2/12 z-10">
                            <div className="bg-slate-900 rounded-full w-10 h-10 flex items-center justify-center mx-auto border-2 border-slate-700 text-slate-400 font-bold text-xs">VS</div>
                        </div>

                        <div className="text-center w-5/12 z-10">
                            <Avatar name={selectedMatchup.p2Name} size="lg" className="mx-auto mb-3" />
                            <div className="text-xl font-bold text-white mb-1">{selectedMatchup.p2Name}</div>
                            {selectedMatchup.p2 !== 'BYE' ? (
                                <div className={`text-4xl font-mono font-bold ${selectedMatchup.p2Score >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {selectedMatchup.p2Score}%
                                </div>
                            ) : (
                                <div className="text-slate-500 font-mono italic">--</div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>
        );
      }

      // List View
      return (
        <div className="space-y-4">
            <h2 className="text-lg font-bold text-white mb-4">Month {activeLeague?.month} Head-to-Head</h2>
            {!activeLeague?.matchups?.length && <div className="text-slate-500">No matchups generated yet.</div>}
            
            {activeLeague?.matchups?.map((m, i) => {
                let p1LiveScore = m.p1Score;
                let p2LiveScore = m.p2Score;

                if (activeLeague.status === 'active') {
                    const p1 = leaguePlayers.find(p => p.userId === m.p1);
                    const p2 = leaguePlayers.find(p => p.userId === m.p2);
                    const basePrices = activeLeague.startingPrices || {};
                    p1LiveScore = parseFloat(calculateReturn(p1?.roster, p1?.cash, basePrices, p1?.startValue).toFixed(2));
                    p2LiveScore = m.p2 === 'BYE' ? 0 : parseFloat(calculateReturn(p2?.roster, p2?.cash, basePrices, p2?.startValue).toFixed(2));
                }

                return (
                    <Card key={i} className="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors" onClick={() => setSelectedMatchup({...m, p1Score: p1LiveScore, p2Score: p2LiveScore})}>
                        <div className="flex justify-between items-center text-sm">
                            <div className="text-center w-1/3">
                                <div className="font-bold text-slate-200">{m.p1Name}</div>
                                <div className={`font-mono font-bold ${p1LiveScore>=0?'text-emerald-400':'text-rose-400'}`}>{p1LiveScore}%</div>
                            </div>
                            <div className="text-center">
                                <div className="text-slate-600 font-bold text-xs">VS</div>
                                {m.type && <div className="text-[10px] text-amber-500 font-bold uppercase mt-1">{m.type}</div>}
                            </div>
                            <div className="text-center w-1/3">
                                <div className="font-bold text-slate-200">{m.p2Name}</div>
                                <div className={`font-mono font-bold ${p2LiveScore>=0?'text-emerald-400':'text-rose-400'}`}>{p2LiveScore}%</div>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
      );
  };

  const renderAdmin = () => (
      <div className="space-y-6">
          <div className="bg-slate-800 border-t-4 border-emerald-500 rounded-xl p-4">
             <h3 className="font-bold text-white mb-2 flex items-center gap-2"><Settings size={18}/> League Info</h3>
             <div className="p-3 bg-slate-900 rounded mb-4 flex justify-between items-center">
                 <div><div className="text-[10px] uppercase text-slate-500 font-bold">Invite Code</div><div className="text-xl font-mono text-white tracking-widest">{activeMembership?.leagueId}</div></div>
                 <button onClick={()=>{navigator.clipboard.writeText(activeMembership.leagueId);alert("Copied")}}><Copy className="text-slate-400"/></button>
             </div>
             <input value={newLeagueNameSetting} onChange={e=>setNewLeagueNameSetting(e.target.value)} className="w-full bg-slate-900 border-slate-700 text-white px-3 py-2 rounded mb-2" />
             <button onClick={() => updateDoc(doc(db,'artifacts', appId, 'public', 'data', 'leagues',activeMembership.leagueId), {name:newLeagueNameSetting})} className="bg-emerald-600 text-white font-bold w-full py-2 rounded">Save Name</button>
          </div>

          <div className="bg-slate-800 border-t-4 border-cyan-500 rounded-xl p-4">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2"><DollarSign size={18}/> Player Starting Values (Month Start)</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                  {leaguePlayers.filter(p => p.isPlayer).map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-slate-900 p-2 rounded">
                          <div className="text-sm font-bold text-white">{p.name}</div>
                          <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">$</span>
                              <input 
                                  type="number" 
                                  defaultValue={p.startValue} 
                                  onBlur={(e) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'league_players', p.id), { startValue: parseFloat(e.target.value) })}
                                  className="w-24 bg-slate-800 border border-slate-700 text-white px-2 py-1 rounded text-right text-sm"
                                  placeholder="Start Value"
                              />
                          </div>
                      </div>
                  ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Enter the total portfolio value for each player at the beginning of the month. This is used to calculate the % return.</p>
          </div>

          <div className="bg-slate-800 border-t-4 border-orange-500 rounded-xl p-4">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Trophy size={18}/> Edit Player Records</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                  {leaguePlayers.filter(p => p.isPlayer).map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-slate-900 p-2 rounded">
                          <div className="text-sm font-bold text-white w-1/3 truncate">{p.name}</div>
                          <div className="flex items-center gap-2">
                              <div className="flex flex-col items-center">
                                  <span className="text-[8px] text-slate-500 uppercase">Wins</span>
                                  <input
                                      type="number"
                                      defaultValue={p.wins}
                                      onBlur={(e) => handleUpdatePlayerStats(p.id, 'wins', e.target.value)}
                                      className="w-12 bg-slate-800 border border-slate-700 text-white px-1 rounded text-center text-xs"
                                  />
                              </div>
                              <div className="flex flex-col items-center">
                                  <span className="text-[8px] text-slate-500 uppercase">Losses</span>
                                  <input
                                      type="number"
                                      defaultValue={p.losses}
                                      onBlur={(e) => handleUpdatePlayerStats(p.id, 'losses', e.target.value)}
                                      className="w-12 bg-slate-800 border border-slate-700 text-white px-1 rounded text-center text-xs"
                                  />
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          <div className="bg-slate-800 border-t-4 border-pink-500 rounded-xl p-4">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Swords size={18}/> Edit Current Matchups</h3>
            <div className="space-y-2 mb-4">
                {activeLeague?.matchups?.map((m, i) => (
                    <div key={i} className="flex flex-col gap-2 bg-slate-900 p-2 rounded">
                        <div className="flex items-center gap-2">
                            <select 
                                value={m.p1}
                                onChange={(e) => handleUpdateMatchup(i, 'p1', e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-white text-xs rounded p-1 flex-1"
                            >
                                <option value="BYE">BYE</option>
                                {leaguePlayers.map(p => <option key={p.userId} value={p.userId}>{p.name}</option>)}
                            </select>
                            <span className="text-slate-500 text-xs font-bold">VS</span>
                            <select 
                                value={m.p2}
                                onChange={(e) => handleUpdateMatchup(i, 'p2', e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-white text-xs rounded p-1 flex-1"
                            >
                                <option value="BYE">BYE</option>
                                {leaguePlayers.map(p => <option key={p.userId} value={p.userId}>{p.name}</option>)}
                            </select>
                            <button onClick={() => handleDeleteMatchup(i)} className="text-rose-500 hover:text-rose-400 p-1"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={handleAddMatchup} className="w-full bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded flex items-center justify-center gap-2 text-sm font-bold">
                <Plus size={14}/> Add New Matchup
            </button>
          </div>

          <div className="bg-slate-800 border-t-4 border-purple-500 rounded-xl p-4">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Calendar size={18}/> Season Schedule</h3>
              <div className="max-h-60 overflow-y-auto space-y-4">
                  {[4,5,6,7,8,9,10,11].map(m => {
                      const mMatchups = activeLeague?.schedule?.[m];
                      if (!mMatchups) return null;
                      return (
                          <div key={m}>
                              <div className="text-xs font-bold text-slate-500 uppercase mb-1">Month {m}</div>
                              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                                  {mMatchups.map((match, i) => (
                                      <div key={i} className="bg-slate-900 p-2 rounded">{match.p1Name} vs {match.p2Name}</div>
                                  ))}
                              </div>
                          </div>
                      );
                  })}
                  <div className="pt-2 border-t border-slate-700">
                      <div className="text-xs font-bold text-amber-500 uppercase mb-1">Month 12 (Playoffs)</div>
                      <div className="text-xs text-slate-400">Matchups are determined by standings at end of month 11.</div>
                  </div>
              </div>
          </div>

          <div className="bg-slate-800 border-t-4 border-blue-500 rounded-xl p-4">
             <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Search size={18}/> Manage Stock Pool</h3>
             <div className="flex gap-2 mb-4">
                 <input placeholder="Add Ticker (e.g. KO)" value={newStockTicker} onChange={e=>setNewStockTicker(e.target.value)} className="flex-1 bg-slate-900 border-slate-700 text-white px-3 py-2 rounded uppercase" />
                 <button onClick={addNewStock} disabled={isProcessing} className="bg-blue-600 text-white font-bold px-4 rounded">{isProcessing?'...':'Add'}</button>
             </div>
             <div className="max-h-60 overflow-y-auto space-y-1">
                 {masterStocks.map(s => {
                     return (
                         <div key={s.id} className="flex justify-between items-center bg-slate-900 p-2 rounded">
                             <div className="text-sm font-bold text-white">{s.id}</div>
                             <div className="flex gap-2">
                                 <button onClick={() => deleteStock(s.id)} className="text-slate-600 hover:text-rose-500"><Trash2 size={14}/></button>
                             </div>
                         </div>
                     )
                 })}
             </div>
          </div>

          <div className="bg-slate-800 border-t-4 border-amber-500 rounded-xl p-4 grid gap-3">
             <h3 className="font-bold text-amber-500"><Crown size={18} className="inline mr-2"/> Controls</h3>
             {activeLeague?.status==='drafting' && <button onClick={startLeague} className="bg-emerald-600 text-white font-bold py-3 rounded">Start League (Gen Schedule)</button>}
             {activeLeague?.status?.includes('ready') && <button onClick={startMonth} className="bg-emerald-600 text-white font-bold py-3 rounded">Start Month {activeLeague.month}</button>}
             {activeLeague?.status==='active' && <button onClick={endMonth} className="bg-emerald-600 text-white font-bold py-3 rounded">End Month</button>}
             {activeLeague?.status==='completed' && <button onClick={nextMonth} className="bg-slate-600 text-white font-bold py-3 rounded">Next Month</button>}
          </div>

          <div className="bg-slate-800 border-t-4 border-rose-500 rounded-xl p-4">
             <h3 className="font-bold text-rose-500 mb-4 flex items-center gap-2"><Trash2 size={18}/> Danger Zone</h3>
             <p className="text-slate-400 text-sm mb-4">Deleting a league cannot be undone. All data will be lost.</p>
             <button onClick={handleDeleteLeague} disabled={isProcessing} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                 {isProcessing ? 'Deleting...' : 'Delete League'}
             </button>
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-24 relative">
      <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src={LOGO_URL} alt="Logo" className="w-8 h-8 object-contain rounded bg-slate-900" onError={(e) => {e.target.onerror=null; e.target.src="https://placehold.co/100x100/10b981/ffffff?text=5Star"}} />
          <div>
            <div className="font-bold text-white leading-none">{activeLeague?.name || "FiveStar"}</div>
            <div className="text-xs text-slate-500">{activeMembership?.name || 'Loading...'} {activeMembership?.isAdmin && '(Admin)'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
            {activeMembership && <button onClick={() => { setEditingName(activeMembership?.name || ''); setEditingAvatar(''); setShowProfile(true); }} className="text-slate-500 hover:text-white p-2"><User size={20}/></button>}
            <button onClick={() => { signOut(auth); setMemberships([]); setActiveMembership(null); }} className="text-slate-500 hover:text-white p-2"><LogOut size={20} /></button>
        </div>
      </header>

      {/* Avatar Overlay */}
      {enlargedAvatar && (
          <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setEnlargedAvatar(null)}>
              <div className="relative max-w-sm w-full text-center" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setEnlargedAvatar(null)} className="absolute -top-10 right-0 text-slate-400 hover:text-white"><X size={24}/></button>
                  <img src={enlargedAvatar.url} alt={enlargedAvatar.name} className="w-full aspect-square rounded-2xl object-cover shadow-2xl border-2 border-emerald-500 mb-4" />
                  <div className="text-2xl font-bold text-white">{enlargedAvatar.name}</div>
              </div>
          </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl w-full max-w-sm">
                  <h3 className="text-white font-bold text-lg mb-4">Edit Profile</h3>
                  <div className="flex justify-center mb-4">
                      <Avatar url={editingAvatar || activeMembership.avatar} name={editingName} size="lg" />
                  </div>
                  <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Display Name</label>
                  <input value={editingName} onChange={e => setEditingName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-lg mb-4" placeholder="Display Name" />
                  
                  <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Profile Picture</label>
                  <div className="flex items-center gap-2 mb-6">
                      <label className="flex-1 bg-slate-800 border border-slate-700 text-slate-300 px-3 py-2 rounded-lg cursor-pointer flex items-center justify-center gap-2 hover:bg-slate-700">
                          <Upload size={16}/> Upload Image
                          <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      </label>
                  </div>

                  <div className="flex gap-2">
                      <button onClick={handleUpdateProfile} className="flex-1 bg-emerald-600 text-white font-bold py-2 rounded-lg">Save</button>
                      <button onClick={() => setShowProfile(false)} className="flex-1 bg-slate-800 text-slate-400 font-bold py-2 rounded-lg">Cancel</button>
                  </div>
              </div>
          </div>
      )}

      <main className="p-4 max-w-2xl mx-auto">
         {currentView === 'dashboard' && renderLeagueHub()}
         {activeMembership && currentView === 'market' && renderMarket()}
         {activeMembership && currentView === 'team' && renderTeam()}
         {activeMembership && currentView === 'matchups' && (selectedMatchup ? renderMatchups() : renderMatchups())} 
         {activeMembership?.isAdmin && currentView === 'admin' && renderAdmin()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 pb-safe pt-2 px-6">
        <div className="flex justify-between items-center max-w-lg mx-auto h-16">
          <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center gap-1 ${currentView === 'dashboard' ? 'text-emerald-400' : 'text-slate-600'}`}><Trophy size={24} /><span className="text-[10px] font-medium">League</span></button>
          <button onClick={() => setCurrentView('team')} className={`flex flex-col items-center gap-1 ${currentView === 'team' ? 'text-emerald-400' : 'text-slate-600'}`} disabled={!activeMembership}><Users size={24} /><span className="text-[10px] font-medium">Team</span></button>
          <button onClick={() => { setCurrentView('matchups'); setSelectedMatchup(null); }} className={`flex flex-col items-center gap-1 ${currentView === 'matchups' ? 'text-emerald-400' : 'text-slate-600'}`} disabled={!activeMembership}><Swords size={24} /><span className="text-[10px] font-medium">Matchups</span></button>
          <button onClick={() => setCurrentView('market')} className={`flex flex-col items-center gap-1 ${currentView === 'market' ? 'text-emerald-400' : 'text-slate-600'}`} disabled={!activeMembership}><BarChart3 size={24} /><span className="text-[10px] font-medium">Market</span></button>
          {activeMembership?.isAdmin && <button onClick={() => setCurrentView('admin')} className={`flex flex-col items-center gap-1 ${currentView === 'admin' ? 'text-emerald-400' : 'text-slate-600'}`}><Settings size={24} /><span className="text-[10px] font-medium">Admin</span></button>}
        </div>
      </nav>
    </div>
  );
}