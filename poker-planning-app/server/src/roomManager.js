const rooms = {};

const VOTING_PRESETS = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  powersOfTwo: ['0', '1', '2', '4', '8', '16', '32', '64', '?', '☕'],
};
const MAX_VOTING_OPTIONS = 20;
const DEFAULT_VOTING_SCALE_CONFIG = { type: 'preset', name: 'fibonacci' };

// Generates a random 6-character string for room IDs
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

function resolveVotingScale(scaleConfig) {
  if (!scaleConfig) scaleConfig = DEFAULT_VOTING_SCALE_CONFIG;
  let scale;
  if (scaleConfig.type === 'preset' && VOTING_PRESETS[scaleConfig.name]) {
    scale = VOTING_PRESETS[scaleConfig.name];
  } else if (scaleConfig.type === 'custom' && Array.isArray(scaleConfig.values)) {
    scale = scaleConfig.values;
  } else {
    // Fallback to default if config is invalid
    scale = VOTING_PRESETS[DEFAULT_VOTING_SCALE_CONFIG.name];
    scaleConfig = DEFAULT_VOTING_SCALE_CONFIG; // Reset config to default
  }
  if (scale.length > MAX_VOTING_OPTIONS) {
    // If somehow a preset is too long, or custom scale is too long
     console.warn(`Voting scale exceeded max options. Original: ${scale.length}. Truncated.`);
    scale = scale.slice(0, MAX_VOTING_OPTIONS);
  }
  return { ...scaleConfig, currentValues: scale }; // Store both original config and resolved values
}

function createRoom(creatorName, creatorSocketId, votingScaleConfig) {
  const roomId = generateRoomId();
  const resolvedScale = resolveVotingScale(votingScaleConfig);

  rooms[roomId] = {
    id: roomId,
    creatorId: creatorSocketId,
    participants: [{ id: creatorSocketId, name: creatorName, currentVote: null, hasVoted: false, isSpectator: false }],
    // votes will store { userId: voteValue } - this might be deprecated if storing vote on participant
    votes: {},
    revealed: false,
    votingScaleConfig: resolvedScale, // e.g., { type: 'preset', name: 'fibonacci', currentValues: [...] }
    votingCards: resolvedScale.currentValues, // The actual array of card values
  };
  console.log(`Room ${roomId} created by ${creatorName} (${creatorSocketId}) with scale:`, resolvedScale.name || 'custom');
  return { roomId, room: rooms[roomId] };
}

function joinRoom(roomId, userName, userSocketId) {
  const room = rooms[roomId];
  if (room) {
    if (room.participants.find(p => p.id === userSocketId)) {
      // User is already in the room, perhaps rejoining
      console.log(`User ${userName} (${userSocketId}) re-joined room ${roomId}`);
      // Ensure participant object has new fields if they rejoin and structure changed
      const existingParticipant = room.participants.find(p => p.id === userSocketId);
      if (existingParticipant) {
        existingParticipant.name = userName; // Update name if it changed
        if (existingParticipant.currentVote === undefined) existingParticipant.currentVote = null;
        if (existingParticipant.hasVoted === undefined) existingParticipant.hasVoted = false;
        if (existingParticipant.isSpectator === undefined) existingParticipant.isSpectator = false; // Ensure isSpectator exists
      }
      return { room };
    }
    room.participants.push({ id: userSocketId, name: userName, currentVote: null, hasVoted: false, isSpectator: false });
    console.log(`User ${userName} (${userSocketId}) joined room ${roomId}`);
    return { room };
  }
  return { error: 'Room not found' };
}

function getRoom(roomId) {
  return rooms[roomId];
}

function removeParticipant(roomId, userSocketId) {
  const room = rooms[roomId];
  if (room) {
    const index = room.participants.findIndex(p => p.id === userSocketId);
    if (index !== -1) {
      const removedParticipant = room.participants.splice(index, 1)[0];
      console.log(`Participant ${removedParticipant.name} (${userSocketId}) removed from room ${roomId}`);

      // Basic ownership transfer: if creator leaves, assign to the next participant
      if (room.creatorId === userSocketId && room.participants.length > 0) {
        room.creatorId = room.participants[0].id;
        console.log(`Room ${roomId} ownership transferred to ${room.participants[0].name} (${room.creatorId})`);
      }

      // If room becomes empty, delete it
      if (room.participants.length === 0) {
        delete rooms[roomId];
        console.log(`Room ${roomId} is empty and has been deleted.`);
        return { roomDeleted: true };
      }
      return { room, removedParticipantName: removedParticipant.name };
    }
  }
  return { error: 'Participant or room not found' };
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  removeParticipant,
  updateVotingScale,
  submitVote,
  revealVotes,
  resetVoting,
  toggleSpectatorMode,
  // Will add functions for voting later
};

function resetVoting(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return { error: 'Room not found.' };
  if (room.creatorId !== userId) return { error: 'Only the room creator can reset voting.' };

  // Iterate over participants array
  room.participants.forEach(p => {
    p.currentVote = null;
    p.hasVoted = false;
  });
  room.votesRevealed = false;
  room.statistics = null; // Clear statistics

  console.log(`Voting reset for room ${roomId} by ${userId}`);
  return { success: true, participants: room.participants, room }; // Return room for consistency
}

function calculateStatistics(participants, votingCards) {
  // participants is an array here, not an object
  const votes = participants.map(p => p.currentVote).filter(v => v !== null);
  if (votes.length === 0) {
    return { average: 0, mode: [], voteDistribution: {}, highestVote: null, lowestVote: null, totalVotes: 0 };
  }

  const numericVotes = votes.map(v => parseFloat(v)).filter(v => !isNaN(v));
  const average = numericVotes.length > 0 ? numericVotes.reduce((sum, val) => sum + val, 0) / numericVotes.length : 0;

  const voteCounts = {};
  let highestNumericVote = -Infinity;
  let lowestNumericVote = Infinity;

  votes.forEach(vote => {
    voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    const numVote = parseFloat(vote);
    if (!isNaN(numVote)) {
        if (numVote > highestNumericVote) highestNumericVote = numVote;
        if (numVote < lowestNumericVote) lowestNumericVote = numVote;
    }
  });

  if (highestNumericVote === -Infinity) highestNumericVote = null;
  if (lowestNumericVote === Infinity) lowestNumericVote = null;

  let maxCount = 0;
  for (const vote in voteCounts) {
    if (voteCounts[vote] > maxCount) {
      maxCount = voteCounts[vote];
    }
  }
  const mode = Object.keys(voteCounts).filter(vote => voteCounts[vote] === maxCount);

  return {
    average: parseFloat(average.toFixed(2)), // Keep average to 2 decimal places
    mode,
    voteDistribution: voteCounts,
    highestVote: highestNumericVote,
    lowestVote: lowestNumericVote,
    totalVotes: votes.length
  };
}

function revealVotes(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return { error: 'Room not found.' };
  if (room.creatorId !== userId) return { error: 'Only the room creator can reveal votes.' };

  room.votesRevealed = true;
  room.statistics = calculateStatistics(room.participants, room.votingCards); // Pass participants array

  console.log(`Votes revealed for room ${roomId} by ${userId}. Stats:`, room.statistics);
  return {
    success: true,
    participants: room.participants, // Full participant objects with votes
    statistics: room.statistics
  };
}

function updateVotingScale(roomId, userId, newScaleConfig) {
  const room = getRoom(roomId);
  if (!room) return { error: 'Room not found' };
  if (room.creatorId !== userId) return { error: 'Only the room creator can change the voting scale.' };

  const resolvedScale = resolveVotingScale(newScaleConfig);
  if (resolvedScale.currentValues.length === 0) return { error: 'Voting scale cannot be empty.'};

  room.votingScaleConfig = resolvedScale;
  room.votingCards = resolvedScale.currentValues;
  // Reset votes as participant structure now includes currentVote and hasVoted
  room.participants.forEach(p => { // Iterate directly over participants array
    p.currentVote = null;
    p.hasVoted = false;
  });
  room.votesRevealed = false; // Hide votes if scale changes
  // Also clear the old 'votes' object if it's still being used, though it should be deprecated
  room.votes = {};


  console.log(`Room ${roomId} voting scale updated by ${userId} to:`, resolvedScale.name || 'custom');
  return { room };
}

function submitVote(roomId, userId, voteValue) {
  const room = getRoom(roomId);
  if (!room) return { error: 'Room not found.' };

  // Find participant by ID from the array
  const participant = room.participants.find(p => p.id === userId);
  if (!participant) return { error: 'Participant not found.' };

  if (participant.isSpectator) {
    return { error: 'Spectators cannot vote.' };
  }

  if (room.votesRevealed) return { error: 'Voting has ended for this round. Please reset to vote again.' };

  // Check if voteValue is part of the current room's votingCards
  if (!room.votingCards || !room.votingCards.includes(voteValue)) {
    console.warn(`Invalid vote: ${voteValue} for room ${roomId}. Valid cards: ${room.votingCards}`);
    return { error: 'Invalid vote value.' };
  }

  participant.currentVote = voteValue;
  participant.hasVoted = true;
  console.log(`Vote submitted by ${userId} in room ${roomId}: ${voteValue}`);
  return { success: true, participantId: userId, voteValue, room }; // Return room for consistency, or just participant if preferred
}

function toggleSpectatorMode(roomId, userId) {
  const room = getRoom(roomId);
  if (!room) return { error: 'Room not found.' };

  const participant = room.participants.find(p => p.id === userId);
  if (!participant) return { error: 'Participant not found.' };

  participant.isSpectator = !participant.isSpectator;

  // If user becomes a spectator, clear their vote and hasVoted status
  if (participant.isSpectator) {
    participant.currentVote = null;
    participant.hasVoted = false;
  }
  // If votes are already revealed and they toggle spectator mode, their vote remains revealed if they had one.
  // If voting is active and they stop being a spectator, they can now vote.

  console.log(`User ${participant.name} (${userId}) in room ${roomId} is now ${participant.isSpectator ? 'a spectator' : 'a participant'}.`);
  return { success: true, participant, room }; // Return room for full state update, participant for targeted update
}
