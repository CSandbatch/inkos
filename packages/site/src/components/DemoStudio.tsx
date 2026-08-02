import { FixtureStudioDataSource } from "../../../studio/src/shared/index";
import { StudioApp } from "../../../studio/src/client/StudioApp";
import "../../../studio/src/client/styles.css";
import "@xyflow/react/dist/style.css";

export default function DemoStudio() { return <StudioApp dataSource={new FixtureStudioDataSource()} embedded />; }
