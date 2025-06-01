import React, { useState, useEffect } from 'react';
import './App.css';
import CreateRoom from './components/CreateRoom';
import JoinRoom from './components/JoinRoom';
import EnterNameForRoom from './components/EnterNameForRoom'; // Added
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
  const [targetRoomIdFromUrl, setTargetRoomIdFromUrl] = useState(null); // Added
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


  const handleNameSubmitForRoomJoin = (submittedName, roomId) => {
    if (!getSocketInstance() || !getSocketInstance().connected) {
      addToast("Not connected to the server. Please wait.", "error");
      if (!getSocketInstance()?.connecting && connectionStatus !== 'failed_to_connect') {
          connectSocket();
      }
      return;
    }
    setUserName(submittedName);
    sessionStorage.setItem('pokerUserName', submittedName);

    addToast(`Joining room ${roomId} as ${submittedName}...`, 'info');
    socketJoinRoom(roomId, submittedName, (response) => {
      const currentSocket = getSocketInstance(); // get it here to ensure it's fresh
      const actualSocketId = currentSocket ? currentSocket.id : null;
      if (response.success) {
        addToast(`Successfully joined room ${response.room.id}!`, 'success');
        handleRoomEntry(response.room, submittedName, response.room.creatorId === actualSocketId);
        setTargetRoomIdFromUrl(null);
      } else {
        addToast(`Failed to join room: ${response.message}. Returning to home.`, 'error');
        setCurrentView('home');
        setUserName('');
        sessionStorage.removeItem('pokerUserName');
        setTargetRoomIdFromUrl(null);
      }
    });
  };

  useEffect(() => {
    let statusUnsubscribe;

    const setupEventListeners = (socket) => {
        onVotingScaleUpdated(({ votingScaleConfig, votingCards, participants, message }) => {
            console.log('EVENT: votingScaleUpdated', { votingScaleConfig, votingCards, participants });
            setRoomState(prev => prev ? { ...prev, votingScaleConfig, votingCards, participants, votesRevealed: false, statistics: null, creatorLiveVotes: {} } : null);
            addToast(message || 'The voting scale has been updated. Votes have been reset.', 'info');
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
        // Set the connection status state first. The text indicator will derive from this.
        setConnectionStatus(status);
        console.log("Connection Status Update:", status, data);
        const currentSocket = getSocketInstance();

        // Toasts and specific logic based on status
        if (status === 'initial_connecting') {
            // Text indicator will show "Connecting...". No toast needed for a normal, quick initial connection.
            // If it fails, 'connect_error' or 'failed_to_connect' will trigger toasts.
        } else if (status === 'connect') {
            setCurrentSocketId(currentSocket ? currentSocket.id : null);
            console.log("App.js: Connected with socket ID:", currentSocket ? currentSocket.id : 'N/A');
            // Setup listeners only once on first successful connect or reconnect
            // Note: setupEventListeners might need to be idempotent or handled carefully if socket can change.
            setupEventListeners(currentSocket);

            // URL room join logic / Rejoin logic
            const urlParams = new URLSearchParams(window.location.search);
            const roomFromUrl = urlParams.get('room');
            const persistedUserNameFromSession = sessionStorage.getItem('pokerUserName');
            const currentUserName = userName || persistedUserNameFromSession;

            if (roomFromUrl && !currentUserName) {
                console.log(`App.js: Found room in URL ${roomFromUrl}, user name is missing. Prompting for name.`);
                setTargetRoomIdFromUrl(roomFromUrl);
                setCurrentView('enterNameForRoomJoin');
                 // Clear the room query param from URL to prevent re-triggering if user cancels/fails and lands on home
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (currentView === 'room' && (roomState?.id || sessionStorage.getItem('pokerRoomId')) && currentUserName) {
                const roomIdToRejoin = roomState?.id || sessionStorage.getItem('pokerRoomId');
                console.log(`Attempting to re-join room ${roomIdToRejoin} as ${currentUserName} after (re)connect.`);
                addToast(`Reconnecting to room ${roomIdToRejoin}...`, 'info');
                socketJoinRoom(roomIdToRejoin, currentUserName, (response) => {
                    if (response.success) {
                        console.log(`Successfully re-joined room ${roomIdToRejoin}. Server state:`, response.room);
                        addToast(`Successfully re-joined room ${response.room.id}!`, 'success');
                        handleRoomEntry(response.room, currentUserName, response.room.creatorId === (currentSocket ? currentSocket.id : null));
                    } else {
                        console.error(`Failed to re-join room ${roomIdToRejoin}:`, response.message);
                        addToast(`Could not re-join: ${response.message}. Please try joining manually.`, 'error');
                        handleLeaveRoom(false); // This sets currentView to 'home'
                        setCurrentView('home'); // Explicitly ensure it's home
                         // Clear potentially problematic session items if rejoin fails
                        sessionStorage.removeItem('pokerRoomId');
                        // Do not clear pokerUserName, user might want to use it to join manually
                    }
                });
            } else if (roomFromUrl && currentUserName && currentView !== 'room') {
                // If room in URL, username exists, but not in 'room' view (e.g. landed on home, or manually navigated)
                // Treat this as an explicit join attempt for the room in URL
                console.log(`App.js: Found room ${roomFromUrl} in URL and user ${currentUserName}. Attempting to join.`);
                addToast(`Attempting to join room ${roomFromUrl} from URL...`, 'info');
                socketJoinRoom(roomFromUrl, currentUserName, (response) => {
                    if (response.success) {
                        addToast(`Successfully joined room ${response.room.id} from URL!`, 'success');
                        handleRoomEntry(response.room, currentUserName, response.room.creatorId === (currentSocket ? currentSocket.id : null));
                        window.history.replaceState({}, document.title, window.location.pathname); // Clear URL param
                    } else {
                        addToast(`Could not join room ${roomFromUrl} from URL: ${response.message}`, 'error');
                        setCurrentView('home'); // Go to home if join fails
                        window.history.replaceState({}, document.title, window.location.pathname); // Clear URL param
                    }
                });
            }


        } else if (status === 'disconnect') {
            console.warn("App.js: Disconnected from server.");
            addToast('Disconnected. Attempting to reconnect...', 'warning');
        } else if (status === 'reconnecting') {
            // Text indicator shows "Reconnecting...". No toast needed here as it can be frequent.
            // The 'disconnect' toast ("Disconnected. Attempting to reconnect...") serves as the initial alert.
        } else if (status === 'reconnect') {
            console.log("App.js: Reconnected. New Socket ID:", currentSocket ? currentSocket.id : 'N/A');
            addToast('Reconnected successfully!', 'success');
             // It's possible event listeners need to be re-attached if the socket instance truly changed
            // and `setupEventListeners` isn't run due to `status === 'connect'` condition not re-triggering.
            // However, `socketService` reuses the same `socket` object on reconnects, so listeners should persist.
            // If `connectSocket` was called again creating a new `socket` object, then `connect` would set them up.
        } else if (status === 'reconnect_failed' || status === 'failed_to_connect') {
            addToast("Connection failed. Service might be unavailable. Please refresh later.", 'error');
            // setConnectionStatus('failed_to_connect'); // Already set at the start of function
        } else if (status === 'connect_error') {
            // This can happen during initial connection attempts or during reconnections if not handled by 'reconnecting'.
            // The `isInitialConnectionAttempt` flag in socketService prevents 'reconnecting' log/emit during initial phase.
            // So, this toast will be relevant for initial connection errors that are being retried.
            addToast(`Connection Error: ${data}. Retrying...`, 'warning');
        }
        // Note: The actual state `connectionStatus` is set at the beginning of this function.
        // The specific `setConnectionStatus('failed_to_connect')` call previously in the 'reconnect_failed'
        // block is now covered by the initial `setConnectionStatus(status)`.
    };

    statusUnsubscribe = connectionStatusEmitter.subscribe(handleConnectionStatus);

    // Initial connection attempt if not already connected/connecting
    // This might be redundant if connectSocket() is called elsewhere on app init,
    // but ensures connection if App.js is the primary entry point for socket logic.
    if (!getSocketInstance() || !getSocketInstance().connected) {
        connectSocket();
    }

    // On initial load, try to load username from session storage.
    // Also, handle the URL room check if not connected yet but details are available.
    if (connectionStatus === 'initial' || (status !== 'connect' && !getSocketInstance()?.connected)) {
        const persistedUserNameFromSession = sessionStorage.getItem('pokerUserName');
        if (persistedUserNameFromSession && !userName) {
            setUserName(persistedUserNameFromSession);
        }

        const urlParams = new URLSearchParams(window.location.search);
        const roomFromUrl = urlParams.get('room');
        const currentUserName = userName || persistedUserNameFromSession;

        if (roomFromUrl && !currentUserName && currentView !== 'enterNameForRoomJoin') {
             // If not connected but find room in URL and no user name, prepare to ask for name
            console.log(`App.js (initial/disconnected check): Found room in URL ${roomFromUrl}, user name is missing. Will prompt when connected.`);
            setTargetRoomIdFromUrl(roomFromUrl);
            setCurrentView('enterNameForRoomJoin'); // Change view
            window.history.replaceState({}, document.title, window.location.pathname); // Clear URL
        } else if (roomFromUrl && currentUserName && currentView !== 'room' && currentView !== 'enterNameForRoomJoin') {
            // If we have room and user, but not in room view, and not already trying to get name
            // This case might be redundant if 'connect' handler covers it, but acts as a fallback
            // No, this is probably bad here as socket is not yet connected. Wait for 'connect'
            console.log(`App.js (initial/disconnected check): Room ${roomFromUrl} and user ${currentUserName} exist. Will attempt join on connect.`);
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
  }, [currentView, roomState?.id, roomState?.userName, userName, connectionStatus]); // Added connectionStatus

  let statusIndicatorText = `Status: ${connectionStatus}`; // Default text

  if (connectionStatus === 'initial') {
    statusIndicatorText = 'Status: Initializing...';
  } else if (connectionStatus === 'initial_connecting') {
    statusIndicatorText = 'Connecting...';
  } else if (connectionStatus === 'connect' && currentSocketId) {
    statusIndicatorText = `Connected (${currentSocketId.substring(0, 6)}...)`;
  } else if (connectionStatus === 'disconnect') {
    statusIndicatorText = 'Disconnected. Retrying...';
  } else if (connectionStatus === 'reconnecting') {
    statusIndicatorText = 'Reconnecting...';
  } else if (connectionStatus === 'connect_error') {
    // This text will show if connect_error is the latest status received.
    // Useful during initial connection retries.
    statusIndicatorText = 'Connection error. Retrying...';
  } else if (connectionStatus === 'failed_to_connect') {
    statusIndicatorText = 'Connection Failed. Service Unavailable.';
  }
  // `reconnect` status will quickly transition to `connect`, so `Connected` text will show.
  // `status: initial` is when App.js just loaded, before connectSocket() in useEffect is invoked.

  // Loading screen for true initial state before any connection attempt is made by useEffect or if socket is null
  if (connectionStatus === 'initial' && (!getSocketInstance() || !getSocketInstance().connected)) {
     // Show a generic loading message if connectSocket hasn't effectively started
    return <div className="loading-app"><p>Loading Poker Planning App...</p><p>{statusIndicatorText}</p></div>;
  }
  // If initial_connecting, also show loading screen
  if (connectionStatus === 'initial_connecting') {
    return <div className="loading-app"><p>{statusIndicatorText}</p></div>;
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
        {!showAppContent && currentView !== 'enterNameForRoomJoin' && ( // Keep enterNameForRoomJoin visible during connection issues if already there
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
        {/* New View for Entering Name when room specified in URL */}
        {currentView === 'enterNameForRoomJoin' && targetRoomIdFromUrl && (
          <EnterNameForRoom
            targetRoomId={targetRoomIdFromUrl}
            onNameSubmit={handleNameSubmitForRoomJoin}
            connectionStatus={connectionStatus}
          />
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
