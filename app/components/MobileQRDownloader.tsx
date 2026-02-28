"use client";

import { useRef, useEffect, useState } from "react";
import QRCode from "qrcode.react";

interface MobileQRDownloaderProps {
  qrValue: string; // The URL to encode in QR
  filename: string; // e.g., "coffee-farmers-qr"
  title?: string; // Optional title above QR
}

export function MobileQRDownloader({
  qrValue,
  filename,
  title,
}: MobileQRDownloaderProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if device is mobile
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  }, []);

  const handleDownloadQR = async () => {
    try {
      // Try Method 1: Canvas toDataURL (works better on most devices)
      if (canvasRef.current) {
        const canvas = canvasRef.current as HTMLCanvasElement;
        
        // Convert canvas to blob for better mobile support
        canvas.toBlob((blob) => {
          if (blob) {
            // Method 1: Try using link download (desktop and some mobile browsers)
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${filename}.png`;
            
            // Append to body, click, then remove (needed for some browsers)
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            // Fallback for mobile browsers that ignore download attribute
            setTimeout(() => {
              // If download didn't work, open in new tab for long-press save
              if (isMobile) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  if (e.target?.result) {
                    window.open(e.target.result as string, "_blank");
                  }
                };
                reader.readAsDataURL(blob);
              }
            }, 500);
          }
        }, "image/png");
      }
    } catch (error) {
      console.error("QR download error:", error);
      alert("Unable to download. Try long-press or screenshot instead.");
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Title */}
      {title && (
        <h3 className="text-lg font-bold text-gray-900 text-center">{title}</h3>
      )}

      {/* QR Container - Mobile optimized */}
      <div
        className="bg-white p-4 rounded-xl shadow-md border border-gray-200 flex items-center justify-center"
        style={{
          maxWidth: "280px",
          width: "80vw",
          aspectRatio: "1",
        }}
      >
        <div ref={qrRef} className="flex items-center justify-center">
          <QRCode
            ref={canvasRef}
            value={qrValue}
            size={256}
            level="H"
            includeMargin={true}
            renderAs="canvas"
          />
        </div>
      </div>

      {/* Mobile-friendly instruction text */}
      <p className="text-xs text-gray-500 text-center max-w-xs">
        Tap and hold to save or take a screenshot
      </p>

      {/* Download Button - Large touch target */}
      <button
        onClick={handleDownloadQR}
        className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors min-h-12 touch-none active:scale-95"
      >
        📥 Download QR
      </button>
    </div>
  );
}
