// Names and vocabularies of Wody Counting on the website. They match wody_counting/constants.py and modes.py in the bot.
export const COLL = {
  games: 'ct_games', players: 'ct_players', periods: 'ct_periods', global: 'ct_global', defs: 'ct_defs', seasons: 'ct_seasons',
  inventory: 'ct_inventory', competitions: 'ct_competitions', scores: 'ct_scores', history: 'ct_history', daily: 'ct_daily', audit: 'ct_audit',
};
export const MODES = ['classic', 'reverse', 'increment', 'decimal', 'negative', 'binary', 'hexadecimal', 'roman', 'alphabet', 'word', 'fibonacci', 'multiplication', 'custom_sequence'];
export const BOARDS = ['valid', 'streak', 'record', 'xp'];
export const PERIODS = ['all', 'day', 'week', 'month', 'season'];
export const POWERUPS = ['save', 'streak_shield', 'hint', 'milestone_boost', 'challenge_token', 'extra_attempt', 'event_token'];
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'limited'];
export const DEF_KINDS = ['badge', 'achievement', 'challenge', 'collection', 'custom_mode'];
export const ACHIEVEMENT_METRICS = ['valid_total', 'best_streak', 'milestones', 'sessions', 'modes_played', 'record', 'challenges', 'day_streak', 'perfect_sessions'];
export const CHALLENGE_TYPES = ['valid_counts', 'reach_milestone', 'valid_turns', 'sessions', 'special_mode', 'personal_record', 'community_goal'];
export const COMPETITION_MODES = ['highest_count', 'most_valid', 'best_streak', 'most_milestones', 'best_accuracy', 'challenge_completion', 'team_contribution'];
export const ERRORS = ['wrong_number', 'wrong_sequence', 'duplicate', 'same_user', 'invalid_format', 'invalid_expression', 'unauthorized', 'wrong_mode', 'goal_violation', 'rate_limit', 'locked'];
export const ERROR_ACTIONS = ['fail', 'warn', 'ignore'];
export const GAME_ACTIONS = ['reset', 'pause', 'resume', 'archive', 'grant_save'];
export const SNOWFLAKE = /^\d{15,21}$/;
export const ID = /^[a-z][a-z0-9_]{0,31}$/;
export const PAGE = 24;
