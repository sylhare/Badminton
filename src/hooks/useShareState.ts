import { useEffect, useState } from 'react';

import { storageManager } from '../utils/StorageManager';

function buildStateUrl(raw: string): string {
  const u = new URL(window.location.href);
  u.searchParams.set('state', raw);
  return u.toString();
}

function removeStateParam(): string {
  const u = new URL(window.location.href);
  u.searchParams.delete('state');
  return u.toString();
}

export function useShareState() {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [importState, setImportState] = useState<{ param: string; backupUrl: string; sharedSavedAt?: number; currentSavedAt?: number } | null>(null);

  useEffect(() => {
    const detectImportState = async () => {
      const stateParam = new URLSearchParams(window.location.search).get('state');
      if (!stateParam) return;
      const valid = await storageManager.isValidState(stateParam);
      if (valid) {
        const currentRaw = storageManager.getRawState();
        const backupUrl = currentRaw ? buildStateUrl(currentRaw) : '';
        const { sharedSavedAt, currentSavedAt } = await storageManager.getImportTimestamps(stateParam, currentRaw);
        setImportState({ param: stateParam, backupUrl, sharedSavedAt, currentSavedAt });
      } else {
        history.replaceState(null, '', removeStateParam());
      }
    };
    detectImportState();
  }, []);

  const handleShare = async () => {
    await storageManager.waitForQueue();
    const rawState = storageManager.getRawState();
    if (!rawState) return;
    setShareUrl(buildStateUrl(rawState));
  };

  const handleImportAccept = () => {
    if (!importState) return;
    storageManager.importRawState(importState.param);
    window.location.href = removeStateParam();
  };

  const handleImportDecline = () => {
    history.replaceState(null, '', removeStateParam());
    setImportState(null);
  };

  return { shareUrl, setShareUrl, importState, handleShare, handleImportAccept, handleImportDecline };
}
