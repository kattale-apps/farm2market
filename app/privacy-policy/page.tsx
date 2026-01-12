"use client";

import { useEffect, useState } from "react";

/**
 * Privacy Policy Page
 * 
 * Hosted on Vercel for Google Play Store compliance
 */

export default function PrivacyPolicyPage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <main style={{
      padding: isMobile ? "1rem" : "clamp(2rem, 5vw, 4rem)",
      maxWidth: "900px",
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
          Privacy Policy
        </h1>
        <p style={{
          color: "#666",
          fontSize: isMobile ? "0.9rem" : "1rem"
        }}>
          Last Updated: January 12, 2026
        </p>
      </div>

      <div style={{
        lineHeight: "1.8",
        color: "#333",
        fontSize: isMobile ? "0.95rem" : "1rem"
      }}>
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Introduction
          </h2>
          <p style={{ marginBottom: "1rem" }}>
            Farm2Market Uganda ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Information We Collect
          </h2>
          
          <h3 style={{
            fontSize: isMobile ? "1.1rem" : "1.2rem",
            fontWeight: "600",
            marginTop: "1rem",
            marginBottom: "0.5rem",
            color: "#2c2c2c"
          }}>
            Personal Information
          </h3>
          <ul style={{ marginLeft: "1.5rem", marginBottom: "1rem" }}>
            <li>Name and contact information</li>
            <li>Account credentials</li>
            <li>Business information (for traders)</li>
            <li>Payment information (processed securely through Pesapal)</li>
          </ul>

          <h3 style={{
            fontSize: isMobile ? "1.1rem" : "1.2rem",
            fontWeight: "600",
            marginTop: "1rem",
            marginBottom: "0.5rem",
            color: "#2c2c2c"
          }}>
            Usage Information
          </h3>
          <ul style={{ marginLeft: "1.5rem", marginBottom: "1rem" }}>
            <li>Device information (device type, operating system)</li>
            <li>App usage data</li>
            <li>Transaction history</li>
            <li>Location data (for delivery purposes)</li>
          </ul>

          <h3 style={{
            fontSize: isMobile ? "1.1rem" : "1.2rem",
            fontWeight: "600",
            marginTop: "1rem",
            marginBottom: "0.5rem",
            color: "#2c2c2c"
          }}>
            Push Notification Data
          </h3>
          <ul style={{ marginLeft: "1.5rem", marginBottom: "1rem" }}>
            <li>Device tokens for push notifications</li>
            <li>Notification preferences</li>
          </ul>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            How We Use Your Information
          </h2>
          <p style={{ marginBottom: "1rem" }}>
            We use the information we collect to:
          </p>
          <ul style={{ marginLeft: "1.5rem" }}>
            <li>Provide and maintain our services</li>
            <li>Process transactions and payments</li>
            <li>Send push notifications about offers, transactions, and updates</li>
            <li>Improve our app and user experience</li>
            <li>Communicate with you about your account</li>
            <li>Ensure security and prevent fraud</li>
          </ul>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Data Storage and Security
          </h2>
          <ul style={{ marginLeft: "1.5rem" }}>
            <li>Your data is stored securely using Convex cloud infrastructure</li>
            <li>We use Firebase for push notifications and analytics</li>
            <li>Payment information is processed securely through Pesapal</li>
            <li>We implement industry-standard security measures</li>
          </ul>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Third-Party Services
          </h2>
          <p style={{ marginBottom: "1rem" }}>
            We use the following third-party services:
          </p>
          <ul style={{ marginLeft: "1.5rem" }}>
            <li><strong>Convex:</strong> Backend data storage and processing</li>
            <li><strong>Firebase:</strong> Push notifications and analytics</li>
            <li><strong>Pesapal:</strong> Payment processing</li>
            <li><strong>Vercel:</strong> Application hosting</li>
          </ul>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Data Sharing
          </h2>
          <p style={{ marginBottom: "1rem" }}>
            We do not sell your personal information. We may share your information only:
          </p>
          <ul style={{ marginLeft: "1.5rem" }}>
            <li>With service providers who assist us in operating our app</li>
            <li>When required by law or to protect our rights</li>
            <li>With your explicit consent</li>
          </ul>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Your Rights
          </h2>
          <p style={{ marginBottom: "1rem" }}>
            You have the right to:
          </p>
          <ul style={{ marginLeft: "1.5rem" }}>
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of push notifications</li>
            <li>Withdraw consent for data processing</li>
          </ul>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Data Retention
          </h2>
          <p>
            We retain your data for as long as necessary to provide our services and comply with legal obligations.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Children's Privacy
          </h2>
          <p>
            Our app is not intended for users under 18 years of age. We do not knowingly collect information from children.
          </p>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date and posting the new Privacy Policy in the app.
          </p>
        </section>

        <section style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          background: "#f5f5f5",
          borderRadius: "8px",
          border: "1px solid #e0e0e0"
        }}>
          <h2 style={{
            fontSize: isMobile ? "1.3rem" : "1.5rem",
            color: "#2e7d32",
            fontWeight: "700",
            marginBottom: "1rem",
            fontFamily: '"Montserrat", sans-serif'
          }}>
            Contact Us
          </h2>
          <p style={{ marginBottom: "1rem" }}>
            If you have questions about this Privacy Policy, please contact us at:
          </p>
          <p style={{ marginBottom: "0.5rem" }}>
            <strong>Email:</strong> <a href="mailto:kattaleglobal@gmail.com" style={{ color: "#2e7d32", textDecoration: "none" }}>kattaleglobal@gmail.com</a>
          </p>
          <p>
            <strong>Website:</strong> <a href="https://farm2market-dev.vercel.app" style={{ color: "#2e7d32", textDecoration: "none" }}>https://farm2market-dev.vercel.app</a>
          </p>
        </section>

        <section style={{
          padding: "1rem",
          background: "#e8f5e9",
          borderRadius: "8px",
          border: "1px solid #2e7d32"
        }}>
          <p style={{ margin: 0, fontWeight: "600", color: "#2e7d32" }}>
            By using Farm2Market Uganda, you consent to this Privacy Policy.
          </p>
        </section>
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
