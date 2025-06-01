import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:8080'; // Make this configurable later
let socket = null;

// Emitter for connection status changes
const connectionStatusEmitter = {
  _listeners: [],
  subscribe(listener) {
    this._listeners.push(listener);
    // Optionally, immediately notify with current status if socket exists
    if (socket) {
      listener(socket.connected ? 'connect' : 'disconnect'); // Simplified initial status
    } else {
      listener('initial'); // Before io() is called
    }
  },
  unsubscribe(listener) {
    this._listeners = this._listeners.filter(l => l !== listener);
  },
  emit(status, data) {
    this._listeners.forEach(listener => listener(status, data));
  }
};

export const getSocketInstance = () => socket;

export const connectSocket = () => {
  if (socket && socket.connected) {
    console.log('Socket already connected.');
    connectionStatusEmitter.emit('connect', socket.id); // Re-emit for any new listeners
    return;
  }

  // If socket exists but is disconnected, ensure we clean up old listeners before creating new one
  if (socket) {
    socket.removeAllListeners();
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket'], // Explicitly use WebSocket
    reconnectionAttempts: 5, // Default is Infinity, let's cap for testability
    reconnectionDelay: 1000, // Default
    reconnectionDelayMax: 5000, // Default
    timeout: 20000, // Default
  });

  connectionStatusEmitter.emit('connecting');

  socket.on('connect', () => {
    console.log('Connected to WebSocket server id:', socket.id);
    connectionStatusEmitter.emit('connect', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected from WebSocket server:', reason);
    connectionStatusEmitter.emit('disconnect', reason);
    // If the disconnection was initiated by the server (e.g., auth failure), then reconnection might not be desired or possible.
    // Socket.IO handles "server shutting down" disconnects by attempting to reconnect unless `socket.disconnect()` was called client-side.
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error with WebSocket server:', err.message);
    connectionStatusEmitter.emit('connect_error', err.message);
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    console.log(`Reconnect attempt #${attemptNumber}`);
    connectionStatusEmitter.emit('reconnecting', attemptNumber);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log(`Reconnected successfully after ${attemptNumber} attempts. New socket ID: ${socket.id}`);
    connectionStatusEmitter.emit('reconnect', socket.id);
  });

  socket.on('reconnect_failed', () => {
    console.error('Failed to reconnect to the WebSocket server after multiple attempts.');
    connectionStatusEmitter.emit('reconnect_failed');
  });

  // Expose the emitter for App.js to subscribe to
  return connectionStatusEmitter;
};

// Ensure existing functions use the lazily initialized socket
// Example:
// export const createRoom = (userName, votingScaleConfig, callback) => {
//   if (!socket) return callback({ success: false, message: "Socket not initialized." });
//   console.log(`Emitting createRoom with userName: ${userName}`);
//   socket.emit('createRoom', { creatorName: userName, votingScaleConfig }, callback);
// };
// This pattern needs to be applied to all emit functions if socket is not guaranteed to be up.
// However, App.js should manage calling connectSocket first.

// For now, assuming App.js calls connectSocket() early and socket instance will be available.
// The functions below will use the `socket` variable from the outer scope.

export const createRoom = (userName, votingScaleConfig, callback) => {
  if (!socket) return callback({ success: false, message: "Socket not connected." });
  console.log(`Emitting createRoom with userName: ${userName}`);
  socket.emit('createRoom', { creatorName: userName, votingScaleConfig }, callback);
};

export const joinRoom = (roomId, userName, callback) => {
  if (!socket) return callback({ success: false, message: "Socket not connected." });
  console.log(`Emitting joinRoom with roomId: ${roomId}, userName: ${userName}`);
  socket.emit('joinRoom', { roomId, userName }, callback);
};

// Listeners for events from the server - these should also check if socket exists.
// It's better if the calling component (App.js) only sets up listeners after connectSocket()
// has successfully established a connection and socket instance.
const setupListener = (eventName, callback) => {
  if (socket) {
    socket.on(eventName, callback);
  } else {
    console.warn(`Attempted to set listener for ${eventName} before socket was initialized.`);
  }
};

export const onRoomCreated = (callback) => setupListener('roomCreated', callback); // Note: createRoom uses callback now
export const onJoinedRoom = (callback) => setupListener('joinedRoom', callback); // Note: joinRoom uses callback now
export const onParticipantJoined = (callback) => setupListener('participantJoined', callback);
export const onParticipantLeft = (callback) => setupListener('participantLeft', callback);
export const onRoomNotFound = (callback) => setupListener('roomNotFound', callback); // Typically handled by joinRoom callback
export const onVotingScaleUpdated = (callback) => setupListener('votingScaleUpdated', callback);
export const onParticipantVoted = (callback) => setupListener('participantVoted', callback);
export const onParticipantVotedRealTime = (callback) => setupListener('participantVotedRealTime', callback);
export const onVotesRevealed = (callback) => setupListener('votesRevealed', callback);
export const onVotingReset = (callback) => setupListener('votingReset', callback);
export const onError = (callback) => setupListener('error', callback);


export const updateVotingScale = (newScaleConfig, callback) => {
  if (!socket) return callback({ success: false, message: "Socket not connected." });
  console.log(`Emitting updateVotingScale with newScaleConfig:`, newScaleConfig);
  socket.emit('updateVotingScale', { newScaleConfig }, callback);
};

export const submitVote = (voteValue, callback) => {
  if (!socket) return callback({ success: false, message: "Socket not connected." });
  console.log(`Emitting submitVote with value: ${voteValue}`);
  socket.emit('submitVote', { voteValue }, callback);
};

export const revealVotes = (callback) => {
  if (!socket) return callback({ success: false, message: "Socket not connected." });
  console.log(`Emitting revealVotes`);
  socket.emit('revealVotes', {}, callback);
};

export const resetVoting = (callback) => {
  if (!socket) return callback({ success: false, message: "Socket not connected." });
  console.log(`Emitting resetVoting`);
  socket.emit('resetVoting', {}, callback);
};


// It's generally better not to export the raw socket instance if its lifecycle is managed internally.
// export default socket;
// Instead, provide specific functions or an event emitter for status like connectionStatusEmitter.
export { connectionStatusEmitter }; // Export the emitter
