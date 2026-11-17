import type { Action } from "../calculator/types";
import type { KeyDefinition } from "./keys";

type KeyProps = {
  definition: KeyDefinition;
  /** Selected state; only binary operators have one. */
  pressed?: boolean;
  disabled: boolean;
  onPress: (action: Action) => void;
};

export function Key({ definition, pressed, disabled, onPress }: KeyProps) {
  const classes = ["key", `key--${definition.variant}`];
  if (definition.wide) {
    classes.push("key--wide");
  }
  return (
    <button
      type="button"
      className={classes.join(" ")}
      aria-label={definition.name}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) {
          onPress(definition.action);
        }
      }}
    >
      {definition.label}
    </button>
  );
}
