import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@zenfield/ui/styles/base.css";
import "@zenfield/ui/styles/theme.css";
import "@zenfield/ui/styles/portal.css";
import AuthGate from "@zenfield/ui/components/AuthGate";
import Feedback from "@zenfield/ui/components/Feedback";
import FieldEntry from "./FieldEntry";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthGate audience="technician">
      <FieldEntry />
    </AuthGate>
    <Feedback />
  </StrictMode>,
);
