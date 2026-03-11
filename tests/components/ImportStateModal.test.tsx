import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ImportStateModal from '../../src/components/ImportStateModal';

describe('ImportStateModal', () => {
  const user = userEvent.setup();
  const defaultProps = {
    isOpen: true,
    currentBackupUrl: 'http://localhost/?state=abc123',
    onAccept: vi.fn(),
    onDecline: vi.fn(),
  };

  it('should not render when isOpen is false', () => {
    render(<ImportStateModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('import-state-modal')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(<ImportStateModal {...defaultProps} />);
    expect(screen.getByTestId('import-state-modal')).toBeInTheDocument();
  });

  it('should display backup URL input when currentBackupUrl is provided', () => {
    render(<ImportStateModal {...defaultProps} />);
    const input = screen.getByTestId('import-state-backup-url') as HTMLInputElement;
    expect(input.value).toBe(defaultProps.currentBackupUrl);
  });

  it('should not display backup URL section when currentBackupUrl is empty', () => {
    render(<ImportStateModal {...defaultProps} currentBackupUrl="" />);
    expect(screen.queryByTestId('import-state-backup-url')).not.toBeInTheDocument();
  });

  it('should call onAccept when "Load shared session" button is clicked', async () => {
    const onAccept = vi.fn();
    render(<ImportStateModal {...defaultProps} onAccept={onAccept} />);

    await act(async () => {
      await user.click(screen.getByTestId('import-state-accept'));
    });

    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('should call onDecline when "Keep my session" button is clicked', async () => {
    const onDecline = vi.fn();
    render(<ImportStateModal {...defaultProps} onDecline={onDecline} />);

    await act(async () => {
      await user.click(screen.getByTestId('import-state-decline'));
    });

    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('should call onDecline when close (X) button is clicked', async () => {
    const onDecline = vi.fn();
    render(<ImportStateModal {...defaultProps} onDecline={onDecline} />);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: '' }));
    });

    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('should copy backup URL to clipboard when copy button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<ImportStateModal {...defaultProps} />);

    await act(async () => {
      await user.click(screen.getByTestId('copy-backup-url-button'));
    });

    expect(writeText).toHaveBeenCalledWith(defaultProps.currentBackupUrl);
  });

  it('should show "Copied!" after clicking copy button', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });

    render(<ImportStateModal {...defaultProps} />);
    const copyButton = screen.getByTestId('copy-backup-url-button');
    expect(copyButton).toHaveTextContent('Copy');

    await act(async () => {
      await user.click(copyButton);
    });

    expect(copyButton).toHaveTextContent('Copied!');
  });
});
