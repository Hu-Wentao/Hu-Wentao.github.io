import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { Logger } from "./types.js";

function timestamp(): string {
  return new Date().toISOString();
}

export class FileLogger implements Logger {
  constructor(private readonly logFile: string) {
    mkdirSync(dirname(logFile), { recursive: true });
  }

  info(message: string): void {
    this.write("INFO", message);
  }

  warn(message: string): void {
    this.write("WARN", message);
  }

  error(message: string): void {
    this.write("ERROR", message);
  }

  private write(level: string, message: string): void {
    const line = `[${timestamp()}] ${level} ${message}`;
    console.log(line);
    appendFileSync(this.logFile, `${line}\n`, "utf8");
  }
}
