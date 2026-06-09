import React, { useState } from 'react';
import { Match, Player, Ball, Over, Inning } from '../types';
import { generateCommentary, speakText } from '../utils/commentary';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CornerUpLeft, 
  RotateCw, 
  User, 
  Smartphone, 
  AlertTriangle,
  X,
  Award,
  ChevronRight,
  TrendingUp,
  Volume2,
  VolumeX,
  BarChart2
} from 'lucide-react';

interface ScoreboardProps {
  match: Match;
  onUpdateMatch: (updated: Match) => void;
  onGoToHistory: () => void;
  onResetMatch: () => void;
}

export default function Scoreboard({ match, onUpdateMatch, onGoToHistory, onResetMatch }: ScoreboardProps) {
  // Local modal states
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [showBowlerSelect, setShowBowlerSelect] = useState(false);
  const [showBatterSelect, setShowBatterSelect] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTieDeciderModal, setShowTieDeciderModal] = useState(false);
  const [completedMatchState, setCompletedMatchState] = useState<Match | null>(null);
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [statsActiveTab, setStatsActiveTab] = useState<'batting' | 'bowling'>('batting');
  const [showLastManPrompt, setShowLastManPrompt] = useState(false);
  const [pendingLmsMatch, setPendingLmsMatch] = useState<Match | null>(null);
  
  // Wicket selection temporary parameters
  const [wicketType, setWicketType] = useState<Player['howOut']>('bowled');
  const [wicketFielder, setWicketFielder] = useState('');

  // Selection states for new striker/bowler
  const [newBowlerId, setNewBowlerId] = useState('');
  const [newBatterId, setNewBatterId] = useState('');
  const [newBatterStrike, setNewBatterStrike] = useState<'on_strike' | 'non_strike'>('on_strike');
  const [selectedStrikerId, setSelectedStrikerId] = useState('');
  const [selectedNonStrikerId, setSelectedNonStrikerId] = useState('');
  const [selectedOpeningBowlerId, setSelectedOpeningBowlerId] = useState('');

  // Active inning shorthand
  const isInnings2 = match.status === 'second_innings';
  const inning = isInnings2 && match.secondInnings ? match.secondInnings : match.firstInnings;

  const battingTeam = inning.battingTeamId === 'team_a' ? match.teamA : match.teamB;
  const bowlingTeam = inning.battingTeamId === 'team_a' ? match.teamB : match.teamA;

  // Active players
  const striker = inning.batsmen.find(b => b.id === inning.tempBatter1Id);
  const nonStriker = inning.batsmen.find(b => b.id === inning.tempBatter2Id);
  const activeBowler = inning.bowlers.find(b => b.id === inning.tempBowlerId);

  // Vibration feedback
  const triggerVibrate = (pattern: number | number[]) => {
    try {
      if (match.settings.vibrationFeedback && typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      console.warn("Vibration feedback is blocked or failed:", e);
    }
  };

  // Voice commentary speak trigger
  const triggerAudio = (phrase: string) => {
    try {
      if (match.settings.voiceCommentary) {
        speakText(phrase);
      }
    } catch (e) {
      console.warn("Audio feedback is blocked or failed:", e);
    }
  };

  const showAlert = (message: string) => {
    setAlertMessage(message);
  };

  // Current over parameters
  const totalOvers = match.settings.oversPerMatch;
  const ballsPerOver = match.settings.ballsPerOver;

  // Last over balls log
  const currentOverObj = inning.overs[inning.overs.length - 1];
  const currentOverBalls = currentOverObj ? currentOverObj.balls : [];

  // Match Target computations (Inning 2)
  const target = isInnings2 && match.firstInnings ? match.firstInnings.runs + 1 : 0;
  const remainingTarget = target ? target - inning.runs : 0;
  const ballsRemaining = target ? (totalOvers * ballsPerOver) - inning.ballsBowled : 0;

  // Free hit status (Is free hit active?)
  const isFreeHit = currentOverBalls.length > 0 && 
                      currentOverBalls[currentOverBalls.length - 1].extraType === 'noball' && 
                      match.settings.freeHitOnNoBall;

  // Switch batting roles manually (Rotate Strike)
  const handleRotateStrike = () => {
    if (match.settings.playersPerTeam === 1 || !inning.tempBatter2Id) {
      showAlert("Strike rotation is disabled when batting alone!");
      return;
    }
    triggerVibrate(30);
    const updatedInning = { ...inning };
    const temp = updatedInning.tempBatter1Id;
    updatedInning.tempBatter1Id = updatedInning.tempBatter2Id;
    updatedInning.tempBatter2Id = temp;

    const updatedMatch: Match = {
      ...match,
      [isInnings2 ? 'secondInnings' : 'firstInnings']: updatedInning
    };
    onUpdateMatch(updatedMatch);
  };

  // Confirm the selected opening batsmen pair and first bowler
  const confirmOpeningLineup = () => {
    if (!selectedStrikerId || !selectedNonStrikerId || !selectedOpeningBowlerId || selectedStrikerId === selectedNonStrikerId) {
      showAlert("Please select distinct players for striker and non-striker, and choose an opening bowler.");
      return;
    }

    const updatedMatch = JSON.parse(JSON.stringify(match)) as Match;
    const workingInning = isInnings2 && updatedMatch.secondInnings ? updatedMatch.secondInnings : updatedMatch.firstInnings;

    workingInning.tempBatter1Id = selectedStrikerId;
    workingInning.tempBatter2Id = selectedNonStrikerId;
    workingInning.tempBowlerId = selectedOpeningBowlerId;
    workingInning.openingLineupConfirmed = true;

    // Align first over bowler correctly
    if (workingInning.overs.length > 0) {
      workingInning.overs[0].bowlerId = selectedOpeningBowlerId;
    }

    const chosenStriker = workingInning.batsmen.find(b => b.id === selectedStrikerId);
    const chosenNonStriker = workingInning.batsmen.find(b => b.id === selectedNonStrikerId);
    const chosenBowler = workingInning.bowlers.find(b => b.id === selectedOpeningBowlerId);
    if (chosenStriker && chosenNonStriker && chosenBowler) {
      triggerAudio(`${chosenStriker.name} is on strike, ${chosenNonStriker.name} is at the non-striker's end. ${chosenBowler.name} will open the bowling.`);
    }

    onUpdateMatch(updatedMatch);
  };

  // Scoring Core function
  const recordOutcome = (params: {
    runs: number;
    extras: number;
    extraType?: 'wide' | 'noball' | 'bye' | 'legbye';
    isWicket: boolean;
    wType?: Player['howOut'];
    fielderName?: string;
  }) => {
    triggerVibrate(params.isWicket ? [300, 100, 150] : 40);

    if (!striker || !activeBowler) {
      showAlert("Please ensure both a striker and a bowler are selected.");
      return;
    }

    const updatedMatch = JSON.parse(JSON.stringify(match)) as Match;
    const workingInning = isInnings2 && updatedMatch.secondInnings ? updatedMatch.secondInnings : updatedMatch.firstInnings;

    // Fetch active references from cloned configuration
    const mainStriker = workingInning.batsmen.find(b => b.id === workingInning.tempBatter1Id)!;
    const mainBowler = workingInning.bowlers.find(b => b.id === workingInning.tempBowlerId)!;

    // Retrieve active over object
    const overIndex = workingInning.overs.length - 1;
    let overObj = workingInning.overs[overIndex];
    if (!overObj) {
      overObj = { overNumber: 0, bowlerId: mainBowler.id, balls: [] };
      workingInning.overs.push(overObj);
    }

    const isValidBall = params.extraType !== 'wide' && params.extraType !== 'noball';

    // 1. Update batter scores
    const batRuns = (params.extraType === 'wide' || params.extraType === 'noball') ? 0 : params.runs;
    mainStriker.runsScored += batRuns;
    if (isValidBall || params.extraType === 'noball') {
      mainStriker.ballsFaced += 1;
    }
    if (batRuns === 4) mainStriker.fours += 1;
    if (batRuns === 6) mainStriker.sixes += 1;

    // 2. Update Bowler statistics
    if (isValidBall) {
      mainBowler.oversBowled = Number((((mainBowler.oversBowled * 10) + 1) / 10).toFixed(1));
      const fractionalPart = Math.round((mainBowler.oversBowled % 1) * 10);
      if (fractionalPart >= ballsPerOver) {
        mainBowler.oversBowled = Math.floor(mainBowler.oversBowled) + 1;
      }
    }

    let runsConcededThisBall = batRuns + (params.extraType === 'wide' || params.extraType === 'noball' ? params.extras : 0);
    if (params.extraType === 'bye' || params.extraType === 'legbye') {
      runsConcededThisBall = 0; // Byes & Legbyes don't count against bowler runs
    }
    mainBowler.runsConceded += runsConcededThisBall;
    if (params.extraType === 'wide') mainBowler.wides += 1;
    if (params.extraType === 'noball') mainBowler.noballs += 1;

    // 3. Update total Innings statistics
    workingInning.runs += batRuns + params.extras;
    if (isValidBall) {
      workingInning.ballsBowled += 1;
    }

    // 4. Construct ball ledger log
    const ballId = `ball_${Date.now()}`;
    const overBallNumStr = `${workingInning.overs.length - 1}.${overObj.balls.length + 1}`;
    
    const comm = generateCommentary(
      `Over ${overBallNumStr}`,
      mainStriker.name,
      batRuns,
      params.isWicket,
      params.wType,
      params.extraType,
      params.extras
    );

    const ball: Ball = {
      ballId,
      batterId: mainStriker.id,
      bowlerId: mainBowler.id,
      runs: batRuns,
      extras: params.extras,
      extraType: params.extraType,
      isWicket: params.isWicket,
      wicketType: params.wType,
      wicketPlayerId: params.isWicket ? mainStriker.id : undefined,
      fielderId: params.fielderName,
      isFreeHit: isFreeHit,
      commentaryText: comm.text
    };

    overObj.balls.push(ball);

    // 5. Strike Rotations on run counts
    const runsBattedOrRun = batRuns > 0 ? batRuns : ((params.extraType === 'bye' || params.extraType === 'legbye') ? params.extras : 0);
    const isLMSActive = match.settings.playersPerTeam >= 2 && workingInning.tempBatter2Id === "";
    if (runsBattedOrRun % 2 === 1 && match.settings.playersPerTeam !== 1 && !isLMSActive) {
      const tempId = workingInning.tempBatter1Id;
      workingInning.tempBatter1Id = workingInning.tempBatter2Id;
      workingInning.tempBatter2Id = tempId;
    }

    // 6. Handle Wicket Down Dismissals
    if (params.isWicket) {
      workingInning.wickets += 1;
      mainStriker.isOut = true;
      mainStriker.howOut = params.wType;
      mainStriker.dismissedBy = mainBowler.id;
      if (params.fielderName) {
        mainStriker.helperPlayer = params.fielderName;
      }
      mainBowler.wickets += 1;

      const remainingBatsmen = workingInning.batsmen.filter(b => !b.isOut);

      if (match.settings.playersPerTeam === 1) {
        // Single Player Team
        triggerAudio(`${battingTeam.name} are all out for ${workingInning.runs} runs!`);
        handleEndInnings(updatedMatch);
        return;
      } else {
        // Multi Player Team (2 or more players)
        if (remainingBatsmen.length === 0) {
          triggerAudio(`${battingTeam.name} are all out for ${workingInning.runs} runs!`);
          handleEndInnings(updatedMatch);
          return;
        } else if (remainingBatsmen.length === 1) {
          // Exactly 1 batsman remains not out. Ask whether the team wishes to continue batting
          setPendingLmsMatch(updatedMatch);
          setShowLastManPrompt(true);
          onUpdateMatch(updatedMatch);
          return;
        } else {
          // More than 1 batsman left, select the next available batsman
          setShowBatterSelect(true);
        }
      }
    }

    // Play Voice Commentary Audio
    triggerAudio(comm.phrase);

    // 7. Check if innings complete
    const totalMaxBalls = totalOvers * ballsPerOver;
    if (workingInning.ballsBowled >= totalMaxBalls) {
      triggerAudio(`Innings limits reached!`);
      handleEndInnings(updatedMatch);
      return;
    }

    // 2nd innings cross check
    if (isInnings2 && workingInning.runs >= target) {
      handleEndInnings(updatedMatch);
      return;
    }

    // Over finish triggers
    const validBallsThisOverCount = overObj.balls.filter(b => b.extraType !== 'wide' && b.extraType !== 'noball').length;
    if (validBallsThisOverCount >= ballsPerOver) {
      triggerVibrate([100, 50, 100]);

      // Over finished. Automatic strike rotation
      if (match.settings.playersPerTeam !== 1 && !isLMSActive) {
        const t = workingInning.tempBatter1Id;
        workingInning.tempBatter1Id = workingInning.tempBatter2Id;
        workingInning.tempBatter2Id = t;
      }

      // Check maiden over
      const isMaiden = overObj.balls.every(b => b.runs === 0 && b.extras === 0);
      if (isMaiden) {
        mainBowler.maidens += 1;
        triggerAudio("Incredible! That was a maiden over!");
      }

      // Setup the next over and bowler
      if (match.settings.playersPerTeam === 1) {
        triggerAudio("Over complete! Same bowler continues.");
        workingInning.overs.push({
          overNumber: workingInning.overs.length,
          bowlerId: workingInning.tempBowlerId,
          balls: []
        });
      } else {
        triggerAudio("Over complete! Assign a different bowler.");
        workingInning.overs.push({
          overNumber: workingInning.overs.length,
          bowlerId: '',
          balls: []
        });
        setNewBowlerId('');
        setShowBowlerSelect(true);
      }
    }

    onUpdateMatch(updatedMatch);
  };

  // Undo Ball utility
  const handleUndo = () => {
    if (inning.overs.length === 1 && inning.overs[0].balls.length === 0) {
      showAlert("No deliveries recorded to undo!");
      return;
    }

    triggerVibrate(150);
    const updatedMatch = JSON.parse(JSON.stringify(match)) as Match;
    const workingInning = isInnings2 && updatedMatch.secondInnings ? updatedMatch.secondInnings : updatedMatch.firstInnings;

    let overIdx = workingInning.overs.length - 1;
    let overObj = workingInning.overs[overIdx];

    if (overObj.balls.length === 0 && overIdx > 0) {
      workingInning.overs.pop();
      overIdx--;
      overObj = workingInning.overs[overIdx];
    }

    if (overObj.balls.length === 0) {
      showAlert("No balls logged.");
      return;
    }

    const lastBall = overObj.balls.pop()!;
    const mainStriker = workingInning.batsmen.find(b => b.id === lastBall.batterId)!;
    const mainBowler = workingInning.bowlers.find(b => b.id === lastBall.bowlerId)!;

    const isValidBall = lastBall.extraType !== 'wide' && lastBall.extraType !== 'noball';

    // Reverse stats modifications
    mainStriker.runsScored -= lastBall.runs;
    if (isValidBall || lastBall.extraType === 'noball') {
      mainStriker.ballsFaced -= 1;
    }
    if (lastBall.runs === 4) mainStriker.fours -= 1;
    if (lastBall.runs === 6) mainStriker.sixes -= 1;

    // Reset Bowler
    if (isValidBall) {
      let overValue = mainBowler.oversBowled;
      let fractionalPart = Math.round((overValue % 1) * 10);
      if (fractionalPart === 0) {
        mainBowler.oversBowled = Math.floor(overValue) - 1 + ((ballsPerOver - 1) / 10);
      } else {
        mainBowler.oversBowled = Number((overValue - 0.1).toFixed(1));
      }
    }

    let runsConcededThisBall = lastBall.runs + (lastBall.extraType === 'wide' || lastBall.extraType === 'noball' ? lastBall.extras : 0);
    if (lastBall.extraType === 'bye' || lastBall.extraType === 'legbye') {
      runsConcededThisBall = 0;
    }
    mainBowler.runsConceded -= runsConcededThisBall;
    if (lastBall.extraType === 'wide') mainBowler.wides -= 1;
    if (lastBall.extraType === 'noball') mainBowler.noballs -= 1;

    // Overall innings runs
    workingInning.runs -= (lastBall.runs + lastBall.extras);
    if (isValidBall) workingInning.ballsBowled -= 1;

    // Strike rotation undo
    const runsBattedOrRun = lastBall.runs > 0 ? lastBall.runs : ((lastBall.extraType === 'bye' || lastBall.extraType === 'legbye') ? lastBall.extras : 0);
    if (runsBattedOrRun % 2 === 1) {
      const tempId = workingInning.tempBatter1Id;
      workingInning.tempBatter1Id = workingInning.tempBatter2Id;
      workingInning.tempBatter2Id = tempId;
    }

    if (lastBall.isWicket) {
      workingInning.wickets -= 1;
      mainStriker.isOut = false;
      mainStriker.howOut = undefined;
      mainStriker.dismissedBy = undefined;
      mainStriker.helperPlayer = undefined;
      mainBowler.wickets -= 1;
      workingInning.tempBatter1Id = lastBall.batterId;
    }

    triggerAudio("Last delivery reverted.");
    onUpdateMatch(updatedMatch);
  };

  const handleEndGameAsTie = () => {
    if (!completedMatchState) return;
    const finalTieMatch: Match = {
      ...completedMatchState,
      status: 'completed',
      winnerTeamId: 'tie',
      winMarginText: 'Match Tied! No separators.'
    };
    onUpdateMatch(finalTieMatch);
    setShowTieDeciderModal(false);
  };

  const handleStartSuperOver = () => {
    if (!completedMatchState) return;
    
    const superOverBattingTeamId = completedMatchState.secondInnings!.battingTeamId;
    const superOverBowlingTeamId = completedMatchState.firstInnings.battingTeamId;

    const batTeam = superOverBattingTeamId === 'team_a' ? completedMatchState.teamA : completedMatchState.teamB;
    const bowlTeam = superOverBowlingTeamId === 'team_a' ? completedMatchState.teamA : completedMatchState.teamB;

    const isSinglePlayer = completedMatchState.settings.playersPerTeam === 1;

    const superOverMatch: Match = {
      ...completedMatchState,
      status: 'first_innings',
      isSuperOver: true,
      superOverOriginalScore: completedMatchState.isSuperOver 
        ? completedMatchState.superOverOriginalScore 
        : completedMatchState.firstInnings.runs,
      settings: {
        ...completedMatchState.settings,
        oversPerMatch: 1
      },
      firstInnings: {
        battingTeamId: superOverBattingTeamId,
        bowlingTeamId: superOverBowlingTeamId,
        runs: 0,
        wickets: 0,
        ballsBowled: 0,
        overs: [
          {
            overNumber: 0,
            bowlerId: isSinglePlayer 
              ? (superOverBowlingTeamId === 'team_a' ? 'player_a_0' : 'player_b_0')
              : '',
            balls: []
          }
        ],
        batsmen: batTeam.players.map((pName, i) => ({
          id: superOverBattingTeamId === 'team_a' ? `player_a_${i}` : `player_b_${i}`,
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
        bowlers: bowlTeam.players.map((pName, i) => ({
          id: superOverBowlingTeamId === 'team_a' ? `player_a_${i}` : `player_b_${i}`,
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
        tempBatter1Id: isSinglePlayer 
          ? (superOverBattingTeamId === 'team_a' ? 'player_a_0' : 'player_b_0')
          : '',
        tempBatter2Id: '',
        tempBowlerId: isSinglePlayer 
          ? (superOverBowlingTeamId === 'team_a' ? 'player_a_0' : 'player_b_0')
          : '',
        openingLineupConfirmed: isSinglePlayer ? true : false
      }
    };
    delete superOverMatch.secondInnings;

    triggerAudio(`Super Over triggered! ${batTeam.name} will bat first.`);
    onUpdateMatch(superOverMatch);
    setShowTieDeciderModal(false);
  };

  const handleEndInnings = (updatedMatch: Match) => {
    const workingInning = isInnings2 && updatedMatch.secondInnings ? updatedMatch.secondInnings : updatedMatch.firstInnings;
    
    if (!isInnings2) {
      updatedMatch.status = 'innings_break';
      const secondBattingTeam = match.firstInnings.bowlingTeamId === 'team_a' ? match.teamA : match.teamB;
      const secondBowlingTeam = match.firstInnings.battingTeamId === 'team_a' ? match.teamA : match.teamB;

      const secondInning: Inning = {
        battingTeamId: secondBattingTeam.id,
        bowlingTeamId: secondBowlingTeam.id,
        runs: 0,
        wickets: 0,
        ballsBowled: 0,
        overs: [{ overNumber: 0, bowlerId: '', balls: [] }],
        batsmen: secondBattingTeam.players.map((pName, i) => ({
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
        bowlers: secondBowlingTeam.players.map((pName, i) => ({
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
        tempBatter1Id: match.settings.playersPerTeam > 1 ? '' : 'player_b_0',
        tempBatter2Id: '',
        tempBowlerId: match.settings.playersPerTeam > 1 ? '' : 'player_a_0',
        openingLineupConfirmed: match.settings.playersPerTeam > 1 ? false : true
      };

      updatedMatch.secondInnings = secondInning;

      if (match.settings.playersPerTeam === 1) {
        setIsTransitioning(true);
        setTimeout(() => {
          setIsTransitioning(false);
          onUpdateMatch(updatedMatch);
          triggerAudio(`First innings over! ${match.teamA.name} scored ${workingInning.runs}. Target is ${workingInning.runs + 1} runs.`);
        }, 2500);
      } else {
        onUpdateMatch(updatedMatch);
        triggerAudio(`First innings over! ${match.teamA.name} scored ${workingInning.runs}. Target is ${workingInning.runs + 1} runs.`);
      }
    } else {
      updatedMatch.status = 'completed';
      const firstInnsRuns = match.firstInnings.runs;
      const secondInnsRuns = workingInning.runs;

      if (secondInnsRuns > firstInnsRuns) {
        updatedMatch.winnerTeamId = workingInning.battingTeamId;
        const wicketsBase = match.settings.playersPerTeam === 1 ? 1 : match.settings.playersPerTeam - 1;
        const wktsRemaining = wicketsBase - workingInning.wickets;
        updatedMatch.winMarginText = `by ${wktsRemaining} ${wktsRemaining === 1 ? 'wicket' : 'wickets'}`;
        onUpdateMatch(updatedMatch);
        triggerAudio(`Match finished! ${workingInning.battingTeamId === 'team_a' ? match.teamA.name : match.teamB.name} won the match!`);
      } else if (secondInnsRuns < firstInnsRuns) {
        updatedMatch.winnerTeamId = match.firstInnings.battingTeamId;
        const runsDiff = firstInnsRuns - secondInnsRuns;
        updatedMatch.winMarginText = `by ${runsDiff} runs`;
        onUpdateMatch(updatedMatch);
        triggerAudio(`Match finished! ${match.firstInnings.battingTeamId === 'team_a' ? match.teamA.name : match.teamB.name} won the match!`);
      } else {
        // Tie match! Trigger custom decision modal selection popup
        setCompletedMatchState(updatedMatch);
        setShowTieDeciderModal(true);
        triggerAudio("The match has ended in a TIE! Choose whether to play a decider Super Over or end the game.");
      }
    }
  };

  const confirmBowlerSelection = () => {
    if (!newBowlerId) {
      showAlert("Please choose a bowler!");
      return;
    }
    const updatedMatch = JSON.parse(JSON.stringify(match)) as Match;
    const workingInning = isInnings2 && updatedMatch.secondInnings ? updatedMatch.secondInnings : updatedMatch.firstInnings;
    
    // Check consecutive bowler constraint in Multi Player Mode
    if (match.settings.playersPerTeam >= 2 && workingInning.overs.length >= 2) {
      const consecutiveBowlerId = workingInning.overs[workingInning.overs.length - 2].bowlerId;
      if (newBowlerId === consecutiveBowlerId) {
        showAlert("Proper bowling rotation required: The bowler who just completed an over cannot bowl the immediately following over!");
        return;
      }
    }
    
    // Check if bowlers actually has bowler matching newBowlerId
    const chosenBowlerName = workingInning.bowlers.find(b => b.id === newBowlerId)?.name || 'bowler';
    const overObj = workingInning.overs[workingInning.overs.length - 1];
    if (overObj) {
      overObj.bowlerId = newBowlerId;
    }
    workingInning.tempBowlerId = newBowlerId;

    onUpdateMatch(updatedMatch);
    setShowBowlerSelect(false);
    triggerAudio(`New bowler ${chosenBowlerName} is ready.`);
  };

  const confirmBatterSelection = () => {
    if (!newBatterId) {
      showAlert("Please choose a batter!");
      return;
    }
    const updatedMatch = JSON.parse(JSON.stringify(match)) as Match;
    const workingInning = isInnings2 && updatedMatch.secondInnings ? updatedMatch.secondInnings : updatedMatch.firstInnings;

    const chosenNewBatter = workingInning.batsmen.find(b => b.id === newBatterId);
    const stayingBatter = workingInning.batsmen.find(b => b.id === workingInning.tempBatter2Id);

    if (newBatterStrike === 'on_strike') {
      workingInning.tempBatter1Id = newBatterId;
      // tempBatter2Id remains as is (the staying batter)
      if (chosenNewBatter) {
        triggerAudio(`${chosenNewBatter.name} is taking strike. ${stayingBatter ? stayingBatter.name : ''} is at the non-striker end.`);
      }
    } else {
      const stayingId = workingInning.tempBatter2Id;
      workingInning.tempBatter1Id = stayingId;
      workingInning.tempBatter2Id = newBatterId;
      if (stayingBatter && chosenNewBatter) {
        triggerAudio(`${stayingBatter.name} remains on strike. ${chosenNewBatter.name} takes guard at the runner's end.`);
      }
    }

    onUpdateMatch(updatedMatch);
    setShowBatterSelect(false);
    setNewBatterId('');
  };

  const triggerWicketOutcome = () => {
    recordOutcome({
      runs: 0,
      extras: 0,
      isWicket: true,
      wType: wicketType,
      fielderName: (wicketType === 'caught' || wicketType === 'runout') ? wicketFielder : undefined
    });
    setShowWicketModal(false);
    setWicketFielder('');
  };

  const ballsToOversText = (totalBalls: number) => {
    const ov = Math.floor(totalBalls / ballsPerOver);
    const bls = totalBalls % ballsPerOver;
    return `${ov}.${bls}`;
  };

  const calcRunRate = (r: number, b: number) => {
    if (b === 0) return "0.00";
    const oversFraction = (Math.floor(b / ballsPerOver)) + ((b % ballsPerOver) / ballsPerOver);
    return (r / (oversFraction || 1)).toFixed(2);
  };

  // Real-time Win Probability Calculator
  const getWinProbability = () => {
    const totalWicketsAllowed = match.isSuperOver 
      ? (match.settings.playersPerTeam === 1 ? 1 : 2)
      : (match.settings.playersPerTeam === 1 ? 1 : match.settings.playersPerTeam - 1);

    const allBalls = inning.overs.flatMap(o => o.balls);
    const last6Balls = allBalls.slice(-6);
    const runsInLast6 = last6Balls.reduce((acc, b) => acc + b.runs + b.extras, 0);
    const boundariesLast6 = last6Balls.filter(b => b.runs === 4 || b.runs === 6).length;
    const wicketsLast6 = last6Balls.filter(b => b.isWicket).length;

    // Check consecutive dot balls (runs === 0 and extras === 0 and not wicket)
    let consecutiveDots = 0;
    for (let i = allBalls.length - 1; i >= 0; i--) {
      const b = allBalls[i];
      if (b.runs === 0 && b.extras === 0 && !b.isWicket) {
        consecutiveDots++;
      } else {
        break;
      }
    }

    if (!isInnings2) {
      // First innings rate-weight calculation
      const runs = inning.runs;
      const wickets = inning.wickets;
      const balls = inning.ballsBowled;
      
      if (balls === 0) return { batting: 50, bowling: 50 };
      
      const totalMatchBalls = totalOvers * ballsPerOver;
      const ballsRemainingFirstInns = Math.max(0, totalMatchBalls - balls);
      const oversFraction = balls / ballsPerOver;
      const crr = runs / (oversFraction || 1);
      
      // Compute projected score with momentum
      const weightOfCurrent = Math.min(1.0, balls / totalMatchBalls);
      const estimatedRrate = (crr * weightOfCurrent) + (7.5 * (1 - weightOfCurrent));
      const projectedFinalScore = runs + (estimatedRrate * (ballsRemainingFirstInns / ballsPerOver));
      
      // Adjust projection for wicket resource loss
      const wicketLossRatio = wickets / (totalWicketsAllowed || 1);
      const adjustedProjectedScore = projectedFinalScore * (1 - wicketLossRatio * 0.18);
      
      // Predicted win chance relative to an average target (7.5 runs/over)
      const standardBaseScore = totalOvers * 7.5;
      let winChance = 50 + (adjustedProjectedScore - standardBaseScore) * 1.6;
      
      // Apply momentum metrics
      if (runsInLast6 >= 12) winChance += 5;       // explosive scoring
      if (boundariesLast6 >= 2) winChance += 4;   // boundary streak
      if (wicketsLast6 > 0) winChance -= wicketsLast6 * 6; // recent wickets falls
      if (consecutiveDots >= 3) winChance -= 4;    // pressure from dots
      
      // Shock factor: Last ball was a wicket
      if (allBalls.length > 0 && allBalls[allBalls.length - 1].isWicket) {
        winChance -= 8;
      }

      // Constrain first innings to remain competitive (10-90)
      winChance = Math.min(90, Math.max(10, winChance));
      
      return {
        batting: Math.round(winChance),
        bowling: Math.round(100 - winChance)
      };
    } else {
      // Second innings chasing details
      const runs = inning.runs;
      const wickets = inning.wickets;
      const balls = inning.ballsBowled;
      const wicketsRemaining = totalWicketsAllowed - wickets;
      
      if (remainingTarget <= 0) {
        return { batting: 100, bowling: 0 };
      }
      if (wicketsRemaining <= 0 || (ballsRemaining <= 0 && remainingTarget > 0)) {
        return { batting: 0, bowling: 100 };
      }
      
      const rrr = ballsRemaining > 0 ? (remainingTarget / (ballsRemaining / ballsPerOver)) : 999;
      const wktFraction = wicketsRemaining / (totalWicketsAllowed || 1);
      
      // Chasing index balancing RRR pressure and wickets
      const rrrDiff = rrr - 7.5;
      const rrrPenalty = rrrDiff * 10.0; // steeper penalties for climbing required rate
      const wicketBonus = (wktFraction - 0.5) * 48.0;
      
      let winChance = 50 - rrrPenalty + wicketBonus;
      
      // Volatility at the Death (last 2 overs or 12 balls)
      const totalMatchBalls = totalOvers * ballsPerOver;
      const isDeathOvers = ballsRemaining <= Math.max(6, Math.min(12, totalMatchBalls * 0.3));
      
      if (isDeathOvers) {
        // Double down on required runs. At the death, wickets have amplified importance or penalty
        if (wicketsRemaining === 1) {
          // extreme pressure on the last pair
          winChance -= 15;
        }
        if (rrr > 14.0) {
          winChance -= 10;
        } else if (rrr < 6.0) {
          winChance += 15;
        }
      }
      
      // High-momentum events
      if (runsInLast6 >= 14) winChance += 10;       // massive boundary charge
      if (boundariesLast6 >= 2) winChance += 8;    // momentum to batting
      if (consecutiveDots >= 2) winChance -= (consecutiveDots * 4); // dots pressure
      if (wicketsLast6 > 0) winChance -= wicketsLast6 * 10; // multiple rapid dismissals
      
      // Instructive shock event: Last ball wicket, boundary or dot
      if (allBalls.length > 0) {
        const lastBall = allBalls[allBalls.length - 1];
        if (lastBall.isWicket) {
          winChance -= 18; // Massive swing on wicket fall
        } else if (lastBall.runs === 4 || lastBall.runs === 6) {
          winChance += 6; // Swing on boundary hit
        } else if (lastBall.runs === 0 && lastBall.extras === 0) {
          winChance -= 3; // Minor drop on dot ball
        }
      }

      // Wide boundary boundaries for realistic climax representation
      if (isDeathOvers && ballsRemaining <= 6) {
        // Last over is highly volatile
        winChance = Math.min(99, Math.max(1, winChance));
      } else {
        winChance = Math.min(96, Math.max(4, winChance));
      }
      
      return {
        batting: Math.round(winChance),
        bowling: Math.round(100 - winChance)
      };
    }
  };

  const getPlayerBattingStats = (playerName: string, teamId: 'team_a' | 'team_b') => {
    const isFirstInnsBatting = match.firstInnings.battingTeamId === teamId;
    if (isFirstInnsBatting) {
      const p = match.firstInnings.batsmen.find(b => b.name === playerName);
      if (p) {
        const isCurrentOnPitch = (match.status === 'first_innings' || match.status === 'second_innings') && 
          (match.firstInnings.tempBatter1Id === p.id || match.firstInnings.tempBatter2Id === p.id);
        const isStriker = match.status === 'first_innings' && match.firstInnings.tempBatter1Id === p.id;
        const isNonStriker = match.status === 'first_innings' && match.firstInnings.tempBatter2Id === p.id;
        return {
          hasBatted: p.runsScored > 0 || p.ballsFaced > 0 || p.isOut,
          runs: p.runsScored,
          balls: p.ballsFaced,
          fours: p.fours,
          sixes: p.sixes,
          isOut: p.isOut,
          howOut: p.howOut,
          dismissedBy: p.dismissedBy ? match.firstInnings.bowlers.find(b => b.id === p.dismissedBy)?.name : undefined,
          helperPlayer: p.helperPlayer,
          isCurrentOnPitch,
          isStriker,
          isNonStriker,
          statusText: p.isOut 
            ? `Out (${p.howOut}${p.helperPlayer ? ` / c ${p.helperPlayer}` : ''}${p.dismissedBy ? ` b. ${match.firstInnings.bowlers.find(bow => bow.id === p.dismissedBy)?.name || 'bowler'}` : ''})`
            : isCurrentOnPitch 
              ? (isStriker ? "Batting (Striker) 🏏" : "Batting (Non-Striker)")
              : "Yet to Bat"
        };
      }
    } else if (match.secondInnings && match.secondInnings.battingTeamId === teamId) {
      const p = match.secondInnings.batsmen.find(b => b.name === playerName);
      if (p) {
        const isCurrentOnPitch = (match.status === 'first_innings' || match.status === 'second_innings') && 
          (match.secondInnings.tempBatter1Id === p.id || match.secondInnings.tempBatter2Id === p.id);
        const isStriker = match.status === 'second_innings' && match.secondInnings.tempBatter1Id === p.id;
        const isNonStriker = match.status === 'second_innings' && match.secondInnings.tempBatter2Id === p.id;
        return {
          hasBatted: p.runsScored > 0 || p.ballsFaced > 0 || p.isOut,
          runs: p.runsScored,
          balls: p.ballsFaced,
          fours: p.fours,
          sixes: p.sixes,
          isOut: p.isOut,
          howOut: p.howOut,
          dismissedBy: p.dismissedBy ? match.secondInnings.bowlers.find(b => b.id === p.dismissedBy)?.name : undefined,
          helperPlayer: p.helperPlayer,
          isCurrentOnPitch,
          isStriker,
          isNonStriker,
          statusText: p.isOut 
            ? `Out (${p.howOut}${p.helperPlayer ? ` / c ${p.helperPlayer}` : ''}${p.dismissedBy ? ` b. ${match.secondInnings.bowlers.find(bow => bow.id === p.dismissedBy)?.name || 'bowler'}` : ''})`
            : isCurrentOnPitch 
              ? (isStriker ? "Batting (Striker) 🏏" : "Batting (Non-Striker)")
              : "Yet to Bat"
        };
      }
    }
    return {
      hasBatted: false,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      isCurrentOnPitch: false,
      isStriker: false,
      isNonStriker: false,
      statusText: "Yet to Bat"
    };
  };

  const getPlayerBowlingStats = (playerName: string, teamId: 'team_a' | 'team_b') => {
    const isFirstInnsBowling = match.firstInnings.bowlingTeamId === teamId;
    if (isFirstInnsBowling) {
      const p = match.firstInnings.bowlers.find(b => b.name === playerName);
      if (p) {
        const isCurrentActive = match.status === 'first_innings' && match.firstInnings.tempBowlerId === p.id;
        const totalBalls = Math.floor(p.oversBowled) * ballsPerOver + Math.round((p.oversBowled % 1) * 10);
        const oversFraction = totalBalls / ballsPerOver;
        const econ = oversFraction > 0 ? (p.runsConceded / oversFraction).toFixed(2) : "0.00";
        return {
          hasBowled: p.oversBowled > 0 || p.runsConceded > 0 || p.wickets > 0 || p.wides > 0 || p.noballs > 0,
          overs: p.oversBowled,
          runsConceded: p.runsConceded,
          wickets: p.wickets,
          wides: p.wides,
          noballs: p.noballs,
          isCurrentActive,
          econ,
          bestFiguresText: p.wickets > 0 || p.runsConceded > 0 ? `${p.wickets}/${p.runsConceded}` : "N/A"
        };
      }
    } else if (match.secondInnings && match.secondInnings.bowlingTeamId === teamId) {
      const p = match.secondInnings.bowlers.find(b => b.name === playerName);
      if (p) {
        const isCurrentActive = match.status === 'second_innings' && match.secondInnings.tempBowlerId === p.id;
        const totalBalls = Math.floor(p.oversBowled) * ballsPerOver + Math.round((p.oversBowled % 1) * 10);
        const oversFraction = totalBalls / ballsPerOver;
        const econ = oversFraction > 0 ? (p.runsConceded / oversFraction).toFixed(2) : "0.00";
        return {
          hasBowled: p.oversBowled > 0 || p.runsConceded > 0 || p.wickets > 0 || p.wides > 0 || p.noballs > 0,
          overs: p.oversBowled,
          runsConceded: p.runsConceded,
          wickets: p.wickets,
          wides: p.wides,
          noballs: p.noballs,
          isCurrentActive,
          econ,
          bestFiguresText: p.wickets > 0 || p.runsConceded > 0 ? `${p.wickets}/${p.runsConceded}` : "N/A"
        };
      }
    }
    return {
      hasBowled: false,
      overs: 0,
      runsConceded: 0,
      wickets: 0,
      wides: 0,
      noballs: 0,
      isCurrentActive: false,
      econ: "0.00",
      bestFiguresText: "N/A"
    };
  };

  const winProb = getWinProbability();
  const batTeamPct = winProb.batting;
  const bowlTeamPct = winProb.bowling;

  const needsOpeningLineupPrompt = match.settings.playersPerTeam > 1 && 
    inning.ballsBowled === 0 && 
    !inning.openingLineupConfirmed;

  if (needsOpeningLineupPrompt) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-8 animate-fade-in" id="opening-partnership-setup">
        <div className="glass-panel border border-white/10 rounded-3xl overflow-hidden p-6 text-center space-y-6 shadow-2xl relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-lime-400/5 blur-2xl pointer-events-none" />
          
          <div className="bg-lime-400/10 border border-lime-400/20 rounded-full h-14 w-14 flex items-center justify-center mx-auto text-lime-400">
            <User className="w-6 h-6 animate-pulse" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-lime-400 uppercase tracking-widest font-mono">Innings Opening Lineup</span>
            <h2 className="text-xl font-extrabold uppercase tracking-tight text-white leading-tight">Pick Opening Batter Pair</h2>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed">
              Before the batting innings for <span className="text-lime-400 font-semibold">{battingTeam.name}</span> begins, please select who will take strike first and who will stand at the non-striker's end.
            </p>
          </div>

          <div className="space-y-5 text-left">
            {/* Striker Select Buttons */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest font-mono">
                Who takes strike first? (Striker) 🏏
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {inning.batsmen.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setSelectedStrikerId(b.id);
                      if (selectedNonStrikerId === b.id) {
                        setSelectedNonStrikerId('');
                      }
                    }}
                    className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition cursor-pointer ${
                      selectedStrikerId === b.id
                        ? 'border-lime-400 bg-lime-400/15 text-lime-400'
                        : 'border-white/5 bg-black/40 hover:border-white/10 text-white/60'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Non-Striker Select Buttons */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest font-mono">
                Who stands at the non-striker's end? (Runner) 🏃
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {inning.batsmen
                  .filter(b => b.id !== selectedStrikerId)
                  .map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedNonStrikerId(b.id)}
                      className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition cursor-pointer ${
                        selectedNonStrikerId === b.id
                          ? 'border-lime-400 bg-lime-400/15 text-lime-400'
                          : 'border-white/5 bg-black/40 hover:border-white/10 text-white/60'
                      }`}
                    >
                      {b.name}
                    </button>
                  ))}
              </div>
            </div>

            {/* Opening Bowler Select Buttons */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest font-mono">
                Who bowls the opening over? (Bowler) 🥎
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {inning.bowlers.map((bw) => (
                  <button
                    key={bw.id}
                    type="button"
                    onClick={() => setSelectedOpeningBowlerId(bw.id)}
                    className={`p-3 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition cursor-pointer ${
                      selectedOpeningBowlerId === bw.id
                        ? 'border-lime-400 bg-lime-400/15 text-lime-400'
                        : 'border-white/5 bg-black/40 hover:border-white/10 text-white/60'
                    }`}
                  >
                    {bw.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={confirmOpeningLineup}
              disabled={!selectedStrikerId || !selectedNonStrikerId || !selectedOpeningBowlerId}
              className="w-full flex items-center justify-center gap-1.5 py-4 bg-lime-400 hover:bg-lime-500 disabled:opacity-30 text-zinc-950 font-extrabold uppercase tracking-widest text-xs rounded-xl transition duration-200 cursor-pointer shadow-lg"
              id="btn-confirm-opening-partnership"
            >
              Start Batting Innings
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-2 space-y-6" id="scoring-board-root">
      
      {/* Top Left Small Statistics glassmorphism icon button */}
      <div className="flex justify-between items-center px-1" id="scoreboard-top-stats-bar">
        <button
          type="button"
          onClick={() => {
            triggerVibrate(30);
            setShowStatsPanel(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white/[0.04] border border-white/10 hover:border-cyan-400/50 rounded-xl text-[10px] font-bold uppercase tracking-widest text-[#fafafa] hover:text-cyan-400 hover:bg-white/[0.08] transition-all font-mono shadow-md backdrop-blur-md cursor-pointer select-none"
          id="btn-live-statistics-trigger"
          title="Open Live Match Statistics"
        >
          <BarChart2 size={12} className="text-cyan-400 animate-pulse" />
          <span>Match Stats</span>
        </button>
      </div>
      
      {/* Dynamic Scorecard Premium Glass Card */}
      <div className="glass-panel rounded-3xl p-6 shadow-2xl relative overflow-hidden text-white space-y-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-lime-400/5 blur-3xl pointer-events-none animate-pulse" />
        
        {/* Card Header information */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-widest font-bold bg-lime-400/10 text-lime-400 px-2.5 py-1 rounded-full border border-lime-400/20 font-mono">
                {match.isSuperOver ? '⚡ Super Over Shootout' : (match.status === 'first_innings' ? 'First Innings' : 'Second Innings')}
              </span>
              {match.isSuperOver && (
                <span className="text-[9px] uppercase tracking-widest font-bold bg-red-500/15 text-red-400 px-2.5 py-1 rounded-full border border-red-500/35 font-mono animate-pulse">
                  TIE-BREAKER DECIDER
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight uppercase text-white mt-2" id="current-innings-display">
              {battingTeam.name} Batting
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-white/50 font-mono">
            <span className="uppercase font-bold text-zinc-400">DEFENDING: {bowlingTeam.name}</span>
            <span className="text-white/10">|</span>
            <div className="flex items-center gap-1.5 bg-lime-400/10 text-lime-400 px-3 py-1 rounded-full border border-lime-400/25 uppercase font-bold text-[9px] tracking-wider">
              <span className="h-2 w-2 rounded-full bg-lime-400 animate-ping"></span>
              <span>MOS Live Engaged</span>
            </div>
          </div>
        </div>

        {/* Live Numbers scoreboard dashboard layout */}
        <div className="py-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl md:text-6xl font-black text-white tracking-tighter font-mono" id="batting-runs-wickets">
                {inning.runs}/{inning.wickets}
              </span>
              <span className="text-white/40 font-mono text-sm uppercase">
                ({ballsToOversText(inning.ballsBowled)} / {totalOvers} Overs)
              </span>
            </div>
            
            {match.settings.isUneven && match.settings.commonPlayerName && (
              <p className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                <Smartphone size={10} />
                Uneven Match Balanced via player: <span className="font-bold underline">{match.settings.commonPlayerName}</span>
              </p>
            )}
          </div>

          {/* Core computations values */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-6 text-xs text-zinc-400">
            <div>
              <span className="text-white/30 text-[9px] block uppercase tracking-wider font-mono">Current Run Rate</span>
              <span className="font-mono text-lg font-bold text-white">{calcRunRate(inning.runs, inning.ballsBowled)}</span>
            </div>
            {target > 0 && (
              <>
                <div>
                  <span className="text-lime-400/85 text-[9px] block uppercase tracking-wider font-mono">Target Score</span>
                  <span className="font-mono text-lg font-bold text-white">{target} Runs</span>
                </div>
                <div>
                  <span className="text-[#a855f7] text-[9px] block uppercase tracking-wider font-mono">Required Rate</span>
                  <span className="font-mono text-lg font-bold text-[#e9d5ff]">
                    {ballsRemaining > 0 
                      ? ((remainingTarget / (ballsRemaining / ballsPerOver))).toFixed(2) 
                      : "--"
                    }
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Dynamic Target contextual guide in second innings */}
        {target > 0 && (
          <div className="bg-black/40 border border-white/5 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs font-mono gap-2">
            <span className="font-bold text-lime-400 uppercase tracking-wide flex items-center gap-1.5">
              <TrendingUp size={14} className="text-lime-400" />
              {remainingTarget <= 0 
                ? "Target crossed! Batting squad has completed the chase." 
                : `${battingTeam.name} needs ${remainingTarget} runs in ${ballsRemaining} balls`
              }
            </span>
            <span className="text-white/30 uppercase tracking-widest text-[9px]">
              {ballsRemaining > 0 ? `${(ballsRemaining / ballsPerOver).toFixed(1)} Overs Remain` : 'Final delivery pending'}
            </span>
          </div>
        )}

        {/* Premium Style Live Win Probability Indicator */}
        <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl space-y-3.5">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="font-black text-white/50 uppercase tracking-wider flex items-center gap-1.5 text-[9px]">
              <TrendingUp size={12} className="text-lime-400" />
              Live Win Probability Predictor (MOS Engine)
            </span>
            <span className="text-[10px] uppercase font-bold text-[#f4f4f5]">CRR adjusted</span>
          </div>

          {/* Glowing sliding probability percentage bar */}
          <div className="relative h-4 w-full bg-zinc-950 rounded-full overflow-hidden border border-white/5 flex">
            {/* Batting team percent */}
            <motion.div
              initial={{ width: '50%' }}
              animate={{ width: `${batTeamPct}%` }}
              transition={{ type: 'spring', damping: 20 }}
              className="h-full bg-gradient-to-r from-lime-400 to-emerald-500 relative flex items-center justify-start pl-2"
            >
              <div className="absolute inset-0 bg-white/15 mix-blend-overlay animate-pulse" />
            </motion.div>
            
            {/* Bowling team percent */}
            <motion.div
              initial={{ width: '50%' }}
              animate={{ width: `${bowlTeamPct}%` }}
              transition={{ type: 'spring', damping: 20 }}
              className="h-full bg-gradient-to-r from-zinc-800 to-zinc-950 relative flex items-center justify-end pr-2"
            />
          </div>

          {/* Custom labels showing dynamic statistics */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-lime-400" />
              <span className="font-bold text-white uppercase text-[10px]">{battingTeam.name}</span>
              <span className="text-lime-400 font-mono font-bold text-sm ml-1">{batTeamPct}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white uppercase text-[10px]">{bowlingTeam.name}</span>
              <span className="text-white/50 font-mono font-bold text-sm ml-1">{bowlTeamPct}%</span>
              <span className="h-2 w-2 rounded-full bg-white/20" />
            </div>
          </div>
        </div>

      </div>

      {/* Primary Clicker Score Controls Bento Box (Relocated Below Scorecard) */}
      <div className="glass-panel text-white rounded-3xl p-6 shadow-2xl space-y-6" id="primary-scoring-keypad">
        <div className="flex justify-between items-center border-b border-white/5 pb-3">
          <h3 className="font-extrabold text-white text-xs uppercase tracking-widest font-mono">Scoring Interface</h3>
          <button
            onClick={() => setShowUndoConfirm(true)}
            className="text-[10px] font-bold text-white/50 hover:text-red-400 hover:bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-1 transition-colors bg-black/20 cursor-pointer"
            id="btn-undo-ball"
          >
            <CornerUpLeft size={12} />
            Undo Delivery
          </button>
        </div>

        {/* Primary scoring keys */}
        <div className="grid grid-cols-6 gap-2">
          
          {/* Dot ball */}
          <button
            onClick={() => recordOutcome({ runs: 0, extras: 0, isWicket: false })}
            className="col-span-1 h-16 bg-black/40 hover:bg-white/[0.05] border border-white/5 text-white/70 font-extrabold text-sm rounded-xl transition flex flex-col justify-center items-center cursor-pointer active:scale-95 duration-100"
          >
            0
            <span className="text-[8px] font-bold font-mono text-white/30 mt-0.5 uppercase font-sans">Dot</span>
          </button>
          
          {/* 1 Run */}
          <button
            onClick={() => recordOutcome({ runs: 1, extras: 0, isWicket: false })}
            className="col-span-1 h-16 bg-black/40 hover:bg-white/[0.05] border border-white/5 text-white/90 font-extrabold text-sm rounded-xl transition flex flex-col justify-center items-center cursor-pointer active:scale-95 duration-100"
          >
            1
            <span className="text-[8px] font-bold font-mono text-white/30 mt-0.5 uppercase font-sans font-sans">Single</span>
          </button>

          {/* 2 Runs */}
          <button
            onClick={() => recordOutcome({ runs: 2, extras: 0, isWicket: false })}
            className="col-span-1 h-16 bg-black/40 hover:bg-white/[0.05] border border-white/5 text-white/95 font-extrabold text-sm rounded-xl transition flex flex-col justify-center items-center cursor-pointer active:scale-95 duration-100"
          >
            2
            <span className="text-[8px] font-bold font-mono text-white/30 mt-0.5 uppercase font-sans">Double</span>
          </button>

          {/* 3 Runs */}
          <button
            onClick={() => recordOutcome({ runs: 3, extras: 0, isWicket: false })}
            className="col-span-1 h-16 bg-black/40 hover:bg-white/[0.05] border border-white/5 text-white/95 font-extrabold text-sm rounded-xl transition flex flex-col justify-center items-center cursor-pointer active:scale-95 duration-100"
          >
            3
            <span className="text-[8px] font-bold font-mono text-white/30 mt-0.5 uppercase font-sans">Triple</span>
          </button>

          {/* 4 Runs Boundary */}
          <button
            onClick={() => recordOutcome({ runs: 4, extras: 0, isWicket: false })}
            className="col-span-1 h-16 bg-lime-400/[0.05] border-2 border-lime-400 text-lime-400 hover:bg-lime-400 hover:text-black font-black text-sm rounded-xl transition-all flex flex-col justify-center items-center scale-100 active:scale-95 duration-100 shadow-sm cursor-pointer"
          >
            4
            <span className="text-[8px] font-bold font-mono mt-0.5 uppercase font-sans">Four</span>
          </button>

          {/* 6 Runs Maximum */}
          <button
            onClick={() => recordOutcome({ runs: 6, extras: 0, isWicket: false })}
            className="col-span-1 h-16 bg-lime-400 hover:bg-lime-500 text-black font-black text-sm rounded-xl transition-all flex flex-col justify-center items-center scale-100 active:scale-95 duration-100 shadow-lg cursor-pointer"
          >
            6
            <span className="text-[8px] font-bold font-mono mt-0.5 uppercase font-sans text-black/70">Six</span>
          </button>
        </div>

        {/* Extras row layout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Wides */}
          <button
            onClick={() => recordOutcome({ runs: 0, extras: match.settings.widePenalty, extraType: 'wide', isWicket: false })}
            className="h-12 bg-black/30 hover:bg-white/[0.04] border border-white/5 text-white/80 font-bold font-mono text-[10px] rounded-lg transition-colors cursor-pointer uppercase tracking-wider font-sans"
          >
            Wide (+{match.settings.widePenalty})
          </button>

          {/* No Balls */}
          <button
            onClick={() => recordOutcome({ runs: 0, extras: match.settings.noBallPenalty, extraType: 'noball', isWicket: false })}
            className="h-12 bg-black/30 hover:bg-white/[0.04] border border-white/5 text-white/80 font-bold font-mono text-[10px] rounded-lg transition-colors cursor-pointer uppercase tracking-wider font-sans"
          >
            No Ball (+{match.settings.noBallPenalty})
          </button>

          {/* Byes */}
          <button
            onClick={() => recordOutcome({ runs: 0, extras: 1, extraType: 'bye', isWicket: false })}
            className="h-12 bg-black/30 hover:bg-white/[0.04] border border-white/5 text-white/80 font-bold font-mono text-[10px] rounded-lg transition-colors cursor-pointer uppercase tracking-wider font-sans"
          >
            Bye (+1)
          </button>

          {/* LegByes */}
          <button
            onClick={() => recordOutcome({ runs: 0, extras: 1, extraType: 'legbye', isWicket: false })}
            className="h-12 bg-black/30 hover:bg-white/[0.04] border border-white/5 text-white/80 font-bold font-mono text-[10px] rounded-lg transition-colors cursor-pointer uppercase tracking-wider font-sans"
          >
            Leg Bye (+1)
          </button>
        </div>

        {/* Dismissal key triggers */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowWicketModal(true)}
            className="flex-1 py-4 bg-red-650 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-99 flex items-center justify-center gap-2 cursor-pointer border border-red-550/30"
            id="btn-trigger-wicket"
          >
            <AlertTriangle size={15} />
            DISMISS / WICKET RED ALERT 🔴
          </button>
        </div>
      </div>

      {/* Crease section containing Active pitch hitters & bowler */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Hitters at Crease Card */}
        <div className="hidden-scroll md:col-span-7 bg-white/[0.03] border border-white/5 backdrop-blur-md rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <User size={14} className="text-lime-400" />
              Hitter Crease Status
            </h3>
            {match.settings.playersPerTeam !== 1 && (
              <button
                onClick={handleRotateStrike}
                className="text-[10px] font-bold text-lime-400 hover:text-lime-300 hover:bg-lime-400/10 px-3 py-1.5 rounded-lg border border-white/5 bg-black/40 flex items-center gap-1 transition-all uppercase tracking-wider cursor-pointer"
                title="Manual rotate strike tool"
              >
                <RotateCw size={11} />
                Rotate Strike
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Batter 1 (Striker) */}
            <div className={`p-4 rounded-xl border transition-all duration-300 ${striker ? 'bg-lime-400/[0.04] border-lime-400/20' : 'bg-black/30 border-white/5'}`}>
              {striker ? (
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-lime-400 animate-ping"></div>
                    <div>
                      <div className="font-bold text-white text-sm uppercase flex items-center gap-1">
                        {striker.name}
                        <span className="text-lime-400 text-xs font-bold font-mono">*</span>
                      </div>
                      <div className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Striker</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-white font-mono">{striker.runsScored}</span>
                    <span className="text-zinc-500 text-xs font-medium font-mono"> ({striker.ballsFaced})</span>
                    <div className="text-[10px] text-white/40 font-mono mt-0.5">4s: {striker.fours} | 6s: {striker.sixes}</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 text-xs font-bold font-mono text-amber-500 flex items-center justify-center gap-1 animate-pulse">
                  <AlertTriangle size={14} /> NO ACTIVE STRIKER. SELECT BATSMAN.
                </div>
              )}
            </div>

            {/* Batter 2 (Non-Striker) */}
            {match.settings.playersPerTeam !== 1 && (
              <div className={`p-4 rounded-xl border border-white/5 transition-all duration-300 ${nonStriker ? 'bg-black/30' : 'bg-black/10 border-dashed border-white/5'}`}>
                {nonStriker ? (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-650"></div>
                      <div>
                        <div className="font-bold text-zinc-300 text-sm uppercase">{nonStriker.name}</div>
                        <div className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Non-Striker</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-zinc-300 font-mono">{nonStriker.runsScored}</span>
                      <span className="text-zinc-500 text-xs font-medium font-mono"> ({nonStriker.ballsFaced})</span>
                      <div className="text-[10px] text-white/40 font-mono mt-0.5">4s: {nonStriker.fours} | 6s: {nonStriker.sixes}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2.5 text-xs font-mono text-white/30 italic">
                    Last warrior batting alone (Last Man Standing rules applied).
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Active Bowler Card */}
        <div className="md:col-span-12 lg:col-span-5 bg-white/[0.03] border border-white/5 backdrop-blur-md rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono">
              Active Pitch Bowler
            </h3>
            {match.settings.playersPerTeam !== 1 ? (
              <button
                onClick={() => {
                  setNewBowlerId('');
                  setShowBowlerSelect(true);
                }}
                className="text-[10px] font-bold uppercase tracking-wider text-lime-400 bg-black/40 border border-white/5 hover:bg-white/[0.05] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Change Bowler
              </button>
            ) : (
              <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-widest px-2 py-1 bg-amber-400/10 border border-amber-400/15 rounded-full">
                1-Player Restricted Lock
              </span>
            )}
          </div>

          <div className="p-4 bg-black/30 border border-white/5 rounded-xl relative overflow-hidden flex-1 flex flex-col justify-center min-h-[110px]">
            {activeBowler ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white text-base uppercase block tracking-wide">{activeBowler.name}</span>
                    <span className="block text-[10px] text-white/40 font-mono uppercase mt-1">Overs Bowled: {activeBowler.oversBowled}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-white font-mono">
                      {activeBowler.wickets} <span className="text-xs text-white/40 font-normal">W /</span> {activeBowler.runsConceded} <span className="text-xs text-white/40 font-normal">R</span>
                    </div>
                    <div className="text-[10px] text-white/40 font-mono mt-1">Mdn: {activeBowler.maidens} | Wides: {activeBowler.wides}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs font-bold font-mono text-amber-500 flex flex-col items-center justify-center gap-2 animate-pulse">
                <Smartphone className="text-amber-500 w-5 h-5" />
                <span>TAP CHANGE BOWLER TO INITIATE OPENING OVER</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ball-by-Ball over timeline matrix */}
      <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 shadow-2xl space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-white/50 uppercase tracking-widest font-mono text-[9px]">Current Over Matrix</span>
          <span className="text-white/40 font-mono text-[10px]">
            Overs Complete: {ballsToOversText(inning.ballsBowled)} / {totalOvers} Overs
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          {currentOverBalls.length === 0 ? (
            <span className="text-xs text-white/30 font-mono italic">Ready to bowl! Swipe or select scoring outcomes below to log score...</span>
          ) : (
            currentOverBalls.map((ball, i) => {
              let displayVal = ball.runs.toString();
              let color = "bg-black/40 border-white/5 text-white/90";

              if (ball.isWicket) {
                displayVal = ball.wicketType === 'hit_out_of_ground' ? "🏠 OUT" : "OUT";
                color = "bg-red-500/80 border-red-500 text-white font-extrabold scale-[1.05] shadow-lg shadow-red-500/10";
              } else if (ball.extraType === 'wide') {
                displayVal = `${ball.extras}Wd`;
                color = "bg-black/50 text-amber-400 border-amber-400/30 font-mono font-bold";
              } else if (ball.extraType === 'noball') {
                displayVal = `${ball.extras}Nb`;
                color = "bg-black/50 text-amber-400 border-amber-400/30 font-mono font-bold";
              } else if (ball.extraType === 'bye') {
                displayVal = `${ball.extras}By`;
                color = "bg-black/50 text-sky-400 border-sky-400/20 font-mono";
              } else if (ball.extraType === 'legbye') {
                displayVal = `${ball.extras}Lb`;
                color = "bg-black/50 text-sky-400 border-sky-400/20 font-mono";
              } else if (ball.runs === 6) {
                color = "bg-gradient-to-r from-lime-400 to-emerald-400 text-zinc-950 border-lime-400 font-extrabold scale-[1.08] shadow shadow-lime-400/20";
              } else if (ball.runs === 4) {
                color = "bg-black/60 border-lime-400/40 text-lime-400 font-bold scale-[1.04]";
              } else if (ball.runs === 0) {
                color = "bg-black/40 border-white/5 text-white/30 text-[10px]";
              }

              return (
                <div 
                  key={i} 
                  className={`h-9 min-w-9 px-2 rounded-lg border flex items-center justify-center text-xs font-mono transition-all duration-250 ${color}`}
                  title={ball.commentaryText}
                >
                  {displayVal}
                </div>
              );
            })
          )}

          {isFreeHit && (
            <div className="bg-red-500/15 text-red-400 border border-red-500/20 font-black text-[9px] px-3 py-1 rounded-full uppercase tracking-widest animate-pulse ml-auto" id="indicator-free-hit">
              🚀 Free Hit Active!
            </div>
          )}
        </div>

        {currentOverBalls.length > 0 && (
          <div className="text-xs bg-black/40 p-3.5 rounded-xl border border-white/5 text-white/50 font-mono italic max-h-16 overflow-y-auto">
            {currentOverBalls[currentOverBalls.length - 1].commentaryText}
          </div>
        )}
      </div>

      {/* Innings detailed Scorecard details */}
      <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4">
        <h4 className="font-bold text-white text-xs uppercase tracking-wider font-mono">Live Scorecard Breakdown</h4>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/5 text-white/40 font-mono tracking-widest uppercase text-[9px]">
                <th className="py-2.5">Batter Name</th>
                <th className="py-2.5 text-center">Status</th>
                <th className="py-2.5 text-center">Runs</th>
                <th className="py-2.5 text-center">Balls</th>
                <th className="py-2.5 text-center">4s</th>
                <th className="py-2.5 text-center">6s</th>
                <th className="py-2.5 text-center">S/R</th>
              </tr>
            </thead>
            <tbody>
              {inning.batsmen.map((b) => {
                const isCurrentStriking = b.id === inning.tempBatter1Id;
                const isCurrentOnPitch = b.id === inning.tempBatter1Id || b.id === inning.tempBatter2Id;
                const sr = b.ballsFaced > 0 ? ((b.runsScored / b.ballsFaced) * 100).toFixed(1) : "0.0";
                
                return (
                  <tr key={b.id} className={`border-b border-white/[0.02] ${isCurrentOnPitch ? 'bg-lime-400/[0.04] font-extrabold text-lime-400 shadow-inner' : 'text-zinc-400'}`}>
                    <td className="py-3 uppercase font-medium">
                      {b.name} 
                      {isCurrentStriking && <span className="text-lime-400 ml-1 font-bold font-mono">*</span>}
                    </td>
                    <td className="py-3 text-center">
                      {b.isOut ? (
                        <span className="text-red-400 font-bold uppercase text-[9px] bg-red-400/10 px-2 py-0.5 rounded border border-red-500/25">Out ({b.howOut})</span>
                      ) : isCurrentOnPitch ? (
                        <span className="text-lime-400 font-bold uppercase text-[9px] bg-lime-4d00/10 px-2 py-0.5 rounded border border-lime-400/25">Batting</span>
                      ) : (
                        <span className="text-white/20 uppercase font-black text-[9px]">Yet to bat</span>
                      )}
                    </td>
                    <td className="py-3 text-center font-bold text-[#fafafa] font-mono">{b.runsScored}</td>
                    <td className="py-3 text-center text-white/30 font-mono">{b.ballsFaced}</td>
                    <td className="py-3 text-center text-white/30 font-mono">{b.fours}</td>
                    <td className="py-3 text-center text-white/30 font-mono">{b.sixes}</td>
                    <td className="py-3 text-center font-mono text-white/30">{sr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS SECTION */}

      {/* A. Bowler Select Modal */}
      <AnimatePresence>
        {showBowlerSelect && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 shadow-2xl" id="modal-bowler-select">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/5 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-zinc-100 space-y-4"
            >
              <div>
                <h3 className="font-extrabold text-white text-sm uppercase tracking-widest font-mono flex items-center gap-1.5">
                  Assign New Bowler
                </h3>
                <p className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Bowling side: {bowlingTeam.name}</p>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {(() => {
                  const consecutiveBowlerId = (match.settings.playersPerTeam >= 2 && inning.overs.length >= 2)
                    ? inning.overs[inning.overs.length - 2].bowlerId
                    : null;
                  
                  return inning.bowlers.map((b) => {
                    const isConsecutive = b.id === consecutiveBowlerId;
                    return (
                      <button
                        key={b.id}
                        disabled={isConsecutive}
                        onClick={() => !isConsecutive && setNewBowlerId(b.id)}
                        className={`w-full py-3 px-4 rounded-xl text-left text-xs font-bold uppercase tracking-wider border flex justify-between items-center transition ${
                          isConsecutive
                            ? 'opacity-40 border-dashed border-white/5 bg-zinc-950 text-white/20 cursor-not-allowed'
                            : newBowlerId === b.id
                              ? 'border-lime-400 bg-lime-400/10 text-lime-400'
                              : 'border-white/5 bg-black/40 hover:border-white/10 text-white/60'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className={isConsecutive ? 'line-through' : ''}>{b.name}</span>
                          {isConsecutive && (
                            <span className="text-[8px] text-red-400/80 mt-0.5 lowercase font-mono font-normal normal-case">
                              Blocked: Just completed an over
                            </span>
                          )}
                        </div>
                        <span className="text-[9px] font-mono opacity-80">{b.oversBowled} overs, {b.wickets} wickets</span>
                      </button>
                    );
                  });
                })()}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={confirmBowlerSelection}
                  disabled={!newBowlerId}
                  className="w-full py-4 bg-lime-400 text-zinc-950 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-lime-500 disabled:opacity-30 transition cursor-pointer flex justify-center items-center gap-1.5"
                  id="btn-confirm-bowler"
                >
                  Start Over Delivery
                  <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* B. Batter selection modal */}
      <AnimatePresence>
        {showBatterSelect && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50" id="modal-batter-select">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/5 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-zinc-100 space-y-4"
            >
              <div>
                <h3 className="font-extrabold text-white text-sm uppercase tracking-widest font-mono flex items-center gap-1">
                  New Batter Arrival
                </h3>
                <p className="text-[10px] text-white/40 font-mono uppercase mt-0.5">Batting Squad: {battingTeam.name}</p>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {inning.batsmen
                  .filter(b => !b.isOut && b.id !== inning.tempBatter2Id)
                  .map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setNewBatterId(b.id)}
                      className={`w-full py-3.5 px-4 rounded-xl text-left text-xs font-bold uppercase tracking-wider border flex justify-between items-center transition ${
                        newBatterId === b.id
                          ? 'border-lime-400 bg-lime-400/10 text-lime-400'
                          : 'border-white/5 bg-black/40 hover:border-white/10 text-white/60'
                      }`}
                    >
                      <span>{b.name}</span>
                      <span className="text-[9px] font-mono text-white/20 uppercase font-black">Yet to bat</span>
                    </button>
                  ))}
              </div>

              {/* Strike Selection */}
              {newBatterId && (
                <div className="space-y-2 pt-2 border-t border-white/5 animate-fade-in text-left">
                  <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest font-mono">
                    Who takes strike for the next delivery? 🏏
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setNewBatterStrike('on_strike')}
                      className={`p-3.5 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition cursor-pointer flex flex-col justify-center items-center gap-1 min-h-[64px] ${
                        newBatterStrike === 'on_strike'
                          ? 'border-lime-400 bg-lime-400/15 text-lime-400'
                          : 'border-white/5 bg-black/40 hover:border-white/10 text-white/60'
                      }`}
                    >
                      <span className="font-extrabold text-[11px]">On Strike</span>
                      <span className="text-[9px] font-mono opacity-80 font-normal">({inning.batsmen.find(b => b.id === newBatterId)?.name})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBatterStrike('non_strike')}
                      className={`p-3.5 rounded-xl border text-xs font-bold uppercase tracking-wider text-center transition cursor-pointer flex flex-col justify-center items-center gap-1 min-h-[64px] ${
                        newBatterStrike === 'non_strike'
                          ? 'border-lime-400 bg-lime-400/15 text-lime-400'
                          : 'border-white/5 bg-black/40 hover:border-white/10 text-white/60'
                      }`}
                    >
                      <span className="font-extrabold text-[11px]">On Strike</span>
                      <span className="text-[9px] font-mono opacity-80 font-normal">({inning.batsmen.find(b => b.id === inning.tempBatter2Id)?.name || 'Staying Batter'})</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={confirmBatterSelection}
                  disabled={!newBatterId}
                  className="w-full py-4 bg-lime-400 text-zinc-950 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-lime-500 disabled:opacity-30 transition cursor-pointer flex justify-center items-center gap-1.5"
                  id="btn-confirm-batter"
                >
                  Confirm Batter Crease
                  <ChevronRight size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* C. Interactive Wicket dismissal protocol modal */}
      <AnimatePresence>
        {showWicketModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto" id="modal-wicket">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/5 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative my-auto text-zinc-100 space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <h3 className="font-extrabold text-red-400 text-xs uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <AlertTriangle size={15} />
                  Choose Dismissal Protocol
                </h3>
                <button onClick={() => setShowWicketModal(false)} className="text-white/40 hover:text-white cursor-pointer transition">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Out Selector grid */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  {[
                    { type: 'bowled', label: 'Bowled Stumps 🎯' },
                    { type: 'caught', label: 'Caught Out 🥎' },
                    { type: 'runout', label: 'Run Out 🏃💨' },
                    { type: 'lbw', label: 'LBW Dismiss 🛑' },
                    { type: 'stumped', label: 'Stumped Out 🧤' },
                    ...(match.settings.onePitchCatchOut ? [{ type: 'one_pitch', label: 'One-Tippa Out 🦘' }] : []),
                    ...(match.settings.hitOutOfBoundaryOut ? [{ type: 'hit_out_of_ground', label: 'Ghar Baahar OUT 🏠' }] : [])
                  ].map((d) => (
                    <button
                      key={d.type}
                      type="button"
                      onClick={() => setWicketType(d.type as Player['howOut'])}
                      className={`p-3 rounded-lg border font-bold uppercase tracking-wider text-center transition-colors cursor-pointer ${
                        wicketType === d.type
                          ? 'border-red-500 bg-red-500/10 text-red-400'
                          : 'border-white/5 bg-black/40 hover:border-white/10 text-white/50'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {(wicketType === 'caught' || wicketType === 'runout') && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-1.5"
                    >
                      <label className="block text-[9px] font-bold text-white/50 uppercase tracking-widest font-mono">
                        Fielder / Helper's Name
                      </label>
                      <input
                        type="text"
                        maxLength={14}
                        value={wicketFielder}
                        onChange={(e) => setWicketFielder(e.target.value)}
                        placeholder="Name of fielder..."
                        className="w-full text-xs px-3 py-2.5 rounded-lg border border-white/5 bg-black/50 text-white focus:outline-none focus:border-red-500/50"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={triggerWicketOutcome}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow shadow-red-650/40 cursor-pointer"
                  >
                    Confirm OUT Wicket! 🔴
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
 
      {/* Last Man Standing Confirmation Modal */}
      <AnimatePresence>
        {showLastManPrompt && pendingLmsMatch && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[60]" id="modal-lms-confirm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-zinc-100 space-y-5"
            >
              <div className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <User size={22} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base uppercase tracking-tight">
                    Last Man Standing? 🏏
                  </h3>
                  <p className="text-xs text-white/55 mt-1.5 leading-relaxed font-sans">
                    All batsmen have been dismissed except for the last remaining batsman:{' '}
                    <span className="text-lime-400 font-bold">
                      {(() => {
                        const workingInning = isInnings2 && pendingLmsMatch.secondInnings ? pendingLmsMatch.secondInnings : pendingLmsMatch.firstInnings;
                        return workingInning.batsmen.find(b => !b.isOut)?.name || 'Last Batsman';
                      })()}
                    </span>.
                  </p>
                  <p className="text-[11px] text-white/40 mt-2 leading-relaxed font-sans border-t border-white/5 pt-2">
                    Would you like them to continue batting alone? Strike rotation will be completely disabled, and they will receive credit for every run scored alone.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    // Answered NO: Innings concluded at this point
                    const workingInning = isInnings2 && pendingLmsMatch.secondInnings ? pendingLmsMatch.secondInnings : pendingLmsMatch.firstInnings;
                    triggerAudio(`${battingTeam.name} decided not to continue. Innings complete for ${workingInning.runs} runs.`);
                    handleEndInnings(pendingLmsMatch);
                    setShowLastManPrompt(false);
                    setPendingLmsMatch(null);
                  }}
                  className="w-full py-3.5 border border-white/10 hover:bg-white/5 text-white/70 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Conclude Innings
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Answered YES: Continue batting as LMS!
                    const updatedMatch = JSON.parse(JSON.stringify(pendingLmsMatch)) as Match;
                    const workingInning = isInnings2 && updatedMatch.secondInnings ? updatedMatch.secondInnings : updatedMatch.firstInnings;
                    const lastBatter = workingInning.batsmen.find(b => !b.isOut);
                    if (lastBatter) {
                      workingInning.tempBatter1Id = lastBatter.id;
                      workingInning.tempBatter2Id = ""; // Clear non-striker
                      triggerAudio(`${lastBatter.name} will continue batting alone as Last Man Standing!`);
                    }
                    onUpdateMatch(updatedMatch);
                    setShowLastManPrompt(false);
                    setPendingLmsMatch(null);
                  }}
                  className="w-full py-3.5 bg-lime-500 hover:bg-lime-600 text-black font-black text-xs uppercase tracking-wider rounded-xl transition shadow shadow-lime-500/20 cursor-pointer"
                >
                  Yes, Continue!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Undo confirmation modal */}
      <AnimatePresence>
        {showUndoConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 shadow-2xl" id="modal-undo-confirm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/5 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-zinc-100 space-y-5"
            >
              <div className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                  <CornerUpLeft size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-base uppercase tracking-tight">
                    Confirm Revert Ball?
                  </h3>
                  <p className="text-xs text-white/40 mt-1.5 leading-relaxed font-sans">
                    Are you absolutely sure you want to undo the last delivery? This will completely remove the ball from the log and revert player statistics.
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowUndoConfirm(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition border border-white/5 cursor-pointer"
                >
                  No, Keep It
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleUndo();
                    setShowUndoConfirm(false);
                  }}
                  className="flex-1 py-3 bg-red-650 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Yes, Undo Ball
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic safe modal alert */}
      <AnimatePresence>
        {alertMessage && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] shadow-2xl" id="custom-system-alert">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-zinc-100 space-y-5"
            >
              <div className="text-center space-y-3.5">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                  <AlertTriangle size={22} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm uppercase tracking-widest font-mono">
                    Scorer Note 📢
                  </h3>
                  <p className="text-xs text-white/70 mt-2 leading-relaxed font-semibold">
                    {alertMessage}
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setAlertMessage(null)}
                  className="w-full py-3 bg-lime-400 hover:bg-lime-500 text-zinc-950 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg font-mono"
                >
                  Confirm & Resume
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Innings Delay / Out Visual Transition Screen */}
      <AnimatePresence>
        {isTransitioning && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 z-[120] text-center" id="wicket-transition-overlay">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="space-y-6 max-w-sm"
            >
              <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/40 text-red-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-red-500/10 font-mono text-3xl font-black uppercase">
                OUT
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-wider font-mono">Innings Ended!</h2>
                <p className="text-sm text-white/70 leading-relaxed font-semibold">
                  The batsman has been dismissed! Preparing the second innings chase...
                </p>
              </div>
              <div className="flex justify-center items-center gap-2 text-lime-400 font-mono text-xs font-bold uppercase tracking-widest animate-pulse">
                <RotateCw size={16} className="animate-spin" />
                Next team up in 2s
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Super Over or End Game Tie Decider Modal */}
      <AnimatePresence>
        {showTieDeciderModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] shadow-2xl" id="tie-decider-modal">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-zinc-100 space-y-6"
            >
              <div className="text-center space-y-3.5">
                <div className="mx-auto w-16 h-16 rounded-full bg-amber-400/15 border-2 border-amber-400/30 flex items-center justify-center text-amber-400 animate-pulse">
                  <RotateCw size={28} className="animate-spin" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-lg uppercase tracking-wider font-mono animate-pulse">
                    ⚠️ MATCH TIED ⚠️
                  </h3>
                  <p className="text-xs text-white/70 mt-2 leading-relaxed font-semibold">
                    The score is dead level! Would you like to launch a thrilling <span className="text-lime-400 font-bold">1-Over Super Over decider shootout</span> or settle for a spectacular Gully Cricket Tie?
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={handleEndGameAsTie}
                  className="w-full py-4 bg-zinc-800 hover:bg-zinc-700/80 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all cursor-pointer border border-white/5 font-mono"
                >
                  End Game (Tie)
                </button>
                <button
                  type="button"
                  onClick={handleStartSuperOver}
                  className="w-full py-4 bg-lime-400 hover:bg-lime-500 text-zinc-950 rounded-xl font-extrabold text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-lime-400/10 font-mono"
                >
                  Super Over ⚡
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Match Statistics Panel (Full Screen) */}
      <AnimatePresence>
        {showStatsPanel && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 190 }}
            className="fixed inset-0 bg-[#040810]/98 backdrop-blur-xl z-[150] overflow-hidden flex flex-col text-white font-sans"
            id="live-stats-panel-fullscreen"
          >
            {/* Elegant Header */}
            <div className="p-5 md:p-6 border-b border-white/5 bg-[#03060a]/90 backdrop-blur-md flex justify-between items-center z-10 shrink-0">
              <div>
                <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-white">Live Match Stats</h2>
                <p className="text-[10px] text-zinc-400 font-mono uppercase mt-0.5 tracking-widest">
                  {match.teamA.name} <span className="text-cyan-400">vs</span> {match.teamB.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerVibrate(20);
                  setShowStatsPanel(false);
                }}
                className="p-2.5 bg-white/[0.04] hover:bg-white/[0.1] border border-white/10 hover:border-white/20 text-white rounded-full transition-all cursor-pointer shadow"
                aria-label="Close Statistics View"
                id="btn-close-stats"
              >
                <X size={18} />
              </button>
            </div>

            {/* Inner Content Area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 space-y-6 select-none bg-gradient-to-b from-[#050d18] to-[#040810]" style={{ fontFamily: 'var(--font-sans)' }}>
              
              {/* ICC-style Tabs Switcher */}
              <div className="flex justify-center mb-6">
                <div className="bg-black/60 border border-white/5 p-1 rounded-2xl flex max-w-sm w-full shadow-inner">
                  <button
                    type="button"
                    onClick={() => {
                      triggerVibrate(20);
                      setStatsActiveTab('batting');
                    }}
                    className={`flex-1 py-3 text-center rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                      statsActiveTab === 'batting'
                        ? 'bg-cyan-400 text-zinc-950 shadow-lg shadow-cyan-400/30'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.01]'
                    }`}
                  >
                    Batting
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerVibrate(20);
                      setStatsActiveTab('bowling');
                    }}
                    className={`flex-1 py-3 text-center rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                      statsActiveTab === 'bowling'
                        ? 'bg-cyan-400 text-zinc-950 shadow-lg shadow-cyan-400/30'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.01]'
                    }`}
                  >
                    Bowling
                  </button>
                </div>
              </div>

              {/* Batting Tab Content Segment */}
              {statsActiveTab === 'batting' && (
                <div className="space-y-6 w-full max-w-3xl mx-auto">
                  {[
                    { id: 'team_a' as const, name: match.teamA.name, players: match.teamA.players },
                    { id: 'team_b' as const, name: match.teamB.name, players: match.teamB.players }
                  ].map((team) => {
                    const isCurrentlyBattingTeam = inning.battingTeamId === team.id;
                    return (
                      <div key={team.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 md:p-5 shadow-2xl backdrop-blur-md space-y-4">
                        <div className="flex justify-between items-center pb-2.5 border-b border-white/5">
                          <h3 className="font-extrabold text-white text-sm uppercase tracking-wide flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${isCurrentlyBattingTeam ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'}`} />
                            {team.name}
                            {isCurrentlyBattingTeam && (
                              <span className="text-[9px] font-bold bg-cyan-400/20 text-cyan-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                                Currently Batting
                              </span>
                            )}
                          </h3>
                        </div>

                        <div className="space-y-2.5 overflow-x-auto">
                          <div className="grid grid-cols-12 gap-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono pb-1 border-b border-white/[0.03] min-w-[340px]">
                            <div className="col-span-5">Batter</div>
                            <div className="col-span-2 text-center">Score</div>
                            <div className="col-span-1 text-center">Balls</div>
                            <div className="col-span-1 text-center">4s</div>
                            <div className="col-span-1 text-center">6s</div>
                            <div className="col-span-2 text-right">SR</div>
                          </div>

                          {team.players.map((pName) => {
                            const bStats = getPlayerBattingStats(pName, team.id);
                            const isMutual = match.settings.mutualPlayerName === pName;
                            const sr = bStats.balls > 0 ? ((bStats.runs / bStats.balls) * 100).toFixed(1) : "0.0";
                            const isStriker = bStats.isStriker;

                            return (
                              <div
                                key={pName}
                                className={`grid grid-cols-12 gap-2 p-3 rounded-xl transition duration-200 items-center min-w-[340px] ${
                                  bStats.isCurrentOnPitch
                                    ? 'bg-cyan-400/[0.08] border border-cyan-400/30'
                                    : 'bg-black/20 border border-white/[0.02] hover:bg-white/[0.02]'
                                }`}
                              >
                                <div className="col-span-5 flex flex-col min-w-0 pr-1">
                                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                    <span className={`font-bold text-xs uppercase truncate ${bStats.isCurrentOnPitch ? 'text-cyan-400' : 'text-zinc-200'}`}>
                                      {pName}
                                    </span>
                                    {isMutual && (
                                      <span className="text-[8px] bg-amber-400/10 border border-amber-400/30 text-amber-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                                        👑 Mutual
                                      </span>
                                    )}
                                    {bStats.isCurrentOnPitch && (
                                      <span className="text-[8px] bg-cyan-400/20 text-cyan-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono animate-pulse">
                                        {isStriker ? "Striker *" : "Runner"}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-zinc-500 font-medium font-sans mt-0.5 truncate">
                                    {bStats.statusText}
                                  </span>
                                </div>

                                <div className={`col-span-2 text-center font-mono font-black text-sm ${bStats.isCurrentOnPitch ? 'text-cyan-400' : 'text-white'}`}>
                                  {bStats.runs}
                                </div>
                                <div className="col-span-1 text-center font-mono text-zinc-400 text-xs">
                                  {bStats.balls}
                                </div>
                                <div className="col-span-1 text-center font-mono text-zinc-500 text-xs">
                                  {bStats.fours}
                                </div>
                                <div className="col-span-1 text-center font-mono text-zinc-500 text-xs">
                                  {bStats.sixes}
                                </div>
                                <div className="col-span-2 text-right font-mono text-zinc-400 text-xs">
                                  {sr}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bowling Tab Content Segment */}
              {statsActiveTab === 'bowling' && (
                <div className="space-y-6 w-full max-w-3xl mx-auto">
                  {[
                    { id: 'team_a' as const, name: match.teamA.name, players: match.teamA.players },
                    { id: 'team_b' as const, name: match.teamB.name, players: match.teamB.players }
                  ].map((team) => {
                    const isCurrentlyBowlingTeam = inning.bowlingTeamId === team.id;
                    return (
                      <div key={team.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 md:p-5 shadow-2xl backdrop-blur-md space-y-4">
                        <div className="flex justify-between items-center pb-2.5 border-b border-white/5">
                          <h3 className="font-extrabold text-white text-sm uppercase tracking-wide flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${isCurrentlyBowlingTeam ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'}`} />
                            {team.name}
                            {isCurrentlyBowlingTeam && (
                              <span className="text-[9px] font-bold bg-cyan-400/20 text-cyan-400 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                                Currently Bowling
                              </span>
                            )}
                          </h3>
                        </div>

                        <div className="space-y-2.5 overflow-x-auto">
                          <div className="grid grid-cols-12 gap-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono pb-1 border-b border-white/[0.03] min-w-[340px]">
                            <div className="col-span-4">Bowler</div>
                            <div className="col-span-2 text-center">Overs</div>
                            <div className="col-span-1 text-center">Runs</div>
                            <div className="col-span-1 text-center">W</div>
                            <div className="col-span-2 text-center">Econ</div>
                            <div className="col-span-2 text-right">Extras</div>
                          </div>

                          {team.players.map((pName) => {
                            const bowlStats = getPlayerBowlingStats(pName, team.id);
                            const isMutual = match.settings.mutualPlayerName === pName;
                            return (
                              <div
                                key={pName}
                                className={`grid grid-cols-12 gap-2 p-3 rounded-xl transition duration-200 items-center min-w-[340px] ${
                                  bowlStats.isCurrentActive
                                    ? 'bg-cyan-400/[0.08] border border-cyan-400/30'
                                    : 'bg-black/20 border border-white/[0.02] hover:bg-white/[0.02]'
                                }`}
                              >
                                <div className="col-span-4 flex flex-col min-w-0 pr-1">
                                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                    <span className={`font-bold text-xs uppercase truncate ${bowlStats.isCurrentActive ? 'text-cyan-400' : 'text-zinc-200'}`}>
                                      {pName}
                                    </span>
                                    {isMutual && (
                                      <span className="text-[8px] bg-amber-400/10 border border-amber-400/30 text-amber-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono">
                                        👑 Mutual
                                      </span>
                                    )}
                                    {bowlStats.isCurrentActive && (
                                      <span className="text-[8px] bg-cyan-400/20 text-cyan-400 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider font-mono animate-pulse">
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  {bowlStats.hasBowled && (
                                    <span className="text-[9px] text-zinc-500 font-mono mt-0.5 truncate">
                                      Match Fig: {bowlStats.bestFiguresText}
                                    </span>
                                  )}
                                </div>

                                <div className="col-span-2 text-center font-mono text-zinc-350 text-xs">
                                  {bowlStats.hasBowled ? bowlStats.overs : "-"}
                                </div>
                                <div className="col-span-1 text-center font-mono text-zinc-400 text-xs">
                                  {bowlStats.hasBowled ? bowlStats.runsConceded : "-"}
                                </div>
                                <div className="col-span-1 text-center font-mono font-black text-sm text-white">
                                  {bowlStats.hasBowled ? bowlStats.wickets : "-"}
                                </div>
                                <div className={`col-span-2 text-center font-mono text-xs ${bowlStats.isCurrentActive ? 'text-cyan-400' : 'text-zinc-400'}`}>
                                  {bowlStats.hasBowled ? bowlStats.econ : "-"}
                                </div>
                                <div className="col-span-2 text-right font-mono text-zinc-500 text-[10px]">
                                  {bowlStats.hasBowled ? (
                                    <div className="flex flex-col items-end leading-none space-y-0.5">
                                      <span>Wd: {bowlStats.wides}</span>
                                      <span>Nb: {bowlStats.noballs}</span>
                                    </div>
                                  ) : (
                                    "-"
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
