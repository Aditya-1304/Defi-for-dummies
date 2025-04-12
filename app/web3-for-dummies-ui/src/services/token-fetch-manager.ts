/**
 * This class helps detect and block automatic token fetching
 * to improve app startup performance.
 */
class TokenFetchManager {
  private _isAutomaticFetchingBlocked = true;
  private _isInitialized = false;
  private _lastUserAction = 0;
  private _initialized = false;
  private _blockUntilInteraction = true;

  constructor() {
    if (typeof window !== 'undefined') {
      // Block initial fetching aggressively
      this._isAutomaticFetchingBlocked = true;

      // After 3 seconds, allow automatic fetching
      setTimeout(() => {
        console.log("⏱️ Unblocking automatic token fetching");
        this._isAutomaticFetchingBlocked = false;
        this._initialized = true;
      }, 3000);

      // Track user interactions to better detect user-initiated requests
      ['click', 'keydown', 'touchstart'].forEach(event => {
        window.addEventListener(event, () => {
          this._lastUserAction = Date.now();
          this._blockUntilInteraction = false;
        });
      });

      // Mark as initialized when document is complete
      if (document.readyState === 'complete') {
        this._isInitialized = true;
      } else {
        window.addEventListener('load', () => {
          this._isInitialized = true;
        });
      }
    }
  }

  /**
   * Determines if a token fetch request should be blocked
   */
  shouldBlockTokenFetch(forceRefresh = false): boolean {
    // Always allow explicit refreshes
    if (forceRefresh) return false;

    // Block until initialization is complete
    if (!this._initialized || this._isAutomaticFetchingBlocked) {
      return true;
    }

    // Block until first user interaction has occurred
    if (this._blockUntilInteraction) {
      return true;
    }

    // If there's been user activity in the last second, likely user-initiated
    const isRecentUserAction = (Date.now() - this._lastUserAction) < 1000;
    return !isRecentUserAction;
  }

  /**
   * Check if the initialization period is still active
   */
  get isInitializing(): boolean {
    return !this._initialized;
  }
  
  /**
   * Force unblock token fetching (for use in explicit user actions)
   */
  unblockFetching(): void {
    this._isAutomaticFetchingBlocked = false;
    this._blockUntilInteraction = false;
    this._initialized = true;
  }
}

// Export as a singleton
export const tokenFetchManager = new TokenFetchManager();