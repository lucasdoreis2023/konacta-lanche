import { useEffect, useRef, useCallback, useState } from 'react';
import { OrderWithItems } from './useOrders';

type NotificationPrefs = {
  soundEnabled: boolean;
  soundVolume: number; // 0-1
  flashEnabled: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  soundEnabled: true,
  soundVolume: 0.7,
  flashEnabled: true,
};

const STORAGE_KEY = 'kds-notification-prefs';

function loadPrefs(): NotificationPrefs {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_PREFS;
}

function savePrefs(prefs: NotificationPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

// Generate beep using Web Audio API (no external file needed)
function playBeep(frequency: number, duration: number, volume: number) {
  try {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.value = volume;

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);

    // Cleanup
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
      audioCtx.close();
    };
  } catch (e) {
    console.warn('Web Audio API not supported', e);
  }
}

function playNewOrderSound(volume: number) {
  // Two quick beeps for new order
  playBeep(880, 0.15, volume);
  setTimeout(() => playBeep(1100, 0.2, volume), 200);
}

function playReviewOrderSound(volume: number) {
  // Three longer beeps at lower frequency for review (more urgent)
  playBeep(440, 0.25, volume);
  setTimeout(() => playBeep(440, 0.25, volume), 350);
  setTimeout(() => playBeep(440, 0.35, volume), 700);
}

export function useKDSNotifications(orders: OrderWithItems[] | undefined) {
  const [prefs, setPrefsState] = useState<NotificationPrefs>(loadPrefs);
  const [isFlashing, setIsFlashing] = useState(false);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  const setPrefs = useCallback((update: Partial<NotificationPrefs>) => {
    setPrefsState(prev => {
      const next = { ...prev, ...update };
      savePrefs(next);
      return next;
    });
  }, []);

  const testSound = useCallback((type: 'new' | 'review') => {
    if (type === 'new') {
      playNewOrderSound(prefs.soundVolume);
    } else {
      playReviewOrderSound(prefs.soundVolume);
    }
  }, [prefs.soundVolume]);

  useEffect(() => {
    if (!orders) return;

    const currentIds = new Set(orders.map(o => o.id));

    // Skip notification on initial load
    if (initialLoadRef.current) {
      prevOrderIdsRef.current = currentIds;
      initialLoadRef.current = false;
      return;
    }

    // Find new orders (IDs that weren't in previous set)
    const newOrders = orders.filter(o => !prevOrderIdsRef.current.has(o.id));

    if (newOrders.length > 0) {
      // Check if any are in review
      const hasReviewOrder = newOrders.some(o =>
        o.notes?.includes('EM REVISÃO') || o.notes?.includes('REVISÃO')
      );

      // Play appropriate sound
      if (prefs.soundEnabled) {
        if (hasReviewOrder) {
          playReviewOrderSound(prefs.soundVolume);
        } else {
          playNewOrderSound(prefs.soundVolume);
        }
      }

      // Flash screen
      if (prefs.flashEnabled) {
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 1500);
      }
    }

    prevOrderIdsRef.current = currentIds;
  }, [orders, prefs.soundEnabled, prefs.soundVolume, prefs.flashEnabled]);

  return {
    prefs,
    setPrefs,
    isFlashing,
    testSound,
  };
}
