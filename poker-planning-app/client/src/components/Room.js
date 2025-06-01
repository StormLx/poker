import React, { useEffect, useState } from 'react';
import ParticipantList from './ParticipantList';
import VotingScaleSelector from './VotingScaleSelector';
import {
  onParticipantJoined,
  onParticipantLeft,
  updateVotingScale,
  submitVote,
  revealVotes,
  resetVoting,
  toggleSpectatorMode,
  getSocketInstance // Add this
} from '../socketService';
// import socket from '../socketService'; // Remove this line
import VotingCard from './VotingCard';
import StatisticsDisplay from './StatisticsDisplay';
import QRCodeDisplay from './QRCodeDisplay'; // Import QR Code component
import './Room.css';

function Room({ roomData, userName, isCreator, isSpectator: currentUserIsSpectatorProp, currentRoomId, addToast }) {
  const socket = getSocketInstance();
  // roomData structure: { id, creatorId, participants, votingCards, votingScaleConfig, votesRevealed, statistics, creatorLiveVotes, currentGlobalSocketId }
  const [participants, setParticipants] = useState(roomData.participants || []);
  const [currentCreatorId, setCurrentCreatorId] = useState(roomData.creatorId);
  const [isCurrentUserSpectator, setIsCurrentUserSpectator] = useState(currentUserIsSpectatorProp);
  const [votingCards, setVotingCards] = useState(roomData.votingCards || []);
  const [votingScaleConfig, setVotingScaleConfig] = useState(roomData.votingScaleConfig || {});
  const [votesRevealed, setVotesRevealed] = useState(roomData.votesRevealed || false);
  const [statistics, setStatistics] = useState(roomData.statistics || null);
  const [creatorLiveVotes, setCreatorLiveVotes] = useState(roomData.creatorLiveVotes || {});

  const [selectedVote, setSelectedVote] = useState(null);
  // const [actionMessage, setActionMessage] = useState({ type: '', content: '' }); // Replaced by toasts
  const [isLoadingVote, setIsLoadingVote] = useState(false);
  const [isLoadingReveal, setIsLoadingReveal] = useState(false);
  const [isLoadingReset, setIsLoadingReset] = useState(false);
  const [isLoadingScaleUpdate, setIsLoadingScaleUpdate] = useState(false);
  const [isLoadingSpectatorToggle, setIsLoadingSpectatorToggle] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false); // State for QR code modal


  useEffect(() => {
    setParticipants(roomData.participants || []);
    setCurrentCreatorId(roomData.creatorId);
    setVotingCards(roomData.votingCards || []);
    setVotingScaleConfig(roomData.votingScaleConfig || {});
    setVotesRevealed(roomData.votesRevealed || false);
    setStatistics(roomData.statistics || null);
    setCreatorLiveVotes(roomData.creatorLiveVotes || {});
    setIsCurrentUserSpectator(currentUserIsSpectatorProp); // Keep local spectator state in sync with prop

    // If voting is reset (votes no longer revealed), clear local selected vote
    if (!roomData.votesRevealed) {
      setSelectedVote(null);
    }
  }, [roomData, currentUserIsSpectatorProp]);

  useEffect(() => {
    const handleParticipantJoinedEvent = ({ participant, roomId: eventRoomId }) => {
      if (eventRoomId === currentRoomId) {
        setParticipants((prev) => prev.find(p => p.id === participant.id) ? prev : [...prev, participant]);
      }
    };
    const handleParticipantLeftEvent = ({ userId, roomId: eventRoomId }) => {
      if (eventRoomId === currentRoomId) {
        setParticipants((prev) => prev.filter((p) => p.id !== userId));
        setCreatorLiveVotes(prev => { // Remove live vote if participant leaves
          const newLiveVotes = { ...prev };
          delete newLiveVotes[userId];
          return newLiveVotes;
        });
      }
    };
    onParticipantJoined(handleParticipantJoinedEvent);
    onParticipantLeft(handleParticipantLeftEvent);
    return () => {
      if (socket) { // Check if socket instance exists
        socket.off('participantJoined', handleParticipantJoinedEvent);
        socket.off('participantLeft', handleParticipantLeftEvent);
      }
    };
  }, [currentRoomId, socket]); // Added socket to dependency array

  const handleCardClick = (value) => {
    if (votesRevealed || isLoadingVote || isCurrentUserSpectator) return; // Spectators cannot vote
    setIsLoadingVote(true);
    submitVote(value, (response) => {
      setIsLoadingVote(false);
      if (response.success) {
        addToast(`Vote '${value}' submitted!`, 'success');
        setSelectedVote(value);
      } else {
        addToast(`Vote failed: ${response.message}`, 'error');
      }
    });
  };

  const handleRevealVotes = () => {
    if (isLoadingReveal) return;
    setIsLoadingReveal(true);
    revealVotes((response) => {
      setIsLoadingReveal(false);
      if (response.success) {
        addToast('Votes Revealed!', 'success');
        // App.js handles state update via 'votesRevealed' event
      } else {
        addToast(`Reveal failed: ${response.message}`, 'error');
      }
    });
  };

  const handleResetVoting = () => {
    if (isLoadingReset) return;
    setIsLoadingReset(true);
    resetVoting((response) => {
      setIsLoadingReset(false);
      if (response.success) {
        addToast('New voting round started.', 'success');
        setSelectedVote(null);
        // App.js handles state update via 'votingReset' event
      } else {
        addToast(`Reset failed: ${response.message}`, 'error');
      }
    });
  };

  const handleScaleChangeByCreator = (newScaleConfig) => {
    if (isLoadingScaleUpdate) return;
    let finalScaleConfig = newScaleConfig;
    if (newScaleConfig.type === 'custom') {
      const parsedValues = (newScaleConfig.values || []).filter(v => v.trim() !== '');
      if (parsedValues.length === 0) {
        addToast('Custom voting scale must have at least one value.', 'error');
        return;
      }
      finalScaleConfig = { ...newScaleConfig, values: parsedValues };
    }
    setIsLoadingScaleUpdate(true);
    updateVotingScale(finalScaleConfig, (response) => {
      setIsLoadingScaleUpdate(false);
      if (response.success) {
        addToast('Voting scale updated!', 'success');
        // App.js handles 'votingScaleUpdated' event which resets votes & selectedVote
      } else {
        addToast(`Scale update failed: ${response.message}`, 'error');
      }
    });
  };

  // Determine if current user (socket.id from roomData.currentGlobalSocketId) has voted
  const currentUserSocketId = roomData.currentGlobalSocketId || socket?.id;
  const currentUserFromParticipants = participants.find(p => p.id === currentUserSocketId);
  const currentUserHasVoted = currentUserFromParticipants?.hasVoted || false;
  // isCurrentUserSpectator state is now used directly.

  const handleToggleSpectatorMode = () => {
    if (isLoadingSpectatorToggle) return;
    setIsLoadingSpectatorToggle(true);
    toggleSpectatorMode((response) => {
      setIsLoadingSpectatorToggle(false);
      if (response.success) {
        addToast(`You are now ${response.isSpectator ? 'a spectator' : 'a participant'}.`, 'success');
        // App.js will receive 'participantUpdated' and update props including isSpectator for this user
      } else {
        addToast(`Failed to toggle mode: ${response.message}`, 'error');
      }
    });
  };

  // For VotingCard's voteCount and participantNames props
  const getVoteCountsForCards = () => {
    if (!votesRevealed || !statistics || !statistics.voteDistribution) return {};
    return statistics.voteDistribution;
  };
  const voteCountsMap = getVoteCountsForCards();

  const getParticipantNamesForCardValue = (cardValue) => {
    if (!votesRevealed) return [];
    return participants.filter(p => p.currentVote === cardValue).map(p => p.name);
  };


  if (!roomData) return <p>Loading room information...</p>;

  const votedCount = participants.filter(p => p.hasVoted).length;
  const totalParticipants = participants.length;

  return (
    <div className="room-container">
      <h2>Room: {currentRoomId}</h2>
      <p>Welcome, {userName}!
        {isCreator && <em> (Creator)</em>}
        {isCurrentUserSpectator && <em className="spectator-indicator"> (Spectator)</em>}
      </p>

      <div className="room-actions-bar">
        <button
          onClick={handleToggleSpectatorMode}
          disabled={isLoadingSpectatorToggle}
          className="spectator-toggle-btn room-action-btn"
        >
          {isLoadingSpectatorToggle ? 'Updating...' : (isCurrentUserSpectator ? 'Become a Participant' : 'Become a Spectator')}
        </button>
        <button onClick={handleCopyLink} className="copy-link-btn room-action-btn">
          Copy Room Link
        </button>
        <button onClick={() => setShowQRCode(true)} className="show-qr-btn room-action-btn">
          Show QR to Join
        </button>
      </div>

      {showQRCode && (
        <QRCodeDisplay
          roomLink={`${window.location.origin}${window.location.pathname}?room=${currentRoomId}`}
          onClose={() => setShowQRCode(false)}
        />
      )}

      <div className="room-meta-info">
        <p className="voting-progress">
          Voting Progress: {votedCount} / {totalParticipants} voted.
        </p>
        {currentUserHasVoted && !votesRevealed && <p className="vote-status-message">Your vote is cast! Waiting for others...</p>}
      </div>

      <ParticipantList
        participants={participants}
        currentUserId={socket?.id}
        creatorId={currentCreatorId}
        votesRevealed={votesRevealed}
        creatorLiveVotes={isCreator ? creatorLiveVotes : null} // Pass live votes only if creator
      />

      <div className="voting-area">
        <h4>Voting Cards:</h4>
        <div className="voting-cards-container">
          {votingCards.map((cardValue) => (
            <VotingCard
              key={cardValue}
              value={cardValue}
              isSelected={selectedVote === cardValue}
              isRevealed={votesRevealed}
              voteCount={voteCountsMap[cardValue] || 0}
              participantNames={getParticipantNamesForCardValue(cardValue)}
              onClick={handleCardClick}
              disabled={votesRevealed || currentUserHasVoted || isCurrentUserSpectator || isLoadingVote}
            />
          ))}
        </div>
         {votingCards.length === 0 && <p>No voting scale selected or available.</p>}
         {isCurrentUserSpectator && !votesRevealed && <p className="spectator-message">Spectators cannot vote.</p>}
      </div>

      {isCreator && (
        <div className="creator-controls">
          {!votesRevealed ? (
            <button onClick={handleRevealVotes} disabled={isLoadingReveal || participants.every(p => !p.hasVoted)}>
              {isLoadingReveal ? 'Revealing...' : 'Reveal Votes'}
            </button>
          ) : (
            <button onClick={handleResetVoting} disabled={isLoadingReset}>
              {isLoadingReset ? 'Resetting...' : 'Start New Round'}
            </button>
          )}
        </div>
      )}

      {votesRevealed && statistics && (
        <StatisticsDisplay statistics={statistics} />
      )}
      {votesRevealed && !statistics && totalParticipants > 0 && (
         <p>Votes revealed, but statistics are still loading or unavailable.</p>
      )}
      {votesRevealed && totalParticipants === 0 && (
         <p>Votes revealed, but there were no participants to vote.</p>
      )}


      {isCreator && (
        <div className="creator-settings">
          <hr />
          <h4>Room Settings (Creator)</h4>
          <VotingScaleSelector
            currentScaleConfig={votingScaleConfig}
            onScaleChange={handleScaleChangeByCreator}
            disabled={votesRevealed || isLoadingScaleUpdate}
          />
           {isLoadingScaleUpdate && <p>Updating scale...</p>}
        </div>
      )}
    </div>
  );
}

export default Room;
