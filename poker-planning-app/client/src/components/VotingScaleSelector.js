import React, { useState, useEffect } from 'react';
import { VOTING_PRESETS, MAX_VOTING_OPTIONS, DEFAULT_VOTING_SCALE_CONFIG } from '../constants';
import './VotingScaleSelector.css';

function VotingScaleSelector({ currentScaleConfig, onScaleChange, disabled = false }) {
  const [scaleType, setScaleType] = useState(DEFAULT_VOTING_SCALE_CONFIG.type);
  const [presetName, setPresetName] = useState(DEFAULT_VOTING_SCALE_CONFIG.name);
  const [customValues, setCustomValues] = useState('');
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    if (currentScaleConfig) {
      setScaleType(currentScaleConfig.type || DEFAULT_VOTING_SCALE_CONFIG.type);
      if (currentScaleConfig.type === 'preset') {
        setPresetName(currentScaleConfig.name || DEFAULT_VOTING_SCALE_CONFIG.name);
      } else if (currentScaleConfig.type === 'custom') {
        setCustomValues((currentScaleConfig.values || []).join(', '));
      }
    }
  }, [currentScaleConfig]);

  const handleTypeChange = (event) => {
    const newType = event.target.value;
    setScaleType(newType);
    triggerScaleChange(newType, newType === 'preset' ? presetName : customValues);
  };

  const handlePresetChange = (event) => {
    const newPresetName = event.target.value;
    setPresetName(newPresetName);
    triggerScaleChange('preset', newPresetName);
  };

  const handleCustomChange = (event) => {
    const newCustomValues = event.target.value;
    setCustomValues(newCustomValues);
    triggerScaleChange('custom', newCustomValues);
  };

  const validateAndParseCustomValues = (valuesStr) => {
    const arr = valuesStr.split(',').map(v => v.trim()).filter(v => v);
    if (arr.length === 0 && valuesStr.trim() !== '') { // Allow empty if user is clearing it
        setCustomError('Custom values cannot be all empty or just commas.');
        return null;
    }
    if (arr.length > MAX_VOTING_OPTIONS) {
      setCustomError(`Maximum ${MAX_VOTING_OPTIONS} custom options allowed.`);
      return null;
    }
    // Check for duplicates
    if (new Set(arr).size !== arr.length) {
      setCustomError('Custom values should not contain duplicates.');
      return null;
    }
    setCustomError('');
    return arr;
  };

  const triggerScaleChange = (type, value) => {
    let newConfig = {};
    if (type === 'preset') {
      newConfig = { type: 'preset', name: value };
      // Optionally resolve to values here if needed for immediate feedback, but backend does this
      // newConfig.values = VOTING_PRESETS[value]?.values;
    } else { // custom
      const parsedValues = validateAndParseCustomValues(value);
      if (parsedValues) { // Only trigger change if valid or empty string (to clear)
        newConfig = { type: 'custom', values: parsedValues };
      } else {
        // If validation fails, don't call onScaleChange, or call with error/null
        // For now, we just show error and don't update parent
        return;
      }
    }
    onScaleChange(newConfig);
  };


  return (
    <div className="voting-scale-selector">
      <h4>Voting Scale</h4>
      <div className="scale-type-selection">
        <label>
          <input
            type="radio"
            value="preset"
            checked={scaleType === 'preset'}
            onChange={handleTypeChange}
            disabled={disabled}
          />
          Preset
        </label>
        <label>
          <input
            type="radio"
            value="custom"
            checked={scaleType === 'custom'}
            onChange={handleTypeChange}
            disabled={disabled}
          />
          Custom
        </label>
      </div>

      {scaleType === 'preset' && (
        <div className="preset-options">
          <select value={presetName} onChange={handlePresetChange} disabled={disabled}>
            {Object.keys(VOTING_PRESETS).map((key) => (
              <option key={key} value={key}>
                {VOTING_PRESETS[key].displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      {scaleType === 'custom' && (
        <div className="custom-options">
          <textarea
            placeholder="Enter comma-separated values (e.g., A, B, C)"
            value={customValues}
            onChange={handleCustomChange}
            disabled={disabled}
            rows="3"
          />
          {customError && <p className="custom-error-message">{customError}</p>}
          <p className="custom-info">Max {MAX_VOTING_OPTIONS} options. Values should be unique.</p>
        </div>
      )}
    </div>
  );
}

export default VotingScaleSelector;
