declare module 'react-image-crop' {
  import * as React from 'react';

  export interface Crop {
    unit?: 'px' | '%';
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface PixelCrop {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  export interface ReactCropProps {
    crop: Crop;
    onChange?(crop: Crop): void;
    onComplete?(crop: PixelCrop): void;
    keepSelection?: boolean;
    locked?: boolean;
    children: React.ReactNode;
  }

  const ReactCrop: React.FC<ReactCropProps>;
  export default ReactCrop;
}