// Match Operating System (MOS) - Progressive Web App Edition with custom layouts
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Match, MatchSettings, Team, Inning } from './types';
import MatchSetup from './components/MatchSetup';
import Scoreboard from './components/Scoreboard';
import MatchHistory from './components/MatchHistory';
import LoadingScreen from './components/LoadingScreen';
import { 
  Trophy, 
  BookOpen, 
  Play, 
  ArrowRight, 
  RotateCcw, 
  Settings, 
  Activity, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { speakText } from './utils/commentary';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Global defaults synced to match setups
  const [globalVoiceCommentary, setGlobalVoiceCommentary] = useState(true);
  const [globalVibrationFeedback, setGlobalVibrationFeedback] = useState(true);

  // Load an active unfinished match from storage on entry (in case of browser refresh)
  useEffect(() => {
    const saved = localStorage.getItem('gully_cricket_active_match');
    if (saved) {
      try {
        const loadedMatch = JSON.parse(saved) as Match;
        if (loadedMatch.status !== 'completed') {
          setMatch(loadedMatch);
        }
      } catch (e) {
        console.error("Error loading active match:", e);
      }
    }
  }, []);

  // Save active match state changes to persist through street play disruptions
  const handleUpdateMatch = (updated: Match) => {
    setMatch(updated);
    if (updated.status === 'completed') {
      localStorage.removeItem('gully_cricket_active_match');
    } else {
      localStorage.setItem('gully_cricket_active_match', JSON.stringify(updated));
    }
  };

  const handleStartMatch = (
    teamA: Team,
    teamB: Team,
    settings: MatchSettings,
    tossWinnerId: string,
    tossDecision: 'bat' | 'bowl'
  ) => {
    // Determine who bats first based on toss choice
    const isTeamAWinner = tossWinnerId === 'team_a';
    const chosenBattingFirstTeamId = (isTeamAWinner && tossDecision === 'bat') || (!isTeamAWinner && tossDecision === 'bowl')
      ? 'team_a'
      : 'team_b';

    const battingTeam = chosenBattingFirstTeamId === 'team_a' ? teamA : teamB;
    const bowlingTeam = chosenBattingFirstTeamId === 'team_a' ? teamB : teamA;

    // Generate First Innings skeleton
    const firstInning: Inning = {
      battingTeamId: battingTeam.id,
      bowlingTeamId: bowlingTeam.id,
      runs: 0,
      wickets: 0,
      ballsBowled: 0,
      overs: [
        {
          overNumber: 0,
          bowlerId: 'player_b_0', // pre-pick first bowling-side player as opening bowler
          balls: []
        }
      ],
      batsmen: battingTeam.players.map((pName, i) => ({
        id: `player_a_${i}`,
        name: pName,
        runsScored: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        oversBowled: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        wides: 0,
        noballs: 0
      })),
      bowlers: bowlingTeam.players.map((pName, i) => ({
        id: `player_b_${i}`,
        name: pName,
        runsScored: 0,
        ballsFaced: 0,
        fours: 0,
        sixes: 0,
        isOut: false,
        oversBowled: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        wides: 0,
        noballs: 0
      })),
      tempBatter1Id: settings.playersPerTeam === 1 ? 'player_a_0' : '',
      tempBatter2Id: '',
      tempBowlerId: settings.playersPerTeam === 1 ? 'player_b_0' : '',
      openingLineupConfirmed: settings.playersPerTeam === 1 ? true : false
    };

    const newMatch: Match = {
      id: `match_${Date.now()}`,
      date: new Date().toISOString(),
      teamA,
      teamB,
      settings,
      tossWinnerId,
      tossDecision,
      status: 'first_innings',
      firstInnings: firstInning
    };

    setMatch(newMatch);
    setShowHistory(false);
    localStorage.setItem('gully_cricket_active_match', JSON.stringify(newMatch));

    // Speak announcement
    if (settings.voiceCommentary) {
      speakText(`Toss won by ${isTeamAWinner ? teamA.name : teamB.name}, choosing to ${tossDecision} first. Let the gully match commence!`);
    }
  };

  const handleResetMatch = () => {
    if (window.confirm("Are you sure you want to discard this active match? All changes will be lost!")) {
      setMatch(null);
      setShowHistory(false);
      localStorage.removeItem('gully_cricket_active_match');
    }
  };

  const handleStartSecondInnings = () => {
    if (!match || !match.secondInnings) return;
    
    const updated: Match = {
      ...match,
      status: 'second_innings'
    };
    handleUpdateMatch(updated);
    
    if (match.settings.voiceCommentary) {
      speakText(`Second innings begins. Target is ${match.firstInnings.runs + 1} runs.`);
    }
  };

  if (loading) {
    return (
      <LoadingScreen 
        onComplete={() => {
          setLoading(false);
        }} 
      />
    );
  }

  const firstInnsRuns = match?.firstInnings.runs || 0;
  const firstInnsWickets = match?.firstInnings.wickets || 0;

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 flex flex-col antialiased font-sans relative overflow-x-hidden">
      
      {/* Decorative moving blurs for deep glass gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[8%] left-[15%] w-[380px] h-[380px] rounded-full bg-lime-400/[0.04] blur-[110px] animate-float-slow" />
        <div className="absolute bottom-[20%] right-[10%] w-[420px] h-[420px] rounded-full bg-emerald-500/[0.03] blur-[120px] animate-float-medium" />
        <div className="absolute top-[50%] left-[2%] w-[280px] h-[280px] rounded-full bg-purple-500/[0.02] blur-[100px] animate-float-slow" />
      </div>

      {/* Pristine Glass Header Navigation */}
      <header className="h-20 border-b border-white/[0.06] flex items-center justify-between px-4 md:px-8 bg-black/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl w-full mx-auto flex justify-between items-center">
          
          <div 
            onClick={() => {
              if (match && match.status !== 'completed') {
                if (window.confirm("Return to main screen? Active match will run securely in the background.")) {
                  setShowHistory(false);
                  setShowSetup(false);
                  setShowSettings(false);
                }
              } else {
                setMatch(null);
                setShowHistory(false);
                setShowSetup(false);
                setShowSettings(false);
              }
            }}
            className="flex items-center gap-3.5 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-lime-400 to-emerald-400 flex items-center justify-center text-zinc-950 shadow-md transition hover:scale-105 active:scale-95 duration-200">
              <Trophy size={18} className="fill-current" />
            </div>
            <div>
              <span className="font-extrabold text-sm md:text-base tracking-tight uppercase block leading-tight">
                Match OS <span className="text-lime-400 font-mono">(MOS)</span>
              </span>
              <span className="text-[9px] text-white/40 font-mono tracking-widest uppercase block mt-0.5">
                Made by Areed Hassan
              </span>
            </div>
          </div>

          {/* Navigation Action Buttons */}
          <div className="flex items-center gap-2.5 text-xs">
            {/* Scorer active state indicators */}
            {match && match.status !== 'completed' && (
              <span className="hidden sm:inline-block text-lime-400 bg-lime-400/5 px-3 py-1.5 rounded-full border border-lime-400/20 font-bold font-mono uppercase tracking-wider text-[10px]">
                🏏 {match.status === 'first_innings' ? '1st Innings' : '2nd Innings'}
              </span>
            )}

            {/* History Book Ledger Navigation */}
            <button
              onClick={() => {
                setShowHistory(!showHistory);
              }}
              className={`flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] transition-all select-none border cursor-pointer ${
                showHistory 
                  ? 'bg-lime-400 text-zinc-950 border-lime-400 shadow-md' 
                  : 'text-zinc-200 hover:text-white bg-white/5 border-white/5 hover:bg-white/10'
              }`}
            >
              <BookOpen size={13} />
              <span>Scorebook Arc</span>
            </button>

            {/* Discard active Match */}
            {match && match.status !== 'completed' && (
              <button
                onClick={handleResetMatch}
                className="text-white/40 hover:text-red-400 p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 transition-all select-none cursor-pointer"
                title="Discard Match"
                id="btn-discard-active"
              >
                <RotateCcw size={14} />
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Core Dynamic Screen Routing */}
      <main className="flex-1 flex flex-col relative py-6 z-10 w-full max-w-7xl mx-auto">
        {showHistory ? (
          <MatchHistory 
            currentCompletedMatch={match?.status === 'completed' ? match : undefined} 
            onNewMatch={() => {
              setMatch(null);
              setShowHistory(false);
              setShowSetup(true); // Initiate a brand new setup
            }} 
          />
        ) : showSettings ? (
          // --- CUSTOM SETTINGS PREFERENCES SCREEN ---
          <div className="w-full max-w-xl mx-auto px-4 py-8 space-y-6" id="settings-viewport">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-panel p-6 md:p-8 rounded-3xl space-y-6 relative overflow-hidden shadow-2xl"
            >
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Settings size={18} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white uppercase tracking-tight">System Settings</h2>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Personalize MOS scoring behavior</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Voice Commentary switch */}
                <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <h3 className="text-xs font-bold text-white font-mono uppercase">AI Voice Commentary</h3>
                    <p className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Synthesize speech audio for runs & wickets</p>
                  </div>
                  <button
                    onClick={() => setGlobalVoiceCommentary(!globalVoiceCommentary)}
                    className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      globalVoiceCommentary ? 'bg-lime-400' : 'bg-zinc-800'
                    }`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-zinc-950 transition-transform duration-200 ${
                      globalVoiceCommentary ? 'translate-x-5.5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Haptic feedback switch */}
                <div className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div>
                    <h3 className="text-xs font-bold text-white font-mono uppercase">Touch Click Vibration</h3>
                    <p className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Haptic vibration response on tap events</p>
                  </div>
                  <button
                    onClick={() => setGlobalVibrationFeedback(!globalVibrationFeedback)}
                    className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                      globalVibrationFeedback ? 'bg-lime-400' : 'bg-zinc-800'
                    }`}
                  >
                    <div className={`w-4.5 h-4.5 rounded-full bg-zinc-950 transition-transform duration-200 ${
                      globalVibrationFeedback ? 'translate-x-5.5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex gap-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full py-3.5 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-extrabold uppercase tracking-widest text-[10px] rounded-xl transition duration-200 shadow-md cursor-pointer"
                >
                  Apply Settings
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          /* Route active screens */
          (() => {
            if (!match) {
              if (showSetup) {
                return (
                  <MatchSetup 
                    onStartMatch={handleStartMatch} 
                    onBackToHome={() => setShowSetup(false)}
                    defaultVoiceCommentary={globalVoiceCommentary}
                    defaultVibrationFeedback={globalVibrationFeedback}
                  />
                );
              }

              // --- PREMIUM GLASSMOPHISM HOME SCREEN ---
              return (
                <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-10" id="mos-home-screen">
                  {/* HERO HEADER */}
                  <div className="text-center space-y-4">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.6, type: 'spring' }}
                      className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-lime-400 to-emerald-400 flex items-center justify-center text-zinc-950 shadow-2xl mx-auto border-2 border-white/20"
                    >
                      <Trophy size={36} className="fill-current text-zinc-950" />
                    </motion.div>
                    
                    <div className="space-y-1.5 animate-fade-in">
                      <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white uppercase font-sans">
                        Match Operating System
                      </h1>
                      <div className="flex justify-center items-center gap-2">
                        <span className="text-lime-400 font-mono font-bold uppercase tracking-widest text-xs bg-lime-400/10 border border-lime-400/20 px-4 py-1.5 rounded-full">
                          MOS Live Scoreboard
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PREMIUM BENTO GRID OPTIONS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    
                    {/* Cardinal Option 1: New Match */}
                    <motion.div
                      onClick={() => setShowSetup(true)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="glass-panel text-white rounded-3xl p-6 shadow-2xl cursor-pointer hover:border-lime-400/40 hover:bg-white/[0.06] transition-all flex flex-col justify-between h-64 relative overflow-hidden group border border-white/5"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-lime-400/5 blur-2xl pointer-events-none group-hover:bg-lime-400/15 transition-all" />
                      <div className="space-y-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center text-lime-400">
                          <Play size={20} className="fill-current text-lime-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black uppercase tracking-tight text-white">New Match</h2>
                          <p className="text-xs text-white/50 mt-1.5 leading-relaxed font-sans">
                            Configure rosters, trigger toss animations, align crease players, and start scoring balls.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-lime-400 uppercase tracking-widest pt-4 relative z-10">
                        <span>Launch Setup</span>
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>

                    {/* Cardinal Option 2: Match History */}
                    <motion.div
                      onClick={() => setShowHistory(true)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="glass-panel text-white rounded-3xl p-6 shadow-2xl cursor-pointer hover:border-emerald-400/40 hover:bg-white/[0.06] transition-all flex flex-col justify-between h-64 relative overflow-hidden group border border-white/5"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-2xl pointer-events-none group-hover:bg-emerald-500/15 transition-all" />
                      <div className="space-y-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400">
                          <BookOpen size={20} className="text-emerald-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black uppercase tracking-tight text-white">Scorebook History</h2>
                          <p className="text-xs text-white/50 mt-1.5 leading-relaxed font-sans">
                            Review final matching scores, generate pristine vector PDF report sheets, and clear historic logs.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-widest pt-4 relative z-10">
                        <span>Browse Records</span>
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>

                    {/* Cardinal Option 3: Settings Panel Bento Box */}
                    <motion.div
                      onClick={() => setShowSettings(true)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="glass-panel text-white rounded-3xl p-6 shadow-2xl cursor-pointer hover:border-purple-400/40 hover:bg-white/[0.06] transition-all flex flex-col justify-between h-64 relative overflow-hidden group col-span-1 md:col-span-2 lg:col-span-1 border border-white/5"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-2xl pointer-events-none group-hover:bg-purple-500/15 transition-all" />
                      <div className="space-y-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-purple-400/10 border border-purple-400/20 flex items-center justify-center text-purple-400">
                          <Settings size={20} className="text-purple-400" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black uppercase tracking-tight text-white">Preferences</h2>
                          <p className="text-xs text-white/50 mt-1.5 leading-relaxed font-sans">
                            Manage touch vibration preferences, vocal speech synthesizers, penalties and gully specifications.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400 uppercase tracking-widest pt-4 relative z-10">
                        <span>Adjust Rules</span>
                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </motion.div>

                  </div>
                </div>
              );
            }

            if (match.status === 'first_innings' || match.status === 'second_innings') {
              return (
                <Scoreboard
                  match={match}
                  onUpdateMatch={handleUpdateMatch}
                  onGoToHistory={() => setShowHistory(true)}
                  onResetMatch={handleResetMatch}
                />
              );
            }

            if (match.status === 'innings_break') {
              const firstInnsBatsmen = match.firstInnings?.batsmen || [];
              const firstInnsBowlers = match.firstInnings?.bowlers || [];

              const topBatsman = [...firstInnsBatsmen]
                .filter(b => b.runsScored > 0 || b.ballsFaced > 0)
                .sort((a, b) => {
                  if (b.runsScored !== a.runsScored) return b.runsScored - a.runsScored;
                  return a.ballsFaced - b.ballsFaced;
                })[0];

              const topBowler = [...firstInnsBowlers]
                .filter(b => b.oversBowled > 0 || b.wickets > 0)
                .sort((a, b) => {
                  if (b.wickets !== a.wickets) return b.wickets - a.wickets;
                  return a.runsConceded - b.runsConceded;
                })[0];

              return (
                <div className="w-full max-w-md mx-auto px-4 py-8" id="mid-innings-break-viewport">
                  <motion.div 
                    initial={{ scale: 0.96, opacity: 0, y: 15 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="glass-panel border border-white/10 rounded-3xl overflow-hidden p-6 text-center space-y-6 shadow-2xl relative"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-lime-400/5 blur-2xl pointer-events-none" />

                    <div className="bg-lime-400/10 border border-lime-400/20 rounded-full h-16 w-16 flex items-center justify-center mx-auto text-lime-400">
                      <Sparkles className="w-6 h-6 animate-pulse" />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-lime-400 uppercase tracking-widest font-mono">Mid Match Ledger Announcement</span>
                      <h2 className="text-xl font-extrabold uppercase tracking-tight text-white leading-tight">First Innings Locked!</h2>
                    </div>

                    <div className="bg-black/40 border border-white/5 rounded-2xl p-5 space-y-2">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">1st Innings scoreboard</div>
                      <div className="text-3xl font-black text-white font-mono">{firstInnsRuns} <span className="text-sm text-white/30 font-normal">Runs /</span> {firstInnsWickets} <span className="text-sm text-white/30 font-normal">Wkts</span></div>
                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        Matched played at: {match.settings.oversPerMatch} overs
                      </div>
                    </div>

                    {/* Top Performers Block */}
                    <div className="space-y-3.5 text-left">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono text-center mb-1">Top First Innings Performers</div>
                      <div className="grid grid-cols-2 gap-3">
                        {topBatsman ? (
                          <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1.5 backdrop-blur-sm">
                            <span className="text-[9px] font-mono text-lime-400 font-bold uppercase tracking-widest block">Top Batsman</span>
                            <span className="font-extrabold text-[#fafafa] text-xs block uppercase truncate">{topBatsman.name}</span>
                            <span className="font-mono text-[10px] text-white/50 block">
                              {topBatsman.runsScored} runs in {topBatsman.ballsFaced} balls (fours: {topBatsman.fours}, sixes: {topBatsman.sixes})
                            </span>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl text-center flex items-center justify-center text-[10px] text-white/30 font-mono">
                            No batting stats
                          </div>
                        )}

                        {topBowler ? (
                          <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-1.5 backdrop-blur-sm">
                            <span className="text-[9px] font-mono text-lime-400 font-bold uppercase tracking-widest block">Top Bowler</span>
                            <span className="font-extrabold text-[#fafafa] text-xs block uppercase truncate">{topBowler.name}</span>
                            <span className="font-mono text-[10px] text-white/50 block">
                              {topBowler.wickets} Wkts / {topBowler.runsConceded} runs ({topBowler.oversBowled} overs)
                            </span>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl text-center flex items-center justify-center text-[10px] text-white/30 font-mono">
                            No bowling stats
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-lime-400/5 rounded-2xl p-5 border border-lime-400/10 space-y-1">
                      <div className="text-[9px] font-bold text-lime-400 uppercase tracking-widest font-mono">Target of chase</div>
                      <div className="text-2xl font-black text-white font-mono">{firstInnsRuns + 1} Runs</div>
                      <p className="text-[10px] text-lime-400 font-medium font-mono uppercase tracking-wider mt-1">To take the ultimate victory! 🏆</p>
                    </div>

                    <p className="text-xs text-zinc-400 px-4 leading-relaxed font-sans">
                      Align your batsmen lineups, brief your opening bowlers, and click target trigger to commence!
                    </p>

                    <div className="pt-2">
                      <button
                        onClick={handleStartSecondInnings}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-extrabold uppercase tracking-wider text-xs rounded-xl transition duration-300 shadow-lg shadow-lime-400/15 active:scale-99 cursor-pointer"
                        id="btn-trigger-chase"
                      >
                        COMMENCE CHASE INNINGS
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                </div>
              );
            }

            if (match.status === 'completed') {
              return (
                <MatchHistory 
                  currentCompletedMatch={match} 
                  onNewMatch={() => {
                    setMatch(null);
                    setShowHistory(false);
                    setShowSetup(true); // Open setup directly for another match
                  }} 
                />
              );
            }

            return null;
          })()
        )}
      </main>

      {/* Sleek human Footer */}
      <footer className="h-14 border-t border-white/[0.05] flex items-center justify-center bg-black/40 px-4 text-center text-[9px] text-white/30 font-mono uppercase tracking-widest z-10 w-full mt-auto">
        <span>Match Operating System (MOS) • Made by Areed Hassan</span>
      </footer>
    </div>
  );
}
