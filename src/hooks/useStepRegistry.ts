import React from 'react';

import type { Player, Court, ManualCourtSelection } from '../types';

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

export interface StepRegistryHook {
  steps: StepDefinition[];
  collapsedSteps: StepDefinition[];
  hasCollapsedSteps: boolean;
  toggleStep: (stepNumber: number, setCollapsedSteps: React.Dispatch<React.SetStateAction<Set<number>>>) => void;
  getStepTitle: (stepNumber: number, baseTitle: string) => string;
}

export const useStepRegistry = (
  players: Player[],
  assignments: Court[],
  collapsedSteps: Set<number>,
  callbacks: StepCallbacks,
): StepRegistryHook => {
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

  const getStepTitle = (stepNumber: number, baseTitle: string) => {
    const steps = collapsedSteps instanceof Set ? collapsedSteps : new Set();
    return steps.has(stepNumber) ? baseTitle : `Step ${stepNumber}: ${baseTitle}`;
  };

  const steps: StepDefinition[] = [
    {
      id: 1,
      baseTitle: 'Add Players',
      title: getStepTitle(1, 'Add Players'),
      isVisible: true,
      isCollapsed: (collapsedSteps instanceof Set ? collapsedSteps : new Set()).has(1),
    },
    {
      id: 2,
      baseTitle: 'Manage Players',
      title: getStepTitle(2, 'Manage Players'),
      isVisible: players.length > 0,
      isCollapsed: (collapsedSteps instanceof Set ? collapsedSteps : new Set()).has(2),
      actions: [
        {
          label: 'Clear All Players',
          icon: React.createElement('span', {}, '🗑️'),
          onClick: callbacks.handleClearAllPlayers,
          isDestructive: true,
        },
        {
          label: 'Reset Algorithm',
          icon: React.createElement('span', {}, '🔄'),
          onClick: callbacks.handleResetAlgorithm,
          isDestructive: false,
        },
      ],
    },
    {
      id: 3,
      baseTitle: 'Court Settings',
      title: getStepTitle(3, 'Court Settings'),
      isVisible: players.some(p => p.isPresent),
      isCollapsed: (collapsedSteps instanceof Set ? collapsedSteps : new Set()).has(3),
    },
    {
      id: 4,
      baseTitle: 'Court Assignments',
      title: 'Court Assignments',
      isVisible: assignments.length > 0,
      isCollapsed: (collapsedSteps instanceof Set ? collapsedSteps : new Set()).has(4),
      actions: [
        {
          label: 'Generate New Assignments',
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
