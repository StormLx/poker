// poker-planning-app/server/src/roomManager.test.js
const roomManager = require('./roomManager');

// Helper function to reset rooms state for testing if roomManager doesn't expose one.
// This is a simplified approach. In a real scenario, you might mock or have better state control.
const resetRoomManagerState = () => {
    // This is a bit of a hack. Ideally, roomManager would provide a reset function for tests.
    // Or, tests would be structured to not depend on a globally mutable 'rooms' object.
    // For now, we can't directly clear 'rooms' as it's not exported.
    // Tests will need to be mindful of creating unique room IDs or testing in sequence.
    // For this example, we'll just acknowledge this limitation.
};


describe('Room Manager', () => {
  const creatorId = 'socketCreator123';
  const participantId1 = 'socketParticipant456';
  const participantId2 = 'socketParticipant789';

  beforeEach(() => {
    resetRoomManagerState();
    // Since resetRoomManagerState is a no-op for now, ensure tests use unique room IDs
    // or test functions that don't rely on shared state in conflicting ways.
  });

  describe('createRoom', () => {
    it('should create a new room with a creator and default settings', () => {
      const { room: newRoom, roomId: newRoomId } = roomManager.createRoom('Alice', creatorId);

      expect(newRoomId).toBeDefined();
      expect(typeof newRoomId).toBe('string');
      expect(newRoom).toBeDefined();

      const creatorParticipant = newRoom.participants.find(p => p.id === creatorId);
      expect(creatorParticipant).toBeDefined();
      expect(creatorParticipant.name).toBe('Alice');
      // expect(creatorParticipant.isCreator).toBe(true); // isCreator is not a property on participant, but room.creatorId
      expect(newRoom.creatorId).toBe(creatorId);
      expect(creatorParticipant.isSpectator).toBe(false);
      expect(newRoom.votingCards.length).toBeGreaterThan(0); // Default scale (Fibonacci)
      expect(newRoom.votingScaleConfig.name).toBe('fibonacci');
    });

    it('should create a room with a custom T-Shirt scale', () => {
        const scaleConfig = { type: 'preset', name: 'tshirt' };
        const { room } = roomManager.createRoom('Bob', 'creatorBob123', scaleConfig);
        expect(room.votingScaleConfig.name).toBe('tshirt');
        expect(room.votingCards).toEqual(expect.arrayContaining(['XS', 'S', 'M', 'L', 'XL']));
    });

    it('should create a room with a custom values scale', () => {
        const customValues = ['100', '200', '300', '☕'];
        const scaleConfig = { type: 'custom', values: customValues };
        const { room } = roomManager.createRoom('Carol', 'creatorCarol123', scaleConfig);
        expect(room.votingScaleConfig.type).toBe('custom');
        expect(room.votingCards).toEqual(customValues);
    });
  });

  describe('joinRoom', () => {
    let testRoomId;
    beforeEach(() => {
      // Create a common room for join tests to ensure it exists
      const { roomId } = roomManager.createRoom('TestHost', 'hostSocketForJoinTests');
      testRoomId = roomId;
    });

    it('should allow a participant to join an existing room', () => {
      const result = roomManager.joinRoom(testRoomId, 'Charlie', participantId1);
      expect(result.error).toBeUndefined();
      expect(result.room).toBeDefined();
      const joinedParticipant = result.room.participants.find(p => p.id === participantId1);
      expect(joinedParticipant).toBeDefined();
      expect(joinedParticipant.name).toBe('Charlie');
      expect(joinedParticipant.isSpectator).toBe(false);
    });

    it('should return an error when joining a non-existent room', () => {
      const result = roomManager.joinRoom('nonExistentRoomID123', 'Dave', 'daveSocket123');
      expect(result.error).toBe('Room not found'); // Error message from roomManager
    });

    it('should allow multiple participants to join', () => {
        roomManager.joinRoom(testRoomId, 'Charlie', participantId1);
        const result = roomManager.joinRoom(testRoomId, 'Diana', participantId2);
        expect(result.room.participants.length).toBe(3); // Host + Charlie + Diana
        expect(result.room.participants.find(p=>p.id === participantId1)).toBeDefined();
        expect(result.room.participants.find(p=>p.id === participantId2)).toBeDefined();
    });
  });

  describe('submitVote', () => {
    let testRoomId;
    let hostId = 'hostForVoteTest';
    let voterId = 'voterForVoteTest';

    beforeEach(() => {
      const { roomId } = roomManager.createRoom('VoteHost', hostId);
      testRoomId = roomId;
      roomManager.joinRoom(testRoomId, 'Voter', voterId);
    });

    it('should allow a participant to submit a valid vote', () => {
      const roomBeforeVote = roomManager.getRoom(testRoomId);
      const voteValue = roomBeforeVote.votingCards[0];
      const result = roomManager.submitVote(testRoomId, voterId, voteValue);

      expect(result.success).toBe(true);
      expect(result.participantId).toBe(voterId);
      expect(result.voteValue).toBe(voteValue);

      const participantAfterVote = result.room.participants.find(p => p.id === voterId);
      expect(participantAfterVote.currentVote).toBe(voteValue);
      expect(participantAfterVote.hasVoted).toBe(true);
    });

    it('should prevent submitting an invalid vote value', () => {
        const result = roomManager.submitVote(testRoomId, voterId, 'INVALID_VOTE');
        expect(result.error).toBe('Invalid vote value.');
    });

    it('should prevent a spectator from voting', () => {
        const spectatorId = 'spectatorToTestVote';
        roomManager.joinRoom(testRoomId, 'SpectatorTest', spectatorId);
        // Manually set participant as spectator for this test
        const room = roomManager.getRoom(testRoomId);
        const spectator = room.participants.find(p => p.id === spectatorId);
        spectator.isSpectator = true;

        const voteValue = room.votingCards[0];
        const result = roomManager.submitVote(testRoomId, spectatorId, voteValue);
        expect(result.error).toBe('Spectators cannot vote.');
    });

    it('should prevent voting if votes are revealed', () => {
        const room = roomManager.getRoom(testRoomId);
        room.votesRevealed = true; // Manually set for test
        const voteValue = room.votingCards[0];
        const result = roomManager.submitVote(testRoomId, voterId, voteValue);
        expect(result.error).toBe('Voting has ended for this round. Please reset to vote again.');
        room.votesRevealed = false; // Reset for other tests
    });
  });

  describe('toggleSpectatorMode', () => {
    let testRoomId;
    let toggleUserId = 'userToToggleSpectator';

    beforeEach(() => {
        const { roomId } = roomManager.createRoom('HostForToggle', 'hostToggleSocket');
        testRoomId = roomId;
        roomManager.joinRoom(testRoomId, 'Toggler', toggleUserId);
    });

    it('should toggle spectator mode for a participant and clear their vote', () => {
        const room = roomManager.getRoom(testRoomId);
        const participant = room.participants.find(p => p.id === toggleUserId);
        participant.currentVote = room.votingCards[0]; // Give them a vote
        participant.hasVoted = true;

        const result = roomManager.toggleSpectatorMode(testRoomId, toggleUserId);
        expect(result.success).toBe(true);
        expect(result.participant.isSpectator).toBe(true);
        expect(result.participant.currentVote).toBeNull();
        expect(result.participant.hasVoted).toBe(false);

        const result2 = roomManager.toggleSpectatorMode(testRoomId, toggleUserId);
        expect(result2.success).toBe(true);
        expect(result2.participant.isSpectator).toBe(false);
    });
  });

});
