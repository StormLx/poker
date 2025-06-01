import React, { useState } from 'react';
import { joinRoom } from '../socketService';

// Assume addToast is passed as a prop, or make it optional
function JoinRoom({ onJoinedRoom, addToast = alert }) {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinRoom = () => {
    if (!userName.trim() || !roomId.trim()) {
      addToast('Please enter your name and Room ID.', 'warning');
      return;
    }
    setIsLoading(true);
    joinRoom(roomId.trim(), userName.trim(), (response) => {
      setIsLoading(false);
      if (response.success) {
        // addToast(`Joined room "${response.room.id}" successfully!`, 'success'); // App.js can show this
        console.log('Joined room successfully:', response);
        onJoinedRoom(response.room, userName.trim(), false);
      } else {
        console.error('Failed to join room:', response.message);
        addToast(`Error joining room: ${response.message}`, 'error');
      }
    });
  };

  return (
    <div>
      <h2>Join an Existing Room</h2>
      <input
        type="text"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        disabled={isLoading}
      />
      <input
        type="text"
        placeholder="Enter your name"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        disabled={isLoading}
      />
      <button onClick={handleJoinRoom} disabled={isLoading}>
        {isLoading ? 'Joining...' : 'Join Room'}
      </button>
    </div>
  );
}

export default JoinRoom;
