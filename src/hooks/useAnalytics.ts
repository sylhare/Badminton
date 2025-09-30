import { useCallback } from 'react';

// Declare gtag function for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

export const useAnalytics = () => {
  const trackEvent = useCallback((eventData: AnalyticsEvent) => {
    // Check if gtag is available (it might not be in development or if blocked)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventData.action, {
        event_category: eventData.category,
        event_label: eventData.label,
        value: eventData.value,
      });
    }
  }, []);

  // Player-related events
  const trackPlayerAction = useCallback((action: string, details?: { method?: string; count?: number }) => {
    trackEvent({
      action,
      category: 'Player Management',
      label: details?.method,
      value: details?.count,
    });
  }, [trackEvent]);

  // Court-related events
  const trackCourtAction = useCallback((action: string, details?: { courtCount?: number }) => {
    trackEvent({
      action,
      category: 'Court Management',
      label: details?.courtCount ? `${details.courtCount} courts` : undefined,
      value: details?.courtCount,
    });
  }, [trackEvent]);

  // Game-related events
  const trackGameAction = useCallback((action: string, details?: { gameType?: string; courtNumber?: number }) => {
    trackEvent({
      action,
      category: 'Game Management',
      label: details?.gameType || details?.courtNumber ? `Court ${details.courtNumber}` : undefined,
      value: details?.courtNumber,
    });
  }, [trackEvent]);

  // UI/Navigation events
  const trackUIAction = useCallback((action: string, details?: { section?: string }) => {
    trackEvent({
      action,
      category: 'User Interface',
      label: details?.section,
    });
  }, [trackEvent]);

  return {
    trackEvent,
    trackPlayerAction,
    trackCourtAction,
    trackGameAction,
    trackUIAction,
  };
};
