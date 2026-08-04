#!/usr/bin/env node

import { createRequire } from "node:module";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { authCommand } from "./commands/auth.js";
import { configCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import { inspectCommand } from "./commands/inspect-prose.js";
import { studioCommand } from "./commands/studio.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("novelgraph")
  .description("NovelGraph — local fiction production through an inspectable story graph")
  .version(version);

program.addCommand(initCommand);
program.addCommand(authCommand);
program.addCommand(configCommand);
program.addCommand(doctorCommand);
program.addCommand(inspectCommand);
program.addCommand(studioCommand);

program.parse();
