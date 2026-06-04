import React, { useState, useEffect } from 'react';
import { MatchSettings, Team } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Users, 
  Settings2, 
  Coins, 
  UserCheck, 
  ArrowRight,
  Trophy,
  ChevronLeft,
  Check,
  Award
} from 'lucide-react';

interface MatchSetupProps {
  onStartMatch: (
    teamA: Team,
    teamB: Team,
    settings: MatchSettings,
    tossWinnerId: string,
    tossDecision: 'bat' | 'bowl'
  ) => void;
  onBackToHome?: () => void;
  defaultVoiceCommentary?: boolean;
  defaultVibrationFeedback?: boolean;
}

type WizardStep = 'team_init' | 'players_names' | 'uneven_check' | 'toss';

export default function MatchSetup({ 
  onStartMatch, 
  onBackToHome,
  defaultVoiceCommentary = true,
  defaultVibrationFeedback = true
}: MatchSetupProps) {
  
  // Setup steps
  const [wizardStep, setWizardStep] = useState<WizardStep>('team_init');

  // Input states
  const [teamAName, setTeamAName] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [teamASize, setTeamASize] = useState(5);
  const [teamBSize, setTeamBSize] = useState(5);
  const [oversCount, setOversCount] = useState(4);

  // Player names lists (Size 11, initially empty strings)
  const [teamAPlayers, setTeamAPlayers] = useState<string[]>(Array(11).fill(''));
  const [teamBPlayers, setTeamBPlayers] = useState<string[]>(Array(11).fill(''));

  // Validation feedback
  const [validationError, setValidationError] = useState<string | null>(null);

  // Uneven Teams states
  const [unevenChoice, setUnevenChoice] = useState<'auto' | 'manual' | 'leave_it' | null>(null);
  const [mutualPlayerName, setMutualPlayerName] = useState<string | null>(null);

  // Settings values (Synced from App.tsx default props)
  const [voiceCommentary] = useState(defaultVoiceCommentary);
  const [vibrationFeedback] = useState(defaultVibrationFeedback);

  // 3D Coin Toss simulation state
  const [isFlipping, setIsFlipping] = useState(false);
  const [tossResult, setTossResult] = useState<'Heads' | 'Tails' | null>(null);
  const [callingTeamId, setCallingTeamId] = useState<'team_a' | 'team_b'>('team_a');
  const [selectedCall, setSelectedCall] = useState<'Heads' | 'Tails'>('Heads');
  const [tossWinnerTeamId, setTossWinnerTeamId] = useState<'team_a' | 'team_b' | null>(null);
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | null>(null);

  // Safe names population on mount or change of default sizing values
  useEffect(() => {
    // Player names are left completely blank per user request
  }, [teamAName, teamBName]);

  const handlePlayerNameChange = (team: 'A' | 'B', index: number, val: string) => {
    if (team === 'A') {
      const copy = [...teamAPlayers];
      copy[index] = val;
      setTeamAPlayers(copy);
    } else {
      const copy = [...teamBPlayers];
      copy[index] = val;
      setTeamBPlayers(copy);
    }
  };

  const handleGoToPlayers = () => {
    if (!teamAName.trim() || !teamBName.trim()) {
      setValidationError("Please enter names for both teams to proceed!");
      return;
    }
    setValidationError(null);
    setWizardStep('players_names');
  };

  const handleGoToUnevenOrToss = () => {
    // 1. Validate that all names are non-empty
    for (let i = 0; i < teamASize; i++) {
      if (!teamAPlayers[i] || !teamAPlayers[i].trim()) {
        setValidationError(`Please fill out a valid name for ${teamAName} — Player ${i + 1}`);
        return;
      }
    }
    for (let i = 0; i < teamBSize; i++) {
      if (!teamBPlayers[i] || !teamBPlayers[i].trim()) {
        setValidationError(`Please fill out a valid name for ${teamBName} — Player ${i + 1}`);
        return;
      }
    }

    setValidationError(null);

    // 2. Clear any old selected mutual player structure
    setUnevenChoice(null);
    setMutualPlayerName(null);

    // 3. Test for Asymmetry
    if (teamASize !== teamBSize) {
      setWizardStep('uneven_check');
    } else {
      // Setup the coin toss calling team randomly
      setCallingTeamId(Math.random() < 0.5 ? 'team_a' : 'team_b');
      setWizardStep('toss');
    }
  };

  // Uneven assignation triggers
  const executeAutoAssign = () => {
    const isALarger = teamASize > teamBSize;
    const largerTeamList = isALarger 
      ? teamAPlayers.slice(0, teamASize) 
      : teamBPlayers.slice(0, teamBSize);
    
    const chosenOne = largerTeamList[Math.floor(Math.random() * largerTeamList.length)];
    setMutualPlayerName(chosenOne);
    setUnevenChoice('auto');
  };

  const executeManualAssign = (name: string) => {
    setMutualPlayerName(name);
    setUnevenChoice('manual');
  };

  const executeLeaveIt = () => {
    setMutualPlayerName(null);
    setUnevenChoice('leave_it');
  };

  // 3D Coin Flip Mechanics
  const handleFlipCoin = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setTossResult(null);
    setTossWinnerTeamId(null);
    setTossDecision(null);

    if (vibrationFeedback && 'vibrate' in navigator) {
      navigator.vibrate([80, 80, 80, 80]);
    }

    setTimeout(() => {
      const outcome = Math.random() < 0.5 ? 'Heads' : 'Tails';
      setTossResult(outcome);
      setIsFlipping(false);

      const predictedCorrectly = outcome === selectedCall;
      const winner = predictedCorrectly ? callingTeamId : (callingTeamId === 'team_a' ? 'team_b' : 'team_a');
      setTossWinnerTeamId(winner);

      if (vibrationFeedback && 'vibrate' in navigator) {
        navigator.vibrate([250]);
      }
    }, 1800);
  };

  const handleStartSubmit = (decision: 'bat' | 'bowl') => {
    if (!tossWinnerTeamId) return;

    // Filter player lists for active fields only
    const finalA = teamAPlayers.slice(0, teamASize).map(p => p.trim());
    const finalB = teamBPlayers.slice(0, teamBSize).map(p => p.trim());

    // Inject common/mutual player correctly to make counts balance
    const isUneven = teamASize !== teamBSize;
    if (isUneven && mutualPlayerName) {
      const inA = finalA.includes(mutualPlayerName);
      const inB = finalB.includes(mutualPlayerName);

      if (inA && !inB) {
        finalB.push(mutualPlayerName);
      } else if (inB && !inA) {
        finalA.push(mutualPlayerName);
      }
    }

    const teamA: Team = {
      id: 'team_a',
      name: teamAName.trim() || 'Team A',
      players: finalA,
    };

    const teamB: Team = {
      id: 'team_b',
      name: teamBName.trim() || 'Team B',
      players: finalB,
    };

    const settings: MatchSettings = {
      oversPerMatch: oversCount,
      ballsPerOver: 6, // Hardcoded standard gully match over structure
      playersPerTeam: Math.max(teamASize, teamBSize),
      widePenalty: 1, // Standard Cricket Defaults
      noBallPenalty: 1,
      freeHitOnNoBall: true,
      onePitchCatchOut: false, // Standard, no weird street rules
      hitOutOfBoundaryOut: false,
      lastManStanding: true,
      vibrationFeedback,
      voiceCommentary,
      isUneven,
      unevenMode: unevenChoice || undefined,
      commonPlayerName: mutualPlayerName || undefined,
      mutualPlayerName: mutualPlayerName || undefined,
      teamAForcedSize: teamASize,
      teamBForcedSize: teamBSize
    };

    onStartMatch(teamA, teamB, settings, tossWinnerTeamId, decision);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-2" id="match-setup-holder">
      <AnimatePresence mode="wait">
        
        {/* STEP 1: INITIAL TEAM CONFIGURATION */}
        {wizardStep === 'team_init' && (
          <motion.div
            key="team_init_step"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="glass-panel rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-2xl border border-white/5"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-lime-400/5 blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/5">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-lime-400" />
                  Configure Match Settings
                </h1>
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono">Step 1 of 4: Sizing & Overs</p>
              </div>
              {onBackToHome && (
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/5 transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={13} />
                  Home Screen
                </button>
              )}
            </div>

            {validationError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-400 text-xs font-bold font-mono">
                🛑 ERROR: {validationError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
              {/* Team A Glass Pane panel */}
              <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] space-y-4 relative">
                <span className="absolute top-4 right-4 text-[10px] font-bold font-mono text-lime-400/30 uppercase tracking-widest">TEAM A CONFIG</span>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/40 tracking-wider font-mono mb-2">Team A Name</label>
                  <input
                    type="text"
                    maxLength={18}
                    value={teamAName}
                    onChange={(e) => setTeamAName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-white/5 bg-black/40 focus:border-lime-400/60 focus:outline-none text-white font-semibold transition"
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/40 tracking-wider font-mono mb-2">Number of Players ({teamASize})</label>
                  <input
                    type="range"
                    min={1}
                    max={11}
                    value={teamASize}
                    onChange={(e) => setTeamASize(Number(e.target.value))}
                    className="w-full accent-lime-400"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 font-mono mt-1">
                    <span>1 Player</span>
                    <span className="font-bold text-lime-400">{teamASize === 1 ? 'Solo Rule Active' : `${teamASize} Players`}</span>
                    <span>11 Players</span>
                  </div>
                </div>
              </div>

              {/* Team B Glass Pane panel */}
              <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] space-y-4 relative">
                <span className="absolute top-4 right-4 text-[10px] font-bold font-mono text-lime-400/30 uppercase tracking-widest">TEAM B CONFIG</span>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/40 tracking-wider font-mono mb-2">Team B Name</label>
                  <input
                    type="text"
                    maxLength={18}
                    value={teamBName}
                    onChange={(e) => setTeamBName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-white/5 bg-black/40 focus:border-lime-400/60 focus:outline-none text-white font-semibold transition"
                    placeholder=""
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/40 tracking-wider font-mono mb-2">Number of Players ({teamBSize})</label>
                  <input
                    type="range"
                    min={1}
                    max={11}
                    value={teamBSize}
                    onChange={(e) => setTeamBSize(Number(e.target.value))}
                    className="w-full accent-lime-400"
                  />
                  <div className="flex justify-between text-[10px] text-white/40 font-mono mt-1">
                    <span>1 Player</span>
                    <span className="font-bold text-lime-400">{teamBSize === 1 ? 'Solo Rule Active' : `${teamBSize} Players`}</span>
                    <span>11 Players</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Overs constraints block */}
            <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.01] space-y-3 relative">
              <label className="block text-[10px] uppercase font-bold text-white/40 tracking-wider font-mono">Innings Length (Overs)</label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setOversCount(Math.max(1, oversCount - 1))}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition flex items-center justify-center font-black text-white cursor-pointer"
                >
                  -
                </button>
                <div className="flex-1 text-center bg-black/40 border border-white/5 rounded-xl py-3 text-lg font-black font-mono">
                  {oversCount} {oversCount === 1 ? 'OVER' : 'OVERS'}
                </div>
                <button
                  type="button"
                  onClick={() => setOversCount(oversCount + 1)}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-95 transition flex items-center justify-center font-black text-white cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleGoToPlayers}
                className="px-8 py-4 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-black tracking-widest text-xs uppercase rounded-xl transition duration-300 shadow-md flex items-center gap-2 cursor-pointer"
              >
                Enter Player Names
                <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2: DEDICATED PLAYER NAMES ENTRY SCREEN */}
        {wizardStep === 'players_names' && (
          <motion.div
            key="players_names_step"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="glass-panel rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-2xl border border-white/5"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-lime-400/5 blur-3xl pointer-events-none" />

            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Users className="w-5 h-5 text-lime-400" />
                  Type Player Names
                </h1>
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono">Step 2 of 4: Manual Roster Entry</p>
              </div>
              <button
                type="button"
                onClick={() => setWizardStep('team_init')}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/5 transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={13} />
                Back
              </button>
            </div>

            {validationError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-400 text-xs font-bold font-mono">
                🛑 ERROR: {validationError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[420px] overflow-y-auto pr-2">
              
              {/* Team A Fields List */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-lime-400 font-mono uppercase tracking-wider border-b border-white/5 pb-1.5">{teamAName} Active Sizing ({teamASize})</h3>
                <div className="space-y-3">
                  {Array.from({ length: teamASize }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <label className="block text-[9px] font-bold text-white/50 uppercase tracking-widest font-mono">
                        {teamAName} — Player {i + 1}
                      </label>
                      <input
                        type="text"
                        maxLength={14}
                        value={teamAPlayers[i] ?? ''}
                        onChange={(e) => handlePlayerNameChange('A', i, e.target.value)}
                        placeholder=""
                        className="w-full text-xs px-3.5 py-3 rounded-xl border border-white/5 bg-black/40 text-white focus:outline-none focus:border-lime-400/40 font-semibold"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Team B Fields List */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-lime-400 font-mono uppercase tracking-wider border-b border-white/5 pb-1.5">{teamBName} Active Sizing ({teamBSize})</h3>
                <div className="space-y-3">
                  {Array.from({ length: teamBSize }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <label className="block text-[9px] font-bold text-white/50 uppercase tracking-widest font-mono">
                        {teamBName} — Player {i + 1}
                      </label>
                      <input
                        type="text"
                        maxLength={14}
                        value={teamBPlayers[i] ?? ''}
                        onChange={(e) => handlePlayerNameChange('B', i, e.target.value)}
                        placeholder=""
                        className="w-full text-xs px-3.5 py-3 rounded-xl border border-white/5 bg-black/40 text-white focus:outline-none focus:border-lime-400/40 font-semibold"
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleGoToUnevenOrToss}
                className="px-8 py-4 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-black tracking-widest text-xs uppercase rounded-xl transition duration-300 shadow-md flex items-center gap-2 cursor-pointer"
              >
                Continue Setup
                <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: UNEVEN TEAMS DETECTION SCREEN */}
        {wizardStep === 'uneven_check' && (
          <motion.div
            key="uneven_check_step"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="glass-panel rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-2xl border border-white/5"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-lime-400/5 blur-3xl pointer-events-none" />

            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-lime-400 animate-pulse" />
                  Uneven Teams Detected!
                </h1>
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono">Step 3 of 4: Unequal Sides Handling</p>
              </div>
              <button
                type="button"
                onClick={() => setWizardStep('players_names')}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/5 transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={13} />
                Back
              </button>
            </div>

            <p className="text-xs text-white/60 font-medium font-sans leading-relaxed">
              Teams are unequal: <span className="font-bold text-white">{teamAName}</span> has {teamASize} players, while <span className="font-bold text-white">{teamBName}</span> has {teamBSize} players. Select how you would like to handle this discrepancy.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
              {/* Option A: Auto-assign */}
              <button
                type="button"
                onClick={executeAutoAssign}
                className={`text-left p-5 rounded-2xl border text-white transition duration-200 select-none cursor-pointer flex flex-col justify-between h-44 ${
                  unevenChoice === 'auto'
                    ? 'border-lime-400 bg-lime-400/5'
                    : 'border-white/5 bg-black/40 hover:bg-white/[0.02]'
                }`}
              >
                <div>
                  <span className="text-[10px] font-mono text-lime-400 font-bold uppercase tracking-widest mb-1.5 block">Option 1</span>
                  <h3 className="text-sm font-extrabold uppercase tracking-tight text-white">Auto-Assign</h3>
                  <p className="text-[10px] text-white/55 mt-1 font-sans leading-relaxed">
                    Let the system randomly select one player from the larger team to play for both squads.
                  </p>
                </div>
                {unevenChoice === 'auto' && <span className="text-[10px] font-mono text-lime-400 font-bold uppercase tracking-widest flex items-center gap-1">Selected <Check size={12}/></span>}
              </button>

              {/* Option B: Manual assign */}
              <button
                type="button"
                onClick={() => {
                  setUnevenChoice('manual');
                  setMutualPlayerName(null);
                }}
                className={`text-left p-5 rounded-2xl border text-white transition duration-200 select-none cursor-pointer flex flex-col justify-between h-44 ${
                  unevenChoice === 'manual'
                    ? 'border-lime-400 bg-lime-400/5'
                    : 'border-white/5 bg-black/40 hover:bg-white/[0.02]'
                }`}
              >
                <div>
                  <span className="text-[10px] font-mono text-lime-400 font-bold uppercase tracking-widest mb-1.5 block">Option 2</span>
                  <h3 className="text-sm font-extrabold uppercase tracking-tight text-white">Manual Assign</h3>
                  <p className="text-[10px] text-white/55 mt-1 font-sans leading-relaxed">
                    Manually select a player from the larger team's roster to serve as the mutual companion.
                  </p>
                </div>
                {unevenChoice === 'manual' && <span className="text-[10px] font-mono text-lime-400 font-bold uppercase tracking-widest flex items-center gap-1">Choosing...</span>}
              </button>

              {/* Option C: Leave it */}
              <button
                type="button"
                onClick={executeLeaveIt}
                className={`text-left p-5 rounded-2xl border text-white transition duration-200 select-none cursor-pointer flex flex-col justify-between h-44 ${
                  unevenChoice === 'leave_it'
                    ? 'border-lime-400 bg-lime-400/5'
                    : 'border-white/5 bg-black/40 hover:bg-white/[0.02]'
                }`}
              >
                <div>
                  <span className="text-[10px] font-mono text-lime-400 font-bold uppercase tracking-widest mb-1.5 block">Option 3</span>
                  <h3 className="text-sm font-extrabold uppercase tracking-tight text-white">Leave It</h3>
                  <p className="text-[10px] text-white/55 mt-1 font-sans leading-relaxed">
                    Keep side counts unequal. Play the match without assigning any common mutual characters.
                  </p>
                </div>
                {unevenChoice === 'leave_it' && <span className="text-[10px] font-mono text-lime-400 font-bold uppercase tracking-widest flex items-center gap-1">Selected <Check size={12}/></span>}
              </button>
            </div>

            {/* Manual assign details toggle */}
            {unevenChoice === 'manual' && (
              <div className="p-5 rounded-2xl border border-white/5 bg-black/50 space-y-4">
                <span className="text-[10px] font-bold font-mono text-lime-400 uppercase tracking-widest">
                  Select Player from larger team ({teamASize > teamBSize ? teamAName : teamBName}):
                </span>
                
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                  {(teamASize > teamBSize ? teamAPlayers.slice(0, teamASize) : teamBPlayers.slice(0, teamBSize)).map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => executeManualAssign(p)}
                      className={`w-full py-2.5 px-4 rounded-xl border text-xs text-left font-bold uppercase tracking-wider transition ${
                        mutualPlayerName === p
                          ? 'border-lime-400 bg-lime-400/10 text-white'
                          : 'border-white/5 bg-zinc-950 text-white/60 hover:bg-white/[0.02]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Display message block once decided */}
            {unevenChoice && (
              <div className="p-4 bg-lime-400/10 border border-lime-400/15 rounded-2xl text-center">
                <p className="text-white text-xs font-bold font-sans uppercase">
                  {unevenChoice === 'leave_it' 
                    ? "Proceeding with unequalled sides. No Mutual Player Assigned."
                    : `👑 ${mutualPlayerName} will play for both teams as the Mutual Player!`
                  }
                </p>
                {unevenChoice !== 'leave_it' && (
                  <p className="text-[10px] text-lime-400 font-mono uppercase tracking-widest mt-1">
                    Labelled in game rosters, batters selected and scoreboards!
                  </p>
                )}
              </div>
            )}

            {validationError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-xs font-bold font-mono text-center">
                🛑 ERROR: {validationError}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!unevenChoice) {
                    setValidationError("Please select one of the three options before continuing!");
                    return;
                  }
                  setValidationError(null);
                  setCallingTeamId(Math.random() < 0.5 ? 'team_a' : 'team_b');
                  setWizardStep('toss');
                }}
                className={`px-8 py-4 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-black tracking-widest text-xs uppercase rounded-xl transition duration-300 shadow-md flex items-center gap-2 cursor-pointer ${
                  !unevenChoice ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                Proceed to Coin Toss
                <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 4: PHYSICAL COIN TOSS FLIP SCREEN */}
        {wizardStep === 'toss' && (
          <motion.div
            key="toss_step"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="glass-panel rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden shadow-2xl border border-white/5"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-lime-400/5 blur-3xl pointer-events-none" />

            <div className="flex justify-between items-center pb-4 border-b border-white/5">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Coins className="w-5 h-5 text-lime-400 animate-bounce" />
                  Perform Coin Toss
                </h1>
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-mono">Step 4 of 4: Golden Coin Flip</p>
              </div>
              <button
                type="button"
                onClick={() => setWizardStep(teamASize !== teamBSize ? 'uneven_check' : 'players_names')}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-semibold border border-white/5 transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft size={13} />
                Back
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              
              {/* Coin flip visual panel */}
              <div className="md:col-span-5 flex flex-col items-center justify-center py-4 border-b md:border-b-0 md:border-r border-white/5 space-y-6">
                
                {/* 3D coin rendering component */}
                <div className="relative w-36 h-36 flex items-center justify-center perspektiv select-none">
                  <motion.div
                    animate={
                      isFlipping
                        ? { 
                            rotateY: [0, 1800, 3600],
                            rotateX: [0, 720, 1440],
                            y: [0, -220, 0],
                            scale: [1, 1.4, 1],
                            transition: { duration: 1.8, ease: 'easeInOut' }
                          }
                        : {}
                    }
                    className="w-28 h-28 cursor-pointer style-3d relative flex items-center justify-center font-black"
                    onClick={handleFlipCoin}
                  >
                    {/* Front Face: HEADS */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-200 to-amber-600 border-[3.5px] border-amber-300 shadow-2xl flex flex-col items-center justify-center font-black backface-hidden">
                      <div className="absolute inset-[3px] rounded-full border border-yellow-300/40 bg-gradient-to-br from-white/35 to-black/20" />
                      <span className="text-zinc-950 font-black text-sm tracking-widest z-10 font-mono">HEADS</span>
                      <Trophy size={16} className="text-zinc-950 fill-amber-500/20 z-10 mt-1" />
                    </div>

                    {/* Back Face: TAILS */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-300 to-amber-700 border-[3.5px] border-amber-300 shadow-2xl flex flex-col items-center justify-center font-black rotate-y-180 backface-hidden">
                      <div className="absolute inset-[3px] rounded-full border border-yellow-300/35 bg-gradient-to-br from-white/20 to-black/35" />
                      <span className="text-zinc-950 font-black text-sm tracking-widest z-10 font-mono">TAILS</span>
                      <Trophy size={16} className="text-zinc-950 fill-amber-700/20 z-10 mt-1" />
                    </div>
                  </motion.div>
                </div>

                <button
                  type="button"
                  onClick={handleFlipCoin}
                  disabled={isFlipping}
                  className="px-6 py-3 bg-white/5 border border-white/5 hover:border-lime-400/30 font-bold text-xs uppercase tracking-wider text-lime-400 rounded-full cursor-pointer disabled:opacity-40 animate-pulse"
                >
                  {isFlipping ? 'Spinning Gold...' : 'FLIP GOLD COIN'}
                </button>
              </div>

              {/* Toss result and decisions column */}
              <div className="md:col-span-7 space-y-6">
                
                <div className="bg-white/[0.01] border border-white/5 p-4 rounded-2xl">
                  <h3 className="text-xs font-bold text-lime-400 uppercase tracking-widest font-mono">Toss Caller Assigned</h3>
                  <p className="text-white text-sm font-extrabold uppercase mt-1">
                    👑 {callingTeamId === 'team_a' ? teamAName : teamBName}, call the toss!
                  </p>
                </div>

                {!tossWinnerTeamId && !isFlipping && (
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase font-bold text-white/55 tracking-widest font-mono">Choose Predicted Face</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setSelectedCall('Heads')}
                        className={`py-3.5 rounded-xl border font-black text-xs uppercase text-zinc-200 tracking-wider transition ${
                          selectedCall === 'Heads'
                            ? 'border-amber-400 bg-amber-400/5 text-amber-400 shadow'
                            : 'border-white/5 bg-black/40 hover:bg-white/[0.01]'
                        }`}
                      >
                        Heads
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCall('Tails')}
                        className={`py-3.5 rounded-xl border font-black text-xs uppercase text-zinc-200 tracking-wider transition ${
                          selectedCall === 'Tails'
                            ? 'border-amber-400 bg-amber-400/5 text-amber-400 shadow'
                            : 'border-white/5 bg-black/40 hover:bg-white/[0.01]'
                        }`}
                      >
                        Tails
                      </button>
                    </div>
                  </div>
                )}

                {/* Loading during spinning state */}
                {isFlipping && (
                  <div className="p-10 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-mono text-white/40 uppercase tracking-widest leading-none">Simulating Physical Weight Flipping...</p>
                  </div>
                )}

                {/* Revelations of Winner results */}
                {tossWinnerTeamId && !isFlipping && (
                  <div className="space-y-4 animate-fade-in text-xs">
                    <div className="p-4 rounded-xl bg-amber-400/10 border border-amber-400/15 space-y-2">
                      <p className="text-white font-extrabold uppercase leading-tight">
                        Toss Result: Coin landed on <span className="text-amber-400 font-black">{tossResult}</span>!
                      </p>
                      <p className="text-white/60 font-medium">
                        {callingTeamId === 'team_a' ? teamAName : teamBName} called <span className="font-bold text-white">{selectedCall}</span>. 
                        {tossWinnerTeamId === callingTeamId 
                          ? " Correct prediction! They win."
                          : " Incorrect prediction. Opponent wins."
                        }
                      </p>
                      <p className="text-lime-400 font-extrabold uppercase text-xs tracking-wider">
                        ⭐ {tossWinnerTeamId === 'team_a' ? teamAName : teamBName} won the toss!
                      </p>
                    </div>

                    {!tossDecision && (
                      <div className="space-y-3">
                        <label className="block text-[10px] uppercase font-bold text-white/55 tracking-widest font-mono">Toss Winner decision</label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => setTossDecision('bat')}
                            className="py-3.5 px-3 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-black uppercase tracking-wider text-[11px] rounded-xl transition cursor-pointer border border-lime-400/20"
                          >
                            BAT First 🏏
                          </button>
                          <button
                            type="button"
                            onClick={() => setTossDecision('bowl')}
                            className="py-3.5 px-3 bg-white/5 hover:bg-white/10 active:bg-white/15 text-white border border-white/5 font-black uppercase tracking-wider text-[11px] rounded-xl transition"
                          >
                            BOWL First 🥎
                          </button>
                        </div>
                      </div>
                    )}

                    {tossDecision && (
                      <div className="space-y-4 pt-2">
                        <div className="p-4 bg-lime-400/5 rounded-2xl border border-lime-400/10 text-center font-black uppercase tracking-wider text-xs">
                          📢 "{tossWinnerTeamId === 'team_a' ? teamAName : teamBName} won the toss and chose to {tossDecision} first"
                        </div>

                        <button
                          type="button"
                          onClick={() => handleStartSubmit(tossDecision)}
                          className="w-full py-4 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-black tracking-widest text-xs uppercase rounded-xl transition duration-300 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          COMMENCE STREET BATTLE MATCH
                          <Play size={14} className="fill-current text-zinc-950" />
                        </button>
                      </div>
                    )}

                  </div>
                )}

              </div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
