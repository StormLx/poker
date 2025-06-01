import React, { useState, useEffect } from 'react';
import './App.css';
import CreateRoom from './components/CreateRoom';
import JoinRoom from './components/JoinRoom';
import Room from './components/Room';
import {
  connectSocket,
  onVotingScaleUpdated,
  onParticipantVoted,
  onParticipantVotedRealTime,
  onVotesRevealed,
  onVotingReset,
  onParticipantUpdated, // New
  connectionStatusEmitter,
  getSocketInstance,
  joinRoom as socketJoinRoom,
} from './socketService';
import { DEFAULT_VOTING_SCALE_CONFIG } from './constants';
import { ToastContainer } from './components/Toast';

function App() {
  const [currentView, setCurrentView] = useState('home');
  const [roomState, setRoomState] = useState(null);
  const [userName, setUserName] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('initial');
  const [currentSocketId, setCurrentSocketId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [isSpectator, setIsSpectator] = useState(false);
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) return storedTheme;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen to OS theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      const storedTheme = localStorage.getItem('theme'); // Check if user made a manual choice
      if (!storedTheme) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
    // Auto-remove toast after a delay is handled by Toast component itself
  };

  const removeToast = (id) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  };

  const handleRoomEntry = (roomDataResponse, nameOfUser, isUserCreatorFlag) => {
    console.log("HandleRoomEntry triggered. Room Data:", roomDataResponse, "User Name:", nameOfUser, "Is Creator:", isUserCreatorFlag);
    const currentSocket = getSocketInstance();
    const actualSocketId = currentSocket ? currentSocket.id : null;

    setRoomState({
      id: roomDataResponse.id,
      creatorId: roomDataResponse.creatorId,
      participants: roomDataResponse.participants || [],
      votingCards: roomDataResponse.votingCards || (DEFAULT_VOTING_SCALE_CONFIG.values || []),
      votingScaleConfig: roomDataResponse.votingScaleConfig || DEFAULT_VOTING_SCALE_CONFIG,
      votesRevealed: roomDataResponse.votesRevealed || false,
      statistics: roomDataResponse.statistics || null,
      creatorLiveVotes: {},
      userName: nameOfUser,
    });
    setUserName(nameOfUser);

    const selfInRoom = roomDataResponse.participants.find(p => p.id === actualSocketId);
    setIsCreator(roomDataResponse.creatorId === actualSocketId);
    setIsSpectator(selfInRoom ? selfInRoom.isSpectator : false); // Set spectator status for current user

    setCurrentView('room');
    sessionStorage.setItem('pokerRoomId', roomDataResponse.id);
    sessionStorage.setItem('pokerUserName', nameOfUser);
    // sessionStorage.setItem('pokerIsCreator', isUserCreatorFlag.toString()); // Re-evaluate based on current socketID and creatorID
  };

  const handleLeaveRoom = (informServer = true) => { // informServer not used yet
    console.log("HandleLeaveRoom triggered");
    setCurrentView('home');
    // Do not clear roomState fully to allow rejoin logic to use roomState.id if needed
    // setRoomState(null); // Clearing this would prevent rejoin based on previous roomState.id

    // Clear only parts of roomState that should not persist if user comes back to home
    setRoomState(prev => prev ? { id: prev.id, userName: prev.userName } : null);


    // Keep userName in App's direct state from sessionStorage for potential next join attempt
    // setIsCreator(false); // Reset creator status

    sessionStorage.removeItem('pokerRoomId'); // Clear roomId from session
    // sessionStorage.removeItem('pokerUserName'); // Keep username for convenience
    sessionStorage.removeItem('pokerIsCreator'); // This will be re-evaluated by server or handleRoomEntry

    // Note: We are not calling socket.disconnect() here.
    // This allows the socket to remain for quick re-entry or if user has other tabs open.
    // Server's 'disconnect' event will handle cleanup if the tab/browser is closed.
  };


  useEffect(() => {
    let statusUnsubscribe;

    const setupEventListeners = (socket) => {
        onVotingScaleUpdated(({ votingScaleConfig, votingCards, participants, message }) => {
            console.log('EVENT: votingScaleUpdated', { votingScaleConfig, votingCards, participants });
            setRoomState(prev => prev ? { ...prev, votingScaleConfig, votingCards, participants, votesRevealed: false, statistics: null, creatorLiveVotes: {} } : null);
            alert(message || 'The voting scale has been updated. Votes have been reset.');
        });
        onParticipantVoted(({ participantId, hasVoted }) => {
            console.log('EVENT: participantVoted', { participantId, hasVoted });
            setRoomState(prev => {
                if (!prev) return null;
                return { ...prev, participants: prev.participants.map(p => p.id === participantId ? { ...p, hasVoted } : p) };
            });
        });
        onParticipantVotedRealTime(({ participantId, hasVoted, voteValue }) => {
            console.log('EVENT: participantVotedRealTime (for creator)', { participantId, hasVoted, voteValue });
            setRoomState(prev => {
                if (!prev || !prev.creatorLiveVotes) return prev;
                return {
                    ...prev,
                    participants: prev.participants.map(p => p.id === participantId ? { ...p, hasVoted } : p),
                    creatorLiveVotes: { ...prev.creatorLiveVotes, [participantId]: voteValue },
                };
            });
        });
        onVotesRevealed(({ participants, statistics }) => {
            console.log('EVENT: votesRevealed', { participants, statistics });
            setRoomState(prev => prev ? { ...prev, participants, statistics, votesRevealed: true, creatorLiveVotes: {} } : null);
        });
        onVotingReset(({ participants, votesRevealed, statistics }) => {
            console.log('EVENT: votingReset', { participants, votesRevealed, statistics });
            setRoomState(prev => prev ? { ...prev, participants, votesRevealed, statistics, creatorLiveVotes: {} } : null);
        });
        // Handle participant updates (like spectator mode change)
        onParticipantUpdated(({ participant: updatedParticipant }) => {
            if (!updatedParticipant) return;
            console.log('EVENT: participantUpdated', { updatedParticipant });
            setRoomState(prev => {
                if (!prev || !prev.participants) return prev;
                // Create a new participants array with the updated participant
                const newParticipants = prev.participants.map(p =>
                    p.id === updatedParticipant.id ? { ...p, ...updatedParticipant } : p
                );
                // If the current user is the one updated, also update top-level isSpectator state
                if (updatedParticipant.id === (getSocketInstance() ? getSocketInstance().id : null)) {
                    setIsSpectator(updatedParticipant.isSpectator);
                }
                return { ...prev, participants: newParticipants };
            });
            // Avoid toast if it's the current user, Room.js will show feedback for their own toggle
            if (updatedParticipant.id !== (getSocketInstance() ? getSocketInstance().id : null)) {
                 addToast(`User ${updatedParticipant.name} ${updatedParticipant.isSpectator ? 'is now a spectator.' : 'is no longer a spectator.' }`, 'info');
            }
        });
    };

    const handleConnectionStatus = (status, data) => {
        setConnectionStatus(status);
        console.log("Connection Status Update:", status, data);
        const currentSocket = getSocketInstance();

        if (status === 'connect') {
            setCurrentSocketId(currentSocket ? currentSocket.id : null);
            console.log("App.js: Connected with socket ID:", currentSocket ? currentSocket.id : 'N/A');
            setupEventListeners(currentSocket); // Setup listeners on new/re-established connection

            const persistedRoomId = roomState?.id || sessionStorage.getItem('pokerRoomId');
            const persistedUserName = roomState?.userName || userName || sessionStorage.getItem('pokerUserName');

            if (currentView === 'room' && persistedRoomId && persistedUserName) {
                console.log(`Attempting to re-join room ${persistedRoomId} as ${persistedUserName} after (re)connect.`);
                addToast(`Reconnecting to room ${persistedRoomId}...`, 'info');
                socketJoinRoom(persistedRoomId, persistedUserName, (response) => {
                    if (response.success) {
                        console.log(`Successfully re-joined room ${persistedRoomId}. Server state:`, response.room);
                        addToast(`Successfully re-joined room ${response.room.id}!`, 'success');
                        handleRoomEntry(response.room, persistedUserName, response.room.creatorId === (currentSocket ? currentSocket.id : null));
                    } else {
                        console.error(`Failed to re-join room ${persistedRoomId}:`, response.message);
                        addToast(`Could not re-join: ${response.message}`, 'error');
                        handleLeaveRoom(false);
                        setCurrentView('home');
                    }
                });
            }
        } else if (status === 'disconnect') {
            console.warn("App.js: Disconnected from server.");
            addToast('Disconnected. Attempting to reconnect...', 'warning');
        } else if (status === 'reconnect') {
            console.log("App.js: Reconnected. New Socket ID:", currentSocket ? currentSocket.id : 'N/A');
            addToast('Reconnected successfully!', 'success');
        } else if (status === 'reconnect_failed' || status === 'failed_to_connect') {
            // Using 'failed_to_connect' from socketService for both initial and reconnect failures
            addToast("Connection failed. Service might be unavailable. Please refresh later.", 'error');
            setConnectionStatus('failed_to_connect'); // Ensure state reflects this specific status
        } else if (status === 'connect_error' && !currentSocket?.connected) {
            // If initial connection_error and not yet connected, this might also be a persistent failure.
            // However, socket.io might try reconnecting. Let 'reconnect_failed' be the terminal state.
            addToast(`Connection Error: ${data}. Retrying...`, 'warning');
        }
    };

    statusUnsubscribe = connectionStatusEmitter.subscribe(handleConnectionStatus);

    // Initial connection attempt if not already connected/connecting
    // This might be redundant if connectSocket() is called elsewhere on app init,
    // but ensures connection if App.js is the primary entry point for socket logic.
    if (!getSocketInstance() || !getSocketInstance().connected) {
        connectSocket();
    }

    // On initial load, try to load username from session storage
    // The rejoin logic itself is now handled by the 'connect' event.
    if (connectionStatus === 'initial') {
        const persistedUserNameFromSession = sessionStorage.getItem('pokerUserName');
        if (persistedUserNameFromSession && !userName) { // only set if userName state is not already set
            setUserName(persistedUserNameFromSession);
        }
    }

    return () => {
        if (statusUnsubscribe) {
          statusUnsubscribe.unsubscribe ? statusUnsubscribe.unsubscribe() : connectionStatusEmitter.unsubscribe(statusUnsubscribe);
        }
        // Listeners on the socket instance are cleared in connectSocket if a new socket is created.
        // Or, if keeping the same socket instance across App unmounts (not typical for full page app),
        // then socket.off for specific listeners would be needed here.
        // For now, socketService.js handles re-creating socket or re-attaching its own internal listeners.
    };
  }, [currentView, roomState?.id, roomState?.userName, userName]); // Dependencies for rejoin logic & listener setup

  let statusIndicatorText = `Status: ${connectionStatus}`;
  if (connectionStatus === 'connect' && currentSocketId) statusIndicatorText = `Connected (${currentSocketId.substring(0,6)}...)`; // Shorten ID
  if (connectionStatus === 'disconnect') statusIndicatorText = 'Disconnected. Retrying...';
  if (connectionStatus === 'reconnecting') statusIndicatorText = 'Reconnecting...';
  if (connectionStatus === 'failed_to_connect') statusIndicatorText = 'Connection Failed. Service Unavailable.';


  if (connectionStatus === 'initial' && !currentSocketId && !getSocketInstance()?.connected) {
    return <div className="loading-app"><p>Loading Poker Planning App...</p><p>{statusIndicatorText}</p></div>;
  }

  const showAppContent = connectionStatus !== 'failed_to_connect';

  return (
    <div className="App">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <header className="App-header">
        <h1>Poker Planning</h1>
        <div className="header-controls">
          <div className={`connection-status status-${connectionStatus}`}>{statusIndicatorText}</div>
          <button onClick={toggleTheme} className="theme-toggle-btn">
            Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
          </button>
          {currentView === 'room' && roomState && (
            <button onClick={() => handleLeaveRoom()} className="leave-room-btn">Leave Room</button>
          )}
        </div>
      </header>
      <main>
        {!showAppContent && (
          <div className="connection-error-fullscreen">
            <h2>Service Unavailable</h2>
            <p>Unable to connect to the server. Please check your internet connection or try again later. </p>
            <p>If the problem persists, the service might be temporarily down.</p>
            <button onClick={() => window.location.reload()}>Try Reloading</button>
          </div>
        )}
        {showAppContent && currentView === 'home' && (
          <>
            <CreateRoom onRoomCreated={handleRoomEntry} addToast={addToast} />
            <hr />
            <JoinRoom onJoinedRoom={handleRoomEntry} addToast={addToast} />
          </>
        )}
        {showAppContent && currentView === 'room' && roomState && (
          <Room
            roomData={{...roomState, currentGlobalSocketId: currentSocketId }}
            userName={userName}
            isCreator={isCreator}
            isSpectator={isSpectator}
            currentRoomId={roomState.id}
            addToast={addToast}
          />
        )}
        {showAppContent && currentView === 'room' && !roomState && (
           // This case could be if currentView is 'room' but roomState is null (e.g. failed rejoin after page load)
           // Or, some other unexpected state. Default to showing a loading/error or redirecting to home.
          <div className="room-load-error">
            <p>Loading room data or an error occurred...</p>
            <p>If you were disconnected, we're attempting to reconnect.</p>
            <button onClick={() => { setCurrentView('home'); handleLeaveRoom(false); }}>Go to Home</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
