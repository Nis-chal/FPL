export type Position = "GKP" | "DEF" | "MID" | "FWD";

export interface FplTeam {
  id: number;
  name: string;
  short_name: string;
  code: number;
  strength: number;
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
  pulse_id: number;
}

export interface FplEvent {
  id: number;
  name: string;
  deadline_time: string;
  average_entry_score: number | null;
  finished: boolean;
  data_checked: boolean;
  is_previous: boolean;
  is_current: boolean;
  is_next: boolean;
}

export interface FplElement {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  selected_by_percent: string;
  form: string;
  points_per_game: string;
  total_points: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  status: string;
  news: string;
  chance_of_playing_next_round: number | null;
  chance_of_playing_this_round: number | null;
  ep_next: string | null;
  ep_this: string | null;
  value_form: string;
  value_season: string;
  photo: string;
  penalties_order: number | null;
  corners_and_indirect_freekicks_order: number | null;
  direct_freekicks_order: number | null;
}

export interface FplFixture {
  id: number;
  code: number;
  event: number | null;
  finished: boolean;
  finished_provisional: boolean;
  kickoff_time: string | null;
  minutes: number;
  provisional_start_time: boolean;
  started: boolean | null;
  team_a: number;
  team_a_score: number | null;
  team_h: number;
  team_h_score: number | null;
  team_h_difficulty: number;
  team_a_difficulty: number;
  pulse_id: number;
}

export interface BootstrapStatic {
  elements: FplElement[];
  teams: FplTeam[];
  events: FplEvent[];
  element_types: Array<{ id: number; singular_name_short: string }>;
}

export interface ElementHistory {
  element: number;
  fixture: number;
  opponent_team: number;
  total_points: number;
  was_home: boolean;
  kickoff_time: string;
  team_h_score: number | null;
  team_a_score: number | null;
  round: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  influence: string;
  creativity: string;
  threat: string;
  ict_index: string;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  value: number;
  /** FPL defensive / involvement extras (added for DC scoring). */
  clearances_blocks_interceptions?: number;
  recoveries?: number;
  tackles?: number;
  defensive_contribution?: number;
  starts?: number;
}

export interface ElementFixture {
  id: number;
  code: number;
  team_h: number;
  team_a: number;
  event: number | null;
  kickoff_time: string | null;
  is_home: boolean;
  difficulty: number;
  finished: boolean;
}

export interface ElementSummary {
  fixtures: ElementFixture[];
  history: ElementHistory[];
  history_past: PastSeasonStats[];
}

/** Prior FPL seasons (players may have moved clubs/leagues before joining FPL). */
export interface PastSeasonStats {
  season_name: string;
  element_code?: number;
  start_cost?: number;
  end_cost?: number;
  total_points: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets?: number;
  goals_conceded?: number;
  own_goals?: number;
  penalties_saved?: number;
  penalties_missed?: number;
  yellow_cards?: number;
  red_cards?: number;
  saves?: number;
  bonus?: number;
  bps?: number;
  influence?: string | number;
  creativity?: string | number;
  threat?: string | number;
  ict_index?: string | number;
  expected_goals?: string | number;
  expected_assists?: string | number;
  expected_goal_involvements?: string | number;
  clearances_blocks_interceptions?: number;
  recoveries?: number;
  tackles?: number;
  defensive_contribution?: number;
  starts?: number;
}

export interface EntrySummary {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_points: number;
  summary_overall_rank: number;
  summary_event_points: number;
  summary_event_rank: number | null;
  current_event: number;
  last_deadline_bank: number;
  last_deadline_value: number;
  last_deadline_total_transfers: number;
}

export interface EntryPick {
  element: number;
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface EntryPicks {
  active_chip: string | null;
  automatic_subs: unknown[];
  entry_history: {
    event: number;
    points: number;
    total_points: number;
    rank: number | null;
    bank: number;
    value: number;
    event_transfers: number;
    event_transfers_cost: number;
  };
  picks: EntryPick[];
}

/** Live GW stats from `/api/event/{id}/live/`. */
export interface LiveElementStats {
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  total_points: number;
}

export interface LiveElement {
  id: number;
  stats: LiveElementStats;
}

export interface EventLive {
  elements: LiveElement[];
}

/** Analyze-by ranking modes for filters. */
export type RankBy =
  | "overall"
  | "xpts"
  | "price"
  | "best_start"
  | "xgi90"
  | "win_cs"
  | "team_rating"
  | "next_game"
  | "next_5";

export interface FormationRank {
  name: string;
  DEF: number;
  MID: number;
  FWD: number;
  projectedPoints: number;
  expectedPointsPerGw: number;
  startingXi: ScoredPlayer[];
}

export interface PriceBounds {
  minPrice: number | null;
  maxPrice: number | null;
}

export interface FixtureView {
  id: number;
  event: number | null;
  kickoff_time: string | null;
  isHome: boolean;
  opponentId: number;
  opponentName: string;
  opponentShort: string;
  difficulty: number;
  /** Official FPL finished flag (often false until GW closes). */
  finished: boolean;
  /** True when scores are available (finished, provisional, or live). */
  hasResult: boolean;
  /** In-progress match (started, not yet provisional/official). */
  isLive: boolean;
  minutes: number;
  teamScore: number | null;
  opponentScore: number | null;
  result: "W" | "D" | "L" | null;
}

export interface ScoredPlayer {
  id: number;
  webName: string;
  fullName: string;
  teamId: number;
  teamName: string;
  teamShort: string;
  /** FPL team code for kit assets. */
  teamCode: number;
  /** FPL photo filename e.g. "123456.jpg". */
  photo: string;
  position: Position;
  positionId: number;
  price: number;
  selectedBy: number;
  totalPoints: number;
  form: number;
  minutes: number;
  status: string;
  news: string;
  chanceOfPlaying: number | null;
  /** Live GW points so far (when overlay applied). */
  livePoints?: number | null;
  /** Live GW minutes so far (when overlay applied). */
  liveMinutes?: number | null;
  recentAvgPoints: number;
  recentGames: number;
  nextDifficulty: number | null;
  nextOpponent: string | null;
  nextIsHome: boolean | null;
  upcomingAvgDifficulty: number;
  upcomingFixtures: FixtureView[];
  /** Expected points summed over the active fixture horizon (3–7). */
  projectedPoints: number;
  /** Model expected points for a typical GW in that horizon. */
  expectedPointsPerGw: number;
  valueScore: number;
  availabilityFactor: number;
  /** 0–1 probability of starting / meaningful minutes. */
  startChance: number;
  /** Per-90 underlying rates. */
  xg90: number;
  xa90: number;
  xgi90: number;
  xgc90: number;
  /** True if first-choice penalties. */
  isPenTaker: boolean;
  /** 0–100 attacking threat (xGI/90, set pieces, ICT). */
  attackingThreat: number;
  /** 0–100 estimated chance club wins next fixture. */
  nextWinChance: number;
  /** 0–100 estimated clean-sheet chance next fixture (DEF/GK focus). */
  cleanSheetChance: number;
  /** FPL official expected points next GW, if present. */
  epNext: number | null;
  reasons: string[];
}

export interface TransferSuggestion {
  out: ScoredPlayer;
  in: ScoredPlayer;
  netProjectedGain: number;
  costDelta: number;
  threatDelta: number;
  winChanceDelta: number;
  horizon: number;
  reasons: string[];
}

export interface TeamRating {
  grade: string;
  score: number;
  horizon: number;
  summary: string;
  breakdown: {
    form: number;
    fixtures: number;
    attackingThreat: number;
    nextWinChance: number;
    availability: number;
  };
}

export interface BestSquad {
  squad: ScoredPlayer[];
  startingXi: ScoredPlayer[];
  bench: ScoredPlayer[];
  captain: ScoredPlayer;
  viceCaptain: ScoredPlayer;
  formation: string;
  totalCost: number;
  projectedPoints: number;
  bank: number;
}
