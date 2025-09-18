import React, { useRef, useEffect, useState } from 'react';
import QrScanner from 'qr-scanner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QRScannerProps {
  onScan: (result: string) => void;
  isActive: boolean;
  onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScan, isActive, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isActive || !videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        onScan(result.data);
        scanner.stop();
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        preferredCamera: 'environment',
        maxScansPerSecond: 5,
      }
    );

    setQrScanner(scanner);

    const startScanner = async () => {
      try {
        setIsLoading(true);
        await scanner.start();
        setHasPermission(true);
      } catch (error) {
        console.error('Failed to start QR scanner:', error);
        setHasPermission(false);
      } finally {
        setIsLoading(false);
      }
    };

    startScanner();

    return () => {
      scanner.destroy();
    };
  }, [isActive, onScan]);

  const handleClose = () => {
    qrScanner?.stop();
    onClose();
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm">
      <div className="relative h-full w-full">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Scan QR Code</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-10 w-10 rounded-full bg-background/80"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Camera View */}
        <div className="relative h-full w-full">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
              <div className="text-center">
                <Camera className="mx-auto mb-4 h-12 w-12 text-primary animate-pulse" />
                <p className="text-muted-foreground">Starting camera...</p>
              </div>
            </div>
          )}

          {hasPermission === false && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
              <Card className="mx-4 p-6 text-center">
                <Camera className="mx-auto mb-4 h-12 w-12 text-destructive" />
                <h3 className="mb-2 font-semibold">Camera Access Required</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Please allow camera access to scan QR codes
                </p>
                <Button onClick={() => window.location.reload()}>
                  Try Again
                </Button>
              </Card>
            </div>
          )}

          <video
            ref={videoRef}
            className={cn(
              "h-full w-full object-cover",
              (isLoading || hasPermission === false) && "opacity-0"
            )}
            playsInline
            muted
          />

          {/* Scan Overlay */}
          {hasPermission && !isLoading && (
            <div className="absolute inset-0 z-10">
              {/* Corner Markers */}
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2">
                <div className="relative h-full w-full">
                  {/* Top Left */}
                  <div className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-primary rounded-tl-lg" />
                  {/* Top Right */}
                  <div className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-primary rounded-tr-lg" />
                  {/* Bottom Left */}
                  <div className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  {/* Bottom Right */}
                  <div className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  
                  {/* Scanning Line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-primary scan-line" />
                </div>
              </div>

              {/* Instructions */}
              <div className="absolute bottom-20 left-0 right-0 p-4 text-center">
                <Card className="mx-auto max-w-sm bg-background/80 backdrop-blur-sm">
                  <div className="p-4">
                    <Square className="mx-auto mb-2 h-6 w-6 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Position the QR code within the frame to scan
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};