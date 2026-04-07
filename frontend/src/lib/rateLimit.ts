/**
 * Simple time-based rate limiter for preventing overly frequent actions
 */
export class RateLimiter {
  private lastExecutionTime: number = 0;
  private readonly minIntervalMs: number;

  constructor(minIntervalMs: number) {
    this.minIntervalMs = minIntervalMs;
  }

  /**
   * Check if enough time has passed since the last execution
   */
  canExecute(): boolean {
    const now = Date.now();
    const timeSinceLastExecution = now - this.lastExecutionTime;
    return timeSinceLastExecution >= this.minIntervalMs;
  }

  /**
   * Mark the current time as the last execution time
   */
  markExecuted(): void {
    this.lastExecutionTime = Date.now();
  }

  /**
   * Execute the action if rate limit allows, otherwise skip
   * Returns true if executed, false if rate-limited
   */
  tryExecute(action: () => void): boolean {
    if (this.canExecute()) {
      this.markExecuted();
      action();
      return true;
    }
    return false;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.lastExecutionTime = 0;
  }
}
