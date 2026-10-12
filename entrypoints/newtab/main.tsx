import React from "react";
import { createRoot } from "react-dom/client";
import App from "../../src/App";
import { ErrorBoundary } from "../../src/components/ErrorBoundary";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App surface="newtab" />
    </ErrorBoundary>
  </React.StrictMode>,
);
