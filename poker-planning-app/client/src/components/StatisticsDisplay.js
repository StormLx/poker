import React from 'react';
import './StatisticsDisplay.css';

function StatisticsDisplay({statistics}) {
    if (!statistics) {
        return <p>No statistics to display yet. Votes might not be revealed.</p>;
    }

    const {average, mode, voteDistribution, highestVote, lowestVote, totalVotes} = statistics;

    // For bar chart visualization of voteDistribution
    const maxCount = voteDistribution ? Math.max(...Object.values(voteDistribution), 0) : 0;

    return (
        <div className="statistics-container">
            <h3>Voting Results</h3>
            {totalVotes > 0 ? (
                <>
                    <div className="stats-summary">
                        <p><strong>Total Votes:</strong> {totalVotes}</p>
                        {average > 0 && <p><strong>Average:</strong> {average}</p>}
                        <p><strong>Mode:</strong> {mode && mode.length > 0 ? mode.join(', ') : 'N/A'}</p>
                        {highestVote !== null && <p><strong>Highest Vote:</strong> {highestVote}</p>}
                        {lowestVote !== null && <p><strong>Lowest Vote:</strong> {lowestVote}</p>}
                    </div>

                    <h4>Vote Distribution:</h4>
                    {voteDistribution && Object.keys(voteDistribution).length > 0 ? (
                        <div className="vote-distribution-chart">
                            {Object.entries(voteDistribution).map(([vote, count]) => (
                                <div key={vote} className="vote-bar-item">
                                    <div className="vote-value-label">{vote}:</div>
                                    <div className="vote-bar-wrapper">
                                        <div
                                            className="vote-bar"
                                            style={{width: maxCount > 0 ? `${(count / maxCount) * 100}%` : '0%'}}
                                            title={`Count: ${count}`}
                                        >
                                            <span className="vote-count-in-bar">{count}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>No votes were cast or distribution is not available.</p>
                    )}
                </>
            ) : (
                <p>No votes were cast in this round.</p>
            )}
        </div>
    );
}

export default StatisticsDisplay;
