import { fileListings, files } from "../content/index";

const FILE_MAP: Record<string, string> = { ...files };

export function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

export function readFakeFile(path: string): string | null {
  const normalized = normalizePath(path);
  return FILE_MAP[normalized] ?? null;
}

export function listFakeDir(path: string): string | null {
  const normalized = normalizePath(path);
  return fileListings[normalized] ?? null;
}

export function knownPaths(): string[] {
  return Object.keys(FILE_MAP);
}

export const FAKE_FS_PATHS = Object.keys(FILE_MAP);
