import React from 'react';
import './VotingCard.css';

function VotingCard({
                        value,
                        isSelected,
                        isRevealed,
                        voteCount, // Number of people who cast this vote
                        onClick,
                        disabled, // General disabled state (e.g., voting ended, user is spectator)
                        participantNames, // Array of names who picked this card (shown on hover when revealed)
                    }) {
    const handleClick = () => {
        if (!disabled && onClick) {
            onClick(value);
        }
    };

    let cardClasses = 'voting-card-item';
    if (isSelected) cardClasses += ' selected';
    if (disabled && !isRevealed) cardClasses += ' disabled-opaque'; // Dim if disabled before reveal
    if (disabled && isRevealed && !isSelected) cardClasses += ' disabled-revealed'; // Different style for non-selected revealed cards
    if (isRevealed && isSelected) cardClasses += ' revealed-selected'; // Special style for user's own revealed vote


    // Tooltip to show who voted for this card when revealed
    const voterTooltip = (isRevealed && participantNames && participantNames.length > 0)
        ? participantNames.join(', ')
        : null;

    return (
        <div className={cardClasses} onClick={handleClick} title={voterTooltip}>
            <span className="card-value">{value}</span>
            {isRevealed && voteCount > 0 && (
                <span className="vote-count" title={voterTooltip}>{voteCount}</span>
            )}
        </div>
    );
}

export default VotingCard;
