import React, { useState } from 'react'
import './App.css'
import ImageUpload from './components/ImageUpload'
import ManualPlayerEntry from './components/ManualPlayerEntry'
import PlayerList from './components/PlayerList'
import CourtSettings from './components/CourtSettings'
import CourtAssignments from './components/CourtAssignments'

export interface Player {
  id: string
  name: string
  isPresent: boolean
}

export interface Court {
  courtNumber: number
  players: Player[]
  teams?: {
    team1: Player[]
    team2: Player[]
  }
}

function App() {
  const [players, setPlayers] = useState<Player[]>([])
  const [numberOfCourts, setNumberOfCourts] = useState<number>(1)
  const [assignments, setAssignments] = useState<Court[]>([])

  const handlePlayersExtracted = (extractedNames: string[]) => {
    const newPlayers: Player[] = extractedNames.map((name, index) => ({
      id: `player-${index}`,
      name: name.trim(),
      isPresent: true
    }))
    setPlayers(newPlayers)
  }

  const handleManualPlayersAdded = (newNames: string[]) => {
    const newPlayers: Player[] = newNames.map((name, index) => ({
      id: `player-${Date.now()}-${index}`,
      name: name.trim(),
      isPresent: true
    }))
    setPlayers(prev => [...prev, ...newPlayers])
  }

  const handlePlayerToggle = (playerId: string) => {
    setPlayers(prev => 
      prev.map(player => 
        player.id === playerId 
          ? { ...player, isPresent: !player.isPresent }
          : player
      )
    )
  }



  const handleRemovePlayer = (playerId: string) => {
    setPlayers(prev => prev.filter(player => player.id !== playerId))
  }

  const generateAssignments = () => {
    const presentPlayers = players.filter(player => player.isPresent)
    
    if (presentPlayers.length === 0) {
      setAssignments([])
      return
    }

    // Shuffle players randomly
    const shuffledPlayers = [...presentPlayers].sort(() => Math.random() - 0.5)
    
    const courts: Court[] = []
    const playersPerCourt = 4 // For doubles
    const totalCourtSpots = numberOfCourts * playersPerCourt
    
    let playerIndex = 0

    for (let courtNum = 1; courtNum <= numberOfCourts; courtNum++) {
      const courtPlayers: Player[] = []
      
      // Try to fill with 4 players for doubles
      for (let i = 0; i < playersPerCourt && playerIndex < shuffledPlayers.length; i++) {
        courtPlayers.push(shuffledPlayers[playerIndex])
        playerIndex++
      }

      if (courtPlayers.length > 0) {
        const court: Court = {
          courtNumber: courtNum,
          players: courtPlayers
        }

        // Create teams for doubles (4 players) or singles (2 players)
        if (courtPlayers.length >= 4) {
          court.teams = {
            team1: [courtPlayers[0], courtPlayers[1]],
            team2: [courtPlayers[2], courtPlayers[3]]
          }
        } else if (courtPlayers.length === 2) {
          court.teams = {
            team1: [courtPlayers[0]],
            team2: [courtPlayers[1]]
          }
        } else if (courtPlayers.length === 3) {
          // For 3 players, 2 play and 1 sits out
          court.teams = {
            team1: [courtPlayers[0]],
            team2: [courtPlayers[1]]
          }
        }

        courts.push(court)
      }
    }

    setAssignments(courts)
  }

  const getBenchedPlayers = (): Player[] => {
    const assignedPlayerIds = new Set(
      assignments.flatMap(court => court.players.map(p => p.id))
    )
    return players.filter(player => 
      player.isPresent && !assignedPlayerIds.has(player.id)
    )
  }

  return (
    <div className="app">
      <div className="container">
        <h1>🏸 Badminton Court Manager</h1>
        
        <div className="step">
          <h2>Step 1: Add Players</h2>
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
          <div className="step">
            <h2>Step 2: Manage Players</h2>
            <PlayerList
              players={players}
              onPlayerToggle={handlePlayerToggle}
              onRemovePlayer={handleRemovePlayer}
            />
          </div>
        )}

        <div className="step">
          <h2>Step 3: Court Settings</h2>
          <CourtSettings
            numberOfCourts={numberOfCourts}
            onNumberOfCourtsChange={setNumberOfCourts}
            onGenerateAssignments={generateAssignments}
            hasPlayers={players.some(p => p.isPresent)}
          />
        </div>

        {assignments.length > 0 && (
          <div className="step">
            <h2>Step 4: Court Assignments</h2>
            <CourtAssignments
              assignments={assignments}
              benchedPlayers={getBenchedPlayers()}
              onGenerateNewAssignments={generateAssignments}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default App 