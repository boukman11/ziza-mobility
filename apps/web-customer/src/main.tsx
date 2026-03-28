import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./ui/App";
import "./styles.css";
import { initKeycloak } from "./keycloak";
import { ToastProvider } from "@shared/ui/Toast";

async function bootstrap() {
  await initKeycloak();
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </React.StrictMode>
  );
}

bootstrap();
