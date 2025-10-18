import React from 'react';
import { Player, Court, ManualCourtSelection } from '../App';

export interface StepAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  isDestructive?: boolean;
}

export interface StepDefinition {
  id: number;
  title: string;
  baseTitle: string;
  isVisible: boolean;
  isCollapsed: boolean;
  actions?: StepAction[];
}

export interface StepCallbacks {
  handlePlayersExtracted: (extractedNames: string[]) => void;
  handleManualPlayersAdded: (newNames: string[]) => void;
  handlePlayerToggle: (playerId: string) => void;
  handleRemovePlayer: (playerId: string) => void;
  handleClearAllPlayers: () => void;
  handleResetAlgorithm: () => void;
  generateAssignments: () => void;
  handleWinnerChange: (courtNumber: number, winner: 1 | 2 | undefined) => void;
  setNumberOfCourts: (count: number) => void;
  setManualCourtSelection: (selection: ManualCourtSelection | null) => void;
}

export const useStepRegistry = (
  players: Player[],
  numberOfCourts: number,
  assignments: Court[],
  collapsedSteps: Set<number>,
  manualCourtSelection: ManualCourtSelection | null,
  benchedPlayers: Player[],
  callbacks: StepCallbacks
) => {
  const toggleStep = (stepNumber: number, setCollapsedSteps: React.Dispatch<React.SetStateAction<Set<number>>>) => {
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

  const getStepTitle = (stepNumber: number, baseTitle: string) =>
    collapsedSteps.has(stepNumber) ? baseTitle : `Step ${stepNumber}: ${baseTitle}`;

  const steps: StepDefinition[] = [
    // Step 1: Add Players
    {
      id: 1,
      baseTitle: 'Add Players',
      title: getStepTitle(1, 'Add Players'),
      isVisible: true,
      isCollapsed: collapsedSteps.has(1),
    },

    // Step 2: Manage Players
    {
      id: 2,
      baseTitle: 'Manage Players',
      title: getStepTitle(2, 'Manage Players'),
      isVisible: players.length > 0,
      isCollapsed: collapsedSteps.has(2),
      actions: [
        {
          label: "Clear All Players",
          icon: React.createElement('span', {}, '🗑️'),
          onClick: callbacks.handleClearAllPlayers,
          isDestructive: true,
        },
        {
          label: "Reset Algorithm",
          icon: React.createElement('span', {}, '🔄'),
          onClick: callbacks.handleResetAlgorithm,
          isDestructive: false,
        },
      ],
    },

    // Step 3: Court Settings  
    {
      id: 3,
      baseTitle: 'Court Settings',
      title: getStepTitle(3, 'Court Settings'),
      isVisible: players.some(p => p.isPresent),
      isCollapsed: collapsedSteps.has(3),
    },

    // Step 4: Court Assignments
    {
      id: 4,
      baseTitle: 'Court Assignments',
      title: 'Court Assignments',
      isVisible: assignments.length > 0,
      isCollapsed: collapsedSteps.has(4),
      actions: [
        {
          label: "Generate New Assignments",
          icon: React.createElement('span', {}, '🎲'),
          onClick: callbacks.generateAssignments,
          isDestructive: false,
        },
      ],
    },
  ];

  const visibleSteps = steps.filter(step => step.isVisible);
  const collapsedStepsData = visibleSteps.filter(step => step.isCollapsed);
  const hasCollapsedSteps = collapsedStepsData.length > 0;

  return {
    steps: visibleSteps,
    collapsedSteps: collapsedStepsData,
    hasCollapsedSteps,
    toggleStep,
    getStepTitle,
  };
};
