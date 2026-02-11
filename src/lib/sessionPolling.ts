let intervalId: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

export function startSessionPolling(options: {
  intervalMs?: number;
  isLoggedIn: () => boolean;
  poll: () => Promise<void>;
}) {
  if (intervalId) return;

  const intervalMs = options.intervalMs ?? 5000;

  intervalId = setInterval(async () => {
    if (!options.isLoggedIn()) {
      stopSessionPolling();
      return;
    }

    if (inFlight) return;
    inFlight = true;
    try {
      await options.poll();
    } finally {
      inFlight = false;
    }
  }, intervalMs);
}

export function stopSessionPolling() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  inFlight = false;
}

