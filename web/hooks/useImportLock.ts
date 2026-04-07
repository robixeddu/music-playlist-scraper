"use client";

import { createContext, useContext, useState } from "react";

interface ImportLockContext {
  importing: boolean;
  acquire: () => void;
  release: () => void;
}

export const ImportLockContext = createContext<ImportLockContext>({
  importing: false,
  acquire: () => {},
  release: () => {},
});

export function useImportLock() {
  return useContext(ImportLockContext);
}

export function useImportLockState(): ImportLockContext {
  const [importing, setImporting] = useState(false);
  return {
    importing,
    acquire: () => setImporting(true),
    release: () => setImporting(false),
  };
}
