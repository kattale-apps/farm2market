declare module 'qrcode' {
  interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    type?: 'image/png' | 'image/jpeg' | 'image/webp';
    quality?: number;
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  interface QRCodeToCanvasOptions extends QRCodeToDataURLOptions {
    appendTo?: HTMLElement;
  }

  function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  function toCanvas(canvas: HTMLCanvasElement, text: string, options?: QRCodeToCanvasOptions): Promise<void>;
  function toString(text: string, options?: QRCodeToDataURLOptions): Promise<string>;

  export default {
    toDataURL,
    toCanvas,
    toString,
  };
}
