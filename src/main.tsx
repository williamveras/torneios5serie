import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { loadSiteConfig } from "./lib/siteConfig";

loadSiteConfig().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
