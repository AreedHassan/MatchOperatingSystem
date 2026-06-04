export interface Player {
  id: string;
  name: string;
  runsScored: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  howOut?: 'bowled' | 'caught' | 'runout' | 'lbw' | 'stumped' | 'one_pitch' | 'hit_out_of_ground' | 'retired';
  dismissedBy?: string; // bowler id
  helperPlayer?: string; // fielder who caught/run out
  oversBowled: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  wides: number;
  noballs: number;
}

export interface Ball {
  ballId: string;
  batterId: string;
  bowlerId: string;
  runs: number; // runs off bat
  extras: number; // extra runs
  extraType?: 'wide' | 'noball' | 'bye' | 'legbye';
  isWicket: boolean;
  wicketType?: Player['howOut'];
  wicketPlayerId?: string; // who got out (could be non-striker in runout)
  fielderId?: string;
  isFreeHit: boolean;
  commentaryText: string;
}

export interface Over {
  overNumber: number; // 0-indexed
  bowlerId: string;
  balls: Ball[];
}

export interface Inning {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  ballsBowled: number; // valid balls
  overs: Over[];
  batsmen: Player[];
  bowlers: Player[];
  tempBatter1Id: string; // striker
  tempBatter2Id: string; // non-striker
  tempBowlerId: string;
  openingLineupConfirmed?: boolean;
}

export interface MatchSettings {
  oversPerMatch: number;
  ballsPerOver: number; // normal 6, baby over 3 or any other
  playersPerTeam: number; // default/max per team
  widePenalty: number; // default +1
  noBallPenalty: number; // default +1
  freeHitOnNoBall: boolean;
  onePitchCatchOut: boolean;
  hitOutOfBoundaryOut: boolean; // "Ghar ke baahar out"
  lastManStanding: boolean; // batsman can bat alone
  vibrationFeedback: boolean;
  voiceCommentary: boolean;
  // Uneven rosters (Gully Cricket Common Player logic)
  isUneven?: boolean;
  unevenMode?: 'auto' | 'manual' | 'leave_it';
  commonPlayerName?: string;
  mutualPlayerName?: string;
  teamAForcedSize?: number;
  teamBForcedSize?: number;
}

export interface Team {
  id: string;
  name: string;
  players: string[]; // player names
}

export interface Match {
  id: string;
  date: string;
  teamA: Team;
  teamB: Team;
  settings: MatchSettings;
  tossWinnerId: string;
  tossDecision: 'bat' | 'bowl';
  status: 'setup' | 'first_innings' | 'innings_break' | 'second_innings' | 'completed';
  firstInnings: Inning;
  secondInnings?: Inning;
  winnerTeamId?: string;
  winMarginText?: string;
  isSuperOver?: boolean;
  superOverOriginalScore?: number;
}

export interface MatchHistoryItem {
  id: string;
  date: string;
  teamAName: string;
  teamBName: string;
  teamAScore: string; // "102/5 (10 overs)"
  teamBScore: string; // "98/8 (10 overs)"
  resultText: string;
  momName?: string;
}
