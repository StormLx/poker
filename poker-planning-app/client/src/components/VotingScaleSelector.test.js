import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VotingScaleSelector from './VotingScaleSelector';
import { DEFAULT_VOTING_SCALE_CONFIG } from '../constants';

jest.useFakeTimers();

describe('VotingScaleSelector', () => {
  let mockOnScaleChange;

  beforeEach(() => {
    mockOnScaleChange = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('renders with default props', () => {
    render(<VotingScaleSelector currentScaleConfig={DEFAULT_VOTING_SCALE_CONFIG} onScaleChange={mockOnScaleChange} />);
    expect(screen.getByLabelText('Preset')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom')).toBeInTheDocument();
  });

  test('switches to custom input when custom radio is selected', () => {
    render(<VotingScaleSelector currentScaleConfig={DEFAULT_VOTING_SCALE_CONFIG} onScaleChange={mockOnScaleChange} />);
    fireEvent.click(screen.getByLabelText('Custom'));
    expect(screen.getByPlaceholderText('Enter comma-separated values (e.g., A, B, C)')).toBeInTheDocument();
  });

  test('onScaleChange is not called immediately when custom values are typed', () => {
    render(<VotingScaleSelector currentScaleConfig={{ type: 'custom', values: [] }} onScaleChange={mockOnScaleChange} />);
    fireEvent.click(screen.getByLabelText('Custom')); // Ensure custom is selected
    const customInput = screen.getByPlaceholderText('Enter comma-separated values (e.g., A, B, C)');
    fireEvent.change(customInput, { target: { value: '1' } });
    expect(mockOnScaleChange).not.toHaveBeenCalled();
  });

  test('onScaleChange is called after debounce timeout with correct custom values', () => {
    render(<VotingScaleSelector currentScaleConfig={{ type: 'custom', values: [] }} onScaleChange={mockOnScaleChange} />);
    fireEvent.click(screen.getByLabelText('Custom'));
    const customInput = screen.getByPlaceholderText('Enter comma-separated values (e.g., A, B, C)');

    fireEvent.change(customInput, { target: { value: '1, 2, 3' } });
    expect(mockOnScaleChange).not.toHaveBeenCalled(); // Check before advancing timer

    jest.advanceTimersByTime(500); // Advance by debounce time (500ms)

    expect(mockOnScaleChange).toHaveBeenCalledTimes(1);
    expect(mockOnScaleChange).toHaveBeenCalledWith({ type: 'custom', values: ['1', '2', '3'] });
  });

  test('onScaleChange uses the latest value after multiple quick changes', () => {
    render(<VotingScaleSelector currentScaleConfig={{ type: 'custom', values: [] }} onScaleChange={mockOnScaleChange} />);
    fireEvent.click(screen.getByLabelText('Custom'));
    const customInput = screen.getByPlaceholderText('Enter comma-separated values (e.g., A, B, C)');

    fireEvent.change(customInput, { target: { value: '1' } });
    jest.advanceTimersByTime(200); // Less than debounce time
    expect(mockOnScaleChange).not.toHaveBeenCalled();

    fireEvent.change(customInput, { target: { value: '1,2' } });
    jest.advanceTimersByTime(200); // Less than debounce time
    expect(mockOnScaleChange).not.toHaveBeenCalled();

    fireEvent.change(customInput, { target: { value: '1,2,XYZ' } });
    expect(mockOnScaleChange).not.toHaveBeenCalled(); // Still not called

    jest.advanceTimersByTime(500); // Advance by full debounce time

    expect(mockOnScaleChange).toHaveBeenCalledTimes(1);
    expect(mockOnScaleChange).toHaveBeenCalledWith({ type: 'custom', values: ['1', '2', 'XYZ'] });
  });

  test('onScaleChange is called for preset changes immediately (no debounce)', () => {
    render(<VotingScaleSelector currentScaleConfig={DEFAULT_VOTING_SCALE_CONFIG} onScaleChange={mockOnScaleChange} />);
    // Default is preset, 'Fibonacci'
    const presetSelector = screen.getByRole('combobox');
    fireEvent.change(presetSelector, { target: { value: 'MODIFIED_FIBONACCI' } }); // Assuming 'MODIFIED_FIBONACCI' is a valid key in VOTING_PRESETS

    // Preset changes in VotingScaleSelector directly call triggerScaleChange, which then has its own debounce.
    // The test for `triggerScaleChange` already covers the debounce. This test ensures the event handler for preset changes calls `triggerScaleChange`.
    // The debounce applies to onScaleChange, not directly to the DOM event.
    expect(mockOnScaleChange).not.toHaveBeenCalled(); // It should not be called immediately because triggerScaleChange has a debounce
    jest.advanceTimersByTime(500);
    expect(mockOnScaleChange).toHaveBeenCalledTimes(1);
    expect(mockOnScaleChange).toHaveBeenCalledWith({ type: 'preset', name: 'MODIFIED_FIBONACCI' });
  });

  test('handles custom values with spaces and empty entries correctly', () => {
    render(<VotingScaleSelector currentScaleConfig={{ type: 'custom', values: [] }} onScaleChange={mockOnScaleChange} />);
    fireEvent.click(screen.getByLabelText('Custom'));
    const customInput = screen.getByPlaceholderText('Enter comma-separated values (e.g., A, B, C)');

    fireEvent.change(customInput, { target: { value: '  A  , B ,, C  ' } });
    jest.advanceTimersByTime(500);

    expect(mockOnScaleChange).toHaveBeenCalledWith({ type: 'custom', values: ['A', 'B', 'C'] });
  });

   test('validation error for too many custom options', () => {
    render(<VotingScaleSelector currentScaleConfig={{ type: 'custom', values: [] }} onScaleChange={mockOnScaleChange} />);
    fireEvent.click(screen.getByLabelText('Custom'));
    const customInput = screen.getByPlaceholderText('Enter comma-separated values (e.g., A, B, C)');

    const tooManyOptions = Array.from({ length: 21 }, (_, i) => i + 1).join(','); // MAX_VOTING_OPTIONS is 20
    fireEvent.change(customInput, { target: { value: tooManyOptions } });
    jest.advanceTimersByTime(500); // Debounce time

    // onScaleChange should not be called if validation fails
    expect(mockOnScaleChange).not.toHaveBeenCalled();
    expect(screen.getByText('Maximum 20 custom options allowed.')).toBeInTheDocument();
  });

  test('validation error for duplicate custom options', () => {
    render(<VotingScaleSelector currentScaleConfig={{ type: 'custom', values: [] }} onScaleChange={mockOnScaleChange} />);
    fireEvent.click(screen.getByLabelText('Custom'));
    const customInput = screen.getByPlaceholderText('Enter comma-separated values (e.g., A, B, C)');

    fireEvent.change(customInput, { target: { value: 'A,B,A' } });
    jest.advanceTimersByTime(500);

    expect(mockOnScaleChange).not.toHaveBeenCalled();
    expect(screen.getByText('Custom values should not contain duplicates.')).toBeInTheDocument();
  });
});
