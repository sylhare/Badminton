import React from 'react'
import { Court, Player } from '../App'

interface CourtAssignmentsProps {
  assignments: Court[]
  benchedPlayers: Player[]
  onGenerateNewAssignments: () => void
}

const CourtAssignments: React.FC<CourtAssignmentsProps> = ({
  assignments,
  benchedPlayers,
  onGenerateNewAssignments
}) => {
  const renderCourt = (court: Court) => {
    const { teams } = court

    if (!teams) {
      return (
        <div key={court.courtNumber} className="court-card">
          <div className="court-header">Court {court.courtNumber}</div>
          <div className="singles-match">
            <div>Players on court:</div>
            {court.players.map(player => (
              <div key={player.id} className="team-player">
                {player.name}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // Check if it's singles or doubles
    const isDoubles = teams.team1.length === 2 && teams.team2.length === 2
    const isSingles = teams.team1.length === 1 && teams.team2.length === 1

    if (isSingles) {
      return (
        <div key={court.courtNumber} className="court-card">
          <div className="court-header">Court {court.courtNumber} - Singles</div>
          <div className="singles-match">
            <div className="singles-players">
              <div className="singles-player">
                {teams.team1[0].name}
              </div>
              <div className="vs-divider">VS</div>
              <div className="singles-player">
                {teams.team2[0].name}
              </div>
            </div>
            {court.players.length === 3 && (
              <div style={{ marginTop: '15px', fontSize: '0.9rem', color: '#718096' }}>
                <div>Waiting: {court.players[2].name}</div>
              </div>
            )}
          </div>
        </div>
      )
    }

    if (isDoubles) {
      return (
        <div key={court.courtNumber} className="court-card">
          <div className="court-header">Court {court.courtNumber} - Doubles</div>
          <div className="teams">
            <div className="team">
              <div className="team-label">Team 1</div>
              <div className="team-players">
                {teams.team1.map(player => (
                  <div key={player.id} className="team-player">
                    {player.name}
                  </div>
                ))}
              </div>
            </div>
            <div className="vs-divider">VS</div>
            <div className="team">
              <div className="team-label">Team 2</div>
              <div className="team-players">
                {teams.team2.map(player => (
                  <div key={player.id} className="team-player">
                    {player.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Fallback for other configurations
    return (
      <div key={court.courtNumber} className="court-card">
        <div className="court-header">Court {court.courtNumber}</div>
        <div className="teams">
          <div className="team">
            <div className="team-label">Team 1</div>
            <div className="team-players">
              {teams.team1.map(player => (
                <div key={player.id} className="team-player">
                  {player.name}
                </div>
              ))}
            </div>
          </div>
          {teams.team2.length > 0 && (
            <>
              <div className="vs-divider">VS</div>
              <div className="team">
                <div className="team-label">Team 2</div>
                <div className="team-players">
                  {teams.team2.map(player => (
                    <div key={player.id} className="team-player">
                      {player.name}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="courts-grid">
        {assignments.map(renderCourt)}
      </div>

      {benchedPlayers.length > 0 && (
        <div className="bench-section">
          <div className="bench-header">
            🪑 Bench ({benchedPlayers.length} player{benchedPlayers.length !== 1 ? 's' : ''})
          </div>
          <div className="bench-players">
            {benchedPlayers.map(player => (
              <div key={player.id} className="bench-player">
                {player.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          onClick={onGenerateNewAssignments}
          className="generate-button"
        >
          🎲 Generate New Assignments
        </button>
      </div>
    </div>
  )
}

export default CourtAssignments 