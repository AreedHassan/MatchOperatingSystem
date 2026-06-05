import React, { useState, useEffect } from 'react';
import { Match, MatchHistoryItem, Player, Team, Inning } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { 
  Trophy, 
  Calendar, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Award,
  Download,
  AlertTriangle,
  Play,
  Heart,
  TrendingUp,
  Sliders,
  Flame,
  Zap,
  Star
} from 'lucide-react';

interface MatchHistoryProps {
  currentCompletedMatch?: Match;
  onNewMatch: () => void;
  onSelectSavedMatch?: (mId: string) => void;
}

export default function MatchHistory({ currentCompletedMatch, onNewMatch }: MatchHistoryProps) {
  const [pastMatches, setPastMatches] = useState<MatchHistoryItem[]>([]);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [showPdfSuccessModal, setShowPdfSuccessModal] = useState(false);
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState<Blob | null>(null);
  const [pdfFileName, setPdfFileName] = useState('');

  // Load from localstorage on mount
  useEffect(() => {
    const list = localStorage.getItem('gully_cricket_history');
    if (list) {
      try {
        setPastMatches(JSON.parse(list));
      } catch (e) {
        console.error("Failed parsing scorecard history:", e);
      }
    }
  }, []);

  // Save current completed match to history safely under unique ID
  useEffect(() => {
    if (currentCompletedMatch) {
      const listStr = localStorage.getItem('gully_cricket_history');
      let currentList: MatchHistoryItem[] = [];
      if (listStr) {
        try {
          currentList = JSON.parse(listStr);
        } catch {
          currentList = [];
        }
      }

      // Check if already in history list to prevent duplicates
      if (!currentList.some(item => item.id === currentCompletedMatch.id)) {
        const firstScore = `${currentCompletedMatch.firstInnings.runs}/${currentCompletedMatch.firstInnings.wickets}`;
        const secondScore = currentCompletedMatch.secondInnings 
          ? `${currentCompletedMatch.secondInnings.runs}/${currentCompletedMatch.secondInnings.wickets}`
          : "DNB";

        const winnerName = currentCompletedMatch.winnerTeamId === 'tie'
          ? 'Match Tied'
          : currentCompletedMatch.winnerTeamId === 'team_a'
            ? currentCompletedMatch.teamA.name
            : currentCompletedMatch.teamB.name;

        // Automatically crown Man of the Match to log
        const momDetails = getManOfTheMatch(currentCompletedMatch);

        const newItem: MatchHistoryItem = {
          id: currentCompletedMatch.id,
          date: currentCompletedMatch.date,
          teamAName: currentCompletedMatch.teamA.name,
          teamBName: currentCompletedMatch.teamB.name,
          teamAScore: firstScore,
          teamBScore: secondScore,
          resultText: currentCompletedMatch.winnerTeamId === 'tie' 
            ? 'Match ended in a Tie!' 
            : `${winnerName} won ${currentCompletedMatch.winMarginText}`,
          momName: momDetails?.player.name || "None"
        };

        const updated = [newItem, ...currentList];
        localStorage.setItem('gully_cricket_history', JSON.stringify(updated));
        setPastMatches(updated);
      }
    }
  }, [currentCompletedMatch]);

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to delete all entries from the MOS Match History Book? This is irreversible!")) {
      localStorage.removeItem('gully_cricket_history');
      setPastMatches([]);
    }
  };

  // Man of the Match (MOM) calculation engine
  const getManOfTheMatch = (m: Match) => {
    const playersMap = new Map<string, { player: Player; team: Team; points: number }>();

    const calculatePointsForInning = (inn: Inning, batTeam: Team, bowlTeam: Team) => {
      // 1. Process Batters
      inn.batsmen.forEach(b => {
        // Points: 1 point per run, 4 points per boundary 4, 8 points per sixer 6,
        // and a milestone bonus for crossings!
        let pts = b.runsScored * 1.25;
        pts += b.fours * 2;
        pts += b.sixes * 4;
        if (b.runsScored >= 25) pts += 15; // Gully Half-quarter century bonus
        if (b.runsScored >= 50) pts += 35; // Gully Century bonus

        // Strike rate points (minimum 5 balls faced)
        if (b.ballsFaced >= 5) {
          const sr = (b.runsScored / b.ballsFaced) * 100;
          if (sr >= 200) pts += 15;
          else if (sr >= 150) pts += 8;
        }

        playersMap.set(b.id, { player: b, team: batTeam, points: pts });
      });

      // 2. Process Bowlers
      inn.bowlers.forEach(bowl => {
        let pts = bowl.wickets * 25.0; // Huge weight for wickets
        pts += bowl.maidens * 20.0; // Maidens are extremely rare & valuable in street play
        
        // Economy discount (minimum 1 over bowled)
        if (bowl.oversBowled >= 1) {
          const econ = bowl.runsConceded / bowl.oversBowled;
          if (econ <= 4.0) pts += 20;
          else if (econ <= 6.0) pts += 10;
          else if (econ >= 12.0) pts -= 10; // penalty for getting smashed!
        }

        const existing = playersMap.get(bowl.id);
        if (existing) {
          existing.points += pts;
        } else {
          playersMap.set(bowl.id, { player: bowl, team: bowlTeam, points: pts });
        }
      });
    };

    calculatePointsForInning(m.firstInnings, m.teamA, m.teamB);
    if (m.secondInnings) {
      calculatePointsForInning(m.secondInnings, m.teamB, m.teamA);
    }

    // Sort players map by points
    let topPlayer: { player: Player; team: Team; points: number } | null = null;
    playersMap.forEach((data) => {
      if (!topPlayer || data.points > topPlayer.points) {
        topPlayer = data;
      }
    });

    return topPlayer;
  };

  // Detailed Top Batting & Bowling performers computations
  const getTopPerformers = (m: Match) => {
    let topBatters: { name: string; team: string; runs: number; balls: number }[] = [];
    let topBowlers: { name: string; team: string; wickets: number; runs: number; overs: number }[] = [];

    const harvestFromInning = (inn: Inning, batTeam: Team, bowlTeam: Team) => {
      inn.batsmen.forEach(b => {
        if (b.runsScored > 0) {
          topBatters.push({ name: b.name, team: batTeam.name, runs: b.runsScored, balls: b.ballsFaced });
        }
      });
      inn.bowlers.forEach(bw => {
        if (bw.oversBowled > 0) {
          topBowlers.push({ name: bw.name, team: bowlTeam.name, wickets: bw.wickets, runs: bw.runsConceded, overs: bw.oversBowled });
        }
      });
    };

    harvestFromInning(m.firstInnings, m.teamA, m.teamB);
    if (m.secondInnings) {
      harvestFromInning(m.secondInnings, m.teamB, m.teamA);
    }

    topBatters.sort((a,b) => b.runs - a.runs);
    topBowlers.sort((a,b) => b.wickets - a.wickets || a.runs - b.runs);

    return {
      batters: topBatters.slice(0, 3),
      bowlers: topBowlers.slice(0, 3)
    };
  };

  // Automated PDF Scorecard builder via jsPDF
  const handleDownloadPDF = (m: Match) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Exterior print borders
    doc.setDrawColor(20, 20, 25);
    doc.rect(5, 5, 200, 287, 'S');

    // 2. Midnight premium Header Band
    doc.setFillColor(3, 3, 3);
    doc.rect(5, 5, 200, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('Helvetica', 'bold');
    doc.text("MATCH OPERATING SYSTEM (MOS)", 15, 17);

    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(161, 161, 170); // zinc-400
    doc.text("Premium Street Cricket Ledger System • Designed by Areed Hassan", 15, 23);
    doc.text(`Match Stamp Date: ${new Date(m.date).toLocaleString()} • System Index: ${m.id.substring(0, 8)}`, 15, 28);

    // 3. Verdict Ribbon
    doc.setFillColor(244, 252, 231); // Lime frosting light
    doc.rect(10, 42, 190, 16, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // slate-900

    const winnerName = m.winnerTeamId === 'tie' 
      ? 'THRovING MATCH TIE!' 
      : m.winnerTeamId === 'team_a' ? m.teamA.name : m.teamB.name;
    const finalVerdict = `${winnerName} WON ${m.winnerTeamId === 'tie' ? '' : m.winMarginText}`;
    doc.text(`MATCH STATUS: ${finalVerdict.toUpperCase()}`, 15, 52);

    // 4. Man of the Match Highlight
    const mom = getManOfTheMatch(m);
    if (mom) {
      doc.setFillColor(240, 253, 250); // Emerald frosting light
      doc.rect(10, 62, 190, 20, 'F');
      
      doc.setTextColor(13, 148, 136); // emerald-600
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`🏆 MAN OF THE MATCH AWARD: ${mom.player.name.toUpperCase()}`, 15, 71);
      
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Squad: ${mom.team.name} • Impact points: ${Math.round(mom.points)} pts • Stats: Batted ${mom.player.runsScored} runs (${mom.player.ballsFaced} balls, ${mom.player.sixes}x6s) & took ${mom.player.wickets} wickets.`, 15, 76);
    }

    // 5. Scores Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("INNINGS SCOREBOARD SUMMARIES", 10, 92);
    doc.setDrawColor(228, 228, 231);
    doc.line(10, 95, 200, 95);

    // Team A Innings Scorecard
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'bold');
    doc.text(`${m.teamA.name} Score: ${m.firstInnings.runs} / ${m.firstInnings.wickets}`, 10, 103);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Overs: ${m.firstInnings.ballsBowled / m.settings.ballsPerOver} overs played (Standard)`, 10, 108);

    doc.setFillColor(244, 244, 245);
    doc.rect(10, 112, 190, 8, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.text("Batter", 12, 117);
    doc.text("Runs scored", 70, 117);
    doc.text("Balls", 98, 117);
    doc.text("Boundaries (4s / 6s)", 122, 117);
    doc.text("S/R", 175, 117);

    let y = 125;
    m.firstInnings.batsmen.forEach((b) => {
      doc.setFont('Helvetica', b.runsScored > 0 ? 'bold' : 'normal');
      doc.text(b.name, 12, y);
      doc.text(b.runsScored.toString(), 70, y);
      doc.text(b.ballsFaced.toString(), 98, y);
      doc.text(`${b.fours} Fours / ${b.sixes} Sixers`, 122, y);
      const sr = b.ballsFaced > 0 ? ((b.runsScored / b.ballsFaced) * 100).toFixed(1) : "0.0";
      doc.text(sr, 175, y);
      y += 6.5;
    });

    y += 4;
    doc.line(10, y, 200, y);
    y += 6;

    // Team B Innings Scorecard (If active)
    if (m.secondInnings) {
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'bold');
      doc.text(`${m.teamB.name} Score: ${m.secondInnings.runs} / ${m.secondInnings.wickets}`, 10, y);
      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Overs: ${m.secondInnings.ballsBowled / m.settings.ballsPerOver} overs played (Standard)`, 10, y);
      
      y += 4;
      doc.setFillColor(244, 244, 245);
      doc.rect(10, y, 190, 8, 'F');
      y += 5;
      doc.setFont('Helvetica', 'bold');
      doc.text("Batter", 12, y);
      doc.text("Runs scored", 70, y);
      doc.text("Balls", 98, y);
      doc.text("Boundaries (4s / 6s)", 122, y);
      doc.text("S/R", 175, y);
      
      m.secondInnings.batsmen.forEach((b) => {
        y += 6.5;
        doc.setFont('Helvetica', b.runsScored > 0 ? 'bold' : 'normal');
        doc.text(b.name, 12, y);
        doc.text(b.runsScored.toString(), 70, y);
        doc.text(b.ballsFaced.toString(), 98, y);
        doc.text(`${b.fours} Fours / ${b.sixes} Sixers`, 122, y);
        const sr = b.ballsFaced > 0 ? ((b.runsScored / b.ballsFaced) * 100).toFixed(1) : "0.0";
        doc.text(sr, 175, y);
      });
    }

    // Bowler Table Section
    y += 12;
    if (y > 215) {
      doc.addPage();
      doc.rect(5, 5, 200, 287, 'S');
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.text("MATCH BOWLING HIGHLIGHTS", 10, y);
    y += 4;
    doc.setDrawColor(228, 228, 231);
    doc.line(10, y, 200, y);
    y += 5;

    doc.setFillColor(244, 244, 245);
    doc.rect(10, y, 190, 8, 'F');
    y += 5;
    doc.text("Bowler Name", 12, y);
    doc.text("Overs Bowled", 70, y);
    doc.text("Runs", 100, y);
    doc.text("Wickets", 130, y);
    doc.text("Maidens", 160, y);

    const publishBowlers = (bowlers: typeof m.firstInnings.bowlers) => {
      bowlers.filter(bw => bw.oversBowled > 0).forEach((bw) => {
        y += 6.5;
        doc.setFont('Helvetica', 'normal');
        doc.text(bw.name, 12, y);
        doc.text(bw.oversBowled.toString(), 70, y);
        doc.text(bw.runsConceded.toString(), 100, y);
        doc.text(bw.wickets.toString(), 130, y);
        doc.text(bw.maidens.toString(), 160, y);
      });
    };

    publishBowlers(m.firstInnings.bowlers);
    if (m.secondInnings) {
      publishBowlers(m.secondInnings.bowlers);
    }

    // 6. Street Regulations Stamp
    y += 15;
    if (y > 240) {
      doc.addPage();
      doc.rect(5, 5, 200, 287, 'S');
      y = 20;
    }

    doc.setFillColor(254, 244, 199); // amber 100
    doc.rect(10, y, 190, 20, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`STREET CRICKET REGULATIONS RECORD:`, 15, y + 6);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`- One-Tippa Out rule: ${m.settings.onePitchCatchOut ? "ENABLED" : "DISABLED"}\n- Ghar Ke Baahar OUT boundary safety: ${m.settings.hitOutOfBoundaryOut ? "ENABLED" : "DISABLED"}\n- Batting Overs capped at: ${m.settings.oversPerMatch} overs`, 15, y + 11);

    // Footer lines
    doc.setTextColor(161, 161, 170);
    doc.setFontSize(8);
    doc.text("Match Operating System (MOS) Scorecard Engine • Prepared in high fidelity Vector PDF Space", 12, 280);

    const fileName = `MOS_Gully_Scorecard_${m.teamA.name.replace(/\s+/g, '_')}_vs_${m.teamB.name.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);

    const pdfBlob = doc.output('blob');
    setGeneratedPdfBlob(pdfBlob);
    setPdfFileName(fileName);
    setShowPdfSuccessModal(true);
  };

  const handleOpenPDFNative = async () => {
    if (!generatedPdfBlob) return;
    try {
      const file = new File([generatedPdfBlob], pdfFileName, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'MOS Gully Cricket Scorecard',
          text: 'Pristine Match Operating System (MOS) Scorecard Records PDF'
        });
      } else {
        const fileURL = URL.createObjectURL(generatedPdfBlob);
        window.open(fileURL, '_blank');
      }
    } catch (error) {
      console.error("Failed to call native reader chooser:", error);
      const fileURL = URL.createObjectURL(generatedPdfBlob);
      window.open(fileURL, '_blank');
    }
  };

  const activeMOM = currentCompletedMatch ? getManOfTheMatch(currentCompletedMatch) : null;
  const activePerformers = currentCompletedMatch ? getTopPerformers(currentCompletedMatch) : null;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-2 space-y-6" id="scorecard-summary-root">
      
      {/* 1. Bento Box Match summary dashboard */}
      {currentCompletedMatch && (
        <motion.div 
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="glass-panel rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl space-y-8"
        >
          {/* Glowing colorful ambient blurs for celebration */}
          <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-lime-400/5 blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 right-1/4 w-72 h-72 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

          {/* Heading */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-5">
            <div>
              <span className="text-[9px] font-mono tracking-widest font-black text-lime-400 uppercase bg-lime-400/10 border border-lime-400/20 px-3 py-1 rounded-full">
                Street Match Completed
              </span>
              <h1 className="text-2xl font-black text-white uppercase tracking-tight mt-2 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-lime-400 animate-bounce" />
                Match Summary Record
              </h1>
            </div>

            <button
              onClick={() => handleDownloadPDF(currentCompletedMatch)}
              className="px-5 py-3 glass-button text-xs font-black uppercase tracking-wider text-lime-400 rounded-xl flex items-center gap-2 cursor-pointer border border-lime-400/30 hover:bg-lime-400/10"
              id="btn-download-scorecard"
            >
              <Download size={14} />
              Save pristine PDF Scorecard
            </button>
          </div>

          {/* Bento Grid panels */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pointer-events-auto">

            {/* Cell 1: Winner spotlight banner (col-span-12) */}
            <div className="md:col-span-12 bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-center space-y-3 flex flex-col items-center justify-center">
              <span className="text-white/40 uppercase tracking-widest font-mono text-[9px] block">Champion Spotlight</span>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-wide">
                {currentCompletedMatch.winnerTeamId === 'tie' 
                  ? "It's an ultimate Match Tie! 🤝" 
                  : `${currentCompletedMatch.winnerTeamId === 'team_a' ? currentCompletedMatch.teamA.name : currentCompletedMatch.teamB.name} Victory!`
                }
              </h2>
              <p className="text-lime-400 font-mono tracking-widest uppercase font-bold text-xs bg-lime-400/10 border border-lime-400/15 px-4 py-1.5 rounded-full inline-block">
                {currentCompletedMatch.winnerTeamId === 'tie' ? "Unbelievable battle!" : currentCompletedMatch.winMarginText}
              </p>
            </div>

            {/* Cell 2: Man of the match card (col-span-6) */}
            {activeMOM && (
              <div className="md:col-span-6 bg-gradient-to-br from-emerald-500/[0.04] to-teal-500/[0.02] border border-emerald-500/20 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <span className="text-emerald-400 uppercase tracking-widest font-mono text-[9px] font-bold block mb-1">Impact MVP award</span>
                  <h3 className="text-lg font-bold text-white uppercase flex items-center gap-1.5 leading-tight">
                    <Star className="text-emerald-400 fill-emerald-400 w-5 h-5 flex-shrink-0" />
                    Man of the Match
                  </h3>
                  <div className="font-extrabold text-[#fafafa] uppercase text-sm mt-3 bg-emerald-500/10 border border-emerald-500/15 px-3 py-1.5 rounded-lg inline-block">
                    {activeMOM.player.name}
                  </div>
                  <p className="text-xs text-white/40 font-mono uppercase mt-1">Representing: {activeMOM.team.name}</p>
                </div>

                <div className="pt-4 border-t border-emerald-500/10 mt-4 space-y-1.5 text-xs text-emerald-400/90 font-mono">
                  <div className="flex justify-between">
                    <span>Runs scored:</span>
                    <span className="font-bold text-white">{activeMOM.player.runsScored} ({activeMOM.player.ballsFaced}b, {activeMOM.player.sixes}x6s)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wickets taken:</span>
                    <span className="font-bold text-white">{activeMOM.player.wickets} W wickets</span>
                  </div>
                </div>
              </div>
            )}

            {/* Cell 3: Match core statistics counters (col-span-6) */}
            <div className="md:col-span-6 bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <span className="text-white/30 uppercase tracking-widest font-mono text-[9px] block mb-2">Street Highlights ledger</span>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Flame size={14} className="text-lime-400" />
                  General street highlights
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5 mt-4">
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl text-center">
                  <span className="text-[9px] text-white/40 block font-mono uppercase">Max boundaries (6s)</span>
                  <span className="text-lg font-black text-white font-mono">
                    {(currentCompletedMatch.firstInnings.overs.flatMap(o => o.balls).filter(b => b.runs === 6).length) +
                     (currentCompletedMatch.secondInnings ? currentCompletedMatch.secondInnings.overs.flatMap(o => o.balls).filter(b => b.runs === 6).length : 0)}
                  </span>
                </div>
                <div className="bg-black/40 border border-white/5 p-3 rounded-xl text-center">
                  <span className="text-[9px] text-white/40 block font-mono uppercase">Wickets Overthrown</span>
                  <span className="text-lg font-black text-white font-mono">
                    {currentCompletedMatch.firstInnings.wickets + (currentCompletedMatch.secondInnings ? currentCompletedMatch.secondInnings.wickets : 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cell 4: Top Batsmen (col-span-6) */}
            {activePerformers && activePerformers.batters.length > 0 && (
              <div className="md:col-span-6 bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-3">
                <span className="text-white/30 uppercase tracking-widest font-mono text-[9px] block">Crease batting leaderboard</span>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1">Top batters</h4>
                
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {activePerformers.batters.map((b, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-white uppercase">{b.name}</span>
                        <span className="text-[9px] text-white/40 font-mono uppercase block">{b.team}</span>
                      </div>
                      <span className="font-mono font-bold text-lime-400">{b.runs} runs <span className="text-white/30 text-[10px]">({b.balls}b)</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cell 5: Top Bowlers (col-span-6) */}
            {activePerformers && activePerformers.bowlers.length > 0 && (
              <div className="md:col-span-6 bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-3">
                <span className="text-white/30 uppercase tracking-widest font-mono text-[9px] block">Over bowling leaderboard</span>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1">Top bowlers</h4>
                
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {activePerformers.bowlers.map((bw, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <div>
                        <span className="font-bold text-white uppercase">{bw.name}</span>
                        <span className="text-[9px] text-zinc-500 font-mono uppercase block">{bw.team}</span>
                      </div>
                      <span className="font-mono font-bold text-white">{bw.wickets} W <span className="text-white/30 text-[10px]">/ {bw.runs} runs</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Cell 6: Full Innings Scorecard table on screen (col-span-12) */}
          {(() => {
            const firstInnsBattingTeam = currentCompletedMatch.firstInnings.battingTeamId === 'team_a' ? currentCompletedMatch.teamA : currentCompletedMatch.teamB;
            const secondInnsBattingTeam = currentCompletedMatch.firstInnings.battingTeamId === 'team_a' ? currentCompletedMatch.teamB : currentCompletedMatch.teamA;
            return (
              <div className="md:col-span-12 bg-white/[0.02] border border-white/5 rounded-3xl p-5 md:p-6 space-y-6" id="completed-match-full-scorecards">
                <div className="border-b border-white/5 pb-3">
                  <span className="text-white/30 uppercase tracking-widest font-mono text-[9px] block">Full Detailed Review</span>
                  <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Sliders size={14} className="text-lime-400" />
                    Full Innings Scorecards
                  </h3>
                </div>

                <div className="space-y-8">
                  {/* First Innings */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-white/[0.03] px-4 py-2.5 rounded-xl border border-white/5">
                      <span className="font-bold text-xs text-white uppercase tracking-wider">
                        1st Innings: {firstInnsBattingTeam.name} Batting
                      </span>
                      <span className="text-xs font-black font-mono text-lime-400">
                        {currentCompletedMatch.firstInnings.runs} / {currentCompletedMatch.firstInnings.wickets}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-zinc-300 min-w-[500px]" id="completed-scorecard-table-1">
                        <thead>
                          <tr className="border-b border-white/5 text-white/40 font-mono tracking-widest uppercase text-[9px] pb-2">
                            <th className="py-2.5">Batter</th>
                            <th className="py-2.5 text-center">Status</th>
                            <th className="py-2.5 text-center">Runs</th>
                            <th className="py-2.5 text-center">Balls</th>
                            <th className="py-2.5 text-center">4s</th>
                            <th className="py-2.5 text-center">6s</th>
                            <th className="py-2.5 text-right">SR</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentCompletedMatch.firstInnings.batsmen.map((b) => {
                            const sr = b.ballsFaced > 0 ? ((b.runsScored / b.ballsFaced) * 100).toFixed(1) : "0.0";
                            let statusText = "Did Not Bat";
                            if (b.isOut) {
                              statusText = `Out (${b.howOut || 'dismissed'})`;
                            } else if (b.runsScored > 0 || b.ballsFaced > 0) {
                              statusText = "Not Out";
                            }
                            return (
                              <tr key={b.id} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                                <td className="py-3 uppercase font-medium font-mono text-white">{b.name}</td>
                                <td className="py-3 text-center">
                                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                                    b.isOut 
                                      ? 'text-red-400 bg-red-400/10 border-red-500/20' 
                                      : statusText === 'Not Out' 
                                        ? 'text-lime-400 bg-lime-400/10 border-lime-400/20' 
                                        : 'text-[#8a8a93] bg-white/[0.02] border-white/5'
                                  }`}>
                                    {statusText}
                                  </span>
                                </td>
                                <td className="py-3 text-center font-bold text-white font-mono">{b.runsScored}</td>
                                <td className="py-3 text-center text-zinc-400 font-mono">{b.ballsFaced}</td>
                                <td className="py-3 text-center text-zinc-500 font-mono">{b.fours}</td>
                                <td className="py-3 text-center text-zinc-500 font-mono">{b.sixes}</td>
                                <td className="py-3 text-right font-mono text-lime-400 font-bold">{sr}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Second Innings */}
                  {currentCompletedMatch.secondInnings && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center bg-white/[0.03] px-4 py-2.5 rounded-xl border border-white/5">
                        <span className="font-bold text-xs text-white uppercase tracking-wider">
                          2nd Innings: {secondInnsBattingTeam.name} Batting
                        </span>
                        <span className="text-xs font-black font-mono text-lime-400">
                          {currentCompletedMatch.secondInnings.runs} / {currentCompletedMatch.secondInnings.wickets}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-zinc-300 min-w-[500px]" id="completed-scorecard-table-2">
                          <thead>
                            <tr className="border-b border-white/5 text-white/40 font-mono tracking-widest uppercase text-[9px] pb-2">
                              <th className="py-2.5">Batter</th>
                              <th className="py-2.5 text-center">Status</th>
                              <th className="py-2.5 text-center">Runs</th>
                              <th className="py-2.5 text-center">Balls</th>
                              <th className="py-2.5 text-center">4s</th>
                              <th className="py-2.5 text-center">6s</th>
                              <th className="py-2.5 text-right">SR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentCompletedMatch.secondInnings.batsmen.map((b) => {
                              const sr = b.ballsFaced > 0 ? ((b.runsScored / b.ballsFaced) * 100).toFixed(1) : "0.0";
                              let statusText = "Did Not Bat";
                              if (b.isOut) {
                                statusText = `Out (${b.howOut || 'dismissed'})`;
                              } else if (b.runsScored > 0 || b.ballsFaced > 0) {
                                statusText = "Not Out";
                              }
                              return (
                                <tr key={b.id} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                                  <td className="py-3 uppercase font-medium font-mono text-white">{b.name}</td>
                                  <td className="py-3 text-center">
                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                                      b.isOut 
                                        ? 'text-red-400 bg-red-400/10 border-red-500/20' 
                                        : statusText === 'Not Out' 
                                          ? 'text-lime-400 bg-lime-400/10 border-lime-400/20' 
                                          : 'text-[#8a8a93] bg-white/[0.02] border-white/5'
                                    }`}>
                                      {statusText}
                                    </span>
                                  </td>
                                  <td className="py-3 text-center font-bold text-white font-mono">{b.runsScored}</td>
                                  <td className="py-3 text-center text-zinc-400 font-mono">{b.ballsFaced}</td>
                                  <td className="py-3 text-center text-zinc-500 font-mono">{b.fours}</td>
                                  <td className="py-3 text-center text-zinc-500 font-mono">{b.sixes}</td>
                                  <td className="py-3 text-right font-mono text-lime-400 font-bold">{sr}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* New Match Action Trigger inside summary card */}
          <div className="pt-4 flex justify-center border-t border-white/5">
            <button
              onClick={onNewMatch}
              className="px-8 py-4 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-black tracking-widest text-xs uppercase rounded-xl transition duration-300 shadow-lg shadow-lime-400/20 cursor-pointer"
            >
              Commence Another Street Battle
            </button>
          </div>

        </motion.div>
      )}

      {/* 2. Historic List of Saved matches */}
      <div className="glass-panel text-white rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <div>
            <h2 className="font-black text-white uppercase tracking-tight text-sm font-mono flex items-center gap-2">
              <Sliders className="text-lime-400 w-4 h-4" />
              MOS Scorebook Archives
            </h2>
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-mono mt-0.5">Device browser database records</p>
          </div>

          {pastMatches.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-[9px] font-bold uppercase tracking-wider text-white/30 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer bg-white/[0.02] px-2.5 py-1.5 rounded-lg border border-white/5"
            >
              <Trash2 size={11} />
              Clear scorebook
            </button>
          )}
        </div>

        {pastMatches.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <Calendar size={32} className="mx-auto text-white/15" />
            <div className="space-y-1">
              <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Historical scorecard ledger empty</p>
              <p className="text-white/30 text-[10px]">Play matches inside the live scorer dashboard to fill archives panel.</p>
            </div>
            <div className="pt-2">
              <button
                onClick={onNewMatch}
                className="px-5 py-2.5 border border-lime-400/40 text-lime-400 hover:bg-lime-400/10 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Launch Scorecard Setup ⚡
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pastMatches.map((item) => {
              const isExpanded = expandedMatchId === item.id;
              
              return (
                <div 
                  key={item.id} 
                  className="p-4 border border-white/5 rounded-xl bg-black/40 hover:bg-black/60 transition-all relative overflow-hidden"
                >
                  <div 
                    onClick={() => setExpandedMatchId(isExpanded ? null : item.id)}
                    className="flex justify-between items-center cursor-pointer select-none"
                  >
                    <div className="space-y-1">
                      <div className="text-[9px] text-[#a1a1aa] font-bold font-mono uppercase flex items-center gap-1">
                        <Calendar size={10} />
                        {new Date(item.date).toLocaleDateString()}
                      </div>
                      
                      <div className="font-bold text-white text-xs uppercase tracking-wide flex items-center gap-2">
                        <span>{item.teamAName}</span>
                        <span className="text-[#52525b] text-[9px] font-normal lowercase font-mono">vs</span>
                        <span>{item.teamBName}</span>
                      </div>

                      <div className="text-[11px] text-lime-400 font-bold uppercase tracking-wide">
                        {item.resultText}
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-4">
                      <div>
                        <div className="text-xs font-bold text-white font-mono">1st: {item.teamAScore}</div>
                        <div className="text-xs font-bold text-white/40 font-mono">2nd: {item.teamBScore}</div>
                      </div>
                      <div className="text-zinc-400 bg-white/[0.04] border border-white/5 p-1.5 rounded-lg">
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-white/5 text-xs text-zinc-400 space-y-3 font-mono"
                      >
                        <div className="flex justify-between items-center bg-black/30 p-2.5 rounded-lg border border-white/5">
                          <div>
                            <span className="text-[10px] text-zinc-500 uppercase block font-bold">MOM Recognition</span>
                            <span className="text-xs font-bold text-white uppercase">{item.momName || "None Assigned"}</span>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Regenerate mock full object to download PDF directly
                              const miniMock: Match = {
                                id: item.id,
                                status: 'completed',
                                date: item.date,
                                tossWinnerId: 'team_a',
                                tossDecision: 'bat',
                                teamA: { id: 'team_a', name: item.teamAName, players: [] },
                                teamB: { id: 'team_b', name: item.teamBName, players: [] },
                                settings: {
                                  oversPerMatch: 4,
                                  ballsPerOver: 6,
                                  playersPerTeam: 5,
                                  widePenalty: 1,
                                  noBallPenalty: 1,
                                  freeHitOnNoBall: true,
                                  onePitchCatchOut: true,
                                  hitOutOfBoundaryOut: true,
                                  lastManStanding: true,
                                  vibrationFeedback: true,
                                  voiceCommentary: true
                                },
                                firstInnings: {
                                  battingTeamId: 'team_a',
                                  bowlingTeamId: 'team_b',
                                  runs: parseInt(item.teamAScore.split('/')[0]) || 0,
                                  wickets: parseInt(item.teamAScore.split('/')[1]) || 0,
                                  ballsBowled: 24,
                                  overs: [],
                                  batsmen: [{ id: '1', name: item.momName || 'Batsman', runsScored: parseInt(item.teamAScore.split('/')[0]) || 0, ballsFaced: 12, fours: 2, sixes: 4, isOut: false, oversBowled: 0, maidens: 0, runsConceded: 0, wickets: 0, wides: 0, noballs: 0 }],
                                  bowlers: [{ id: '1', name: 'Bowler', runsScored: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false, oversBowled: 2, maidens: 0, runsConceded: 18, wickets: 2, wides: 0, noballs: 0 }],
                                  tempBatter1Id: '1',
                                  tempBatter2Id: '2',
                                  tempBowlerId: '1'
                                },
                                secondInnings: {
                                  battingTeamId: 'team_b',
                                  bowlingTeamId: 'team_a',
                                  runs: item.teamBScore !== "DNB" ? (parseInt(item.teamBScore.split('/')[0]) || 0) : 0,
                                  wickets: item.teamBScore !== "DNB" ? (parseInt(item.teamBScore.split('/')[1]) || 0) : 0,
                                  ballsBowled: 24,
                                  overs: [],
                                  batsmen: [{ id: '10', name: 'Chase Batter', runsScored: item.teamBScore !== "DNB" ? (parseInt(item.teamBScore.split('/')[0]) || 0) : 0, ballsFaced: 12, fours: 2, sixes: 1, isOut: false, oversBowled: 0, maidens: 0, runsConceded: 0, wickets: 0, wides: 0, noballs: 0 }],
                                  bowlers: [{ id: '11', name: 'Defense Bowler', runsScored: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false, oversBowled: 2, maidens: 0, runsConceded: 20, wickets: 1, wides: 0, noballs: 0 }],
                                  tempBatter1Id: '10',
                                  tempBatter2Id: '11',
                                  tempBowlerId: '11'
                                },
                                winnerTeamId: item.resultText.includes(item.teamAName) ? 'team_a' : 'team_b',
                                winMarginText: item.resultText.substring(item.resultText.indexOf("won") + 4)
                              };
                              handleDownloadPDF(miniMock);
                            }}
                            className="bg-lime-400 hover:bg-lime-500 text-zinc-950 font-black tracking-widest text-[8px] py-1.5 px-2 rounded uppercase tracking-wider cursor-pointer"
                          >
                            PDF Download Scorecard
                          </button>
                        </div>
                        <p className="text-[9px] text-white/20 font-mono">SCOREBOOK DATABASE STAMP ID: {item.id}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!currentCompletedMatch && pastMatches.length > 0 && (
        <div className="text-center pt-2">
          <button
            onClick={onNewMatch}
            className="px-6 py-3.5 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-black tracking-widest text-xs uppercase rounded-xl transition duration-300 shadow cursor-pointer"
          >
            Commence New Match File
          </button>
        </div>
      )}

      {/* PDF Success & Native Reader Dialog */}
      <AnimatePresence>
        {showPdfSuccessModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100]" id="modal-pdf-success">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-zinc-100 space-y-5"
            >
              <div className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-lime-400/10 border border-lime-400/20 flex items-center justify-center text-lime-400">
                  <Download size={22} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base uppercase tracking-tight">
                    PDF Scorecard Ready!
                  </h3>
                  <p className="text-xs text-white/55 mt-1.5 leading-relaxed font-sans">
                    The PDF has been compiled successfully and saved directly to your device storage.
                  </p>
                  <p className="text-[11px] text-white/40 mt-2 leading-relaxed font-sans border-t border-white/5 pt-2">
                    Would you like to open it immediately using your device's default or preferred PDF viewer application?
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPdfSuccessModal(false);
                    setGeneratedPdfBlob(null);
                  }}
                  className="w-full py-3.5 border border-white/10 hover:bg-white/5 text-white/70 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleOpenPDFNative();
                    setShowPdfSuccessModal(false);
                    setGeneratedPdfBlob(null);
                  }}
                  className="w-full py-3.5 bg-lime-400 hover:bg-lime-500 text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow shadow-lime-400/20 cursor-pointer"
                >
                  Open PDF Viewer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
