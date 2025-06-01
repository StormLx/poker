import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// Mock socketService
let mockSocket = {
    id: 'test-socket-id',
    connected: false, // Start as disconnected initially for some tests
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
};

let connectionStatusCallback = null;
const mockConnectionStatusEmitter = {
    subscribe: jest.fn((callback) => {
        connectionStatusCallback = callback; // Store the callback to simulate events
        return {unsubscribe: jest.fn()}; // Return an unsubscribe function
    }),
    unsubscribe: jest.fn(), // Kept for completeness, though not directly used in emit simulation
    emit: (status, data) => { // Helper to simulate emitting connection status
        if (connectionStatusCallback) {
            connectionStatusCallback(status, data);
        }
    }
};

jest.mock('./socketService', () => ({
    __esModule: true,
    connectSocket: jest.fn(() => {
        // Simulate connection success shortly after call
        mockSocket.connected = true;
        // Use a timeout to ensure any immediate state checks for connection might see 'connecting' first
        setTimeout(() => {
            if (connectionStatusCallback) {
                mockConnectionStatusEmitter.emit('connect', mockSocket.id);
            }
        }, 0);
    }),
    getSocketInstance: jest.fn(() => mockSocket),
    socketJoinRoom: jest.fn(),
    onVotingScaleUpdated: jest.fn(),
    onParticipantVoted: jest.fn(),
    onParticipantVotedRealTime: jest.fn(),
    onVotesRevealed: jest.fn(),
    onVotingReset: jest.fn(),
    onParticipantUpdated: jest.fn(),
    onParticipantJoined: jest.fn(), // Mock other listeners used in Room.js to prevent errors
    onParticipantLeft: jest.fn(),
    connectionStatusEmitter: mockConnectionStatusEmitter,
    // Add any other functions App.js might call from socketService
}));


// Mock sessionStorage
const mockSessionStorage = (() => {
    let store = {};
    return {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, value) => {
            store[key] = value.toString();
        }),
        removeItem: jest.fn((key) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
    };
})();
Object.defineProperty(window, 'sessionStorage', {value: mockSessionStorage});

// Mock window.history.replaceState
Object.defineProperty(window, 'history', {
    value: {
        ...window.history, // Preserve other history properties if any
        replaceState: jest.fn(),
    },
    writable: true,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
});


describe('App component URL room join flow', () => {
    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();
        mockSessionStorage.clear();
        mockSocket.connected = false; // Reset socket connected state
        mockSocket.id = 'test-socket-id';

        // Reset window.location.search for each test
        Object.defineProperty(window, 'location', {
            writable: true,
            value: {...window.location, search: ''},
        });
    });

    test('renders EnterNameForRoom when room URL param exists and no username in session', async () => {
        Object.defineProperty(window, 'location', {
            value: {search: '?room=testRoom123'},
            writable: true,
        });
        mockSessionStorage.getItem.mockReturnValue(null); // No username

        render(<App/>);

        // Simulate socket connection
        mockConnectionStatusEmitter.emit('connect', mockSocket.id);

        await waitFor(() => {
            expect(screen.getByText(/Joining Room: testRoom123/i)).toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
        expect(window.history.replaceState).toHaveBeenCalledWith({}, document.title, window.location.pathname);
    });

    test('calls socketJoinRoom and handles success when name is submitted', async () => {
        Object.defineProperty(window, 'location', {
            value: {search: '?room=testRoomABC'},
            writable: true,
        });
        mockSessionStorage.getItem.mockReturnValue(null); // No username

        const mockRoomData = {
            id: 'testRoomABC',
            creatorId: 'creator-id',
            participants: [{id: mockSocket.id, name: 'Test User', isSpectator: false}],
            votingCards: ['1', '2', '3'],
            votingScaleConfig: {type: 'fibonacci', name: 'Fibonacci', values: ['1', '2', '3', '5']},
            votesRevealed: false,
            statistics: null,
        };

        // Setup socketJoinRoom to simulate success
        const {socketJoinRoom} = require('./socketService');
        socketJoinRoom.mockImplementation((roomId, userName, callback) => {
            callback({success: true, room: mockRoomData});
        });

        render(<App/>);
        mockConnectionStatusEmitter.emit('connect', mockSocket.id); // Simulate connection

        await waitFor(() => {
            expect(screen.getByText(/Joining Room: testRoomABC/i)).toBeInTheDocument();
        });

        fireEvent.change(screen.getByPlaceholderText('Enter your name'), {target: {value: 'Test User'}});
        fireEvent.click(screen.getByRole('button', {name: /Join Room/i}));

        await waitFor(() => {
            expect(socketJoinRoom).toHaveBeenCalledWith('testRoomABC', 'Test User', expect.any(Function));
        });

        // Check if App component transitioned to Room view
        // This assumes Room component shows "Welcome, {userName}" or similar unique text
        await waitFor(() => {
            expect(screen.getByText(/Welcome, Test User!/i)).toBeInTheDocument();
        });
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('pokerUserName', 'Test User');
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith('pokerRoomId', 'testRoomABC');
    });

    test('shows error toast and returns to home if socketJoinRoom fails', async () => {
        Object.defineProperty(window, 'location', {
            value: {search: '?room=failRoom'},
            writable: true,
        });
        mockSessionStorage.getItem.mockReturnValue(null);

        const {socketJoinRoom} = require('./socketService');
        socketJoinRoom.mockImplementation((roomId, userName, callback) => {
            callback({success: false, message: 'Server error'});
        });

        render(<App/>);
        mockConnectionStatusEmitter.emit('connect', mockSocket.id);

        await waitFor(() => {
            expect(screen.getByText(/Joining Room: failRoom/i)).toBeInTheDocument();
        });

        fireEvent.change(screen.getByPlaceholderText('Enter your name'), {target: {value: 'Failure Prone'}});
        fireEvent.click(screen.getByRole('button', {name: /Join Room/i}));

        await waitFor(() => {
            expect(socketJoinRoom).toHaveBeenCalledWith('failRoom', 'Failure Prone', expect.any(Function));
        });

        // Check for toast message (App.js uses a ToastContainer; this checks for part of the message)
        // This requires that ToastContainer renders toasts in a way that screen.getByText can find them.
        await waitFor(() => {
            expect(screen.getByText(/Failed to join room: Server error. Returning to home./i)).toBeInTheDocument();
        });

        // Check if it returned to home view (e.g., CreateRoom/JoinRoom components are visible)
        await waitFor(() => {
            expect(screen.getByRole('heading', {name: /Create a New Room/i})).toBeInTheDocument();
            expect(screen.getByRole('heading', {name: /Join an Existing Room/i})).toBeInTheDocument();
        });
        expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('pokerUserName');
    });

    test('attempts to rejoin if room and user exist in session and view is room', async () => {
        mockSessionStorage.getItem.mockImplementation(key => {
            if (key === 'pokerRoomId') return 'existingRoom123';
            if (key === 'pokerUserName') return 'Existing User';
            return null;
        });

        const mockRoomData = {
            id: 'existingRoom123',
            creatorId: 'some-creator',
            participants: [{id: mockSocket.id, name: 'Existing User', isSpectator: false}],
            // ... other room data
        };
        const {socketJoinRoom} = require('./socketService');
        socketJoinRoom.mockImplementation((roomId, userName, callback) => {
            if (roomId === 'existingRoom123' && userName === 'Existing User') {
                callback({success: true, room: mockRoomData});
            }
        });

        // Manually set App's initial state to 'room' for this test scenario
        // This is tricky as App internal state isn't directly settable.
        // Instead, we rely on the useEffect in App.js to trigger rejoin attempt when connection happens.
        // We need to ensure App starts in a state that would lead to currentView='room' if data was there.
        // The key is that `sessionStorage` has roomID and userName.

        render(<App/>); // App will initialize, read session storage

        // Simulate connection
        // The App's useEffect for connection status should pick up the session items and attempt rejoin
        mockConnectionStatusEmitter.emit('connect', mockSocket.id);

        await waitFor(() => {
            expect(socketJoinRoom).toHaveBeenCalledWith('existingRoom123', 'Existing User', expect.any(Function));
        });
        await waitFor(() => {
            // Check for a message indicating successful rejoin, or view change to room
            expect(screen.getByText(/Welcome, Existing User!/i)).toBeInTheDocument();
        });
    });

});
