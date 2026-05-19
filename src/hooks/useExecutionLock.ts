import { useEffect, useState } from "react";
import {
  EXEC_LOCK_EVENT,
  isExecutionLocked,
  getExecutionLockReason,
  getCooldownRemainingMs,
} from "@/lib/tradingLayerControl";

/**
 * Subscribes a component to the global execution lock.
 * Returns whether the lock is engaged, the reason, and the rate-limit
 * cooldown countdown (seconds).
 */
export function useExecutionLock() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener(EXEC_LOCK_EVENT, onChange);
    window.addEventListener("mt:rate-limited", onChange);
    const id = window.setInterval(onChange, 500);
    return () => {
      window.removeEventListener(EXEC_LOCK_EVENT, onChange);
      window.removeEventListener("mt:rate-limited", onChange);
      window.clearInterval(id);
    };
  }, []);
  const cooldownMs = getCooldownRemainingMs();
  return {
    locked: isExecutionLocked(),
    reason: getExecutionLockReason(),
    cooldownMs,
    cooldownSec: Math.ceil(cooldownMs / 1000),
    rateLimited: cooldownMs > 0,
  };
}
