import { useState } from 'react';

interface UseCopyToClipboard {
  copied: boolean;
  copy: (text: string) => Promise<void>;
}

export function useCopyToClipboard(resetMs = 2000): UseCopyToClipboard {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string): Promise<void> => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), resetMs);
  };

  return { copied, copy };
}
