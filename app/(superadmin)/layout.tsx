import { Suspense, ReactNode } from "react";

export default function SuperadminLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="p-8">Loading...</div>}>{children}</Suspense>;
}
