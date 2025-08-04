import React, { useState } from 'react';

import './App.css';
import ImageUpload from './components/ImageUpload';
import ManualPlayerEntry from './components/ManualPlayerEntry';
import PlayerList from './components/PlayerList';
import CourtSettings from './components/CourtSettings';
import CourtAssignments from './components/CourtAssignments';
import Leaderboard from './components/Leaderboard';
import { CourtAssignmentEngine, generateCourtAssignments, getBenchedPlayers } from './utils/CourtAssignmentEngine';
import { createPlayersFromNames } from './utils/playerUtils';

export interface Player {
  id: string;
  name: string;
  isPresent: boolean;
}

export interface Court {
  courtNumber: number;
  players: Player[];
  teams?: {
    team1: Player[]
    team2: Player[]
  };
  winner?: 1 | 2; // 1 for team1, 2 for team2
}

function App(): React.ReactElement {
  const [players, setPlayers] = useState<Player[]>([]);
  const [numberOfCourts, setNumberOfCourts] = useState<number>(4);
  const [assignments, setAssignments] = useState<Court[]>([]);
  const [collapsedSteps, setCollapsedSteps] = useState<Set<number>>(new Set());

  const handlePlayersExtracted = (extractedNames: string[]) => {
    const newPlayers = createPlayersFromNames(extractedNames, 'extracted');
    setPlayers(newPlayers);
    setCollapsedSteps(prev => {
      const next = new Set(prev);
      next.add(1);
      return next;
    });
  };

  const handleManualPlayersAdded = (newNames: string[]) => {
    const newPlayers = createPlayersFromNames(newNames, 'manual');
    setPlayers(prev => [...prev, ...newPlayers]);
    if (newNames.length > 1) {
      setCollapsedSteps(prev => {
        const next = new Set(prev);
        next.add(1);
        return next;
      });
    }
  };

  const handlePlayerToggle = (playerId: string) => {
    setPlayers(prev =>
      prev.map(player =>
        player.id === playerId
          ? { ...player, isPresent: !player.isPresent }
          : player,
      ),
    );
  };

  const handleRemovePlayer = (playerId: string) => {
    setPlayers(prev => prev.filter(player => player.id !== playerId));
  };

  const toggleStep = (stepNumber: number) => {
    setCollapsedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const generateAssignments = () => {
    if (assignments.length > 0) {
      CourtAssignmentEngine.recordWins(assignments);
    }
    const courts = generateCourtAssignments(players, numberOfCourts);
    setAssignments(courts);
    setCollapsedSteps(new Set([1, 2, 3]));
  };

  const handleWinnerChange = (courtNumber: number, winner: 1 | 2 | undefined) => {
    setAssignments(prevAssignments =>
      prevAssignments.map(court =>
        court.courtNumber === courtNumber
          ? { ...court, winner }
          : court,
      ),
    );
  };

  const getStepTitle = (stepNumber: number, baseTitle: string) =>
    collapsedSteps.has(stepNumber) ? baseTitle : `Step ${stepNumber}: ${baseTitle}`;

  return (
    <div className="app">
      <div className="container">
        <h1>🏸 Badminton Court Manager</h1>

        <div className={`step ${collapsedSteps.has(1) ? 'collapsed' : ''}`}>
          <h2 onClick={() => toggleStep(1)}>{getStepTitle(1, 'Add Players')}</h2>
          <div className="add-players-options">
            <div className="add-option">
              <h3>From Image</h3>
              <ImageUpload onPlayersExtracted={handlePlayersExtracted} />
            </div>
            <div className="add-option-divider">OR</div>
            <div className="add-option">
              <h3>Manual Entry</h3>
              <ManualPlayerEntry onPlayersAdded={handleManualPlayersAdded} />
            </div>
          </div>
        </div>

        {players.length > 0 && (
          <div className={`step ${collapsedSteps.has(2) ? 'collapsed' : ''}`}>
            <h2 onClick={() => toggleStep(2)}>{getStepTitle(2, 'Manage Players')}</h2>
            <PlayerList
              players={players}
              onPlayerToggle={handlePlayerToggle}
              onRemovePlayer={handleRemovePlayer}
            />
          </div>
        )}

        {players.some(p => p.isPresent) && (
          <div className={`step ${collapsedSteps.has(3) ? 'collapsed' : ''}`}>
            <h2 onClick={() => toggleStep(3)}>{getStepTitle(3, 'Court Settings')}</h2>
            <CourtSettings
              numberOfCourts={numberOfCourts}
              onNumberOfCourtsChange={setNumberOfCourts}
              onGenerateAssignments={generateAssignments}
              hasPlayers={players.some(p => p.isPresent)}
            />
          </div>
        )}

        {assignments.length > 0 && (
          <div className={`step ${collapsedSteps.has(4) ? 'collapsed' : ''}`}>
            <h2 onClick={() => toggleStep(4)}>Court Assignments</h2>
            <CourtAssignments
              assignments={assignments}
              benchedPlayers={getBenchedPlayers(assignments, players)}
              onGenerateNewAssignments={generateAssignments}
              onWinnerChange={handleWinnerChange}
            />
          </div>
        )}

        {/* Leaderboard */}
        <Leaderboard players={players} winCounts={CourtAssignmentEngine.getWinCounts()} />
      </div>
    </div>
  );
}

export default App;