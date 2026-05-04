import "./logging";
import { createRoot } from "react-dom/client";

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", () => {
    window.location.reload();
  });
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find #root mount element");
}
const rootContainer = rootElement;

const url = new URL(window.location.href);
const isTilesetBatchPicker =
  url.searchParams.get("tool") === "tileset-batch-picker" ||
  url.pathname.replace(/\/+$/, "").endsWith("/tileset-batch-picker");

async function bootstrap(): Promise<void> {
  if (isTilesetBatchPicker) {
    document.title = "Tileset Batch Picker";
    document.documentElement.classList.add("tileset-batch-picker-page");
    document.body.classList.add("tileset-batch-picker-page");
    rootContainer.classList.add("tileset-batch-picker-page");
    const { default: TilesetBatchPicker } = await import(
      "./ui/TilesetBatchPicker"
    );
    createRoot(rootContainer).render(<TilesetBatchPicker />);
    return;
  }

  const [{ TranslationProvider }, { default: App }] = await Promise.all([
    import("./i18n"),
    import("./ui/App"),
    import("./styles/app.scss"),
  ]);

  createRoot(rootContainer).render(
    <TranslationProvider>
      <App />
    </TranslationProvider>,
  );
}

void bootstrap();
