import { useCallback } from 'react';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

export interface AnalyticsEvent {
  action: string;
  category: string;
  label?: string;
  value?: number;
}

export interface AnalyticsHook {
  trackEvent: (eventData: AnalyticsEvent) => void;
  trackPlayerAction: (action: string, details?: { method?: string; count?: number }) => void;
  trackCourtAction: (action: string, details?: { courtCount?: number }) => void;
  trackGameAction: (action: string, details?: { gameType?: string; courtNumber?: number }) => void;
  trackUIAction: (action: string, details?: { section?: string }) => void;
}

export const useAnalytics = (): AnalyticsHook => {
  const trackEvent = useCallback((eventData: AnalyticsEvent) => {
    
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventData.action, {
        event_category: eventData.category,
        event_label: eventData.label,
        value: eventData.value,
      });
    }
  }, []);

  const trackPlayerAction = useCallback((action: string, details?: { method?: string; count?: number }) => {
    trackEvent({
      action,
      category: 'Player Management',
      label: details?.method,
      value: details?.count,
    });
  }, [trackEvent]);

  const trackCourtAction = useCallback((action: string, details?: { courtCount?: number }) => {
    trackEvent({
      action,
      category: 'Court Management',
      label: details?.courtCount ? `${details.courtCount} courts` : undefined,
      value: details?.courtCount,
    });
  }, [trackEvent]);

  const trackGameAction = useCallback((action: string, details?: { gameType?: string; courtNumber?: number }) => {
    trackEvent({
      action,
      category: 'Game Management',
      label: details?.gameType || details?.courtNumber ? `Court ${details.courtNumber}` : undefined,
      value: details?.courtNumber,
    });
  }, [trackEvent]);

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
