import { createRoot } from "react-dom/client";
import { TranslationProvider } from "../../i18n";
import { QuestUiProbe } from "./QuestUiProbe";
import "../../styles/app.scss";
import "./probe.scss";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the Quest UI probe mount element");
}

document.documentElement.classList.add("nh3d-quest-ui-probe");
createRoot(rootElement).render(
  <TranslationProvider>
    <QuestUiProbe />
  </TranslationProvider>,
);
