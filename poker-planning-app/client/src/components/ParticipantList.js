import React from 'react';
import './ParticipantList.css'; // Create this file for styling

function ParticipantList({
                             participants,
                             currentUserId,
                             creatorId,
                             votesRevealed,
                             creatorLiveVotes // Object: { participantId: voteValue }
                         }) {
    if (!participants || participants.length === 0) {
        return <p className="no-participants-message">No participants yet.</p>;
    }

    return (
        <div className="participant-list-container">
            <h4>Participants ({participants.length}):</h4>
            <ul className="participant-ul">
                {participants.map((p) => {
                    const isCurrentUser = p.id === currentUserId;
                    const isRoomCreator = p.id === creatorId;
                    let voteDisplay = null;

                    if (votesRevealed && p.currentVote !== null) {
                        voteDisplay = <span className="vote-value revealed">{p.currentVote}</span>;
                    } else if (p.hasVoted) {
                        voteDisplay = <span className="vote-status voted">✓ Voted</span>;
                    } else if (creatorLiveVotes && creatorLiveVotes[p.id] && !isCurrentUser) {
                        // Creator sees live votes of others, if they have voted
                        voteDisplay = <span className="vote-value live">{creatorLiveVotes[p.id]}</span>;
                    } else if (p.id === currentUserId && p.currentVote !== null && !votesRevealed) {
                        // Current user sees their own vote if they have voted and not revealed
                        voteDisplay = <span className="vote-value live-own">{p.currentVote}</span>;
                    } else {
                        voteDisplay = <span className="vote-status pending">Voting...</span>;
                    }

                    return (
                        <li key={p.id} className={`participant-item ${p.hasVoted ? 'has-voted' : ''} ${isCurrentUser
                            ? 'current-user'
                            : ''} ${p.isSpectator ? 'spectator' : ''}`}>
              <span className="participant-name">
                {p.name}
                  {isCurrentUser && <strong> (You)</strong>}
                  {isRoomCreator && <em> (Creator)</em>}
                  {p.isSpectator && <span className="spectator-tag"> (Spectator)</span>}
              </span>
                            <span className="participant-vote-info">
                {voteDisplay}
              </span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default ParticipantList;
