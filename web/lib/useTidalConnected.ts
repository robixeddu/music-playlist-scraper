"use client";

import { useState, useEffect } from "react";
import { getStoredToken, clearToken } from "./tidal-auth";

const subscribers = new Set<(v: boolean) => void>();

function broadcast(v: boolean) {
  subscribers.forEach((fn) => fn(v));
}

export function useTidalConnected(): [boolean, () => void] {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    subscribers.add(setConnected);
    function checkToken() {
      broadcast(getStoredToken() !== null);
    }
    window.addEventListener("focus", checkToken);
    checkToken();
    return () => {
      subscribers.delete(setConnected);
      window.removeEventListener("focus", checkToken);
    };
  }, []);

  function disconnect() {
    clearToken();
    broadcast(false);
  }

  return [connected, disconnect];
}
