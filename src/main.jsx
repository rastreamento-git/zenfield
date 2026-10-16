import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@zenfield/ui/styles/base.css";
import "@zenfield/ui/styles/theme.css";
import "@zenfield/ui/styles/portal.css";
import AuthGate from "@zenfield/ui/components/AuthGate";
import Feedback from "@zenfield/ui/components/Feedback";
import TechnicianPortal from "./Portal";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthGate audience="technician">
      <TechnicianPortal />
    </AuthGate>
    <Feedback />
  </StrictMode>,
);
