import { useCallback, useState } from 'react';

import { getFirstFile, isImageFile } from '../utils/fileUtils';

interface UseDragAndDropProps {
  onFileDropped: (file: File) => void;
}

interface UseDragAndDropReturn {
  isDragOver: boolean;
  handleDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
}

export function useDragAndDrop({ onFileDropped }: UseDragAndDropProps): UseDragAndDropReturn {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const file = getFirstFile(event.dataTransfer.files);
    if (isImageFile(file)) {
      onFileDropped(file);
    }
  }, [onFileDropped]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  return {
    isDragOver,
    handleDrop,
    handleDragOver,
    handleDragLeave,
  };
}