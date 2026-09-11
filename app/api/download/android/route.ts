/**
 * Same-origin Android APK download.
 *
 * The APK is published as a GitHub Release asset (interim distribution
 * pending Google Play Store publication). Linking straight to the GitHub
 * URL sends the user's browser to github.com, which reads as "leaving the
 * app" and produces a generic downloaded filename. This route streams the
 * asset bytes through our own domain instead, so the download starts from
 * farm2marketuganda.com with a proper filename and content type.
 *
 * Update APK_DOWNLOAD_URL whenever a new APK is published to Releases.
 */
import { NextResponse } from "next/server";

const APK_DOWNLOAD_URL =
  "https://github.com/kattale-apps/farm2market/releases/download/android-v20260908/app-defaultCommunity-productionFlavors-release.apk";

export async function GET() {
  const upstream = await fetch(APK_DOWNLOAD_URL, { redirect: "follow" });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "APK is temporarily unavailable. Please try again shortly." },
      { status: 502 }
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": 'attachment; filename="Farm2Market.apk"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
