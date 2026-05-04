"use client";

import { useEffect, useState } from "react";
import { getStoredUser, type StoredUser } from "../utils/authStorage";

type AuthStatus = "loading" | "ready" | "unauthenticated";

const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000;

export function useStoredUser() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let active = true;

    const timeout = new Promise<StoredUser | null>((resolve) => {
      setTimeout(() => resolve(null), AUTH_BOOTSTRAP_TIMEOUT_MS);
    });

    Promise.race([getStoredUser(), timeout])
      .then((stored) => {
        if (!active) return;
        if (stored?.userId) {
          setUser(stored);
          setStatus("ready");
        } else {
          setUser(null);
          setStatus("unauthenticated");
        }
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus("unauthenticated");
      });

    return () => {
      active = false;
    };
  }, []);

  return { user, status };
}
