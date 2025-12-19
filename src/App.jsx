import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Trophy, Plus, Minus, RefreshCw, Shield, Crown, PlayCircle, Lock, LogOut
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot, updateDoc, writeBatch 
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

const ADMIN_CODE = "admin123";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Mock "Master List" of all possible companies
const MASTER_STOCKS = [
  { id: 'AAPL', name: 'Apple Inc.', sector: 'Tech', price: 175.50 },
  { id: 'TSLA', name: 'Tesla, Inc.', sector: 'Auto', price: 240.20 },
  { id: 'AMZN', name: 'Amazon.com', sector: 'Retail', price: 130.15 },
  { id: 'NVDA', name: 'NVIDIA Corp', sector: 'Tech', price: 460.10 },
  { id: 'MSFT', name: 'Microsoft', sector: 'Tech', price: 330.00 },
  { id: 'GOOGL', name: 'Alphabet', sector: 'Tech', price: 135.50 },
  { id: 'META', name: 'Meta', sector: 'Tech', price: 300.25 },
  { id: 'JPM', name: 'JPMorgan', sector: 'Finance', price: 145.30 },
  { id: 'JNJ', name: 'Johnson & Johnson', sector: 'Health', price: 160.40 },
  { id: 'XOM', name: 'Exxon Mobil', sector: 'Energy', price: 110.15 },
  { id: 'WMT', name: 'Walmart', sector: 'Retail', price: 160.00 },
  { id: 'KO', name: 'Coca-Cola', sector: 'Consumer', price: 58.20 },
  { id: 'DIS', name: 'Disney', sector: 'Entertain', price: 85.50 },
  { id: 'NFLX', name: 'Netflix', sector: 'Entertain', price: 440.30 },
  { id: 'AMD', name: 'AMD', sector: 'Tech', price: 105.20 },
  { id: 'SBUX', name: 'Starbucks', sector: 'Consumer', price: 95.00 },
  { id: 'NKE', name: 'Nike', sector: 'Retail', price: 98.50 },
  { id: 'INTC', name: 'Intel', sector: 'Tech', price: 35.50 },
  { id: 'PEP', name: 'PepsiCo', sector: 'Consumer', price: 170.00 },
  { id: 'GS', name: 'Goldman Sachs', sector: 'Finance', price: 320.00 },
];

// --- Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, type = 'neutral' }) => {
  const colors = {
    neutral: 'bg-slate-700 text-slate-300',
    tech: 'bg-blue-900/50 text-blue-400 border border-blue-800',
    retail: 'bg-orange-900/50 text-orange-400 border border-orange-800',
    energy: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
    finance: 'bg-emerald-900/50 text-emerald-400 border border-emerald-800',
  };
  
  let colorClass = colors.neutral;
  const t = (type || 'neutral').toLowerCase();
  if (t.includes('tech')) colorClass = colors.tech;
  else if (t.includes('retail')) colorClass = colors.retail;
  else if (t.includes('energy')) colorClass = colors.energy;
  else if (t.includes('finance')) colorClass = colors.finance;

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${colorClass}`}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function FiveStarApp() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [leagueState, setLeagueState] = useState(null);
  const [players, setPlayers] = useState([]);
  
  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // Profile Creation State
  const [loginName, setLoginName] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // --- Auth & Data Listeners ---

  useEffect(() => {
    // Listen for auth state changes (no auto sign-in)
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;

    // 1. Listen to League State
    const leagueRef = doc(db, 'league_state', 'main');
    const unsubLeague = onSnapshot(leagueRef, (docSnap) => {
      if (docSnap.exists()) {
        setLeagueState(docSnap.data());
      } else {
        // Init League if it doesn't exist
        setDoc(leagueRef, {
          month: 1,
          activeStockIds: ['AAPL', 'MSFT', 'TSLA', 'AMZN', 'GOOGL', 'META', 'NVDA', 'JPM'],
          status: 'drafting',
          matchups: [],
          lastUpdate: Date.now()
        });
      }
    });

    // 2. Listen to Players
    const playersRef = collection(db, 'players');
    const unsubPlayers = onSnapshot(playersRef, (snapshot) => {
      const pList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPlayers(pList);
      
      const myProfile = pList.find(p => p.id === user.uid);
      if (myProfile) setUserProfile(myProfile);
    });

    return () => {
      unsubLeague();
      unsubPlayers();
    };
  }, [user]);

  // --- Actions ---

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      alert(err.message);
    }
    setIsProcessing(false);
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!loginName.trim() || !user) return;
    setIsProcessing(true);

    const isAdmin = loginCode === ADMIN_CODE;
    const userRef = doc(db, 'players', user.uid);
    
    await setDoc(userRef, {
      name: loginName,
      isAdmin: isAdmin,
      roster: [], 
      wins: 0, 
      losses: 0, 
      points: 0,
      joinedAt: Date.now()
    }, { merge: true });

    setIsProcessing(false);
  };

  const updateRoster = async (stockId) => {
    if (!userProfile) return;
    const currentRoster = userProfile.roster || [];
    let newRoster;
    
    if (currentRoster.includes(stockId)) {
      newRoster = currentRoster.filter(id => id !== stockId);
    } else {
      if (currentRoster.length >= 5) return alert("Roster full! Max 5 companies.");
      newRoster = [...currentRoster, stockId];
    }

    const userRef = doc(db, 'players', user.uid);
    await updateDoc(userRef, { roster: newRoster });
  };

  const toggleAllowedStock = async (stockId) => {
    if (!leagueState || !userProfile?.isAdmin) return;
    const currentActive = leagueState.activeStockIds || [];
    let newActive = currentActive.includes(stockId) 
      ? currentActive.filter(id => id !== stockId)
      : [...currentActive, stockId];

    const leagueRef = doc(db, 'league_state', 'main');
    await updateDoc(leagueRef, { activeStockIds: newActive });
  };

  const generateMatchups = async () => {
    if (!userProfile?.isAdmin) return;
    setIsProcessing(true);

    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const newMatchups = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        newMatchups.push({
          p1: shuffled[i].id, p2: shuffled[i+1].id,
          p1Name: shuffled[i].name, p2Name: shuffled[i+1].name,
          p1Score: 0, p2Score: 0,
        });
      } else {
        newMatchups.push({
          p1: shuffled[i].id, p2: 'BYE',
          p1Name: shuffled[i].name, p2Name: 'Bye Week',
          p1Score: 0, p2Score: 0
        });
      }
    }

    const leagueRef = doc(db, 'league_state', 'main');
    await updateDoc(leagueRef, { matchups: newMatchups, status: 'active' });
    setIsProcessing(false);
  };

  const simulateMonth = async () => {
    if (!userProfile?.isAdmin || !leagueState) return;
    setIsProcessing(true);

    const stockPerformance = {};
    leagueState.activeStockIds.forEach(id => {
      // Random move -5% to +15%
      stockPerformance[id] = parseFloat(((Math.random() * 0.20 - 0.05) * 100).toFixed(2));
    });

    const getScore = (pid) => {
      if (pid === 'BYE') return 0;
      const player = players.find(p => p.id === pid);
      if (!player || !player.roster) return 0;
      return player.roster.reduce((sum, sId) => sum + (stockPerformance[sId] || 0), 0);
    };

    const updatedMatchups = leagueState.matchups.map(m => ({
      ...m,
      p1Score: parseFloat(getScore(m.p1).toFixed(1)),
      p2Score: parseFloat(getScore(m.p2).toFixed(1)),
    }));

    const batch = writeBatch(db);
    batch.update(doc(db, 'league_state', 'main'), { 
      matchups: updatedMatchups, status: 'completed' 
    });

    updatedMatchups.forEach(m => {
      if (m.p1 !== 'BYE') {
        const p1 = players.find(p=>p.id===m.p1);
        batch.update(doc(db, 'players', m.p1), { 
          wins: (p1?.wins || 0) + (m.p1Score > m.p2Score ? 1 : 0),
          losses: (p1?.losses || 0) + (m.p1Score < m.p2Score ? 1 : 0),
          points: (p1?.points || 0) + m.p1Score
        });
      }
      if (m.p2 !== 'BYE') {
        const p2 = players.find(p=>p.id===m.p2);
        batch.update(doc(db, 'players', m.p2), { 
          wins: (p2?.wins || 0) + (m.p2Score > m.p1Score ? 1 : 0),
          losses: (p2?.losses || 0) + (m.p2Score < m.p1Score ? 1 : 0),
          points: (p2?.points || 0) + m.p2Score
        });
      }
    });

    await batch.commit();
    setIsProcessing(false);
  };

  const nextMonth = async () => {
    if (!userProfile?.isAdmin) return;
    await updateDoc(doc(db, 'league_state', 'main'), {
      month: (leagueState.month || 1) + 1,
      status: 'drafting',
      matchups: []
    });
  };

  // --- Views ---

  // 1. Auth View (Login/Sign Up)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <TrendingUp size={40} className="text-emerald-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-6">FiveStar Login</h1>
          <form onSubmit={handleAuth} className="space-y-4">
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl"
              placeholder="Email Address"
              required
            />
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl"
              placeholder="Password"
              required
            />
            <button disabled={isProcessing} className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-3 rounded-xl transition-colors">
              {isProcessing ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Login')}
            </button>
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-slate-400 text-sm hover:text-white transition-colors">
              {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. Profile Creation View (Join League)
  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl">
          <h1 className="text-2xl font-bold text-white text-center mb-6">Create Profile</h1>
          <form onSubmit={handleCreateProfile} className="space-y-4">
            <input 
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl"
              placeholder="Enter Your Player Name"
              required
            />
            <input 
              type="password"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl"
              placeholder="Admin Code (Optional)"
            />
            <button disabled={!loginName || isProcessing} className="w-full bg-emerald-500 text-slate-900 font-bold py-3 rounded-xl">
              {isProcessing ? 'Creating...' : 'Start Playing'}
            </button>
            <button type="button" onClick={() => signOut(auth)} className="w-full text-slate-500 text-sm">
              Cancel / Log Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 3. Main Dashboard View
  const myMatchup = leagueState?.matchups?.find(m => m.p1 === user.uid || m.p2 === user.uid);
  const isDrafting = leagueState?.status === 'drafting';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
      <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center text-slate-900"><TrendingUp size={20}/></div>
          <div>
            <div className="font-bold text-white leading-none">FiveStar</div>
            <div className="text-xs text-slate-500">{userProfile.name} {userProfile.isAdmin && '(Admin)'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Month</div>
            <div className="font-mono font-bold leading-none">{leagueState?.month || 1}</div>
          </div>
          <button onClick={() => signOut(auth)} className="bg-slate-800 p-2 rounded-lg text-slate-400 hover:text-white"><LogOut size={16}/></button>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-6">
        <div className={`p-4 rounded-xl border flex items-center justify-between ${isDrafting ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-emerald-900/20 border-emerald-500/30'}`}>
          <div className="flex items-center gap-3">
            {isDrafting ? <PlayCircle className="text-indigo-400" /> : <Shield className="text-emerald-400" />}
            <div>
              <h2 className="font-bold text-white">{isDrafting ? 'Drafting Phase' : 'Season Active'}</h2>
              <p className="text-xs text-slate-400">{isDrafting ? 'Select 5 companies.' : 'Markets are open.'}</p>
            </div>
          </div>
          {isDrafting && (
             <div className="text-right">
               <span className={`text-2xl font-bold font-mono ${(userProfile.roster?.length || 0) === 5 ? 'text-emerald-400' : 'text-slate-300'}`}>{userProfile.roster?.length || 0}/5</span>
             </div>
          )}
        </div>

        {!isDrafting && myMatchup && (
          <div className="grid grid-cols-2 gap-px bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
            <div className={`p-6 text-center ${myMatchup.p1Score > myMatchup.p2Score ? 'bg-emerald-900/20' : ''}`}>
               <div className="text-xs text-slate-500 font-bold uppercase mb-1">{myMatchup.p1Name}</div>
               <div className="text-4xl font-bold text-white">{myMatchup.p1Score}</div>
            </div>
            <div className={`p-6 text-center ${myMatchup.p2Score > myMatchup.p1Score ? 'bg-emerald-900/20' : ''}`}>
               <div className="text-xs text-slate-500 font-bold uppercase mb-1">{myMatchup.p2Name}</div>
               <div className="text-4xl font-bold text-white">{myMatchup.p2Score}</div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {MASTER_STOCKS.map(stock => {
            const isAvailable = leagueState?.activeStockIds?.includes(stock.id);
            const isInMyRoster = userProfile.roster?.includes(stock.id);
            
            if (!userProfile.isAdmin) {
              if (isDrafting && !isAvailable) return null;
              if (!isDrafting && !isInMyRoster) return null;
            }

            return (
              <Card key={stock.id} className={`p-4 flex items-center justify-between ${userProfile.isAdmin && !isAvailable ? 'opacity-40 grayscale' : ''} ${isInMyRoster ? 'border-emerald-500/50 bg-emerald-900/10' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center text-xs font-bold text-white">{stock.id}</div>
                  <div>
                    <div className="font-bold text-slate-200">{stock.name}</div>
                    <Badge type={stock.sector}>{stock.sector}</Badge>
                  </div>
                </div>
                {userProfile.isAdmin && isDrafting ? (
                  <button onClick={() => toggleAllowedStock(stock.id)} className={`px-3 py-1 text-xs font-bold rounded ${isAvailable ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-700 text-slate-400'}`}>{isAvailable ? 'Allowed' : 'Banned'}</button>
                ) : (
                  isDrafting && (
                    <button onClick={() => updateRoster(stock.id)} className={`w-8 h-8 rounded-full flex items-center justify-center ${isInMyRoster ? 'bg-rose-500/20 text-rose-500' : 'bg-emerald-500/20 text-emerald-500'}`}>{isInMyRoster ? <Minus size={16} /> : <Plus size={16} />}</button>
                  )
                )}
              </Card>
            );
          })}
        </div>

        {userProfile.isAdmin && (
          <div className="bg-slate-800 border-t-4 border-amber-500 rounded-xl p-4 mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {isDrafting ? (
              <button onClick={generateMatchups} disabled={players.length < 2 || isProcessing} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">Start Month</button>
            ) : (
              <button onClick={simulateMonth} disabled={leagueState.status === 'completed' || isProcessing} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">Simulate Results</button>
            )}
            {leagueState?.status === 'completed' && (
              <button onClick={nextMonth} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg">Next Month</button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}