"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useState, useEffect } from "react";
import jsPDF from "jspdf";

export default function DeliveryVerificationPage() {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [selectedUtid, setSelectedUtid] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const utids = useQuery(
    api.storeAdmin.getStoreAdminUTIDs,
    userId ? { adminId: userId } : "skip"
  );
  const verifyDelivery = useMutation(api.storeAdmin.verifyDeliveryWithProof);
  const linkPDF = useMutation(api.storeAdmin.linkDeliveryPDF);

  // Get current user from localStorage (pilot mode)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("pilot_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.userId) {
            setUserId(parsed.userId as Id<"users">);
          }
        }
      } catch (e) {
        console.error("Error reading user from localStorage:", e);
      }
    }
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setPhotos(files);
      setMessage(null);
    }
  };

  const generatePDF = async (lockUtid: string): Promise<string> => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Delivery Verification Report", 20, 20);
    
    doc.setFontSize(12);
    doc.text(`UTID: ${lockUtid}`, 20, 35);
    doc.text(`Date: ${new Date().toLocaleString()}`, 20, 45);
    
    if (comment) {
      doc.text("Comments:", 20, 60);
      doc.setFontSize(10);
      const splitComment = doc.splitTextToSize(comment, 170);
      doc.text(splitComment, 20, 70);
    }
    
    doc.text("Photos: 3 photos attached (weighing, checking, in-storage)", 20, 100);
    
    // Save PDF as data URL
    const pdfDataUrl = doc.output("dataurlstring");
    return pdfDataUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId || !selectedUtid) {
      setMessage({ type: "error", text: "Please select a UTID" });
      return;
    }

    if (!comment.trim()) {
      setMessage({ type: "error", text: "Comment is required" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Convert photos to base64 (in production, upload to Convex file storage)
      const photoIds: string[] = [];
      if (photos.length > 0) {
        for (const photo of photos) {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(photo);
          });
          photoIds.push(base64); // In production, upload to Convex and get file ID
        }
      }

      // Verify delivery
      const result = await verifyDelivery({
        adminId: userId,
        lockUtid: selectedUtid,
        comment: comment.trim(),
        photoIds: photoIds.length > 0 ? photoIds : undefined,
        reason: `Delivery verification for UTID: ${selectedUtid}`,
      });

      // Generate PDF
      const pdfDataUrl = await generatePDF(selectedUtid);
      
      // Link PDF (in production, upload PDF to Convex file storage first)
      await linkPDF({
        adminId: userId,
        lockUtid: selectedUtid,
        pdfId: pdfDataUrl, // In production, use Convex file storage ID
      });

      setMessage({
        type: "success",
        text: `Delivery verified successfully! UTID: ${result.utid}. PDF generated.`,
      });

      // Reset form
      setComment("");
      setPhotos([]);
      setSelectedUtid(null);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to verify delivery" });
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Please log in to access delivery verification.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "clamp(1rem, 4vw, 2rem)", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", marginBottom: "1.5rem" }}>
        Delivery Verification
      </h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Verify deliveries for UTIDs from your assigned storage locations. Provide a comment; photos are optional.
      </p>

      {message && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            borderRadius: "8px",
            background: message.type === "success" ? "#d4edda" : "#f8d7da",
            color: message.type === "success" ? "#155724" : "#721c24",
          }}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
            Select UTID *
          </label>
          {utids === undefined ? (
            <p>Loading UTIDs...</p>
          ) : utids.length === 0 ? (
            <p style={{ color: "#666", padding: "1rem", background: "#fff3cd", borderRadius: "6px" }}>
              No UTIDs available for verification. All deliveries may have been verified.
            </p>
          ) : (
            <select
              value={selectedUtid || ""}
              onChange={(e) => setSelectedUtid(e.target.value || null)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "1rem",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="">-- Select UTID --</option>
              {utids.map((utid: any) => (
                <option key={utid.utid} value={utid.utid}>
                  {utid.utid} - {utid.produceType} ({utid.units.length} units)
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
            Comment *
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
            rows={4}
            placeholder="Describe the delivery condition, quality, weight verification, etc."
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "1rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "600" }}>
            Photos (optional)
          </label>
          <p style={{ fontSize: "0.9rem", color: "#666", marginBottom: "0.5rem" }}>
            Upload photos (weighing, checking quality, in-storage) if available
          </p>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoChange}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "1rem",
              border: "1px solid #ddd",
              borderRadius: "4px",
            }}
          />
          {photos.length > 0 && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: photos.length === 3 ? "#28a745" : "#dc3545" }}>
              {photos.length} photo(s) selected
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !selectedUtid || !comment.trim() || photos.length !== 3}
          style={{
            width: "100%",
            padding: "1rem",
            fontSize: "1.1rem",
            fontWeight: "600",
            background: loading || !selectedUtid || !comment.trim() || photos.length !== 3 ? "#ccc" : "#28a745",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: loading || !selectedUtid || !comment.trim() || photos.length !== 3 ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Verifying..." : "Verify Delivery & Generate PDF"}
        </button>
      </form>
    </div>
  );
}
