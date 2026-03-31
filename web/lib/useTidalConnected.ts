"use client";

import { useState, useEffect } from "react";
import { getStoredToken, clearToken } from "./tidal-auth";

export function useTidalConnected(): [boolean, () => void] {
  const [connected, setConnected] = useState(() => {
    if (typeof window === "undefined") return false;
    return getStoredToken() !== null;
  });

  useEffect(() => {
    function checkToken() {
      setConnected(getStoredToken() !== null);
    }
    window.addEventListener("focus", checkToken);
    checkToken();
    return () => window.removeEventListener("focus", checkToken);
  }, []);

  function disconnect() {
    clearToken();
    setConnected(false);
  }

  return [connected, disconnect];
}
