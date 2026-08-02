import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LocalStudioDataSource } from "../shared/index.js";
import { StudioApp } from "./StudioApp.js";
import "./styles.css";
import "@xyflow/react/dist/style.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><StudioApp dataSource={new LocalStudioDataSource()} /></StrictMode>,
);
