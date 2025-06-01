const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const roomManager = require('./roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for now
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8080; // Use environment variable

// Store which room a socket is in for easier lookup on disconnect
const socketRoomMap = {};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('createRoom', ({ creatorName, votingScaleConfig }, callback) => {
    console.log(`createRoom event received from ${socket.id} with creatorName: ${creatorName}, scaleConfig:`, votingScaleConfig);
    const { roomId, room } = roomManager.createRoom(creatorName, socket.id, votingScaleConfig);
    if (roomId) {
      socket.join(roomId);
      socketRoomMap[socket.id] = roomId;
      console.log(`Socket ${socket.id} joined room ${roomId}`);
      callback({ success: true, roomId, room });
    } else {
      callback({ success: false, message: "Failed to create room" });
    }
  });

  socket.on('joinRoom', ({ roomId, userName }, callback) => {
    console.log(`joinRoom event received from ${socket.id} for room ${roomId} with userName: ${userName}`);
    const result = roomManager.joinRoom(roomId, userName, socket.id);
    if (result.error) {
      console.error(`Failed to join room ${roomId}: ${result.error}`);
      callback({ success: false, message: result.error });
      return;
    }

    const room = result.room;
    socket.join(roomId);
    socketRoomMap[socket.id] = roomId;
    console.log(`Socket ${socket.id} joined room ${roomId}`);

    // Send current room state to the joiner
    callback({ success: true, room });

    // Notify other participants in the room
    socket.to(roomId).emit('participantJoined', {
      participant: room.participants.find(p => p.id === socket.id),
      roomId
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    const roomId = socketRoomMap[socket.id];
    if (roomId) {
      console.log(`Socket ${socket.id} was in room ${roomId}. Attempting to remove.`);
      const result = roomManager.removeParticipant(roomId, socket.id);
      delete socketRoomMap[socket.id];

      if (result.error) {
        console.error(`Error removing participant ${socket.id} from room ${roomId}: ${result.error}`);
      } else if (result.roomDeleted) {
        console.log(`Room ${roomId} was deleted after participant ${socket.id} left.`);
        // No need to broadcast if the room is gone
      } else if (result.room && result.removedParticipantName) {
        console.log(`Participant ${result.removedParticipantName} (${socket.id}) left room ${roomId}. Notifying others.`);
        socket.to(roomId).emit('participantLeft', { userId: socket.id, roomId, participantName: result.removedParticipantName });
      }
    } else {
      console.log(`Socket ${socket.id} was not mapped to any room.`);
    }
  });

  socket.on('updateVotingScale', ({ newScaleConfig }, callback) => {
    // Attempt to find the room ID the socket is currently in.
    // socket.rooms is a Set, first element is usually socket.id, second (if present) is the room.
    const currentRoomId = Array.from(socket.rooms).find(r => r !== socket.id);

    if (!currentRoomId) {
      console.error(`Socket ${socket.id} tried to update scale but is not in a room.`);
      return callback({ success: false, message: 'You are not currently in a room.' });
    }

    console.log(`updateVotingScale event from ${socket.id} for room ${currentRoomId}, newScaleConfig:`, newScaleConfig);
    const result = roomManager.updateVotingScale(currentRoomId, socket.id, newScaleConfig);

    if (result.error) {
      console.error(`Failed to update voting scale for room ${currentRoomId}: ${result.error}`);
      return callback({ success: false, message: result.error });
    }

    // Notify all clients in the room about the updated scale
    io.to(currentRoomId).emit('votingScaleUpdated', {
      votingScaleConfig: result.room.votingScaleConfig,
      votingCards: result.room.votingCards,
      participants: result.room.participants, // Send updated participants as votes are reset
      message: `${socketRoomMap[socket.id] || 'The room creator'} changed the voting scale.` // Consider sending user name if available
    });

    console.log(`Voting scale updated successfully for room ${currentRoomId}. Notifying clients.`);
    callback({ success: true, room: result.room }); // Acknowledge success to sender
  });

  // Placeholder for other game logic events (vote, revealVotes, etc.)

  socket.on('submitVote', ({ voteValue }, callback) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomId) {
      console.error(`submitVote: Socket ${socket.id} not in a room.`);
      return callback({ success: false, message: 'Not in a room.' });
    }

    console.log(`submitVote event from ${socket.id} in room ${roomId} with value: ${voteValue}`);
    const result = roomManager.submitVote(roomId, socket.id, voteValue);

    if (result.error) {
      console.error(`submitVote failed for ${socket.id} in room ${roomId}: ${result.error}`);
      return callback({ success: false, message: result.error });
    }

    callback({ success: true }); // Acknowledge voter

    // Notify all participants (including voter themselves for UI update) that a vote has been cast
    // The payload indicates who voted, and if they are the creator, also their vote value
    const room = roomManager.getRoom(roomId); // Get current room state
    if (!room) { // Should not happen if submitVote was successful
        console.error(`submitVote: Room ${roomId} disappeared after vote submission.`);
        return;
    }

    // Notify all clients in the room that this participant has voted.
    // The client side will then update the UI for that participant.
    io.to(roomId).emit('participantVoted', {
        participantId: socket.id,
        hasVoted: true
    });

    // If the voter is not the creator, and the creator is in the room,
    // send a special event to the creator so they can see the vote value in real-time.
    if (room.creatorId !== socket.id && room.participants.find(p => p.id === room.creatorId)) {
        io.to(room.creatorId).emit('participantVotedRealTime', {
            participantId: socket.id,
            hasVoted: true,
            voteValue: result.voteValue // Only creator sees this
        });
    }
  });

  socket.on('revealVotes', (payload, callback) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomId) return callback({ success: false, message: 'Not in a room.' });

    console.log(`revealVotes event from ${socket.id} for room ${roomId}`);
    const result = roomManager.revealVotes(roomId, socket.id);

    if (result.error) {
      console.error(`revealVotes failed for room ${roomId} by ${socket.id}: ${result.error}`);
      return callback({ success: false, message: result.error });
    }

    io.to(roomId).emit('votesRevealed', {
      participants: result.participants,
      statistics: result.statistics
    });
    console.log(`Votes revealed for room ${roomId}. Notifying clients.`);
    callback({ success: true, statistics: result.statistics }); // Send stats back to creator too
  });

  socket.on('resetVoting', (payload, callback) => {
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomId) return callback({ success: false, message: 'Not in a room.' });

    console.log(`resetVoting event from ${socket.id} for room ${roomId}`);
    const result = roomManager.resetVoting(roomId, socket.id);

    if (result.error) {
      console.error(`resetVoting failed for room ${roomId} by ${socket.id}: ${result.error}`);
      return callback({ success: false, message: result.error });
    }

    io.to(roomId).emit('votingReset', {
      participants: result.participants, // participants with votes cleared
      votesRevealed: false,
      statistics: null
    });
    console.log(`Voting reset for room ${roomId}. Notifying clients.`);
    callback({ success: true });
  });

  socket.on('toggleSpectatorMode', (payload, callback) => { // payload can be empty
    const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!roomId) {
      console.error(`toggleSpectatorMode: Socket ${socket.id} not in a room.`);
      if (callback) callback({ success: false, message: 'Not in a room.' });
      return;
    }

    console.log(`toggleSpectatorMode event from ${socket.id} for room ${roomId}`);
    const result = roomManager.toggleSpectatorMode(roomId, socket.id);

    if (result.error) {
      console.error(`toggleSpectatorMode failed for ${socket.id} in room ${roomId}: ${result.error}`);
      if (callback) callback({ success: false, message: result.error });
      return;
    }

    // Notify all clients in the room about the participant update
    // This includes the change in isSpectator, and also if their vote was cleared.
    io.to(roomId).emit('participantUpdated', { participant: result.participant });

    // Also, if the participant became a spectator and votes were reset,
    // the general 'participantVoted' event might be useful to update UI showing who has voted.
    // However, 'participantUpdated' should be enough if client logic correctly updates based on the full participant object.
    // If spectator mode change also affects overall voting counts (e.g. a spectator's vote is removed),
    // then a more general room update might be needed or client recalculates.
    // For now, 'participantUpdated' is the primary notification.

    console.log(`User ${result.participant.name} (${socket.id}) spectator mode is now ${result.participant.isSpectator}. Notifying room ${roomId}.`);
    if (callback) callback({ success: true, isSpectator: result.participant.isSpectator, participant: result.participant });
  });
});

// Ensure this uses the http server instance, not the express app
server.listen(PORT, () => { // 'server' is the http.createServer instance
  console.log(`Server listening on port ${PORT}`);
});
