export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketMessage {
  type: 'encrypted_zip' | 'status' | 'error';
  data?: ArrayBuffer | string;
  error?: string;
}

export class SecureWebSocketService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;
  
  public onStatusChange: (status: ConnectionStatus) => void = () => {};
  public onMessage: (message: WebSocketMessage) => void = () => {};
  public onError: (error: string) => void = () => {};

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.url = url;
        this.onStatusChange('connecting');
        
        this.ws = new WebSocket(url);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.onStatusChange('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            if (event.data instanceof ArrayBuffer) {
              // Binary data (encrypted zip)
              this.onMessage({
                type: 'encrypted_zip',
                data: event.data
              });
            } else {
              // Text data (JSON messages)
              const message = JSON.parse(event.data);
              this.onMessage(message);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            this.onError('Failed to parse message');
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.onStatusChange('error');
          this.onError('Connection error');
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.onStatusChange('disconnected');
          
          // Auto-reconnect logic
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnect();
          }
        };

        // Connection timeout
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.onStatusChange('error');
        reject(error);
      }
    });
  }

  private reconnect(): void {
    this.reconnectAttempts++;
    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect(this.url).catch(() => {
          // Reconnection failed, will try again if attempts left
        });
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  send(message: any): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error('Failed to send message:', error);
        return false;
      }
    }
    return false;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.onStatusChange('disconnected');
  }

  getStatus(): ConnectionStatus {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'error';
    }
  }

  // Utility to extract WebSocket URL from QR code
  static parseQRData(qrData: string): { url: string; key?: string } | null {
    try {
      // Try parsing as JSON first
      const parsed = JSON.parse(qrData);
      if (parsed.url) {
        return parsed;
      }
    } catch {
      // Fallback: treat as plain URL
      if (qrData.startsWith('ws://') || qrData.startsWith('wss://')) {
        return { url: qrData };
      }
    }
    
    return null;
  }
}

export const wsService = new SecureWebSocketService();