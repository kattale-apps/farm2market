import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { QrLandingPage } from "./QrLandingPage";

/**
 * Public QR resolution route — no auth, no admin bundle.
 * Server Component so a plain redirect-type QR gets a fast server-side
 * redirect with minimal client JS (only landing-page QRs ship client code).
 */
export default async function QrResolvePage({ params }: { params: { code: string } }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return <NotFoundState message="QR service is temporarily unavailable." />;
  }

  const client = new ConvexHttpClient(convexUrl);
  const headerList = headers();
  const referrer = headerList.get("referer") ?? undefined;
  const userAgent = headerList.get("user-agent") ?? "";
  const { deviceCategory, browser, os } = classifyUserAgent(userAgent);

  const result = await client.mutation(api.qrPublic.resolveAndTrackScan, {
    code: params.code,
    referrer,
    deviceCategory,
    browser,
    os,
  });

  if (result.status === "not_found") {
    return <NotFoundState message="This QR code doesn't exist or is no longer valid." />;
  }
  if (result.status === "inactive") {
    return <NotFoundState message="This QR code is no longer active." />;
  }

  if (!result.landingEnabled) {
    redirect(result.destinationUrl);
  }

  return <QrLandingPage code={params.code} data={result} />;
}

function classifyUserAgent(userAgent: string): { deviceCategory: string; browser: string; os: string } {
  const ua = userAgent.toLowerCase();

  let deviceCategory = "desktop";
  if (/mobile|iphone|android.*mobile/.test(ua)) deviceCategory = "mobile";
  else if (/ipad|tablet|android(?!.*mobile)/.test(ua)) deviceCategory = "tablet";

  let browser = "other";
  if (ua.includes("edg/")) browser = "edge";
  else if (ua.includes("chrome/")) browser = "chrome";
  else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "safari";
  else if (ua.includes("firefox/")) browser = "firefox";

  let os = "other";
  if (ua.includes("android")) os = "android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "ios";
  else if (ua.includes("windows")) os = "windows";
  else if (ua.includes("mac os")) os = "macos";
  else if (ua.includes("linux")) os = "linux";

  return { deviceCategory, browser, os };
}

function NotFoundState({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        flexDirection: "column",
        background: "#f5f5f5",
        padding: "1rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
      <p style={{ color: "#555", fontSize: "1rem", maxWidth: 320 }}>{message}</p>
    </div>
  );
}
