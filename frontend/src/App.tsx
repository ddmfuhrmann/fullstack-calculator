import { useEffect, useReducer, useState } from "react";
import { calculate, type CalculationOutcome } from "./api/client";
import { initialState, reducer } from "./calculator/reducer";
import type { Action } from "./calculator/types";
import { Display } from "./components/Display";
import { ErrorBanner } from "./components/ErrorBanner";
import { Keypad } from "./components/Keypad";
import "./components/calculator.css";

/** Mirrors --loading-delay: fast responses never show the progress bar. */
const LOADING_DELAY_MS = 150;

function outcomeAction(outcome: CalculationOutcome): Action {
  switch (outcome.kind) {
    case "ok":
      return { type: "resolved", result: outcome.result };
    case "apiError":
      return { type: "apiError", code: outcome.code };
    case "networkError":
      return { type: "networkError" };
  }
}

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showProgress, setShowProgress] = useState(false);
  const loading = state.status === "loading";
  const { request } = state;

  useEffect(() => {
    if (!loading || request === null) {
      return;
    }
    let active = true;
    void calculate(request).then((outcome) => {
      if (active) {
        dispatch(outcomeAction(outcome));
      }
    });
    return () => {
      active = false;
    };
  }, [loading, request]);

  useEffect(() => {
    if (!loading) {
      return;
    }
    const timer = setTimeout(() => setShowProgress(true), LOADING_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setShowProgress(false);
    };
  }, [loading]);

  return (
    <section className="calculator" aria-label="Calculator">
      <Display status={state.status} expression={state.expression} entry={state.entry} showProgress={showProgress} />
      <ErrorBanner error={state.error} onRetry={() => dispatch({ type: "retry" })} />
      <Keypad selectedOperator={state.operator} disabled={loading} onPress={dispatch} />
    </section>
  );
}
