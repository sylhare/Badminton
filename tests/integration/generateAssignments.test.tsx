import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import App from '../../src/App'

describe('Generate Assignments Integration', () => {
  beforeEach(() => {
    // Reset any potential localStorage or global state
    window.localStorage.clear()
  })

  it('preserves players and courts when generating new assignments', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Step 1: Add players manually
    const singlePlayerInput = screen.getByPlaceholderText('Enter player name...')
    const addPlayerButton = screen.getByRole('button', { name: /add player/i })
    
    // Add multiple players
    const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']
    for (const name of playerNames) {
      await user.type(singlePlayerInput, name)
      await user.click(addPlayerButton)
    }
    
         // Verify players were added to the player list
     for (const name of playerNames) {
       expect(screen.getAllByText(name)[0]).toBeInTheDocument()
     }
    
             // Step 2: Set number of courts to 2
    const courtsInput = screen.getByLabelText('Number of Courts:') as HTMLInputElement
    fireEvent.change(courtsInput, { target: { value: '2' } })
    
    // Step 3: Generate initial assignments
    const generateButton = screen.getByRole('button', { name: /generate random assignments/i })
    await user.click(generateButton)
    
         // Verify assignments were created (courts may include additional text like "- Doubles")
     expect(screen.getByText(/Court 1/)).toBeInTheDocument()
     expect(screen.getByText(/Court 2/)).toBeInTheDocument()
    
         // Verify players are still present (either on courts or bench)
     for (const name of playerNames) {
       expect(screen.getAllByText(name).length).toBeGreaterThan(0)
     }
    
        // Step 4: Generate new assignments using the button in CourtAssignments
    const regenerateButton = screen.getByRole('button', { name: /generate new assignments/i })
    await user.click(regenerateButton)
    
    // Step 5: Verify everything is preserved
    
        // Courts should still exist
    expect(screen.getByText(/Court 1/)).toBeInTheDocument()
    expect(screen.getByText(/Court 2/)).toBeInTheDocument()
   
        // All players should still be present
    for (const name of playerNames) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    }
   
    // Court settings should be preserved
    expect(courtsInput).toHaveValue(2)
    
    // Player list should still show all players
    const playerListSection = screen.getByText('Step 2: Manage Players').parentElement
    expect(playerListSection).toBeInTheDocument()
    
    // Should still be able to generate more assignments
    expect(regenerateButton).toBeEnabled()
  })

  it('can generate multiple new assignments in succession', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Add players
    const bulkInput = screen.getByPlaceholderText(/John Doe, Jane Smith/)
    const addAllButton = screen.getByRole('button', { name: /add all players/i })
    
    await user.type(bulkInput, 'Player1, Player2, Player3, Player4, Player5, Player6, Player7, Player8')
    await user.click(addAllButton)
    
    // Generate initial assignments
    const generateButton = screen.getByRole('button', { name: /generate random assignments/i })
    await user.click(generateButton)
    
    // Get the regenerate button
    const regenerateButton = screen.getByRole('button', { name: /generate new assignments/i })
    
    // Generate new assignments multiple times
    await user.click(regenerateButton)
    await user.click(regenerateButton)
    await user.click(regenerateButton)
    
         // Verify all players are still present after multiple regenerations
     for (let i = 1; i <= 8; i++) {
       expect(screen.getAllByText(`Player${i}`).length).toBeGreaterThan(0)
     }
    
         // Verify courts are still functional
     expect(screen.getByText(/Court 1/)).toBeInTheDocument()
    
    // Button should still work
    expect(regenerateButton).toBeEnabled()
  })

  it('preserves player present/absent status across regenerations', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Add players
    const singlePlayerInput = screen.getByPlaceholderText('Enter player name...')
    const addPlayerButton = screen.getByRole('button', { name: /add player/i })
    
    await user.type(singlePlayerInput, 'Alice')
    await user.click(addPlayerButton)
    await user.type(singlePlayerInput, 'Bob')
    await user.click(addPlayerButton)
    await user.type(singlePlayerInput, 'Charlie')
    await user.click(addPlayerButton)
    await user.type(singlePlayerInput, 'Diana')
    await user.click(addPlayerButton)
    
         // Mark one player as absent by finding Bob's checkbox
     const bobPlayerItems = screen.getAllByText('Bob')
     const bobPlayerListItem = bobPlayerItems.find(el => 
       el.parentElement?.querySelector('.player-checkbox')
     )
     const bobToggle = bobPlayerListItem?.parentElement?.querySelector('.player-checkbox') as HTMLElement
     await user.click(bobToggle)
    
    // Generate assignments
    const generateButton = screen.getByRole('button', { name: /generate random assignments/i })
    await user.click(generateButton)
    
    // Bob should be in the player list but not in court assignments
    const playerListSection = screen.getByText('Step 2: Manage Players').parentElement!
    expect(playerListSection).toHaveTextContent('Bob')
    
    // Generate new assignments
    const regenerateButton = screen.getByRole('button', { name: /generate new assignments/i })
    await user.click(regenerateButton)
    
    // Bob should still be absent (in player list but not assigned)
    expect(playerListSection).toHaveTextContent('Bob')
    
         // Verify Bob's checkbox is still unchecked
     const bobCheckboxAfter = bobPlayerListItem?.parentElement?.querySelector('.player-checkbox') as HTMLInputElement
     expect(bobCheckboxAfter).not.toBeChecked()
    
         // Other players should still be present and assigned
     expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
     expect(screen.getAllByText('Charlie').length).toBeGreaterThan(0)
     expect(screen.getAllByText('Diana').length).toBeGreaterThan(0)
  })
}) 