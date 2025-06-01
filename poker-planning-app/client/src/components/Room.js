import React, { useEffect, useState } from 'react';
import ParticipantList from './ParticipantList';
import VotingScaleSelector from './VotingScaleSelector';
import {
  onParticipantJoined,
  onParticipantLeft,
  updateVotingScale,
  submitVote, // New
  revealVotes, // New
  resetVoting, // New
} from '../socketService';
import socket from '../socketService'; // Direct import for current user ID
import VotingCard from './VotingCard'; // New
import StatisticsDisplay from './StatisticsDisplay'; // New
import './Room.css';

function Room({ roomData, userName, isCreator, currentRoomId, addToast }) { // Added addToast prop
  // roomData structure: { id, creatorId, participants, votingCards, votingScaleConfig, votesRevealed, statistics, creatorLiveVotes, currentGlobalSocketId }
  const [participants, setParticipants] = useState(roomData.participants || []);
  const [currentCreatorId, setCurrentCreatorId] = useState(roomData.creatorId);
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


  useEffect(() => {
    setParticipants(roomData.participants || []);
    setCurrentCreatorId(roomData.creatorId);
    setVotingCards(roomData.votingCards || []);
    setVotingScaleConfig(roomData.votingScaleConfig || {});
    setVotesRevealed(roomData.votesRevealed || false);
    setStatistics(roomData.statistics || null);
    setCreatorLiveVotes(roomData.creatorLiveVotes || {});

    // If voting is reset (votes no longer revealed), clear local selected vote
    if (!roomData.votesRevealed) {
      setSelectedVote(null);
    }
  }, [roomData]);

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
      socket.off('participantJoined', handleParticipantJoinedEvent);
      socket.off('participantLeft', handleParticipantLeftEvent);
    };
  }, [currentRoomId]);

  const handleCardClick = (value) => {
    if (votesRevealed || isLoadingVote) return;
    setIsLoadingVote(true);
    // setSelectedVote(value); // Optimistically set, or wait for 'participantVoted' from App.js for self
    submitVote(value, (response) => {
      setIsLoadingVote(false);
      if (response.success) {
        addToast(`Vote '${value}' submitted!`, 'success');
        setSelectedVote(value); // Confirm selection on successful submit
        // App.js state will update participant's hasVoted via 'participantVoted' event
      } else {
        addToast(`Vote failed: ${response.message}`, 'error');
        // setSelectedVote(null); // Revert if needed, but depends on desired UX
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
  const currentUserSocketId = roomData.currentGlobalSocketId || socket.id; // Fallback to direct socket.id if prop not there
  const currentUserHasVoted = participants.find(p => p.id === currentUserSocketId)?.hasVoted || false;
  const currentUserIsSpectator = !participants.find(p => p.id === currentUserSocketId); // Example: if not in participant list

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
      <p>Welcome, {userName}! {isCreator && <em>(You are the Creator)</em>} {currentUserIsSpectator && <em>(Spectator)</em>}</p>

      {/* Action messages replaced by toasts */}

      <div className="room-meta-info">
        <p className="voting-progress">
          Voting Progress: {votedCount} / {totalParticipants} voted.
        </p>
        {currentUserHasVoted && !votesRevealed && <p className="vote-status-message">Your vote is cast! Waiting for others...</p>}
      </div>

      <ParticipantList
        participants={participants}
        currentUserId={socket.id}
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
              disabled={votesRevealed || currentUserHasVoted || currentUserIsSpectator || isLoadingVote}
            />
          ))}
        </div>
         {votingCards.length === 0 && <p>No voting scale selected or available.</p>}
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
