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
    // 1. Initialize jsPDF in points (pt)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width; // 595.28 pt
    const pageHeight = doc.internal.pageSize.height; // 841.89 pt
    const margin = 24;
    const contentWidth = pageWidth - 2 * margin; // 547.28 pt

    const todayDateStr = new Date().toISOString().split('T')[0];

    // Safe opacity controller
    const setOpacity = (opacity: number) => {
      try {
        const GStateClass = (doc as any).GState || (jsPDF as any).GState;
        if (GStateClass) {
          doc.setGState(new GStateClass({ opacity }));
        }
      } catch (e) {
        // fallback
      }
    };

    // Helper to blend backgrounds for standard shapes
    const drawPageBackground = () => {
      doc.setFillColor(248, 249, 252);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
    };

    // Helper to draw glass card with correct stacking layers
    const drawGlassCard = (x: number, y: number, w: number, h: number, accentColor: [number, number, number]) => {
      const r = 18; // Corner radius 16-20pt minimum
      
      // 1. Drop shadow Layer 1 (7% opacity, 3pt right, 5pt down)
      doc.setFillColor(180, 185, 200);
      setOpacity(0.07);
      doc.roundedRect(x + 3, y + 5, w, h, r, r, 'F');
      
      // Drop shadow Layer 2 (12% opacity, 2pt right, 3pt down)
      setOpacity(0.12);
      doc.roundedRect(x + 2, y + 3, w, h, r, r, 'F');
      
      // 2. Frosted base (white fill at 70% opacity)
      doc.setFillColor(255, 255, 255);
      setOpacity(0.70);
      doc.roundedRect(x, y, w, h, r, r, 'F');
      
      // 3. Color tint overlay (soft wash of accent color at 12% opacity)
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      setOpacity(0.12);
      doc.roundedRect(x, y, w, h, r, r, 'F');
      
      // 4. Inner highlight shimmer (thin bright white strip 3.5pt tall at top inner edge, 80% opacity)
      doc.setFillColor(255, 255, 255);
      setOpacity(0.80);
      doc.roundedRect(x + 2, y + 1.5, w - 4, 3.5, 3, 3, 'F');
      
      // 5. Border stroke (0.8pt rounded stroke of accent color at 24% opacity)
      doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setLineWidth(0.8);
      setOpacity(0.24);
      doc.roundedRect(x, y, w, h, r, r, 'S');
      
      // Accent stripe (At the top inside edge of every card, render a thin rounded strip 5.5pt tall in card's accent color at 32% opacity)
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      setOpacity(0.32);
      doc.roundedRect(x + 18, y + 6, w - 36, 5.5, 2, 2, 'F');
      
      // Clean reset
      setOpacity(1.0);
    };

    // Helper to draw pill
    const drawPill = (
      text: string,
      x: number,
      y: number,
      accentColor: [number, number, number],
      fontSize: number = 6.5,
      isBold: boolean = true
    ) => {
      doc.setFont("Helvetica", isBold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      const textW = doc.getTextWidth(text);
      const h = fontSize + 6.5; // height of pill
      const w = textW + 16;     // width with horizontal padding
      
      // White Base 70%
      doc.setFillColor(255, 255, 255);
      setOpacity(0.70);
      doc.roundedRect(x, y, w, h, h/2, h/2, 'F');
      
      // Color Overlay 12%
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      setOpacity(0.12);
      doc.roundedRect(x, y, w, h, h/2, h/2, 'F');
      
      // Soft border stroke 24%
      doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setLineWidth(0.8);
      setOpacity(0.24);
      doc.roundedRect(x, y, w, h, h/2, h/2, 'S');
      
      // Text centered vertically
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      setOpacity(1.0);
      doc.text(text, x + 8, y + h/2 + fontSize/2 - 0.5);
      
      return w;
    };

    // Helper to format dismissal text
    const getDismissalText = (b: Player, bowlersList: any[]) => {
      if (!b.isOut) {
        if (b.runsScored > 0 || b.ballsFaced > 0) {
          return "NOT OUT";
        }
        return "DID NOT BAT";
      }
      
      const bowler = b.dismissedBy ? bowlersList.find(bow => bow.id === b.dismissedBy)?.name : undefined;
      const fielder = b.helperPlayer;
      
      switch(b.howOut) {
        case 'caught':
          return `C ${fielder || 'FIELDER'} B ${bowler || 'BOWLER'}`.toUpperCase();
        case 'runout':
          return `RUN OUT (${fielder || 'FIELDER'})`.toUpperCase();
        case 'lbw':
          return `LBW B ${bowler || 'BOWLER'}`.toUpperCase();
        case 'stumped':
          return `STUMPED B ${bowler || 'BOWLER'}`.toUpperCase();
        case 'bowled':
          return `B ${bowler || 'BOWLER'}`.toUpperCase();
        case 'hit_out_of_ground':
          return "GHAR BAAHAR OUT".toUpperCase();
        case 'one_pitch':
          return `1-PITCH B ${bowler || 'BOWLER'}`.toUpperCase();
        default:
          return "OUT";
      }
    };

    // Helper to draw dismissal capsules
    const drawDismissalPill = (pdfDoc: any, text: string, px: number, py: number, pw: number, ph: number) => {
      let color: [number, number, number] = [120, 125, 145]; // default gray
      if (text === "NOT OUT") {
        color = [40, 190, 120]; // Green
      } else if (text !== "DID NOT BAT" && text !== "") {
        color = [255, 85, 100]; // Red
      }
      
      // Draw white base 70%
      pdfDoc.setFillColor(255, 255, 255);
      setOpacity(0.70);
      pdfDoc.roundedRect(px, py, pw, ph, ph/2, ph/2, 'F');
      
      // Draw color overlay 12%
      pdfDoc.setFillColor(color[0], color[1], color[2]);
      setOpacity(0.12);
      pdfDoc.roundedRect(px, py, pw, ph, ph/2, ph/2, 'F');
      
      // Stroke border 24%
      pdfDoc.setDrawColor(color[0], color[1], color[2]);
      pdfDoc.setLineWidth(0.6);
      setOpacity(0.24);
      pdfDoc.roundedRect(px, py, pw, ph, ph/2, ph/2, 'S');
      
      // Text
      pdfDoc.setTextColor(color[0], color[1], color[2]);
      pdfDoc.setFont("Helvetica-Bold", "normal");
      pdfDoc.setFontSize(5.5);
      setOpacity(1.0);
      pdfDoc.text(text, px + pw/2, py + ph/2 + 2, { align: 'center' });
    };

    // Helper to draw page footer
    const drawFooter = (pdfDoc: any, pageNum: number, totalPages: number) => {
      const y_footer = 815; // standard footer y for A4 in points
      
      // Thin 0.4pt horizontal rule in [200, 205, 225] at 40% opacity
      pdfDoc.setDrawColor(200, 205, 225);
      pdfDoc.setLineWidth(0.4);
      setOpacity(0.40);
      pdfDoc.line(margin, y_footer - 10, pageWidth - margin, y_footer - 10);
      
      // Left and Right text
      setOpacity(1.0);
      pdfDoc.setFont("Helvetica", "normal");
      pdfDoc.setFontSize(6.5);
      pdfDoc.setTextColor(150, 155, 178); // muted gray
      
      pdfDoc.text("Match Operating System (MOS) · Designed by Areed Hassan", margin, y_footer);
      
      const genDateStr = `Generated ${todayDateStr} · Page ${pageNum} of ${totalPages}`;
      pdfDoc.text(genDateStr, pageWidth - margin, y_footer, { align: 'right' });
    };

    // Draw background on Page 1 first
    drawPageBackground();

    let curY = 24; // starting top padding
    let currentPage = 1;

    // ==========================================
    // CARD 1: HEADER (Accent: [99, 118, 255])
    // ==========================================
    const headerHeight = 115;
    drawGlassCard(margin, curY, contentWidth, headerHeight, [99, 118, 255]);
    
    // Top-left frosted chill pill
    drawPill("MATCH OPERATING SYSTEM", margin + 18, curY + 15, [99, 118, 255], 6.5, true);
    
    // Top-right overs pill
    const oversText = `${m.settings.oversPerMatch.toFixed(1)} OVERS`;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7);
    const oversTextW = doc.getTextWidth(oversText);
    const oversPillW = oversTextW + 16;
    drawPill(oversText, margin + contentWidth - 18 - oversPillW, curY + 15, [99, 118, 255], 7, true);
    
    // Team Names (STREET KINGS vs GULLY GODS)
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(18);
    doc.setTextColor(20, 22, 40);
    const teamNamesStr = `${m.teamA.name.toUpperCase()}  vs  ${m.teamB.name.toUpperCase()}`;
    doc.text(teamNamesStr, margin + 18, curY + 44);
    
    // Scores line list
    const scoreTextA = `${m.teamA.name.toUpperCase()} ${m.firstInnings.runs}/${m.firstInnings.wickets}`;
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(13.5);
    doc.setTextColor(99, 118, 255);
    doc.text(scoreTextA, margin + 18, curY + 66);
    
    // Slash separator in muted gray
    const widthA = doc.getTextWidth(scoreTextA);
    doc.setFont("Helvetica-Bold", "normal");
    doc.setTextColor(150, 155, 178);
    doc.text("  /  ", margin + 18 + widthA, curY + 66);
    
    const widthSlash = doc.getTextWidth("  /  ");
    const scoreTextB = m.secondInnings ? `${m.teamB.name.toUpperCase()} ${m.secondInnings.runs}/${m.secondInnings.wickets}` : "DNB";
    doc.setTextColor(255, 85, 100);
    doc.text(scoreTextB, margin + 18 + widthA + widthSlash, curY + 66);
    
    // Match date & ID
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 88, 112);
    const matchDetailsStr = `DATE: ${todayDateStr}   ·   MATCH ID: ${m.id.toUpperCase()}`;
    doc.text(matchDetailsStr, margin + 18, curY + 84);
    
    curY += headerHeight + 11; // Gap between cards = 11pt

    // ==========================================
    // CARD 2: RESULT BANNER (Accent: [40, 190, 120])
    // ==========================================
    const resultHeight = 42;
    drawGlassCard(margin, curY, contentWidth, resultHeight, [40, 190, 120]);
    
    // Thick 6.5pt vertical accent bar
    doc.setFillColor(40, 190, 120);
    doc.roundedRect(margin + 12, curY + 11, 6.5, resultHeight - 22, 1.5, 1.5, 'F');
    
    // Winner text + margin
    const winnerName = m.winnerTeamId === 'tie'
      ? 'Match Tied'
      : m.winnerTeamId === 'team_a' ? m.teamA.name : m.teamB.name;
    const finalVerdict = m.winnerTeamId === 'tie' ? 'MATCH TIED' : `${winnerName.toUpperCase()} WIN`;
    
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(11);
    doc.setTextColor(20, 22, 40);
    doc.text(finalVerdict, margin + 25, curY + 25);
    
    const finalVerdictWidth = doc.getTextWidth(finalVerdict);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 88, 112);
    const marginText = m.winnerTeamId === 'tie' ? ' after standard play' : ` by ${m.winMarginText}`;
    doc.text(marginText, margin + 25 + finalVerdictWidth + 2, curY + 25);
    
    // MATCH COMPLETE pill (right aligned)
    const matchCompletePillW = doc.getTextWidth("MATCH COMPLETE") + 16;
    drawPill("MATCH COMPLETE", margin + contentWidth - 18 - matchCompletePillW, curY + 14.5, [40, 190, 120], 6.5, true);
    
    curY += resultHeight + 11; // Gap = 11pt

    // ==========================================
    // CARD 3: MAN OF THE MATCH (Accent: [230, 160, 40])
    // ==========================================
    const momHeight = 93;
    drawGlassCard(margin, curY, contentWidth, momHeight, [230, 160, 40]);
    
    // Label "MAN OF THE MATCH"
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(7);
    doc.setTextColor(230, 160, 40);
    doc.text("MAN OF THE MATCH", margin + 18, curY + 17);
    
    // Player Name
    const mom = getManOfTheMatch(m);
    const momPlayerName = mom ? mom.player.name.toUpperCase() : "N/A";
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(16);
    doc.setTextColor(20, 22, 40);
    doc.text(momPlayerName, margin + 18, curY + 33);
    
    // Team Name
    const momTeamName = mom ? mom.team.name.toUpperCase() : "";
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 155, 178);
    doc.text(momTeamName, margin + 18, curY + 42);
    
    // Thin separator rule
    doc.setDrawColor(230, 160, 40);
    doc.setLineWidth(0.4);
    setOpacity(0.15);
    doc.line(margin + 18, curY + 48, margin + contentWidth - 18, curY + 48);
    setOpacity(1.0);
    
    // Row of 7 frosted stat boxes
    if (mom) {
      const statsList = [
        { val: mom.player.runsScored.toString(), lbl: "RUNS" },
        { val: mom.player.ballsFaced.toString(), lbl: "BALLS" },
        { val: mom.player.ballsFaced > 0 ? ((mom.player.runsScored / mom.player.ballsFaced) * 100).toFixed(1) : "0.0", lbl: "S/R" },
        { val: mom.player.fours.toString(), lbl: "4s" },
        { val: mom.player.sixes.toString(), lbl: "6s" },
        { val: mom.player.wickets.toString(), lbl: "WKTS" },
        { val: Math.round(mom.points).toString(), lbl: "PTS" }
      ];
      
      const cardW = 67.89; // Calculated boxWidth
      const spacing = 6;
      const startX = margin + 18;
      
      statsList.forEach((stat, i) => {
        const bx = startX + i * (cardW + spacing);
        const by = curY + 54;
        const bw = cardW;
        const bh = 28;
        const br = 6;
        
        // 1. Drop shadow (1pt offset, color at 7%)
        doc.setFillColor(180, 185, 200);
        setOpacity(0.07);
        doc.roundedRect(bx + 1, by + 1, bw, bh, br, br, 'F');
        
        // 2. White base (70% opacity)
        doc.setFillColor(255, 255, 255);
        setOpacity(0.70);
        doc.roundedRect(bx, by, bw, bh, br, br, 'F');
        
        // 3. Gold Tint overlay (10% opacity)
        doc.setFillColor(230, 160, 40);
        setOpacity(0.10);
        doc.roundedRect(bx, by, bw, bh, br, br, 'F');
        
        // 4. White highlight shimmer (80% opacity)
        doc.setFillColor(255, 255, 255);
        setOpacity(0.80);
        doc.roundedRect(bx + 1, by + 1, bw - 2, 2, 1, 1, 'F');
        
        // 5. Border stroke (24% opacity)
        doc.setDrawColor(230, 160, 40);
        doc.setLineWidth(0.6);
        setOpacity(0.24);
        doc.roundedRect(bx, by, bw, bh, br, br, 'S');
        
        // Text 1: Value
        doc.setFont("Helvetica-Bold", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(230, 160, 40);
        setOpacity(1.0);
        doc.text(stat.val, bx + bw / 2, by + 14, { align: 'center' });
        
        // Text 2: Label
        doc.setFont("Helvetica-Bold", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(230, 160, 40);
        doc.text(stat.lbl, bx + bw / 2, by + 23, { align: 'center' });
      });
    }
    
    curY += momHeight + 11; // Gap = 11pt

    // ==========================================
    // CARD 4: TEAM A INNINGS (Accent: [99, 118, 255])
    // ==========================================
    const activeBowlersA = m.firstInnings.bowlers.filter(bw => bw.oversBowled > 0);
    const height4 = 14 + 22 + 22 + 17 + (m.firstInnings.batsmen.length * 21) + 21 + 6 + 22 + 17 + (activeBowlersA.length * 21) + 14;
    
    // Draw Glass Card
    drawGlassCard(margin, curY, contentWidth, height4, [99, 118, 255]);
    
    let innerY = curY + 14; // Start at top padding Y
    
    // 1. Innings Header Area (Innings Label + Team Name + Score Badge)
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(7);
    doc.setTextColor(99, 118, 255);
    doc.text("1ST INNINGS", margin + 18, innerY + 5);
    
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(15);
    doc.setTextColor(20, 22, 40);
    doc.text(m.teamA.name.toUpperCase(), margin + 18, innerY + 17);
    
    // Score Badge Pill (right aligned)
    const scoreStrTeamA = `${m.firstInnings.runs}/${m.firstInnings.wickets}  (${(m.firstInnings.ballsBowled / m.settings.ballsPerOver).toFixed(1)})`;
    const scorePillW = doc.getTextWidth(scoreStrTeamA) + 18;
    drawPill(scoreStrTeamA, margin + contentWidth - 18 - scorePillW, innerY + 4, [99, 118, 255], 8.5, true);
    
    innerY += 22; // increment header
    
    // 2. Batting Sub-badge
    drawPill("BATTING", margin + 18, innerY + 2.5, [99, 118, 255], 6.5, true);
    innerY += 22; // increment batting label
    
    // 3. Table Headers
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(99, 118, 255);
    setOpacity(0.85);
    doc.text("BATTER", margin + 18, innerY + 12);
    doc.text("DISMISSAL", margin + 145, innerY + 12);
    doc.text("R", margin + 340, innerY + 12, { align: 'right' });
    doc.text("B", margin + 380, innerY + 12, { align: 'right' });
    doc.text("4s", margin + 420, innerY + 12, { align: 'right' });
    doc.text("6s", margin + 460, innerY + 12, { align: 'right' });
    doc.text("SR", margin + contentWidth - 18, innerY + 12, { align: 'right' });
    setOpacity(1.0);
    
    innerY += 17; // increment table header
    
    // 4. Render Batting rows
    m.firstInnings.batsmen.forEach((b, idx) => {
      // Alternating rows zebra pattern background
      if (idx % 2 === 0) {
        doc.setFillColor(180, 185, 200);
        setOpacity(0.05);
        doc.roundedRect(margin + 10, innerY, contentWidth - 20, 21, 4, 4, 'F');
        setOpacity(1.0);
      }
      
      // Batter Name
      doc.setFont("Helvetica-Bold", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(20, 22, 40);
      doc.text(b.name, margin + 18, innerY + 13.5);
      
      // Dismissal Pill
      const disText = getDismissalText(b, m.firstInnings.bowlers);
      drawDismissalPill(doc, disText, margin + 145, innerY + 5.5, 95, 10);
      
      // Values
      doc.setFont("Helvetica-Bold", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(20, 22, 40);
      doc.text(b.runsScored.toString(), margin + 340, innerY + 13.5, { align: 'right' });
      
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(80, 88, 112);
      doc.text(b.ballsFaced.toString(), margin + 380, innerY + 13.5, { align: 'right' });
      doc.text(b.fours.toString(), margin + 420, innerY + 13.5, { align: 'right' });
      
      // Gold highlight for 6s > 0
      if (b.sixes > 0) {
        doc.setFont("Helvetica-Bold", "normal");
        doc.setTextColor(230, 160, 40); // gold
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(20, 22, 40);
      }
      doc.text(b.sixes.toString(), margin + 460, innerY + 13.5, { align: 'right' });
      
      // SR formatting
      const srVal = b.ballsFaced > 0 ? (b.runsScored / b.ballsFaced) * 100 : 0;
      const srStr = srVal.toFixed(1);
      if (srVal > 150) {
        doc.setFont("Helvetica-Bold", "normal");
        doc.setTextColor(99, 118, 255); // accent color
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(80, 88, 112);
      }
      doc.text(srStr, margin + contentWidth - 18, innerY + 13.5, { align: 'right' });
      
      innerY += 21;
    });
    
    // 5. Total Row
    doc.setFillColor(99, 118, 255);
    setOpacity(0.08);
    doc.roundedRect(margin + 10, innerY, contentWidth - 20, 21, 4, 4, 'F');
    setOpacity(1.0);
    
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(20, 22, 40);
    doc.text("TOTAL", margin + 18, innerY + 13.5);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 88, 112);
    const oversTextA = `overs: ${(m.firstInnings.ballsBowled / m.settings.ballsPerOver).toFixed(1)} / ${m.settings.oversPerMatch}`;
    doc.text(oversTextA, margin + 65, innerY + 13);
    
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 22, 40);
    const totScoreStrA = `${m.firstInnings.runs}/${m.firstInnings.wickets}`;
    doc.text(totScoreStrA, margin + contentWidth - 18, innerY + 14, { align: 'right' });
    
    innerY += 21 + 6; // increment total row + offset
    
    // 6. Bowling Section Header Label
    drawPill("BOWLING", margin + 18, innerY + 2.5, [99, 118, 255], 6.5, true);
    innerY += 22;
    
    // 7. Bowling Table Headers
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(99, 118, 255);
    setOpacity(0.85);
    doc.text("BOWLER", margin + 18, innerY + 12);
    doc.text("O", margin + 340, innerY + 12, { align: 'right' });
    doc.text("R", margin + 380, innerY + 12, { align: 'right' });
    doc.text("W", margin + 420, innerY + 12, { align: 'right' });
    doc.text("MDNS", margin + 460, innerY + 12, { align: 'right' });
    doc.text("ECON", margin + contentWidth - 18, innerY + 12, { align: 'right' });
    setOpacity(1.0);
    
    innerY += 17;
    
    // 8. Render Bowling rows
    activeBowlersA.forEach((bw, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(180, 185, 200);
        setOpacity(0.05);
        doc.roundedRect(margin + 10, innerY, contentWidth - 20, 21, 4, 4, 'F');
        setOpacity(1.0);
      }
      
      // Bowler Name
      doc.setFont("Helvetica-Bold", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(20, 22, 40);
      doc.text(bw.name, margin + 18, innerY + 13.5);
      
      // Standard metrics
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(80, 88, 112);
      doc.text(bw.oversBowled.toFixed(1), margin + 340, innerY + 13.5, { align: 'right' });
      doc.text(bw.runsConceded.toString(), margin + 380, innerY + 13.5, { align: 'right' });
      
      // Wickets highlighted in accent color if > 0
      if (bw.wickets > 0) {
        doc.setFont("Helvetica-Bold", "normal");
        doc.setTextColor(99, 118, 255); // blue accent
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(80, 88, 112);
      }
      doc.text(bw.wickets.toString(), margin + 420, innerY + 13.5, { align: 'right' });
      
      // Maidens
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(80, 88, 112);
      doc.text(bw.maidens.toString(), margin + 460, innerY + 13.5, { align: 'right' });
      
      // Economy highlighted green if < 8
      const econVal = bw.oversBowled > 0 ? (bw.runsConceded / bw.oversBowled) : 0;
      const econStr = econVal.toFixed(1);
      if (econVal < 8) {
        doc.setFont("Helvetica-Bold", "normal");
        doc.setTextColor(40, 190, 120); // clean green
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(80, 88, 112);
      }
      doc.text(econStr, margin + contentWidth - 18, innerY + 13.5, { align: 'right' });
      
      innerY += 21;
    });
    
    // Draw Footer on Page 1 before wrapping
    drawFooter(doc, 1, 2);
    
    curY += height4 + 11;

    // ==========================================
    // CARD 5: TEAM B INNINGS (Accent: [255, 85, 100])
    // ==========================================
    const listBattersB = m.secondInnings ? m.secondInnings.batsmen : [];
    const activeBowlersB = m.secondInnings ? m.secondInnings.bowlers.filter(bw => bw.oversBowled > 0) : [];
    
    const height5 = 14 + 22 + 22 + 17 + (listBattersB.length * 21) + 21 + 6 + 22 + 17 + (activeBowlersB.length * 21) + 14;
    
    // Always calculate height and break page if it doesn't fit on Page 1
    if (curY + height5 > pageHeight - margin - 30) {
      doc.addPage();
      currentPage = 2;
      drawPageBackground();
      curY = 24; // reset Y to top padding
    }
    
    // Draw Glass Card 5 - Accent: Red [255, 85, 100]
    drawGlassCard(margin, curY, contentWidth, height5, [255, 85, 100]);
    
    let innerY5 = curY + 14;
    
    // 1. Innings Header Area (2ND INNINGS label + Team Name + Score Badge)
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(7);
    doc.setTextColor(255, 85, 100);
    doc.text("2ND INNINGS", margin + 18, innerY5 + 5);
    
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(15);
    doc.setTextColor(20, 22, 40);
    doc.text(m.teamB.name.toUpperCase(), margin + 18, innerY5 + 17);
    
    // Score Badge Pill (right aligned)
    const runsValB = m.secondInnings ? m.secondInnings.runs : 0;
    const wicketsValB = m.secondInnings ? m.secondInnings.wickets : 0;
    const oversValB = m.secondInnings ? (m.secondInnings.ballsBowled / m.settings.ballsPerOver).toFixed(1) : "0.0";
    const scoreStrTeamB = `${runsValB}/${wicketsValB}  (${oversValB})`;
    const scorePillW5 = doc.getTextWidth(scoreStrTeamB) + 18;
    drawPill(scoreStrTeamB, margin + contentWidth - 18 - scorePillW5, innerY5 + 4, [255, 85, 100], 8.5, true);
    
    innerY5 += 22;
    
    // 2. Batting Sub-badge
    drawPill("BATTING", margin + 18, innerY5 + 2.5, [255, 85, 100], 6.5, true);
    innerY5 += 22;
    
    // 3. Table Headers
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(255, 85, 100);
    setOpacity(0.85);
    doc.text("BATTER", margin + 18, innerY5 + 12);
    doc.text("DISMISSAL", margin + 145, innerY5 + 12);
    doc.text("R", margin + 340, innerY5 + 12, { align: 'right' });
    doc.text("B", margin + 380, innerY5 + 12, { align: 'right' });
    doc.text("4s", margin + 420, innerY5 + 12, { align: 'right' });
    doc.text("6s", margin + 460, innerY5 + 12, { align: 'right' });
    doc.text("SR", margin + contentWidth - 18, innerY5 + 12, { align: 'right' });
    setOpacity(1.0);
    
    innerY5 += 17;
    
    // 4. Render Batting rows for Team B
    listBattersB.forEach((b, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(180, 185, 200);
        setOpacity(0.05);
        doc.roundedRect(margin + 10, innerY5, contentWidth - 20, 21, 4, 4, 'F');
        setOpacity(1.0);
      }
      
      // Batter Name
      doc.setFont("Helvetica-Bold", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(20, 22, 40);
      doc.text(b.name, margin + 18, innerY5 + 13.5);
      
      // Dismissal Pill
      const disText = getDismissalText(b, m.secondInnings ? m.secondInnings.bowlers : []);
      drawDismissalPill(doc, disText, margin + 145, innerY5 + 5.5, 95, 10);
      
      // Values
      doc.setFont("Helvetica-Bold", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(20, 22, 40);
      doc.text(b.runsScored.toString(), margin + 340, innerY5 + 13.5, { align: 'right' });
      
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(80, 88, 112);
      doc.text(b.ballsFaced.toString(), margin + 380, innerY5 + 13.5, { align: 'right' });
      doc.text(b.fours.toString(), margin + 420, innerY5 + 13.5, { align: 'right' });
      
      // Gold highlight for 6s > 0
      if (b.sixes > 0) {
        doc.setFont("Helvetica-Bold", "normal");
        doc.setTextColor(230, 160, 40); // gold
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(20, 22, 40);
      }
      doc.text(b.sixes.toString(), margin + 460, innerY5 + 13.5, { align: 'right' });
      
      // SR formatting
      const srVal = b.ballsFaced > 0 ? (b.runsScored / b.ballsFaced) * 100 : 0;
      const srStr = srVal.toFixed(1);
      if (srVal > 150) {
        doc.setFont("Helvetica-Bold", "normal");
        doc.setTextColor(255, 85, 100); // 2nd Innings accent color
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(80, 88, 112);
      }
      doc.text(srStr, margin + contentWidth - 18, innerY5 + 13.5, { align: 'right' });
      
      innerY5 += 21;
    });
    
    // 5. Total Row Team B
    doc.setFillColor(255, 85, 100);
    setOpacity(0.08);
    doc.roundedRect(margin + 10, innerY5, contentWidth - 20, 21, 4, 4, 'F');
    setOpacity(1.0);
    
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(20, 22, 40);
    doc.text("TOTAL", margin + 18, innerY5 + 13.5);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 88, 112);
    const oversTextBStr = `overs: ${oversValB} / ${m.settings.oversPerMatch}`;
    doc.text(oversTextBStr, margin + 65, innerY5 + 13);
    
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(20, 22, 40);
    const totScoreStrB = `${runsValB}/${wicketsValB}`;
    doc.text(totScoreStrB, margin + contentWidth - 18, innerY5 + 14, { align: 'right' });
    
    innerY5 += 21 + 6;
    
    // 6. Bowling Section Header Label
    drawPill("BOWLING", margin + 18, innerY5 + 2.5, [255, 85, 100], 6.5, true);
    innerY5 += 22;
    
    // 7. Bowling Table Headers
    doc.setFont("Helvetica-Bold", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(255, 85, 100);
    setOpacity(0.85);
    doc.text("BOWLER", margin + 18, innerY5 + 12);
    doc.text("O", margin + 340, innerY5 + 12, { align: 'right' });
    doc.text("R", margin + 380, innerY5 + 12, { align: 'right' });
    doc.text("W", margin + 420, innerY5 + 12, { align: 'right' });
    doc.text("MDNS", margin + 460, innerY5 + 12, { align: 'right' });
    doc.text("ECON", margin + contentWidth - 18, innerY5 + 12, { align: 'right' });
    setOpacity(1.0);
    
    innerY5 += 17;
    
    // 8. Render Bowling rows for Team B
    activeBowlersB.forEach((bw, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(180, 185, 200);
        setOpacity(0.05);
        doc.roundedRect(margin + 10, innerY5, contentWidth - 20, 21, 4, 4, 'F');
        setOpacity(1.0);
      }
      
      // Bowler Name
      doc.setFont("Helvetica-Bold", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(20, 22, 40);
      doc.text(bw.name, margin + 18, innerY5 + 13.5);
      
      // Standard metrics
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(80, 88, 112);
      doc.text(bw.oversBowled.toFixed(1), margin + 340, innerY5 + 13.5, { align: 'right' });
      doc.text(bw.runsConceded.toString(), margin + 380, innerY5 + 13.5, { align: 'right' });
      
      // Wickets highlighted in accent color if > 0
      if (bw.wickets > 0) {
        doc.setFont("Helvetica-Bold", "normal");
        doc.setTextColor(255, 85, 100); // red accent
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(80, 88, 112);
      }
      doc.text(bw.wickets.toString(), margin + 420, innerY5 + 13.5, { align: 'right' });
      
      // Maidens
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(80, 88, 112);
      doc.text(bw.maidens.toString(), margin + 460, innerY5 + 13.5, { align: 'right' });
      
      // Economy highlighted green if < 8
      const econVal = bw.oversBowled > 0 ? (bw.runsConceded / bw.oversBowled) : 0;
      const econStr = econVal.toFixed(1);
      if (econVal < 8) {
        doc.setFont("Helvetica-Bold", "normal");
        doc.setTextColor(40, 190, 120); // green
      } else {
        doc.setFont("Helvetica", "normal");
        doc.setTextColor(80, 88, 112);
      }
      doc.text(econStr, margin + contentWidth - 18, innerY5 + 13.5, { align: 'right' });
      
      innerY5 += 21;
    });
    
    // Draw Footer on Page 2
    drawFooter(doc, currentPage, 2);

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
