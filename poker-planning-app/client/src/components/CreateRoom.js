import React, { useState } from 'react';
import { createRoom } from '../socketService';
import VotingScaleSelector from './VotingScaleSelector';
import { DEFAULT_VOTING_SCALE_CONFIG } from '../constants';

// Assume addToast is passed as a prop, or make it optional
function CreateRoom({onRoomCreated, addToast = alert}) {
    const [userName, setUserName] = useState('');
    const [votingScaleConfig, setVotingScaleConfig] = useState(DEFAULT_VOTING_SCALE_CONFIG);
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateRoom = () => {
        if (!userName.trim()) {
            addToast('Please enter your name.', 'warning');
            return;
        }

        let finalScaleConfig = votingScaleConfig;
        if (votingScaleConfig.type === 'custom') {
            const parsedValues = (votingScaleConfig.values || []).filter(v => v.trim() !== '');
            if (parsedValues.length === 0) {
                addToast('Custom voting scale must have at least one value.', 'warning');
                return;
            }
            finalScaleConfig = {...votingScaleConfig, values: parsedValues};
        }

        setIsLoading(true);
        console.log("Creating room with name:", userName.trim(), "and scale config:", finalScaleConfig);
        createRoom(userName.trim(), finalScaleConfig, (response) => {
            setIsLoading(false);
            if (response.success) {
                addToast(`Room "${response.room.id}" created successfully!`, 'success');
                console.log('Room created successfully:', response);
                onRoomCreated(response.room, userName.trim(), true);
            } else {
                console.error('Failed to create room:', response.message);
                addToast(`Error creating room: ${response.message}`, 'error');
            }
        });
    };

    return (
        <div>
            <h2>Create a New Room</h2>
            <input
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={isLoading}
            />
            <VotingScaleSelector
                currentScaleConfig={votingScaleConfig}
                onScaleChange={setVotingScaleConfig}
                disabled={isLoading}
            />
            <button onClick={handleCreateRoom} disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Room'}
            </button>
        </div>
    );
}

export default CreateRoom;
