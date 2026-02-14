import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("[v0] Initializing app...");
const rootElement = document.getElementById("root");
console.log("[v0] Root element:", rootElement);

if (!rootElement) {
  console.error("[v0] Root element not found!");
} else {
  createRoot(rootElement).render(<App />);
  console.log("[v0] App rendered");
}
