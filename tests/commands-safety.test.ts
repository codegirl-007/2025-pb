import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { runFakeCommand } from "../src/game/commands";
import { readFakeFile } from "../src/game/filesystem";
import { files } from "../src/content/index";

describe("fake shell", () => {
  it("never reaches a real process API", () => {
    const spawnSpy = vi.spyOn({ spawn }, "spawn");
    const result = runFakeCommand("birthdayctl doctor");
    expect(result.output).toContain("major version drift");
    expect(runFakeCommand("rm -rf /").output).toContain("not a real machine");
    expect(readFakeFile("/etc/passwd")).toBeNull();
    expect(readFakeFile("/var/log/birthday-migration.log")).toBe(files["/var/log/birthday-migration.log"]);
    expect(spawnSpy).not.toHaveBeenCalled();
    spawnSpy.mockRestore();

    const commandSrc = readFileSync(new URL("../src/game/commands.ts", import.meta.url), "utf8");
    const fsSrc = readFileSync(new URL("../src/game/filesystem.ts", import.meta.url), "utf8");
    expect(commandSrc).not.toMatch(/child_process|node:fs|exec\(|spawn\(/);
    expect(fsSrc).not.toMatch(/node:fs|readFileSync|createReadStream/);
  });
});
