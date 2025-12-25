import { useState, useRef, useEffect } from 'react';
import Icon from './Icons';
import './ImageCropper.css';

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
  aspectRatio?: number;
  circular?: boolean;
}

const ImageCropper = ({ imageSrc, onCrop, onCancel, aspectRatio = 1, circular = false }: ImageCropperProps) => {
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const containerWidth = containerRef.current?.clientWidth || 500;
      const containerHeight = containerRef.current?.clientHeight || 500;
      
      const imgAspect = img.width / img.height;
      const containerAspect = containerWidth / containerHeight;
      
      let displayWidth, displayHeight;
      if (imgAspect > containerAspect) {
        displayWidth = containerWidth;
        displayHeight = containerWidth / imgAspect;
      } else {
        displayHeight = containerHeight;
        displayWidth = containerHeight * imgAspect;
      }
      
      setImageSize({ width: displayWidth, height: displayHeight });
      
      // Initialize crop box in center
      const cropSize = Math.min(displayWidth, displayHeight) * 0.8;
      setCrop({
        x: (displayWidth - cropSize) / 2,
        y: (displayHeight - cropSize) / 2,
        width: cropSize,
        height: cropSize
      });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const constrainCrop = (newCrop: typeof crop): typeof crop => {
    const minSize = 50;
    const maxWidth = imageSize.width;
    const maxHeight = imageSize.height;
    
    let { x, y, width, height } = newCrop;
    
    // Maintain aspect ratio
    if (aspectRatio) {
      if (width / height > aspectRatio) {
        height = width / aspectRatio;
      } else {
        width = height * aspectRatio;
      }
    }
    
    // Constrain size
    width = Math.max(minSize, Math.min(width, maxWidth));
    height = Math.max(minSize, Math.min(height, maxHeight));
    
    // Constrain position
    x = Math.max(0, Math.min(x, maxWidth - width));
    y = Math.max(0, Math.min(y, maxHeight - height));
    
    return { x, y, width, height };
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'drag' | 'resize', handle?: string) => {
    e.preventDefault();
    if (type === 'drag') {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - crop.x,
        y: e.clientY - crop.y
      });
    } else if (type === 'resize' && handle) {
      setIsResizing(true);
      setResizeHandle(handle);
      setDragStart({
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setCrop(constrainCrop({ ...crop, x: newX, y: newY }));
    } else if (isResizing && resizeHandle) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      let newCrop = { ...crop };
      
      switch (resizeHandle) {
        case 'se':
          newCrop.width = crop.width + deltaX;
          newCrop.height = crop.height + deltaY;
          break;
        case 'sw':
          newCrop.width = crop.width - deltaX;
          newCrop.height = crop.height + deltaY;
          newCrop.x = crop.x + deltaX;
          break;
        case 'ne':
          newCrop.width = crop.width + deltaX;
          newCrop.height = crop.height - deltaY;
          newCrop.y = crop.y + deltaY;
          break;
        case 'nw':
          newCrop.width = crop.width - deltaX;
          newCrop.height = crop.height - deltaY;
          newCrop.x = crop.x + deltaX;
          newCrop.y = crop.y + deltaY;
          break;
      }
      
      setCrop(constrainCrop(newCrop));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  };

  const handleCrop = () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scaleX = img.width / imageSize.width;
      const scaleY = img.height / imageSize.height;
      
      const cropX = crop.x * scaleX;
      const cropY = crop.y * scaleY;
      const cropWidth = crop.width * scaleX;
      const cropHeight = crop.height * scaleY;

      canvas.width = circular ? cropWidth : cropWidth;
      canvas.height = circular ? cropHeight : cropHeight;

      if (circular) {
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
        ctx.clip();
      }

      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, canvas.width, canvas.height
      );

      canvas.toBlob((blob) => {
        if (blob) {
          onCrop(blob);
        }
      }, 'image/jpeg', 0.9);
    };
    img.src = imageSrc;
  };

  return (
    <div className="image-cropper-overlay" onClick={onCancel}>
      <div className="image-cropper-container" onClick={(e) => e.stopPropagation()}>
        <div className="image-cropper-header">
          <h3>Crop Profile Image</h3>
          <button className="image-cropper-close" onClick={onCancel}>
            <Icon name="x" />
          </button>
        </div>
        
        <div className="image-cropper-content">
          <div 
            ref={containerRef}
            className="image-cropper-preview"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop preview"
              style={{
                width: `${imageSize.width}px`,
                height: `${imageSize.height}px`,
                maxWidth: '100%',
                maxHeight: '100%'
              }}
            />
            
            <div
              ref={cropBoxRef}
              className={`crop-box ${circular ? 'circular' : ''}`}
              style={{
                left: `${crop.x}px`,
                top: `${crop.y}px`,
                width: `${crop.width}px`,
                height: `${crop.height}px`
              }}
              onMouseDown={(e) => handleMouseDown(e, 'drag')}
            >
              {!circular && (
                <>
                  <div className="resize-handle nw" onMouseDown={(e) => handleMouseDown(e, 'resize', 'nw')} />
                  <div className="resize-handle ne" onMouseDown={(e) => handleMouseDown(e, 'resize', 'ne')} />
                  <div className="resize-handle sw" onMouseDown={(e) => handleMouseDown(e, 'resize', 'sw')} />
                  <div className="resize-handle se" onMouseDown={(e) => handleMouseDown(e, 'resize', 'se')} />
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="image-cropper-actions">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-crop" onClick={handleCrop}>
            <Icon name="check-circle" />
            Crop & Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropper;

