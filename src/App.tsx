import React, { useState, useEffect, useRef } from 'react';

import './App.css';
import ImageUpload from './components/ImageUpload';
import ManualPlayerEntry from './components/ManualPlayerEntry';
import PlayerList from './components/PlayerList';
import CourtSettings from './components/CourtSettings';
import CourtAssignments from './components/CourtAssignments';
import ManualCourtSelectionComponent from './components/ManualCourtSelection';
import Leaderboard from './components/Leaderboard';
import { CourtAssignmentEngine, generateCourtAssignments, getBenchedPlayers } from './utils/CourtAssignmentEngine';
import { createPlayersFromNames } from './utils/playerUtils';
import { saveAppState, loadAppState, clearAllStoredState } from './utils/storageUtils';
import { useStepRegistry, StepCallbacks } from './hooks/useStepRegistry';
import type { Player, Court, ManualCourtSelection, WinnerSelection } from './types';

function App(): React.ReactElement {
  const loadedState = loadAppState();
  const [players, setPlayers] = useState<Player[]>(loadedState.players ?? []);
  const [numberOfCourts, setNumberOfCourts] = useState<number>(loadedState.numberOfCourts ?? 4);
  const [assignments, setAssignments] = useState<Court[]>(loadedState.assignments ?? []);
  const [collapsedSteps, setCollapsedSteps] = useState<Set<number>>(loadedState.collapsedSteps ?? new Set());
  const [manualCourtSelection, setManualCourtSelection] = useState<ManualCourtSelection | null>(loadedState.manualCourt ?? null);

  const isInitialLoad = useRef(true);

  useEffect(() => {
    CourtAssignmentEngine.loadState();
    isInitialLoad.current = false;
  }, []);

  useEffect(() => {
    if (isInitialLoad.current) return;

    const assignmentsWithWinners = assignments.filter(court => court.winner);
    if (assignmentsWithWinners.length > 0) {
      CourtAssignmentEngine.recordWins(assignmentsWithWinners);
    }
  }, [assignments]);

  useEffect(() => {
    if (isInitialLoad.current) return;

      saveAppState({
        players,
        numberOfCourts,
        assignments,
        collapsedSteps,
        manualCourt: manualCourtSelection,
      });
    CourtAssignmentEngine.saveState();
    }, [players, numberOfCourts, assignments, collapsedSteps, manualCourtSelection]);

  const handlePlayersExtracted = (extractedNames: string[]) => {
    const newPlayers = createPlayersFromNames(extractedNames, 'extracted');
    setPlayers(newPlayers);
    setCollapsedSteps(prev => {
      const next = new Set(prev);
      next.add(1);
      next.delete(2);
      return next;
    });
  };

  const handleManualPlayersAdded = (newNames: string[]) => {
    const newPlayers = createPlayersFromNames(newNames, 'manual');
    setPlayers(prev => [...prev, ...newPlayers]);
    setCollapsedSteps(prev => {
      const next = new Set(prev);
      if (newNames.length > 1) {
        next.add(1);
      }
      next.delete(2);
      return next;
    });
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

  const recordCurrentWins = () => {
    if (assignments.length > 0) {
      const assignmentsWithWinners = assignments.filter(court => court.winner);
      if (assignmentsWithWinners.length > 0) {
        CourtAssignmentEngine.recordWins(assignmentsWithWinners);
      }
    }
  };

  const handleClearAllPlayers = () => {
    setPlayers([]);
    setAssignments([]);
    setCollapsedSteps(new Set());
    setManualCourtSelection(null);
    CourtAssignmentEngine.resetHistory();
    setTimeout(() => clearAllStoredState(), 0);
  };

  const handleResetAlgorithm = () => {
    CourtAssignmentEngine.resetHistory();
    CourtAssignmentEngine.saveState();
  };

  const generateAssignments = () => {
    recordCurrentWins();
    CourtAssignmentEngine.clearCurrentSession();
    const hadManualSelection = manualCourtSelection !== null && manualCourtSelection.players.length > 0;
    const courts = generateCourtAssignments(players, numberOfCourts, manualCourtSelection || undefined);

    if (hadManualSelection) {
      courts.forEach(court => {
        if (court.courtNumber === 1) {
          court.wasManuallyAssigned = true;
        }
      });
    }

    setAssignments(courts);
    setCollapsedSteps(new Set([1, 2, 3]));
    setManualCourtSelection(null);
  };

  const handleWinnerChange = (courtNumber: number, winner: WinnerSelection) => {
    setAssignments(prevAssignments =>
      prevAssignments.map(court =>
        court.courtNumber === courtNumber
          ? { ...court, winner }
          : court,
      ),
    );
  };

  const stepCallbacks: StepCallbacks = {
    handlePlayersExtracted,
    handleManualPlayersAdded,
    handlePlayerToggle,
    handleRemovePlayer,
    handleClearAllPlayers,
    handleResetAlgorithm,
    generateAssignments,
    handleWinnerChange,
    setNumberOfCourts,
    setManualCourtSelection,
  };

  const { steps, toggleStep: toggleStepFromRegistry } = useStepRegistry(
    players,
    assignments,
    collapsedSteps,
    stepCallbacks,
  );

  const handleToggleStep = (stepNumber: number, event?: React.MouseEvent) => {
    if (event?.target !== event?.currentTarget) {
      // Only toggle if clicking directly on the header area, not on children
      const target = event?.target as HTMLElement;
      const isHeaderClick = target.closest('.step-header') !== null;
      if (!isHeaderClick) return;
    }
    toggleStepFromRegistry(stepNumber, setCollapsedSteps);
  };

  const renderStepContent = (stepId: number) => {
    switch (stepId) {
      case 1:
        return (
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
        );
      case 2:
        return (
          <PlayerList
            players={players}
            onPlayerToggle={handlePlayerToggle}
            onRemovePlayer={handleRemovePlayer}
            onClearAllPlayers={handleClearAllPlayers}
            onResetAlgorithm={handleResetAlgorithm}
          />
        );
      case 3:
        return (
          <CourtSettings
            numberOfCourts={numberOfCourts}
            onNumberOfCourtsChange={setNumberOfCourts}
            onGenerateAssignments={generateAssignments}
            hasPlayers={players.some(p => p.isPresent)}
          />
        );
      case 4:
        return (
          <>
            <ManualCourtSelectionComponent
              players={players}
              onSelectionChange={setManualCourtSelection}
              currentSelection={manualCourtSelection}
            />
            <CourtAssignments
              assignments={assignments}
              benchedPlayers={getBenchedPlayers(assignments, players)}
              onGenerateNewAssignments={generateAssignments}
              onWinnerChange={handleWinnerChange}
              hasManualCourtSelection={assignments.some(court => (court as any).wasManuallyAssigned)}
            />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <div className="container">
        <h1>🏸 Badminton Court Manager</h1>

        {steps.map(step => (
          <div
            key={step.id}
            className={`step${step.isCollapsed ? ' collapsed' : ''}`}
            onClick={(e) => handleToggleStep(step.id, e)}
          >
            <div className="step-header">
              <h2>{step.title}</h2>
            </div>
            {!step.isCollapsed && renderStepContent(step.id)}
          </div>
        ))}

        <Leaderboard players={players} winCounts={CourtAssignmentEngine.getWinCounts()} />
      </div>
    </div>
  );
}

export default App;