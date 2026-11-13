import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GridironLegends from "./game";

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><GridironLegends /></StrictMode>);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js").then((reg) => {
      void reg.update();
      window.setInterval(() => { void reg.update(); }, 60 * 60 * 1000);
    }).catch(() => undefined);
  });
}
