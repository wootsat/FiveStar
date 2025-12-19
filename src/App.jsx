import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Briefcase, 
  Trophy, 
  Search, 
  ArrowRightLeft, 
  Plus, 
  Minus,
  RefreshCw,
  DollarSign,
  Activity,
  Calendar
} from 'lucide-react';

// --- Mock Data ---

const INITIAL_STOCKS = [
  { id: 'AAPL', name: 'Apple Inc.', sector: 'Tech', price: 175.50, volatility: 0.02, projected: 12.5 },
  { id: 'TSLA', name: 'Tesla, Inc.', sector: 'Auto', price: 240.20, volatility: 0.05, projected: 18.2 },
  { id: 'AMZN', name: 'Amazon.com', sector: 'Retail', price: 130.15, volatility: 0.03, projected: 14.1 },
  { id: 'NVDA', name: 'NVIDIA Corp', sector: 'Tech', price: 460.10, volatility: 0.06, projected: 22.0 },
  { id: 'MSFT', name: 'Microsoft', sector: 'Tech', price: 330.00, volatility: 0.02, projected: 10.5 },
  { id: 'GOOGL', name: 'Alphabet', sector: 'Tech', price: 135.50, volatility: 0.025, projected: 11.8 },
  { id: 'META', name: 'Meta', sector: 'Tech', price: 300.25, volatility: 0.04, projected: 15.5 },
  { id: 'JPM', name: 'JPMorgan', sector: 'Finance', price: 145.30, volatility: 0.015, projected: 8.2 },
  { id: 'JNJ', name: 'Johnson & Johnson', sector: 'Health', price: 160.40, volatility: 0.01, projected: 6.5 },
  { id: 'XOM', name: 'Exxon Mobil', sector: 'Energy', price: 110.15, volatility: 0.03, projected: 9.0 },
  { id: 'WMT', name: 'Walmart', sector: 'Retail', price: 160.00, volatility: 0.01, projected: 5.5 },
  { id: 'KO', name: 'Coca-Cola', sector: 'Consumer', price: 58.20, volatility: 0.005, projected: 4.2 },
  { id: 'DIS', name: 'Disney', sector: 'Entertain', price: 85.50, volatility: 0.03, projected: 7.8 },
  { id: 'NFLX', name: 'Netflix', sector: 'Entertain', price: 440.30, volatility: 0.045, projected: 16.5 },
  { id: 'AMD', name: 'AMD', sector: 'Tech', price: 105.20, volatility: 0.05, projected: 19.5 },
];

const OPPONENT_ROSTER_IDS = ['MSFT', 'GOOGL', 'JPM', 'KO', 'DIS'];

// --- Helper Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, type = 'neutral' }) => {
  const colors = {
    neutral: 'bg-slate-700 text-slate-300',
    success: 'bg-emerald-900/50 text-emerald-400 border border-emerald-800',
    danger: 'bg-rose-900/50 text-rose-400 border border-rose-800',
    tech: 'bg-blue-900/50 text-blue-400 border border-blue-800',
    retail: 'bg-orange-900/50 text-orange-400 border border-orange-800',
    energy: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
  };
  
  let colorClass = colors.neutral;
  if (type === 'Tech') colorClass = colors.tech;
  else if (type === 'Retail') colorClass = colors.retail;
  else if (type === 'Energy') colorClass = colors.energy;
  else if (['Auto', 'Finance', 'Health', 'Consumer', 'Entertain'].includes(type)) colorClass = colors.neutral;
  else if (colors[type]) colorClass = colors[type];

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {children}
    </span>
  );
};

// --- Main App Component ---

export default function FiveStarApp() {
  const [view, setView] = useState('matchup'); // matchup, team, market, league
  const [week, setWeek] = useState(1);
  const [stocks, setStocks] = useState(INITIAL_STOCKS);
  const [myRoster, setMyRoster] = useState(['AAPL', 'TSLA', 'AMZN', 'NVDA', 'XOM']);
  const [opponentRoster, setOpponentRoster] = useState(OPPONENT_ROSTER_IDS);
  const [scores, setScores] = useState({}); // { week: { me: 100, opp: 90 } }
  const [liveData, setLiveData] = useState({}); // { TICKER: { change: 5.2, points: 15.2 } }
  const [isPlaying, setIsPlaying] = useState(false);
  const [leagueStandings, setLeagueStandings] = useState([
    { name: 'Wall St. Wolves (You)', wins: 0, losses: 0, pf: 0 },
    { name: 'Index Fund Bots', wins: 0, losses: 0, pf: 0 },
    { name: 'Crypto Kings', wins: 0, losses: 0, pf: 0 },
    { name: 'Dividend Dads', wins: 0, losses: 0, pf: 0 },
  ]);

  // Generate live data for the current view
  useEffect(() => {
    generateDailyMovement();
  }, [week]);

  const generateDailyMovement = () => {
    const newLiveData = {};
    stocks.forEach(stock => {
      // Random movement based on volatility
      // Fantasy Points = % Change * 10 (e.g., +2.5% = 25 pts)
      const baseMove = (Math.random() - 0.48) * stock.volatility * 100; // Slight bias to growth
      const points = parseFloat((baseMove * 10).toFixed(1)); 
      const priceChange = stock.price * (baseMove / 100);
      
      newLiveData[stock.id] = {
        changePercent: baseMove,
        priceChange: priceChange,
        currentPrice: stock.price + priceChange,
        points: points
      };
    });
    setLiveData(newLiveData);
  };

  const calculateTotalScore = (rosterIds) => {
    return rosterIds.reduce((sum, id) => {
      return sum + (liveData[id]?.points || 0);
    }, 0).toFixed(1);
  };

  const simulateWeekEnd = () => {
    setIsPlaying(true);
    
    // Animate numbers for effect
    let steps = 0;
    const interval = setInterval(() => {
      generateDailyMovement();
      steps++;
      if (steps > 5) {
        clearInterval(interval);
        finalizeWeek();
      }
    }, 200);
  };

  const finalizeWeek = () => {
    const myScore = parseFloat(calculateTotalScore(myRoster));
    const oppScore = parseFloat(calculateTotalScore(opponentRoster));

    // Update history
    setScores(prev => ({
      ...prev,
      [week]: { me: myScore, opp: oppScore }
    }));

    // Update Standings
    const myWin = myScore > oppScore;
    const newStandings = [...leagueStandings];
    
    // Update You
    newStandings[0].wins += myWin ? 1 : 0;
    newStandings[0].losses += myWin ? 0 : 1;
    newStandings[0].pf += myScore;

    // Update Opponent (Index Fund Bots)
    newStandings[1].wins += myWin ? 0 : 1;
    newStandings[1].losses += myWin ? 1 : 0;
    newStandings[1].pf += oppScore;

    // Simulate other random matchups for league
    newStandings[2].wins += Math.random() > 0.5 ? 1 : 0;
    newStandings[2].losses += newStandings[2].wins === 0 ? 0 : 1; // Simplified logic
    newStandings[2].pf += 100 + (Math.random() * 50);

    newStandings[3].wins += Math.random() > 0.5 ? 1 : 0;
    newStandings[3].losses += newStandings[3].wins === 0 ? 0 : 1;
    newStandings[3].pf += 90 + (Math.random() * 40);

    // Sort standings
    newStandings.sort((a, b) => b.wins - a.wins || b.pf - a.pf);

    setLeagueStandings(newStandings);
    setWeek(w => w + 1);
    setIsPlaying(false);
  };

  const toggleStockInRoster = (stockId) => {
    if (myRoster.includes(stockId)) {
      setMyRoster(prev => prev.filter(id => id !== stockId));
    } else {
      if (myRoster.length >= 5) {
        alert("Roster full! Drop a company first.");
        return;
      }
      setMyRoster(prev => [...prev, stockId]);
    }
  };

  // --- Views ---

  const renderMatchup = () => {
    const myTotal = calculateTotalScore(myRoster);
    const oppTotal = calculateTotalScore(opponentRoster);
    const winning = parseFloat(myTotal) > parseFloat(oppTotal);

    return (
      <div className="space-y-6 pb-20">
        {/* Scoreboard Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-slate-900 p-6 rounded-2xl shadow-xl border border-emerald-800/30">
          <div className="flex justify-between items-center text-slate-400 mb-2 text-sm font-medium uppercase tracking-wider">
            <span>Week {week} Matchup</span>
            <span className="flex items-center gap-1"><Activity size={14} /> Live Market</span>
          </div>
          <div className="flex justify-between items-end">
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-1">{myTotal}</div>
              <div className="text-xs text-emerald-400 font-medium">Wall St. Wolves</div>
            </div>
            <div className="text-slate-500 font-bold text-xl pb-2">VS</div>
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-300 mb-1">{oppTotal}</div>
              <div className="text-xs text-slate-500 font-medium">Index Fund Bots</div>
            </div>
          </div>
          <div className="mt-4 w-full bg-slate-800 h-2 rounded-full overflow-hidden">
             {/* Simple win probability bar */}
             <div 
               className={`h-full transition-all duration-500 ${winning ? 'bg-emerald-500' : 'bg-rose-500'}`} 
               style={{ width: '50%' }} 
             />
          </div>
          <div className="mt-2 text-center text-xs text-slate-400">
             Projected Winner: {winning ? 'You' : 'Opponent'} (52%)
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={simulateWeekEnd}
          disabled={isPlaying}
          className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all
            ${isPlaying 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 hover:shadow-emerald-500/20'
            }`}
        >
          {isPlaying ? (
            <><RefreshCw className="animate-spin" /> Trading in Progress...</>
          ) : (
            <><Calendar size={20} /> End Week & Finalize Scores</>
          )}
        </button>

        {/* Rosters Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RosterColumn 
            title="Your Portfolio" 
            rosterIds={myRoster} 
            stocks={stocks} 
            liveData={liveData} 
            isMe={true} 
          />
          <RosterColumn 
            title="Opponent Portfolio" 
            rosterIds={opponentRoster} 
            stocks={stocks} 
            liveData={liveData} 
            isMe={false} 
          />
        </div>
      </div>
    );
  };

  const RosterColumn = ({ title, rosterIds, stocks, liveData, isMe }) => (
    <div className="space-y-3">
      <h3 className={`text-sm font-bold uppercase tracking-wide ${isMe ? 'text-emerald-400' : 'text-slate-400'}`}>
        {title}
      </h3>
      {rosterIds.map(id => {
        const stock = stocks.find(s => s.id === id);
        const data = liveData[id] || { points: 0, changePercent: 0 };
        const isPos = data.changePercent >= 0;

        return (
          <Card key={id} className="p-3 flex items-center justify-between hover:bg-slate-800/80 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${isMe ? 'bg-slate-700 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {id.substring(0, 1)}
              </div>
              <div>
                <div className="font-bold text-slate-200 text-sm leading-tight">{stock.name}</div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{stock.sector}</span>
                  <span className={isPos ? 'text-emerald-400' : 'text-rose-400'}>
                    {data.changePercent > 0 ? '+' : ''}{data.changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`font-mono font-bold text-lg ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                {data.points > 0 ? '+' : ''}{data.points.toFixed(1)}
              </div>
              <div className="text-[10px] text-slate-500 uppercase font-bold">Pts</div>
            </div>
          </Card>
        );
      })}
      {/* Empty Slots */}
      {Array.from({ length: 5 - rosterIds.length }).map((_, i) => (
        <div key={i} className="h-16 border-2 border-dashed border-slate-700 rounded-xl flex items-center justify-center text-slate-600 text-sm font-medium">
          Empty Slot
        </div>
      ))}
    </div>
  );

  const renderMarket = () => (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Stock Market</h2>
        <div className="text-slate-400 text-sm">Cap Space: <span className="text-emerald-400 font-mono">Unlimited</span></div>
      </div>
      
      {/* Search Bar - Visual only */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 text-slate-500" size={18} />
        <input 
          type="text" 
          placeholder="Search companies or tickers..." 
          className="w-full bg-slate-800 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="space-y-3">
        {stocks.map(stock => {
          const inRoster = myRoster.includes(stock.id);
          const isFull = myRoster.length >= 5;
          const data = liveData[stock.id] || { points: 0, changePercent: 0 };

          return (
            <Card key={stock.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center text-white font-bold shadow-inner">
                     {stock.id}
                   </div>
                   <div>
                     <h3 className="font-bold text-white">{stock.name}</h3>
                     <div className="flex items-center gap-2 mt-1">
                       <Badge type={stock.sector}>{stock.sector}</Badge>
                       <span className="text-xs text-slate-400 flex items-center gap-1">
                         Proj: <span className="text-slate-300 font-medium">{stock.projected} pts</span>
                       </span>
                     </div>
                   </div>
                </div>

                <button 
                  onClick={() => toggleStockInRoster(stock.id)}
                  disabled={!inRoster && isFull}
                  className={`p-3 rounded-full transition-all ${
                    inRoster 
                      ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white' 
                      : isFull
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'
                  }`}
                >
                  {inRoster ? <Minus size={20} /> : <Plus size={20} />}
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  );

  const renderStandings = () => (
    <div className="pb-20">
      <h2 className="text-2xl font-bold text-white mb-6">League Standings</h2>
      <Card className="divide-y divide-slate-700">
        <div className="grid grid-cols-12 p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <div className="col-span-1">#</div>
          <div className="col-span-6">Team</div>
          <div className="col-span-2 text-center">W-L</div>
          <div className="col-span-3 text-right">PF</div>
        </div>
        {leagueStandings.map((team, idx) => (
          <div key={team.name} className={`grid grid-cols-12 p-4 items-center ${idx === 0 ? 'bg-emerald-900/10' : ''}`}>
            <div className="col-span-1 text-slate-400 font-mono font-bold">{idx + 1}</div>
            <div className="col-span-6 font-bold text-white flex items-center gap-2">
              {idx === 0 && <Trophy size={14} className="text-yellow-500" />}
              <span className="truncate">{team.name}</span>
            </div>
            <div className="col-span-2 text-center text-slate-300 font-mono">
              {team.wins}-{team.losses}
            </div>
            <div className="col-span-3 text-right text-slate-400 font-mono text-sm">
              {team.pf.toFixed(1)}
            </div>
          </div>
        ))}
      </Card>

      <div className="mt-8 p-6 bg-slate-800 rounded-xl text-center">
        <Trophy size={48} className="mx-auto text-slate-600 mb-4" />
        <h3 className="text-white font-bold text-lg">Season Ends in 12 Weeks</h3>
        <p className="text-slate-400 text-sm mt-2">Top 2 teams make the playoffs. Keep trading to stay ahead of the index bots.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* Top Navigation / Header */}
      <header className="sticky top-0 z-10 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-slate-900">
            <TrendingUp size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">FiveStar</h1>
            <span className="text-xs text-slate-500 font-medium">League: Big Spenders</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Current Week</div>
          <div className="text-emerald-400 font-mono font-bold leading-none">{week}</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 max-w-lg mx-auto">
        {view === 'matchup' && renderMatchup()}
        {view === 'market' && renderMarket()}
        {view === 'standings' && renderStandings()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 pb-safe pt-2 px-6">
        <div className="flex justify-between items-center max-w-lg mx-auto h-16">
          <NavButton 
            active={view === 'matchup'} 
            onClick={() => setView('matchup')} 
            icon={<ArrowRightLeft />} 
            label="Matchup" 
          />
          <NavButton 
            active={view === 'market'} 
            onClick={() => setView('market')} 
            icon={<Search />} 
            label="Market" 
          />
          <NavButton 
            active={view === 'standings'} 
            onClick={() => setView('standings')} 
            icon={<Trophy />} 
            label="League" 
          />
        </div>
      </nav>
    </div>
  );
}

const NavButton = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}
  >
    {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 })}
    <span className="text-[10px] font-medium">{label}</span>
  </button>
);