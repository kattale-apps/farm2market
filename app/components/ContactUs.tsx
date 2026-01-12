"use client";

import { useState } from "react";

/**
 * Contact Us Component
 * 
 * Reusable contact component for dashboards
 */

interface ContactUsProps {
  isMobile?: boolean;
}

export function ContactUs({ isMobile = false }: ContactUsProps) {
  const [showContact, setShowContact] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailtoLink = `mailto:kattaleglobal@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`)}`;
    window.location.href = mailtoLink;
    setShowContact(false);
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  };

  if (!showContact) {
    return (
      <div style={{
        marginTop: "1rem",
        padding: "1rem",
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
      }}>
        <button
          onClick={() => setShowContact(true)}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#2e7d32",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: isMobile ? "0.9rem" : "1rem",
            fontWeight: "600",
            width: "100%",
            transition: "background 0.3s",
            fontFamily: '"Montserrat", sans-serif'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#1b5e20"}
          onMouseLeave={(e) => e.currentTarget.style.background = "#2e7d32"}
        >
          📧 Contact Us
        </button>
        <p style={{
          marginTop: "0.5rem",
          fontSize: "0.85rem",
          color: "#666",
          textAlign: "center"
        }}>
          Need help? Email us at{" "}
          <a 
            href="mailto:kattaleglobal@gmail.com" 
            style={{ color: "#2e7d32", textDecoration: "none" }}
          >
            kattaleglobal@gmail.com
          </a>
        </p>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: "1rem",
      padding: "1.5rem",
      background: "rgba(255, 255, 255, 0.95)",
      borderRadius: "8px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1rem"
      }}>
        <h3 style={{
          fontSize: isMobile ? "1.1rem" : "1.3rem",
          color: "#2e7d32",
          fontWeight: "700",
          fontFamily: '"Montserrat", sans-serif',
          margin: 0
        }}>
          Contact Us
        </h3>
        <button
          onClick={() => setShowContact(false)}
          style={{
            background: "transparent",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
            color: "#666",
            padding: "0",
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "600",
            color: "#2c2c2c",
            fontSize: isMobile ? "0.9rem" : "1rem"
          }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: isMobile ? "0.9rem" : "1rem",
              fontFamily: '"Montserrat", sans-serif',
              boxSizing: "border-box"
            }}
          />
        </div>

        <div>
          <label style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "600",
            color: "#2c2c2c",
            fontSize: isMobile ? "0.9rem" : "1rem"
          }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: isMobile ? "0.9rem" : "1rem",
              fontFamily: '"Montserrat", sans-serif',
              boxSizing: "border-box"
            }}
          />
        </div>

        <div>
          <label style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "600",
            color: "#2c2c2c",
            fontSize: isMobile ? "0.9rem" : "1rem"
          }}>
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: isMobile ? "0.9rem" : "1rem",
              fontFamily: '"Montserrat", sans-serif',
              boxSizing: "border-box"
            }}
          />
        </div>

        <div>
          <label style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "600",
            color: "#2c2c2c",
            fontSize: isMobile ? "0.9rem" : "1rem"
          }}>
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "0.75rem",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: isMobile ? "0.9rem" : "1rem",
              fontFamily: '"Montserrat", sans-serif',
              resize: "vertical",
              boxSizing: "border-box"
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: "0.75rem 1.5rem",
            background: "#2e7d32",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "600",
            fontSize: isMobile ? "0.9rem" : "1rem",
            cursor: "pointer",
            transition: "background 0.3s",
            fontFamily: '"Montserrat", sans-serif'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#1b5e20"}
          onMouseLeave={(e) => e.currentTarget.style.background = "#2e7d32"}
        >
          Send Message
        </button>
      </form>
    </div>
  );
}
