import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactCrop, { type PixelCrop, type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import { getCroppedImageFile } from '../utils/cropImage';

interface ImageCropperProps {
  /** The image file selected by the user */
  file: File | null;
  /** Whether the cropper should be displayed */
  isOpen: boolean;
  /** Called when the user cancels cropping */
  onCancel: () => void;
  /** Called with a new cropped File when the user confirms */
  onCropped: (croppedFile: File) => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ file, isOpen, onCancel, onCropped }) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);

  // Create an object URL when the component mounts / file changes
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);

    // Cleanup when unmounting / file changes
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // Disable body scrolling when cropper is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    // Cleanup: restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Store reference to image element once loaded so we can calculate pixel crop
  const onImageLoaded = useCallback((img: HTMLImageElement) => {
    imgRef.current = img;
  }, []);

  const onCropComplete = useCallback((c: PixelCrop) => {
    setCompletedCrop(c);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!imageSrc || !completedCrop || !imgRef.current) return;

    const pixelCrop = {
      x: completedCrop.x,
      y: completedCrop.y,
      width: completedCrop.width,
      height: completedCrop.height,
    } as PixelCrop;

    try {
      const cropped = await getCroppedImageFile(imageSrc, pixelCrop as any);
      onCropped(cropped);
    } catch (err) {
      console.error('Failed to crop image', err);
      if (file) onCropped(file);
    }
  }, [imageSrc, completedCrop, onCropped, file]);

  if (!isOpen || !file || !imageSrc) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Crop area */}
      <div
        style={{
          position: 'relative',
          width: '90vw',
          maxWidth: 600,
          height: '70vh',
          background: 'transparent',
        }}
      >
        <ReactCrop
          crop={crop}
          onChange={(newCrop: Crop) => setCrop(newCrop)}
          onComplete={(c: PixelCrop) => onCropComplete(c)}
          locked={false}
          keepSelection={true}
        >
          <img
            src={imageSrc}
            alt="Crop"
            onLoad={(e) => onImageLoaded(e.currentTarget)}
            style={{ maxWidth: '100%' }}
          />
        </ReactCrop>
      </div>

      {/* Controls */}
      <div
        style={{
          marginTop: 16,
          width: '90vw',
          maxWidth: 600,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 8,
        }}
      >
        {/* No zoom slider needed; users can adjust rectangle directly */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <button type="button" onClick={onCancel} className="upload-button" style={{ background: '#a0aec0' }}>
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} className="upload-button">
            Crop & Continue
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;