import { formatNumber } from "../calculator/format";
import type { Status } from "../calculator/types";

const LARGE_MAX_LENGTH = 10;
const MEDIUM_MAX_LENGTH = 14;

type DisplayProps = {
  status: Status;
  expression: string;
  entry: string;
  showProgress: boolean;
};

function resultClass(result: string): string {
  if (result.length > MEDIUM_MAX_LENGTH) {
    return "display__result display__result--sm";
  }
  if (result.length > LARGE_MAX_LENGTH) {
    return "display__result display__result--md";
  }
  return "display__result";
}

export function Display({ status, expression, entry, showProgress }: DisplayProps) {
  const result = formatNumber(entry);
  return (
    <div className={`display display--${status}`} aria-busy={status === "loading" || undefined}>
      <div className="display__expression" aria-label="Expression">
        {expression}
      </div>
      <output className={resultClass(result)} aria-live="polite">
        {result}
      </output>
      {showProgress && <span className="display__progress" aria-hidden="true" />}
    </div>
  );
}
