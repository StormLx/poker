import React, { useState } from 'react';
import './EnterNameForRoom.css'; // We'll create this basic CSS file next

function EnterNameForRoom({ targetRoomId, onNameSubmit, connectionStatus }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setError('');
    onNameSubmit(name, targetRoomId);
  };

  // Disable form if not connected or in the process of connecting/reconnecting
  const isDisabled = connectionStatus !== 'connect' && connectionStatus !== 'reconnect';


  if (isDisabled) {
    return (
      <div className="enter-name-for-room-container">
        <p>Connecting to server... Please wait.</p>
        <p>Status: {connectionStatus}</p>
      </div>
    );
  }

  return (
    <div className="enter-name-for-room-container">
      <h2>Joining Room: {targetRoomId}</h2>
      <p>Please enter your name to join the room.</p>
      <form onSubmit={handleSubmit} className="enter-name-form">
        <div className="form-group">
          <label htmlFor="name-input">Your Name:</label>
          <input
            id="name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            autoFocus
            maxLength="30"
          />
        </div>
        {error && <p className="error-message">{error}</p>}
        <button type="submit" className="submit-name-btn">
          Join Room
        </button>
      </form>
    </div>
  );
}

export default EnterNameForRoom;
