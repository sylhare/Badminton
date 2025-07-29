import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';

import CourtSettings from '../../src/components/CourtSettings';

describe('CourtSettings Component', () => {
  const mockOnNumberOfCourtsChange = vi.fn();
  const mockOnGenerateAssignments = vi.fn();

  const defaultProps = {
    numberOfCourts: 4,
    onNumberOfCourtsChange: mockOnNumberOfCourtsChange,
    onGenerateAssignments: mockOnGenerateAssignments,
    hasPlayers: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default value of 4 courts', () => {
    render(<CourtSettings {...defaultProps} />);

    const input = screen.getByLabelText('Number of Courts:');
    expect(input).toHaveValue(4);
  });

  it('renders all required elements', () => {
    render(<CourtSettings {...defaultProps} />);

    expect(screen.getByText('Number of Courts:')).toBeInTheDocument();
    expect(screen.getByLabelText('Number of Courts:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate random assignments/i })).toBeInTheDocument();
    expect(screen.getByText('How it works:')).toBeInTheDocument();
  });

  it('has correct input constraints', () => {
    render(<CourtSettings {...defaultProps} />);

    const input = screen.getByLabelText('Number of Courts:');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveAttribute('max', '20');
  });

  it('calls onNumberOfCourtsChange when input value changes', () => {
    render(<CourtSettings {...defaultProps} />);

    const input = screen.getByLabelText('Number of Courts:');

    fireEvent.change(input, { target: { value: '6' } });

    expect(mockOnNumberOfCourtsChange).toHaveBeenCalledWith(6);
  });

  it('does not call onNumberOfCourtsChange for invalid values', () => {
    render(<CourtSettings {...defaultProps} />);

    const input = screen.getByLabelText('Number of Courts:');

    fireEvent.change(input, { target: { value: '25' } });

    expect(mockOnNumberOfCourtsChange).not.toHaveBeenCalledWith(25);

    fireEvent.change(input, { target: { value: '0' } });

    expect(mockOnNumberOfCourtsChange).not.toHaveBeenCalledWith(0);
  });

  it('calls onGenerateAssignments when generate button is clicked', async () => {
    const user = userEvent.setup();
    render(<CourtSettings {...defaultProps} />);

    const button = screen.getByRole('button', { name: /generate random assignments/i });
    await user.click(button);

    expect(mockOnGenerateAssignments).toHaveBeenCalledTimes(1);
  });

  it('disables generate button when hasPlayers is false', () => {
    render(<CourtSettings {...defaultProps} hasPlayers={false} />);

    const button = screen.getByRole('button', { name: /generate random assignments/i });
    expect(button).toBeDisabled();
  });

  it('enables generate button when hasPlayers is true', () => {
    render(<CourtSettings {...defaultProps} hasPlayers={true} />);

    const button = screen.getByRole('button', { name: /generate random assignments/i });
    expect(button).toBeEnabled();
  });

  it('displays the explanation text', () => {
    render(<CourtSettings {...defaultProps} />);

    expect(screen.getByText('How it works:')).toBeInTheDocument();
    expect(screen.getByText(/Players will be randomly assigned to courts/)).toBeInTheDocument();
    expect(screen.getByText(/Doubles.*is preferred.*singles.*will be used/)).toBeInTheDocument();
    expect(screen.getByText(/Extra players will be benched/)).toBeInTheDocument();
  });

  it('accepts valid court numbers within range', () => {
    render(<CourtSettings {...defaultProps} />);

    const input = screen.getByLabelText('Number of Courts:');

    fireEvent.change(input, { target: { value: '1' } });
    expect(mockOnNumberOfCourtsChange).toHaveBeenCalledWith(1);

    vi.clearAllMocks();
    fireEvent.change(input, { target: { value: '20' } });
    expect(mockOnNumberOfCourtsChange).toHaveBeenCalledWith(20);
  });

  it('can generate multiple assignments without losing functionality', async () => {
    const user = userEvent.setup();
    render(<CourtSettings {...defaultProps} />);

    const button = screen.getByRole('button', { name: /generate random assignments/i });

    await user.click(button);
    await user.click(button);
    await user.click(button);

    expect(mockOnGenerateAssignments).toHaveBeenCalledTimes(3);

    expect(button).toBeEnabled();
  });
});