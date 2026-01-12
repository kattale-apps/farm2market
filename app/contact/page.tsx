"use client";

import { useState, useEffect } from "react";

/**
 * Contact Us Page
 * 
 * Allows users to contact Farm2Market Uganda support
 */

export default function ContactPage() {
  const [isMobile, setIsMobile] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !subject || !message) {
      setError("Please fill in all fields");
      return;
    }

    // Create mailto link
    const mailtoLink = `mailto:kattaleglobal@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`)}`;
    
    // Open email client
    window.location.href = mailtoLink;
    setSubmitted(true);
    
    // Reset form after a delay
    setTimeout(() => {
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setSubmitted(false);
    }, 3000);
  };

  return (
    <main style={{
      padding: isMobile ? "1rem" : "clamp(2rem, 5vw, 4rem)",
      maxWidth: "800px",
      margin: "0 auto",
      minHeight: "100vh",
      background: "rgba(255, 255, 255, 0.95)",
      borderRadius: isMobile ? "0" : "12px",
      boxShadow: isMobile ? "none" : "0 2px 8px rgba(0,0,0,0.1)",
      marginTop: isMobile ? "0" : "2rem",
      marginBottom: isMobile ? "0" : "2rem"
    }}>
      <div style={{
        marginBottom: "2rem",
        paddingBottom: "1rem",
        borderBottom: "2px solid #2e7d32"
      }}>
        <h1 style={{
          fontSize: isMobile ? "clamp(1.5rem, 6vw, 2.5rem)" : "2.5rem",
          color: "#2c2c2c",
          fontWeight: "800",
          fontFamily: '"Montserrat", sans-serif',
          letterSpacing: "-0.03em",
          marginBottom: "0.5rem"
        }}>
          Contact Us
        </h1>
        <p style={{
          color: "#666",
          fontSize: isMobile ? "0.9rem" : "1rem"
        }}>
          Get in touch with Farm2Market Uganda support team
        </p>
      </div>

      {submitted && (
        <div style={{
          padding: "1rem",
          background: "#e8f5e9",
          border: "1px solid #2e7d32",
          borderRadius: "8px",
          marginBottom: "2rem",
          color: "#2e7d32",
          fontWeight: "600"
        }}>
          ✓ Your email client should open. If not, please email us directly at kattaleglobal@gmail.com
        </div>
      )}

      {error && (
        <div style={{
          padding: "1rem",
          background: "#ffebee",
          border: "1px solid #c62828",
          borderRadius: "8px",
          marginBottom: "2rem",
          color: "#c62828",
          fontWeight: "600"
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: "2rem",
        marginBottom: "2rem"
      }}>
        <div>
          <h2 style={{
            fontSize: isMobile ? "1.2rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Get in Touch
          </h2>
          <p style={{
            marginBottom: "1.5rem",
            lineHeight: "1.8",
            color: "#333"
          }}>
            Have a question, suggestion, or need support? We&apos;re here to help! Fill out the form or contact us directly.
          </p>

          <div style={{
            padding: "1.5rem",
            background: "#f5f5f5",
            borderRadius: "8px",
            border: "1px solid #e0e0e0"
          }}>
            <h3 style={{
              fontSize: "1.1rem",
              fontWeight: "600",
              marginBottom: "1rem",
              color: "#2c2c2c"
            }}>
              Contact Information
            </h3>
            <p style={{ marginBottom: "0.75rem", color: "#333" }}>
              <strong>Email:</strong><br />
              <a 
                href="mailto:kattaleglobal@gmail.com" 
                style={{ 
                  color: "#2e7d32", 
                  textDecoration: "none",
                  wordBreak: "break-word"
                }}
              >
                kattaleglobal@gmail.com
              </a>
            </p>
            <p style={{ marginBottom: "0.75rem", color: "#333" }}>
              <strong>Website:</strong><br />
              <a 
                href="https://farm2market-dev.vercel.app" 
                style={{ 
                  color: "#2e7d32", 
                  textDecoration: "none"
                }}
              >
                https://farm2market-dev.vercel.app
              </a>
            </p>
            <p style={{ color: "#333" }}>
              <strong>Response Time:</strong><br />
              We typically respond within 24-48 hours
            </p>
          </div>
        </div>

        <div>
          <form onSubmit={handleSubmit} style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem"
          }}>
            <div>
              <label style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "600",
                color: "#2c2c2c",
                fontSize: isMobile ? "0.9rem" : "1rem"
              }}>
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
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
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
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
                Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder="e.g., Support Request, Feature Suggestion"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
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
                Message *
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                placeholder="Please describe your question or issue..."
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
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
                padding: "0.75rem 2rem",
                background: "#2e7d32",
                color: "white",
                border: "none",
                borderRadius: "8px",
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
      </div>

      <div style={{
        marginTop: "3rem",
        paddingTop: "2rem",
        borderTop: "1px solid #e0e0e0",
        textAlign: "center"
      }}>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "0.75rem 2rem",
            background: "#2e7d32",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: isMobile ? "0.9rem" : "1rem",
            transition: "background 0.3s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#1b5e20"}
          onMouseLeave={(e) => e.currentTarget.style.background = "#2e7d32"}
        >
          Back to Home
        </a>
      </div>
    </main>
  );
}
