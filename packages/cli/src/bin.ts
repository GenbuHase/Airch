#!/usr/bin/env node
import { createProgram, handleCliError } from "./cli.js";

const program = createProgram();

program.parseAsync(process.argv).catch((err) => {
  handleCliError(err);
});
