import React, { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageGalleryProps {
  images: { [filename: string]: string };
  onClose?: () => void;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images, onClose }) => {
  const imageList = Object.entries(images);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Touch/gesture handling
  const touchRef = useRef({
    touches: [] as any[],
    lastDistance: 0,
    lastScale: 1,
  });

  useEffect(() => {
    // Reset zoom and position when image changes
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  const nextImage = () => {
    if (currentIndex < imageList.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.5));
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const downloadImage = () => {
    const [filename, dataUrl] = imageList[currentIndex];
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch events for gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    touchRef.current.touches = Array.from(e.touches);

    if (e.touches.length === 1 && scale > 1) {
      // Single touch drag
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    } else if (e.touches.length === 2) {
      // Two finger pinch
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      touchRef.current.lastDistance = distance;
      touchRef.current.lastScale = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && isDragging && scale > 1) {
      // Single touch drag
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    } else if (e.touches.length === 2) {
      // Two finger pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) + 
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      
      if (touchRef.current.lastDistance > 0) {
        const scaleChange = distance / touchRef.current.lastDistance;
        const newScale = Math.max(0.5, Math.min(5, touchRef.current.lastScale * scaleChange));
        setScale(newScale);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(false);
    touchRef.current.touches = [];
    touchRef.current.lastDistance = 0;
    
    // Check for swipe gestures
    if (e.changedTouches.length === 1 && scale === 1) {
      // Implement swipe detection here if needed
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          prevImage();
          break;
        case 'ArrowRight':
          nextImage();
          break;
        case 'Escape':
          onClose?.();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          resetZoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  if (imageList.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">No images to display</p>
      </div>
    );
  }

  const [filename, imageUrl] = imageList[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-background to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground truncate">{filename}</h3>
            <p className="text-sm text-muted-foreground">
              {currentIndex + 1} of {imageList.length}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={downloadImage}
              className="h-10 w-10 bg-background/80"
            >
              <Download className="h-5 w-5" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 bg-background/80"
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex h-full w-full items-center justify-center p-16">
          <img
            ref={imageRef}
            src={imageUrl}
            alt={filename}
            className={cn(
              "max-h-full max-w-full object-contain transition-transform duration-200",
              isDragging ? "cursor-grabbing" : scale > 1 ? "cursor-grab" : "cursor-default"
            )}
            style={{
              transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            }}
            draggable={false}
            onDoubleClick={scale > 1 ? resetZoom : handleZoomIn}
          />
        </div>
      </div>

      {/* Navigation */}
      {imageList.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={prevImage}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 h-12 w-12 -translate-y-1/2 bg-background/80 disabled:opacity-50"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextImage}
            disabled={currentIndex === imageList.length - 1}
            className="absolute right-4 top-1/2 h-12 w-12 -translate-y-1/2 bg-background/80 disabled:opacity-50"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}

      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomIn}
          className="h-10 w-10 bg-background/80"
          disabled={scale >= 5}
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleZoomOut}
          className="h-10 w-10 bg-background/80"
          disabled={scale <= 0.5}
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
      </div>

      {/* Thumbnails */}
      {imageList.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
          <Card className="bg-background/80 backdrop-blur-sm p-2">
            <div className="flex gap-2 max-w-sm overflow-x-auto">
              {imageList.map(([name, url], index) => (
                <button
                  key={name}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "h-12 w-12 flex-shrink-0 overflow-hidden rounded border-2 transition-all",
                    index === currentIndex 
                      ? "border-primary scale-110" 
                      : "border-muted hover:border-primary/50"
                  )}
                >
                  <img
                    src={url}
                    alt={name}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};