import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useDragAndDrop } from '../../src/hooks/useDragAndDrop';
import { createMockDragEvent, MOCK_FILES } from '../data/testFactories';
import { mockAssertions } from '../data/testHelpers';

describe('useDragAndDrop Hook', () => {
  const mockOnFileDropped = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with isDragOver as false', () => {
    const { result } = renderHook(() => useDragAndDrop({ onFileDropped: mockOnFileDropped }));

    expect(result.current.isDragOver).toBe(false);
  });

  it('should set isDragOver to true on handleDragOver', () => {
    const { result } = renderHook(() => useDragAndDrop({ onFileDropped: mockOnFileDropped }));
    const mockEvent = createMockDragEvent();

    act(() => {
      result.current.handleDragOver(mockEvent);
    });

    expect(result.current.isDragOver).toBe(true);
    mockAssertions.expectCalled(mockEvent.preventDefault);
  });

  it('should set isDragOver to false on handleDragLeave', () => {
    const { result } = renderHook(() => useDragAndDrop({ onFileDropped: mockOnFileDropped }));
    const mockEvent = createMockDragEvent();

    act(() => {
      result.current.handleDragOver(mockEvent);
    });
    expect(result.current.isDragOver).toBe(true);

    act(() => {
      result.current.handleDragLeave(mockEvent);
    });
    expect(result.current.isDragOver).toBe(false);
    mockAssertions.expectCalledTimes(mockEvent.preventDefault, 2);
  });

  it('should call onFileDropped with valid image file on handleDrop', () => {
    const { result } = renderHook(() => useDragAndDrop({ onFileDropped: mockOnFileDropped }));
    const mockEvent = createMockDragEvent([MOCK_FILES.image.jpg]);

    act(() => {
      result.current.handleDrop(mockEvent);
    });

    expect(result.current.isDragOver).toBe(false);
    mockAssertions.expectCalled(mockEvent.preventDefault);
    mockAssertions.expectCalledWith(mockOnFileDropped, MOCK_FILES.image.jpg);
  });

  it('should not call onFileDropped with non-image file on handleDrop', () => {
    const { result } = renderHook(() => useDragAndDrop({ onFileDropped: mockOnFileDropped }));
    const mockEvent = createMockDragEvent([MOCK_FILES.nonImage.txt]);

    act(() => {
      result.current.handleDrop(mockEvent);
    });

    expect(result.current.isDragOver).toBe(false);
    mockAssertions.expectCalled(mockEvent.preventDefault);
    mockAssertions.expectNotCalled(mockOnFileDropped);
  });

  it('should not call onFileDropped when no files are dropped', () => {
    const { result } = renderHook(() => useDragAndDrop({ onFileDropped: mockOnFileDropped }));
    const mockEvent = createMockDragEvent([]);

    act(() => {
      result.current.handleDrop(mockEvent);
    });

    expect(result.current.isDragOver).toBe(false);
    mockAssertions.expectCalled(mockEvent.preventDefault);
    mockAssertions.expectNotCalled(mockOnFileDropped);
  });

  it('should handle null dataTransfer.files gracefully', () => {
    const { result } = renderHook(() => useDragAndDrop({ onFileDropped: mockOnFileDropped }));

    const mockEvent = {
      preventDefault: vi.fn(),
      dataTransfer: {
        files: null,
      },
    } as unknown as React.DragEvent<HTMLDivElement>;

    act(() => {
      result.current.handleDrop(mockEvent);
    });

    expect(result.current.isDragOver).toBe(false);
    mockAssertions.expectCalled(mockEvent.preventDefault);
    mockAssertions.expectNotCalled(mockOnFileDropped);
  });

  it('should return stable function references with useCallback', () => {
    const { result, rerender } = renderHook(() => useDragAndDrop({ onFileDropped: mockOnFileDropped }));

    const firstRenderHandlers = {
      handleDrop: result.current.handleDrop,
      handleDragOver: result.current.handleDragOver,
      handleDragLeave: result.current.handleDragLeave,
    };

    rerender();

    expect(result.current.handleDrop).toBe(firstRenderHandlers.handleDrop);
    expect(result.current.handleDragOver).toBe(firstRenderHandlers.handleDragOver);
    expect(result.current.handleDragLeave).toBe(firstRenderHandlers.handleDragLeave);
  });

  it('should handle multiple drag operations correctly', () => {
    const { result } = renderHook(() => useDragAndDrop({ onFileDropped: mockOnFileDropped }));
    const mockEvent = createMockDragEvent();

    act(() => {
      result.current.handleDragOver(mockEvent);
    });
    expect(result.current.isDragOver).toBe(true);

    act(() => {
      result.current.handleDragLeave(mockEvent);
    });
    expect(result.current.isDragOver).toBe(false);

    act(() => {
      result.current.handleDragOver(mockEvent);
    });
    expect(result.current.isDragOver).toBe(true);

    act(() => {
      result.current.handleDragLeave(mockEvent);
    });
    expect(result.current.isDragOver).toBe(false);
  });
});