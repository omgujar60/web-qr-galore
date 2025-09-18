import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QRScanner } from '@/components/QRScanner';
import { ImageGallery } from '@/components/ImageGallery';
import { wsService, SecureWebSocketService, type ConnectionStatus } from '@/services/websocket';
import { CryptoService, type DecryptionResult } from '@/services/crypto';
import { useToast } from '@/hooks/use-toast';
import { 
  QrCode, 
  Wifi, 
  WifiOff, 
  Lock, 
  Images, 
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AppState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'decrypting' | 'viewing';

const Index = () => {
  const { toast } = useToast();
  const [appState, setAppState] = useState<AppState>('idle');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [images, setImages] = useState<{ [filename: string]: string }>({});
  const [qrData, setQrData] = useState<{ url: string; key?: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Set up WebSocket event handlers
    wsService.onStatusChange = (status: ConnectionStatus) => {
      setConnectionStatus(status);
      
      if (status === 'connected') {
        setAppState('connected');
        toast({
          title: "Connected",
          description: "Successfully connected to secure server",
        });
      } else if (status === 'error') {
        setAppState('idle');
        toast({
          title: "Connection Failed",
          description: "Failed to connect to server",
          variant: "destructive",
        });
      }
    };

    wsService.onMessage = async (message) => {
      if (message.type === 'encrypted_zip' && message.data instanceof ArrayBuffer) {
        await handleEncryptedData(message.data);
      } else if (message.type === 'error') {
        toast({
          title: "Server Error",
          description: message.error || "Unknown server error",
          variant: "destructive",
        });
      }
    };

    wsService.onError = (error: string) => {
      toast({
        title: "Connection Error",
        description: error,
        variant: "destructive",
      });
    };

    return () => {
      wsService.disconnect();
    };
  }, [toast]);

  const handleQRScan = async (result: string) => {
    console.log('QR Code scanned:', result);
    
    const parsedData = SecureWebSocketService.parseQRData(result);
    if (!parsedData) {
      toast({
        title: "Invalid QR Code",
        description: "QR code does not contain valid connection data",
        variant: "destructive",
      });
      setAppState('idle');
      return;
    }

    setQrData(parsedData);
    setAppState('connecting');

    try {
      await wsService.connect(parsedData.url);
    } catch (error) {
      console.error('Connection failed:', error);
      setAppState('idle');
    }
  };

  const handleEncryptedData = async (encryptedData: ArrayBuffer) => {
    if (!qrData?.key) {
      toast({
        title: "Missing Decryption Key",
        description: "No decryption key found in QR code",
        variant: "destructive",
      });
      return;
    }

    setAppState('decrypting');
    setIsProcessing(true);

    try {
      const result: DecryptionResult = await CryptoService.decryptAndExtractZip(
        encryptedData,
        qrData.key
      );

      if (result.success && result.files) {
        setImages(result.files);
        setAppState('viewing');
        toast({
          title: "Images Loaded",
          description: `Successfully decrypted ${Object.keys(result.files).length} images`,
        });
      } else {
        toast({
          title: "Decryption Failed",
          description: result.error || "Failed to decrypt and extract images",
          variant: "destructive",
        });
        setAppState('connected');
      }
    } catch (error) {
      console.error('Decryption failed:', error);
      toast({
        title: "Decryption Error",
        description: "An error occurred during decryption",
        variant: "destructive",
      });
      setAppState('connected');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetApp = () => {
    wsService.disconnect();
    setAppState('idle');
    setImages({});
    setQrData(null);
    setIsProcessing(false);
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-accent" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin text-info" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <WifiOff className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Disconnected';
    }
  };

  const getStatusVariant = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'default' as const;
      case 'connecting':
        return 'secondary' as const;
      case 'error':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  // Render based on app state
  if (appState === 'scanning') {
    return (
      <QRScanner
        onScan={handleQRScan}
        isActive={true}
        onClose={() => setAppState('idle')}
      />
    );
  }

  if (appState === 'viewing' && Object.keys(images).length > 0) {
    return (
      <ImageGallery
        images={images}
        onClose={resetApp}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <div className="mx-auto max-w-md space-y-6">
        {/* Header */}
        <div className="text-center pt-8">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary">
            <Lock className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="mb-2 text-2xl font-bold">Secure Image Viewer</h1>
          <p className="text-muted-foreground">
            Scan QR code to securely receive and decrypt images
          </p>
        </div>

        {/* Status Card */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <span className="font-medium">{getStatusText()}</span>
            </div>
            <Badge variant={getStatusVariant()}>
              {connectionStatus.toUpperCase()}
            </Badge>
          </div>

          {qrData && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Server: {new URL(qrData.url).host}
              </p>
            </div>
          )}
        </Card>

        {/* Main Content */}
        <div className="space-y-4">
          {appState === 'idle' && (
            <Card className="p-6 text-center">
              <QrCode className="mx-auto mb-4 h-16 w-16 text-primary" />
              <h3 className="mb-2 font-semibold">Ready to Scan</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Scan a QR code to connect to a secure server and receive encrypted images
              </p>
              <Button 
                onClick={() => setAppState('scanning')}
                className="w-full"
                size="lg"
              >
                <QrCode className="mr-2 h-5 w-5" />
                Scan QR Code
              </Button>
            </Card>
          )}

          {appState === 'connecting' && (
            <Card className="p-6 text-center">
              <Loader2 className="mx-auto mb-4 h-16 w-16 animate-spin text-info" />
              <h3 className="mb-2 font-semibold">Connecting...</h3>
              <p className="text-sm text-muted-foreground">
                Establishing secure connection to server
              </p>
            </Card>
          )}

          {appState === 'connected' && (
            <Card className="p-6 text-center">
              <CheckCircle className="mx-auto mb-4 h-16 w-16 text-accent" />
              <h3 className="mb-2 font-semibold">Connected</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Waiting for encrypted image data...
              </p>
              <Button 
                variant="outline" 
                onClick={resetApp}
                className="w-full"
              >
                Disconnect
              </Button>
            </Card>
          )}

          {appState === 'decrypting' && (
            <Card className="p-6 text-center">
              <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center animate-pulse">
                <Lock className="h-8 w-8 text-primary-foreground" />
              </div>
              <h3 className="mb-2 font-semibold">Decrypting Images</h3>
              <p className="text-sm text-muted-foreground">
                Processing encrypted data and extracting images...
              </p>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="pt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;