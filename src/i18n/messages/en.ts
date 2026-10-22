/**
 * English message catalog: the source of truth for translation keys.
 *
 * Keys are flat and dot-namespaced (`area.thing`). `{name}` placeholders are
 * interpolated by `t(key, params)`.
 */
export const en = {
  // App shell
  'app.title': 'Badminton Court Manager',
  'app.managePlayers': 'Manage Players',
  'app.courtAssignments': 'Court Assignments',

  // Footer / language
  'footer.feedback': 'Have feedback? Found a bug or want to suggest a feature?',
  'footer.contact': 'Let us know on GitHub',
  'footer.statsLink': 'View Statistics & Analysis',
  'footer.tournamentLink': 'Try Tournament Mode',
  'language.label': 'Language',

  // Shared
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.copied': 'Copied!',
  'common.moreInformation': 'More information',
  'common.removedPlayer': 'removed',

  // Player entry
  'players.entryPlaceholder': 'Enter player name (use ` or , to add multiple)',
  'players.importFromImage': 'Import players from image',
  'players.addPlayer': 'Add Player',
  'players.addPlayers': 'Add {count} Players',
  'players.detectedHint': '💡 Detected {count} players separated by {separator}',

  // Player list
  'players.present': 'Present',
  'players.absent': 'Absent',
  'players.total': 'Total',
  'players.editPrompt': 'Click to edit gender/level',
  'players.markAbsent': 'Mark as absent',
  'players.markPresent': 'Mark as present',
  'players.deletePermanently': 'Delete player permanently',
  'players.benchCount': 'Bench count: {count}',
  'players.benchNext': 'Bench next',
  'players.resetAlgorithm': 'Reset Algorithm',
  'players.resetAlgorithmTooltip': 'Reset who played with who history (keeps all players)',
  'players.clearAll': 'Clear All Players',
  'players.clearAllTooltip': 'Remove all players and reset scores',
  'players.share': 'Share',
  'players.shareTooltip': 'Share session via URL',
  'players.smartEngine': 'Smart Engine',
  'players.smartEngineTooltip':
    'Smart Engine balances matches using gender and skill level. Enable it then click any player name to set their gender and level.',
  'players.clearTitle': 'Clear All Players',
  'players.clearMessage':
    'Are you sure you want to remove all players? This will also reset all scores and game history. This action cannot be undone.',
  'players.clearConfirm': 'Clear All',
  'players.resetTitle': 'Reset Algorithm',
  'players.resetMessage':
    'Are you sure you want to reset the algorithm\'s memory? This will clear all records of who played with who, bench counts, and win/loss history. Players will remain but pairing preferences will be reset.',

  // Leaderboard
  'leaderboard.title': '🏆 Leaderboard',
  'leaderboard.player': 'Player',
  'leaderboard.level': 'Level',
  'leaderboard.avgPoints': 'Avg Pts',
  'leaderboard.wins': 'Wins',
  'leaderboard.matches': 'Matches',

  // Player edit modal
  'playerEdit.gender': 'Gender',
  'playerEdit.genderTooltip':
    'Setting gender helps Smart Engine balance mixed doubles — it avoids putting all players of the same gender on one team.',
  'playerEdit.genderUnknown': 'Unknown',
  'playerEdit.level': 'Level: {level}',
  'playerEdit.levelTooltip':
    'Level (0–100) represents playing skill. Smart Engine pairs players of similar levels together for more competitive and enjoyable matches.',

  // Player removal modal
  'playerRemoval.title': 'Remove Player',
  'playerRemoval.question': 'What would you like to do with {name}?',
  'playerRemoval.markAbsent': 'Mark as Absent',
  'playerRemoval.remove': 'Remove Player',

  // Share modal
  'share.title': 'Share Session',
  'share.body': 'Share this URL to let others load your current session:',
  'share.copyUrl': 'Copy URL',

  // Import (shared session) modal
  'import.title': 'Load Shared Session',
  'import.body': 'A shared session was found in the URL. Loading it will replace your current session.',
  'import.sharedSavedAt': 'Shared session saved:',
  'import.currentSavedAt': 'Your session saved:',
  'import.backupHint': 'Save this link to restore your current session later:',
  'import.copy': 'Copy',
  'import.keepMine': 'Keep my session',
  'import.loadShared': 'Load shared session',

  // Image import modal
  'image.title': '📸 Import Players from Image',
  'image.instructions1': 'Take a photo or upload an image of your player list.',
  'image.instructions2': 'Drag and drop, or click to select.',
  'image.choose': 'Choose Image',
  'image.processing': '🔍 Processing image and extracting player names...',
  'image.foundOne': 'Found {count} player',
  'image.foundOther': 'Found {count} players',
  'image.selectAll': 'Select all',
  'image.deselectAll': 'Deselect all',
  'image.tryAnother': '📸 Try another image',
  'image.addOne': 'Add {count} Player',
  'image.addOther': 'Add {count} Players',

  // Court assignments
  'court.courts': 'Courts:',
  'court.rearrange': 'Rearrange players',
  'court.rearrangeTooltip':
    'Drag a player onto another to swap them between teams, courts and the bench — or tap two players.',
  'court.editBanner': 'Drag a player onto another to swap them — or tap two players.',
  'court.done': 'Done',
  'court.court': 'Court {number}',
  'court.singles': 'Singles',
  'court.doubles': 'Doubles',
  'court.rotateTooltip': 'Rotate team assignment',
  'court.playersOnCourt': 'Players on court:',
  'court.waiting': 'Waiting: {name}',
  'court.team': 'Team {number}',
  'court.benchOne': '🪑 Bench ({count} player)',
  'court.benchOther': '🪑 Bench ({count} players)',
  'court.viewBenchCounts': 'View bench counts & manage',
  'court.winnerTipPrefix': 'Tip:',
  'court.winnerTip':
    'Click on a team to mark them as the winner. A crown 👑 will appear next to the winning team. Click again to remove the winner.',
  'court.regenerate': '🎲 Regenerate Assignments',
  'court.generate': '🎲 Generate Assignments',
  'court.lastGenerated': 'Last generated {time}',
  'court.howItWorksTitle': 'How it works:',
  'court.howItWorksBody':
    'Players will be randomly assigned to courts. Doubles (4 players) is preferred, but singles (2 players) will be used for odd numbers. Extra players will be benched.',
  'court.addPlayersFirst': 'Add some players above to start generating court assignments.',

  // Relative time
  'time.justNow': 'just now',
  'time.secondsAgo': '{count}s ago',
  'time.minutesAgo': '{count}min ago',
  'time.hoursAgo': '{count}h ago',
  'time.daysAgo': '{count}d ago',

  // Score input modal
  'score.enterTitle': 'Enter the set scores',
  'score.winnerTitle': '🏆 Team {team} wins!',
  'score.enterSingle': 'Enter the score (defaults to {a} – {b}):',
  'score.enterSets': 'Enter the score for each set (best of {count}):',
  'score.setLabel': 'Set {number}',
  'score.vs': 'vs',
  'score.teamScore': 'Team {team} score',
  'score.teamScoreSet': 'Team {team} score set {set}',

  // Tournament shell
  'tournament.setup': 'Tournament Setup',
  'tournament.current': 'Current Tournament',
  'tournament.title': 'Tournament',
  'tournament.mode': 'Mode',
  'tournament.roundRobin': 'Round Robin',
  'tournament.elimination': 'Elimination',
  'tournament.groupsKnockout': 'Groups + Knockout',
  'tournament.format': 'Format',
  'tournament.singlesPill': 'Singles (1v1)',
  'tournament.doublesPill': 'Doubles (2v2)',
  'tournament.players': 'Players',
  'tournament.numberOfCourts': 'Number of Courts',
  'tournament.setsPerMatch': 'Sets per Match',
  'tournament.singleGame': 'Single game',
  'tournament.bestOf': 'Best of {count}',
  'tournament.pointsPerSet': 'Points per set',
  'tournament.teams': 'Teams',
  'tournament.teamNumber': 'Team {number}',
  'tournament.dragHint': 'Drag a player onto another to swap them — or tap two players.',
  'tournament.start': 'Start Tournament',
  'tournament.newTournament': 'Start a New Tournament',
  'tournament.newTitle': 'Start a new tournament?',
  'tournament.newMessage':
    'This discards the current tournament and its results. Are you sure you want to start a new one?',
  'tournament.newConfirm': 'Start new',
  'tournament.needTwoTeams': 'Need at least 2 teams to start',
  'tournament.doublesTwoPlayers': 'Each doubles team must have exactly 2 players',
  'tournament.courtWarningOne':
    '{matches} matches per round but only {courts} court — some matches will need to wait.',
  'tournament.courtWarningOther':
    '{matches} matches per round but only {courts} courts — some matches will need to wait.',
  'tournament.standings': 'Standings',
  'tournament.subtitleRounds': 'After Round {done} / {total}',
  'tournament.subtitleRoundZero': 'Round 0 / {total}',
  'tournament.finalResults': 'Final Results',
  'tournament.inProgress': 'In Progress',
  'tournament.round': 'Round {number}',
  'tournament.roundComplete': '✓ Complete',
  'tournament.roundProgress': '{done}/{total} done',
  'tournament.court': 'Court {number}',
  'tournament.team': 'Team',
  'tournament.won': 'W',
  'tournament.lost': 'L',
  'tournament.points': 'Pts',
  'tournament.sets': 'Sets',
  'tournament.scoreDiff': 'Score Diff',
  'tournament.rank': 'Rank',
  'tournament.hash': '#',
  'tournament.tiedTooltip': 'Tied on every metric — set the finishing order by hand',
  'tournament.tiedAria': 'Tied — needs manual ordering',
  'tournament.setTieBreak': 'Set tie-break order',
  'tournament.tieBreakTitle': 'Set the tie-break order',
  'tournament.tieBreakBody': 'These teams are tied on every metric — put them in the order they should finish:',
  'tournament.saveOrder': 'Save order',
  'tournament.moveUp': 'Move {team} up',
  'tournament.moveDown': 'Move {team} down',
  'tournament.group': 'Group {letter}',
  'tournament.knockoutStage': 'Knockout Stage',
  'tournament.groupTieWarning':
    'A group tie must be resolved before the knockout can start — use the ⇅ button on the tied rows above.',
  'tournament.winnersBracket': 'Winners Bracket',
  'tournament.consolationBracket': 'Consolation Bracket',
  'tournament.thirdPlace': '3rd Place',
  'tournament.tbd': 'TBD',
  'tournament.bye': 'BYE',
  'tournament.final': 'Final',
  'tournament.semiFinal': 'Semi Final',
  'tournament.nthOfFinal': '{count}th of Final',
  'tournament.teamsPerGroup': 'Teams per group',
  'tournament.qualifiersPerGroup': 'Qualifiers per group',
  'tournament.groupShapeUniform': '{count} {noun} of {size}',
  'tournament.groupShapeMixed': '{count} {noun} of {sizes}',
  'tournament.groupNounOne': 'group',
  'tournament.groupNounOther': 'groups',
  'tournament.groupSplitShort': '{teams} teams can\'t fill groups of {size}, so they\'ll play as {shape}.',
  'tournament.groupSplit': '{teams} teams → {shape}.',
  'tournament.groupTooFewQualifiers':
    'That leaves too few to seed a knockout — add teams or lower the group size.',
  'tournament.groupAllAdvance':
    'With the top {count} qualifying, every team advances — no one is eliminated in the group phase.',
  'tournament.tooFewQualifiersError':
    'Too few teams would qualify for a knockout — add teams or lower the group size.',
  'tournament.allAdvanceWarning':
    'No one will be eliminated in the group phase — every team advances. Is that what you want?',

  // Stats page
  'stats.backToApp': '← Court Manager',
  'stats.title': '{engine} Diagnostics',
  'stats.warnings': '⚠️ Warnings',
  'stats.currentSession': '🔍 Current Session Diagnostics',
  'stats.totalPlayers': 'Total Players',
  'stats.roundsPlayed': 'Rounds Played',
  'stats.repeatedPairs': 'Repeated Pairs',
  'stats.warningsLabel': 'Warnings',
  'stats.benchDistribution': '🪑 Bench Distribution',
  'stats.neverBenched': 'Never benched:',
  'stats.benchedOnce': 'Benched once:',
  'stats.benchedMultiple': 'Benched multiple times:',
  'stats.minMaxBench': 'Min/Max bench count:',
  'stats.fairnessScore': 'Fairness score:',
  'stats.lowerIsBetter': '(lower is better)',
  'stats.viewBenchCounts': 'View bench counts per player ({count})',
  'stats.teammateConnections': '👥 Teammate Connections',
  'stats.viewRepeatedPairs': 'View repeated pairs ({count})',
  'stats.noTeammatePairings': '✓ No teammate pairings recorded yet',
  'stats.opponentMatchups': '⚔️ Opponent Matchups',
  'stats.viewRepeatedMatchups': 'View repeated matchups ({count})',
  'stats.noOpponentMatchups': '✓ No opponent matchups recorded yet',
  'stats.singlesMatches': '🎯 Singles Matches',
  'stats.singlesSummary': '{count} players have played singles',
  'stats.singlesWithMultiple': '({count} with multiple)',
  'stats.viewSinglesList': 'View singles list ({count})',
  'stats.noSingles': 'No singles matches recorded',
  'stats.levelProgression': '📈 Level Progression',
  'stats.noData': 'No session data yet. Start playing to see diagnostics!',
  'stats.startGame': 'Start a Game →',
  'stats.githubAnalysis': '📊 GitHub Analysis',
  'stats.exploreAnalysis': 'Explore the Analysis',
  'stats.analysisBody':
    'Read the algorithm documentation, engine comparisons, and level tracker analysis on GitHub.',
  'stats.warnBenchImbalance':
    'Bench imbalance: spread of {spread} (expected ~{expected} for {rounds} rounds)',
  'stats.warnSingles':
    '{count} player(s) played singles {threshold}+ times (expected ~{expected} each)',
  'stats.warnPairs': '{count} pair(s) {label} {threshold}+ times (avg is {avg})',
  'stats.labelTeamedUp': 'teamed up',
  'stats.labelFacedEachOther': 'faced each other',

  // Not found
  'notFound.message': 'The page you\'re looking for doesn\'t exist.',
  'notFound.back': 'Go back to the Court Manager',

  // Image OCR
  'ocr.failed': 'Failed to process image. Please try again or add players manually.',

  // Engines
  'engine.sa.description':
    'Simulated Annealing with iterative improvement. Performs {iterations} iterations, accepting worse solutions probabilistically to escape local minima.',
  'engine.smart2.description':
    'Sliding window level grouping with win momentum and mixed doubles preference.',
} as const;

export type TranslationKey = keyof typeof en;
