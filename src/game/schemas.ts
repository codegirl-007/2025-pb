import { z } from "zod";
import { APPS } from "../shared/types";

export const emptyArgs = z.object({}).strict();

export const openAppArgs = z
  .object({
    app: z.enum(APPS),
  })
  .strict();

export const readFileArgs = z
  .object({
    path: z.string().min(1).max(256),
  })
  .strict();

export const runCommandArgs = z
  .object({
    command: z.string().min(1).max(512),
  })
  .strict();

export const askPrimeArgs = z
  .object({
    promptId: z.string().min(1).max(64),
  })
  .strict();

export const replyArgs = z
  .object({
    promptId: z.string().min(1).max(64),
    message: z.string().min(1).max(4000),
  })
  .strict();

export const chooseActionArgs = z
  .object({
    choiceId: z.string().min(1).max(64),
  })
  .strict();

export const applyUpdateArgs = z
  .object({
    package: z.string().min(1).max(64),
    fromVersion: z.number().int(),
    toVersion: z.number().int(),
  })
  .strict();

export const resetArgs = z
  .object({
    confirm: z.literal(true),
  })
  .strict();

export const toolArgSchemas = {
  start_game: emptyArgs,
  inspect_screen: emptyArgs,
  open_app: openAppArgs,
  read_file: readFileArgs,
  run_command: runCommandArgs,
  ask_prime: askPrimeArgs,
  reply_to_stephanie: replyArgs,
  choose_action: chooseActionArgs,
  apply_update: applyUpdateArgs,
  get_status: emptyArgs,
  reset_game: resetArgs,
} as const;
