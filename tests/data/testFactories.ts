import React from 'react';
import { vi } from 'vitest';

import { Player } from '../../src/App';

export function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: `player-${Date.now()}-${Math.random()}`,
    name: 'Test Player',
    isPresent: true,
    ...overrides,
  };
}

export function createMockPlayers(count: number, baseOverrides: Partial<Player> = {}): Player[] {
  return Array.from({ length: count }, (_, index) =>
    createMockPlayer({
      id: `player-${index}`,
      name: `Player ${index + 1}`,
      ...baseOverrides,
    }),
  );
}

export const MOCK_PLAYERS = {
  basic: [
    createMockPlayer({ id: 'player-1', name: 'John Doe' }),
    createMockPlayer({ id: 'player-2', name: 'Jane Smith' }),
    createMockPlayer({ id: 'player-3', name: 'Bob Wilson' }),
  ],

  withAbsent: [
    createMockPlayer({ id: 'player-1', name: 'John Doe', isPresent: true }),
    createMockPlayer({ id: 'player-2', name: 'Jane Smith', isPresent: true }),
    createMockPlayer({ id: 'player-3', name: 'Bob Wilson', isPresent: false }),
  ],

  specialNames: [
    createMockPlayer({ id: 'player-1', name: 'José María' }),
    createMockPlayer({ id: 'player-2', name: 'O\'Connor' }),
    createMockPlayer({ id: 'player-3', name: 'Smith-Jones' }),
  ],

  single: [
    createMockPlayer({ id: 'player-solo', name: 'Solo Player' }),
  ],

  longName: [
    createMockPlayer({
      id: 'player-long',
      name: 'Alexander Maximilian Von Habsburg-Lorraine III',
    }),
  ],

  doubles: createMockPlayers(4, { isPresent: true }),

  team: createMockPlayers(2, { isPresent: true }),
};

export function createMockFile(
  name: string,
  type: string,
  content: string[] = [''],
): File {
  return new File(content, name, { type });
}

export const MOCK_FILES = {
  image: {
    jpg: createMockFile('test.jpg', 'image/jpeg'),
    png: createMockFile('test.png', 'image/png'),
    gif: createMockFile('test.gif', 'image/gif'),
    svg: createMockFile('test.svg', 'image/svg+xml'),
  },

  nonImage: {
    txt: createMockFile('test.txt', 'text/plain'),
    pdf: createMockFile('test.pdf', 'application/pdf'),
    json: createMockFile('test.json', 'application/json'),
    video: createMockFile('test.mp4', 'video/mp4'),
  },
};

export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
  };

  files.forEach((file, index) => {
    (fileList as any)[index] = file;
  });

  return fileList as unknown as FileList;
}

export function createMockDragEvent(files: File[] = []): React.DragEvent<HTMLDivElement> {
  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      files: createMockFileList(files),
    },
  } as unknown as React.DragEvent<HTMLDivElement>;
}