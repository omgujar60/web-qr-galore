import CryptoJS from 'crypto-js';
import JSZip from 'jszip';

export interface DecryptionResult {
  success: boolean;
  files?: { [filename: string]: string }; // Base64 image data
  error?: string;
}

export class CryptoService {
  /**
   * Decrypt AES encrypted data
   */
  static decryptAES(encryptedData: ArrayBuffer, key: string, iv?: string): ArrayBuffer | null {
    try {
      // Convert ArrayBuffer to WordArray
      const encrypted = CryptoJS.lib.WordArray.create(encryptedData);
      
      // Create key from string
      const keyWordArray = CryptoJS.enc.Utf8.parse(key);
      
      // Use provided IV or extract from data (first 16 bytes)
      let ivWordArray: CryptoJS.lib.WordArray;
      let ciphertext: CryptoJS.lib.WordArray;
      
      if (iv) {
        ivWordArray = CryptoJS.enc.Utf8.parse(iv);
        ciphertext = encrypted;
      } else {
        // Extract IV from first 16 bytes
        const ivBytes = new Uint8Array(encryptedData.slice(0, 16));
        const ciphertextBytes = new Uint8Array(encryptedData.slice(16));
        
        ivWordArray = CryptoJS.lib.WordArray.create(ivBytes);
        ciphertext = CryptoJS.lib.WordArray.create(ciphertextBytes);
      }

      // Decrypt
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: ciphertext
      });
      
      const decrypted = CryptoJS.AES.decrypt(
        cipherParams,
        keyWordArray,
        {
          iv: ivWordArray,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );

      // Convert back to ArrayBuffer
      const decryptedBytes = new Uint8Array(decrypted.sigBytes);
      const words = decrypted.words;
      
      for (let i = 0; i < decryptedBytes.length; i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        decryptedBytes[i] = (words[wordIndex] >>> (24 - byteIndex * 8)) & 0xff;
      }

      return decryptedBytes.buffer;
    } catch (error) {
      console.error('AES decryption failed:', error);
      return null;
    }
  }

  /**
   * Alternative decryption method using different key derivation
   */
  static decryptAESWithSalt(encryptedData: ArrayBuffer, passphrase: string): ArrayBuffer | null {
    try {
      // Extract salt (first 8 bytes) and encrypted data
      const salt = new Uint8Array(encryptedData.slice(0, 8));
      const encrypted = new Uint8Array(encryptedData.slice(8));

      // Derive key and IV from passphrase and salt
      const keyIv = CryptoJS.PBKDF2(passphrase, CryptoJS.lib.WordArray.create(salt), {
        keySize: 12, // 32 bytes key + 16 bytes IV = 48 bytes = 12 words
        iterations: 1000
      });

      const key = CryptoJS.lib.WordArray.create(keyIv.words.slice(0, 8)); // 32 bytes
      const iv = CryptoJS.lib.WordArray.create(keyIv.words.slice(8, 12)); // 16 bytes

      // Decrypt
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.lib.WordArray.create(encrypted)
      });
      
      const decrypted = CryptoJS.AES.decrypt(
        cipherParams,
        key,
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7
        }
      );

      // Convert to ArrayBuffer
      const decryptedBytes = new Uint8Array(decrypted.sigBytes);
      const words = decrypted.words;
      
      for (let i = 0; i < decryptedBytes.length; i++) {
        const wordIndex = Math.floor(i / 4);
        const byteIndex = i % 4;
        decryptedBytes[i] = (words[wordIndex] >>> (24 - byteIndex * 8)) & 0xff;
      }

      return decryptedBytes.buffer;
    } catch (error) {
      console.error('AES decryption with salt failed:', error);
      return null;
    }
  }

  /**
   * Decrypt and extract ZIP file
   */
  static async decryptAndExtractZip(
    encryptedData: ArrayBuffer, 
    key: string, 
    iv?: string
  ): Promise<DecryptionResult> {
    try {
      // Try different decryption methods
      let decryptedData = this.decryptAES(encryptedData, key, iv);
      
      if (!decryptedData) {
        // Try with salt-based decryption
        decryptedData = this.decryptAESWithSalt(encryptedData, key);
      }

      if (!decryptedData) {
        return {
          success: false,
          error: 'Failed to decrypt data'
        };
      }

      // Extract ZIP
      const zip = new JSZip();
      const zipData = await zip.loadAsync(decryptedData);
      const files: { [filename: string]: string } = {};

      // Process each file in the ZIP
      for (const [filename, file] of Object.entries(zipData.files)) {
        if (!file.dir && this.isImageFile(filename)) {
          try {
            // Get file as ArrayBuffer
            const fileData = await file.async('arraybuffer');
            
            // Convert to base64 for display
            const base64 = this.arrayBufferToBase64(fileData);
            const mimeType = this.getMimeType(filename);
            files[filename] = `data:${mimeType};base64,${base64}`;
          } catch (error) {
            console.error(`Failed to process file ${filename}:`, error);
          }
        }
      }

      if (Object.keys(files).length === 0) {
        return {
          success: false,
          error: 'No image files found in archive'
        };
      }

      return {
        success: true,
        files
      };

    } catch (error) {
      console.error('Decryption and extraction failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if file is an image based on extension
   */
  private static isImageFile(filename: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  }

  /**
   * Get MIME type based on file extension
   */
  private static getMimeType(filename: string): string {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}