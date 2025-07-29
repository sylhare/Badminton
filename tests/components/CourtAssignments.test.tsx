import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import CourtAssignments from '../../src/components/CourtAssignments'
import { Court, Player } from '../../src/App'

describe('CourtAssignments Component', () => {
  const mockOnGenerateNewAssignments = vi.fn()
  
  const mockPlayers: Player[] = [
    { id: '1', name: 'Alice', isPresent: true },
    { id: '2', name: 'Bob', isPresent: true },
    { id: '3', name: 'Charlie', isPresent: true },
    { id: '4', name: 'Diana', isPresent: true },
    { id: '5', name: 'Eve', isPresent: true },
    { id: '6', name: 'Frank', isPresent: true }
  ]

  const mockAssignments: Court[] = [
    {
      courtNumber: 1,
      players: [mockPlayers[0], mockPlayers[1], mockPlayers[2], mockPlayers[3]],
      teams: {
        team1: [mockPlayers[0], mockPlayers[1]],
        team2: [mockPlayers[2], mockPlayers[3]]
      }
    }
  ]

  const mockBenchedPlayers: Player[] = [mockPlayers[4], mockPlayers[5]]

  const defaultProps = {
    assignments: mockAssignments,
    benchedPlayers: mockBenchedPlayers,
    onGenerateNewAssignments: mockOnGenerateNewAssignments
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders court assignments correctly', () => {
    render(<CourtAssignments {...defaultProps} />)
    
    expect(screen.getByText(/Court 1/)).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
    expect(screen.getByText('Diana')).toBeInTheDocument()
  })

  it('renders benched players correctly', () => {
    render(<CourtAssignments {...defaultProps} />)
    
    expect(screen.getByText('🪑 Bench (2 players)')).toBeInTheDocument()
    expect(screen.getByText('Eve')).toBeInTheDocument()
    expect(screen.getByText('Frank')).toBeInTheDocument()
  })

  it('renders generate new assignments button', () => {
    render(<CourtAssignments {...defaultProps} />)
    
    const button = screen.getByRole('button', { name: /generate new assignments/i })
    expect(button).toBeInTheDocument()
  })

  it('calls onGenerateNewAssignments when generate button is clicked', async () => {
    const user = userEvent.setup()
    render(<CourtAssignments {...defaultProps} />)
    
    const button = screen.getByRole('button', { name: /generate new assignments/i })
    await user.click(button)
    
    expect(mockOnGenerateNewAssignments).toHaveBeenCalledTimes(1)
  })

  it('does not render bench section when no benched players', () => {
    const propsWithoutBench = {
      ...defaultProps,
      benchedPlayers: []
    }
    
    render(<CourtAssignments {...propsWithoutBench} />)
    
    expect(screen.queryByText(/bench/i)).not.toBeInTheDocument()
  })

  it('handles singular bench player count correctly', () => {
    const propsWithOneBench = {
      ...defaultProps,
      benchedPlayers: [mockPlayers[4]]
    }
    
    render(<CourtAssignments {...propsWithOneBench} />)
    
    expect(screen.getByText('🪑 Bench (1 player)')).toBeInTheDocument()
  })

  it('renders multiple courts correctly', () => {
    const multipleCourtAssignments: Court[] = [
      {
        courtNumber: 1,
        players: [mockPlayers[0], mockPlayers[1]],
        teams: {
          team1: [mockPlayers[0]],
          team2: [mockPlayers[1]]
        }
      },
      {
        courtNumber: 2,
        players: [mockPlayers[2], mockPlayers[3]],
        teams: {
          team1: [mockPlayers[2]],
          team2: [mockPlayers[3]]
        }
      }
    ]

    const propsWithMultipleCourts = {
      ...defaultProps,
      assignments: multipleCourtAssignments
    }
    
    render(<CourtAssignments {...propsWithMultipleCourts} />)
    
    expect(screen.getByText(/Court 1/)).toBeInTheDocument()
    expect(screen.getByText(/Court 2/)).toBeInTheDocument()
  })

  it('preserves player data when generating new assignments', async () => {
    const user = userEvent.setup()
    render(<CourtAssignments {...defaultProps} />)
    
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Eve')).toBeInTheDocument()
    
    const button = screen.getByRole('button', { name: /generate new assignments/i })
    await user.click(button)
    
    expect(mockOnGenerateNewAssignments).toHaveBeenCalledTimes(1)
    
  })
}) 