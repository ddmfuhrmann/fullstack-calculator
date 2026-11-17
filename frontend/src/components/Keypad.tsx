import type { Action, BinaryOperator } from "../calculator/types";
import { Key } from "./Key";
import { KEYS } from "./keys";

type KeypadProps = {
  selectedOperator: BinaryOperator | null;
  disabled: boolean;
  onPress: (action: Action) => void;
};

export function Keypad({ selectedOperator, disabled, onPress }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label="Keypad">
      {KEYS.map((definition) => (
        <Key
          key={definition.name}
          definition={definition}
          pressed={definition.action.type === "operator" ? definition.action.operator === selectedOperator : undefined}
          disabled={disabled}
          onPress={onPress}
        />
      ))}
    </div>
  );
}
