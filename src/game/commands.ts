import { commands, files, unknownCommand } from "../content/index";
import { listFakeDir, normalizePath, readFakeFile } from "./filesystem";

export interface FakeCommandResult {
  output: string;
  opensPath?: string;
  countsAs: string[];
}

function stripPrefix(command: string): string {
  return command
    .trim()
    .replace(/^sudo\s+/, "")
    .replace(/^\/usr\/bin\//, "")
    .replace(/\s+/g, " ");
}

export function runFakeCommand(command: string): FakeCommandResult {
  const raw = stripPrefix(command);
  const lower = raw.toLowerCase();

  if (lower === "birthdayctl status") {
    return { output: commands["birthdayctl status"], countsAs: ["ranStatus"] };
  }
  if (lower === "birthdayctl logs") {
    return { output: commands["birthdayctl logs"], countsAs: ["ranLogs", "readLog"] };
  }
  if (lower === "birthdayctl doctor") {
    return { output: commands["birthdayctl doctor"], countsAs: ["ranDoctor"] };
  }
  if (lower === "uname -a" || lower === "uname") {
    return { output: commands["uname -a"], countsAs: [] };
  }
  if (lower === "help" || lower === "--help") {
    return { output: commands.help, countsAs: [] };
  }
  if (lower === "pwd") {
    return { output: commands.pwd, countsAs: [] };
  }
  if (lower === "whoami") {
    return { output: commands.whoami, countsAs: [] };
  }

  const nvim = raw.match(/^nvim\s+(\S+)$/) ?? raw.match(/^vim\s+(\S+)$/) ?? raw.match(/^cat\s+(\S+)$/);
  if (nvim) {
    const path = normalizePath(nvim[1] ?? "");
    const content = readFakeFile(path);
    if (!content) {
      return {
        output: `birthdaysh: ${path}: No such file in the simulated filesystem`,
        countsAs: [],
      };
    }
    const countsAs = path === "/var/log/birthday-migration.log" ? ["readLog"] : path === "/home/prime/README.md" ? ["readReadme"] : [];
    return {
      output: content,
      opensPath: raw.startsWith("nvim") || raw.startsWith("vim") ? path : undefined,
      countsAs,
    };
  }

  const ls = raw.match(/^ls(?:\s+(\S+))?$/);
  if (ls) {
    const path = normalizePath(ls[1] ?? "/home/prime");
    const listing = listFakeDir(path);
    if (listing) return { output: listing, countsAs: [] };
    if (readFakeFile(path)) return { output: path, countsAs: [] };
    return { output: `ls: cannot access '${path}': No such file or directory`, countsAs: [] };
  }

  if (raw === "birthdayctl") {
    return {
      output: "usage: birthdayctl <status|logs|doctor>",
      countsAs: [],
    };
  }

  if (Object.prototype.hasOwnProperty.call(files, raw)) {
    const content = readFakeFile(raw);
    if (content) return { output: content, countsAs: [] };
  }

  return { output: unknownCommand(raw), countsAs: [] };
}
