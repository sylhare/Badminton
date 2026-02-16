import type { Court, Player, ManualCourtSelection, ICourtAssignmentEngine } from '../types';
import { CourtAssignmentTracker } from './CourtAssignmentTracker';

/**
 * Base Court Assignment Engine
 *
 * Implements the Template Method pattern for court generation.
 * Handles common tasks like:
 * - Filtering present players
 * - Managing manual court selections
 * - Calculating and assigning bench spots
 * - Recording statistics (benching, singles, pairs)
 *
 * Subclasses must implement `generateAssignments` to provide the specific
 * algorithm for pairing players on the available courts.
 */
export abstract class BaseCourtAssignmentEngine extends CourtAssignmentTracker implements ICourtAssignmentEngine {

    /**
     * Generates court assignments for a set of players.
     * This template method defines the skeletal implementation of the assignment process.
     */
    generate(
        players: Player[],
        numberOfCourts: number,
        manualSelection?: ManualCourtSelection,
        forceBenchPlayerIds?: Set<string>
    ): Court[] {
        const presentPlayers = players.filter(p => p.isPresent);
        if (presentPlayers.length === 0) return [];

        let manualCourtResult: Court | null = null;
        let remainingPlayers = presentPlayers;
        let remainingCourts = numberOfCourts;

        // 1. Handle Manual Selection
        if (manualSelection && manualSelection.players.length > 0) {
            const manualPlayers = manualSelection.players.filter(p => p.isPresent);
            // Minimum 2 players for a game, max 4.
            // Note: If only 2 or 3 players are manually selected, specific engines might handle filling them differently
            // or here we assume manual selection is a complete court for simplicity in typical use cases,
            // or the user manually selected a partial court.
            // The existing engines logic checks for >= 2 and <= 4.
            if (manualPlayers.length >= 2 && manualPlayers.length <= 4) {
                // We need a strategy to split teams for manual courts if 4 players.
                // Since `chooseBestTeamSplit` might be specific to the engine's heuristics,
                // we can either make it abstract or provide a default/simple one here.
                // Most engines use a cost-based split.
                // For the base class, we can delegate the team splitting implementation to the subclass
                // via an abstract or hook method if needed.
                // HOWEVER, `createManualCourt` takes a splitter callback.
                // Let's define a helper `getBestTeamSplit` that subclasses can override or implement.
                manualCourtResult = this.createManualCourt(manualPlayers, 1, (p) => this.getOptimalTeamSplit(p));
                remainingPlayers = presentPlayers.filter(p => !manualPlayers.some(mp => mp.id === p.id));
                remainingCourts = numberOfCourts - 1;
            }
        }

        // 2. Calculate Bench Spots
        const capacity = remainingCourts * 4;
        let benchSpots = Math.max(0, remainingPlayers.length - capacity);
        // Ensure even number of players if possible, or just standard logic
        // The existing logic: if (remaining - bench) % 2 === 1, bench += 1.
        // This ensures the number of players playing is even (for singles/doubles compatibility).
        if ((remainingPlayers.length - benchSpots) % 2 === 1) benchSpots += 1;
        benchSpots = Math.min(benchSpots, remainingPlayers.length);

        // 3. Select Benched Players
        const forceBenchedPlayers = forceBenchPlayerIds
            ? remainingPlayers.filter(p => forceBenchPlayerIds.has(p.id))
            : [];

        const additionalBenchSpots = Math.max(0, benchSpots - forceBenchedPlayers.length);
        const playersForAlgorithmBench = remainingPlayers.filter(p => !forceBenchPlayerIds?.has(p.id));
        const algorithmBenchedPlayers = this.selectBenchedPlayers(playersForAlgorithmBench, additionalBenchSpots);

        const benchedPlayers = [...forceBenchedPlayers, ...algorithmBenchedPlayers];

        // 4. Identify On-Court Players
        const onCourtPlayers = remainingPlayers.filter(p => !benchedPlayers.includes(p));

        // 5. Generate Assignments (Core Algorithm)
        const startCourtNum = manualCourtResult ? 2 : 1;
        const generatedCourts = this.generateAssignments(onCourtPlayers, remainingCourts, startCourtNum);

        // 6. Combine Results
        let finalCourts = generatedCourts;
        if (manualCourtResult) {
            finalCourts = [manualCourtResult, ...finalCourts];
        }

        // 7. Record Statistics / Telemetry
        this.recordSessionStats(benchedPlayers, finalCourts);

        return finalCourts;
    }

    /**
     * Core algorithm implementation to be defined by subclasses.
     * @param players Players available for assignment (already filtered for benching).
     * @param numberOfCourts Number of courts to fill.
     * @param startCourtNum The starting court number (offset if manual court exists).
     */
    protected abstract generateAssignments(players: Player[], numberOfCourts: number, startCourtNum: number): Court[];

    /**
     * Helper to split 4 players into 2 teams.
     * Subclasses should implement their specific heuristic (cost interpretation).
     * By default, engines used `chooseBestTeamSplit`.
     */
    protected abstract getOptimalTeamSplit(players: Player[]): Court['teams'];

    /**
     * Evaluates the cost of a specific team split.
     * Each engine implements its own cost calculation logic.
     */
    protected abstract evaluateTeamSplitCost(team1: Player[], team2: Player[]): number;

    /**
     * Chooses the best team split from all possible configurations.
     * Uses the engine-specific cost evaluation to select optimal teams.
     */
    protected chooseBestTeamSplit(players: Player[]): { teams: Court['teams']; cost: number } {
        const splits: Array<[[number, number], [number, number]]> = [
            [[0, 1], [2, 3]],
            [[0, 2], [1, 3]],
            [[0, 3], [1, 2]],
        ];

        let bestCost = Infinity;
        let bestTeams: Court['teams'];

        for (const split of splits) {
            const team1 = [players[split[0][0]], players[split[0][1]]];
            const team2 = [players[split[1][0]], players[split[1][1]]];
            const cost = this.evaluateTeamSplitCost(team1, team2);

            if (cost < bestCost) {
                bestCost = cost;
                bestTeams = { team1, team2 };
            }
        }

        return { teams: bestTeams!, cost: bestCost };
    }

    /**
     * Records statistics for the generated round.
     */
    protected recordSessionStats(benchedPlayers: Player[], courts: Court[]): void {
        benchedPlayers.forEach(p => this.recordBenching(p.id));

        courts.forEach(court => {
            if (!court.teams) return;

            // Record Singles
            if (court.players.length === 2) {
                court.players.forEach(p => this.recordSingles(p.id));
            }

            // Record Teammate Pairs
            const addTeamPairs = (team: Player[]) => {
                for (let i = 0; i < team.length; i++) {
                    for (let j = i + 1; j < team.length; j++) {
                        this.recordTeammatePair(team[i].id, team[j].id);
                    }
                }
            };
            addTeamPairs(court.teams.team1);
            addTeamPairs(court.teams.team2);

            // Record Opponent Pairs
            court.teams.team1.forEach(a => {
                court.teams!.team2.forEach(b => {
                    this.recordOpponentPair(a.id, b.id);
                });
            });
        });
    }
}
