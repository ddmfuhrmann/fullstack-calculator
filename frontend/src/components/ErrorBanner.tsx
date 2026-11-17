import type { CalculatorError } from "../calculator/types";

type ErrorBannerProps = {
  error: CalculatorError | null;
  onRetry: () => void;
};

/** The slot keeps its height when empty, so the keypad never moves. */
export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  return (
    <div className="banner-slot">
      {error && (
        <div className={`banner banner--${error.kind}`} role="alert">
          <svg className="banner__icon" viewBox="0 0 16 16" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v5h-1.5v-5Zm.75 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
            />
          </svg>
          <span className="banner__message">{error.message}</span>
          {error.retryable && (
            <button type="button" className="banner__action" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
