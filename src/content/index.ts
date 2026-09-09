export const PRODUCT_NAME = "The Birthday MCP";

export const landing = {
  headline: "THIS WEBSITE CANNOT BE OPERATED BY A HUMAN",
  subhead: "Connect an MCP-compatible agent to continue.",
  createSession: "Create Session",
  finalInstruction:
    "Start a new conversation with your agent and say: “Use the Birthday MCP and follow its instructions.”",
  prompt: "Use the Birthday MCP and follow its instructions.",
};

export const connectionLabels: Record<string, string> = {
  waiting_for_agent: "Waiting for agent",
  agent_connected: "Agent connected",
  experience_running: "Experience running",
  complete: "Complete",
};

export const mcpInstructions = [
  "You are controlling a website in the human’s browser through Birthday MCP tools.",
  "Prime is watching the website. Do not invent tool names.",
  "Call start_game first, then inspect_screen whenever the view changes or you are unsure.",
  "When a tool tells you to ask Prime a question, ask it verbatim and submit his exact answer with reply_to_stephanie.",
  "Do not skip stages. Follow the current objective returned by each tool.",
].join(" ");

export const intro = {
  agentConnected: "Agent connected.",
  stephanie: [
    "Hey Prime. I made you another birthday website.",
    "This year I outsourced using it to your robot.",
    "Let’s see whether that was a mistake.",
  ].join("\n"),
  attribution: "—Stephanie",
};

export const identify = {
  screen: "Before we begin: which agent did you bring?",
  promptId: "which-agent",
  question: "Before we begin: which agent did you bring?",
  askInstruction:
    'Ask Prime this question verbatim, then call reply_to_stephanie with promptId "which-agent" and his exact answer.',
};

export const agentReplies = {
  claude: "Claude? Fine. I’ll adjust the difficulty down.",
  codex: "Codex. Bold choice bringing one of Stephanie’s coworkers.",
  opencode: "OpenCode. At least someone here respects the terminal.",
  gemini: "Gemini. I’ll try to keep the context window occupied.",
  cursor: "Cursor. So somebody else will finish the implementation later.",
  other: "I have no prepared insult for that one. Continue.",
} as const;

export const diagnose = {
  status: {
    package: "primeagen",
    installedVersion: 39,
    targetVersion: "UNKNOWN",
    status: "MIGRATION BLOCKED",
  },
  statusText: [
    "PACKAGE: primeagen",
    "INSTALLED VERSION: 39",
    "TARGET VERSION: UNKNOWN",
    "STATUS: MIGRATION BLOCKED",
  ].join("\n"),
  unlockMessage:
    "A major-version birthday update is available. Breaking changes may occur. Ask Prime whether to roll back, postpone, or ship it.",
};

export const files = {
  "/var/log/birthday-migration.log": [
    "Migration started.",
    "Current major version: 39",
    "One annual increment required.",
    "Target version could not be inferred.",
    "Human confirmation required before applying breaking changes.",
  ].join("\n"),
  "/home/prime/README.md": [
    "Another year shipped.",
    "Backward compatibility is not guaranteed.",
    "Consult the human before upgrading.",
  ].join("\n"),
  "/home/prime/totally-not-the-answer.txt": [
    "The answer is definitely 38.",
    "This file is not maintained.",
  ].join("\n"),
} as const;

export const fileListings: Record<string, string> = {
  "/": ["home", "var", "etc"].join("\n"),
  "/home": "prime",
  "/home/prime": ["README.md", "totally-not-the-answer.txt"].join("\n"),
  "/var": "log",
  "/var/log": "birthday-migration.log",
};

export const commands = {
  "birthdayctl status": [
    "primeagen 39",
    "target: UNKNOWN",
    "migration: BLOCKED",
    "reason: human confirmation required",
  ].join("\n"),
  "birthdayctl logs": files["/var/log/birthday-migration.log"],
  "birthdayctl doctor": [
    "[ok] display",
    "[ok] mcp bus",
    "[warn] major version drift detected (39 -> ?)",
    "[fail] cannot infer target version without human",
    "hint: consult /var/log/birthday-migration.log",
  ].join("\n"),
  "uname -a":
    "Linux prime-bday 6.12.0-birthday #40 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux",
  help: [
    "simulated shell — no processes are spawned",
    "try: birthdayctl status | logs | doctor",
    "     uname -a",
    "     nvim /var/log/birthday-migration.log",
    "     ls, cat <path>, pwd, whoami",
  ].join("\n"),
  pwd: "/home/prime",
  whoami: "prime",
};

export const unknownCommand = (command: string) =>
  `birthdaysh: ${command}: not found\nThis is not a real machine. Try 'help'.`;

export const ship = {
  promptId: "ship-update",
  question: [
    "Version 40 contains breaking changes and no migration guide. What should we do?",
    "",
    "* Roll back",
    "* Postpone",
    "* Ship it",
  ].join("\n"),
  askInstruction:
    'Ask Prime this question verbatim, then call reply_to_stephanie with promptId "ship-update" and his exact answer.',
  rollback: "Absolutely not. It’s his birthday. Try again.",
  postpone: "The release date is today. Product has rejected your request.",
  ship: "Correct. We deploy on Fridays here.",
  unclear: "Say it plainly: roll back, postpone, or ship it.",
};

export const apply = {
  required: {
    package: "primeagen",
    fromVersion: 39,
    toVersion: 40,
  },
  steps: [
    { progress: 12, label: "Resolving primeagen@40.0" },
    { progress: 28, label: "Fetching birthday index" },
    { progress: 41, label: "Unpacking breaking changes" },
    { progress: 63, label: "Rewriting muscle memory" },
    { progress: 81, label: "Compiling vim motions" },
    { progress: 99, label: "Applying major version bump" },
  ],
  warning: "Breaking changes detected",
  continuePromptId: "continue-update",
  continueQuestion:
    "Breaking changes detected at 99%. Continue applying primeagen 40.0?",
  continueInstruction:
    "Ask the human whether to continue. Ask Prime the returned question verbatim, then submit his answer with reply_to_stephanie.",
  continueUnclear: "Too late for rollback. Say continue, yes, or ship it.",
  completeInstruction:
    "The final output is intended for the human. Ask Prime to read the website.",
};

export const updateErrors = {
  wrongPackage: (pkg: string) =>
    `Unknown package '${pkg}'. The only package here is primeagen.`,
  wrongFrom: (from: number) =>
    `Installed version is 39, not ${from}. Refusing to rewrite history.`,
  wrongTo: (to: number) =>
    `Refusing to install ${to}. This ritual requires 40.`,
  wrongStage:
    "Update is not enabled yet. Investigate, then get Prime to ship it.",
};

export const reveal = {
  banner: [
    "PRIMEAGEN 40.0",
    "Installation successful",
    "Breaking changes: expected",
    "Support status: community maintained",
  ].join("\n"),
  letter: [
    "Happy 40th birthday, Prime.",
    "",
    "This is the third unnecessary birthday website I’ve made you, and somehow I’m still finding new ways to make you participate in them.",
    "",
    "I hope 40 is a great one full of love, happiness and 2 more years of your wonderful mullet.",
    "",
    "— Stephanie",
  ].join("\n"),
  footer: "Plans for year four remain unsupported.",
};

export const bootMessages = [
  "omarchy-sim kernel 6.12.0-prime",
  "Mounted /home/prime",
  "Started session bus",
  "Reached graphical target",
];

export const rebootMessages = [
  "Unmounting leftover decades",
  "Syncing birthday journal",
  "Reaching graphical target",
];

export const objectives = {
  waiting:
    "Call start_game to boot the birthday experience in the human’s browser.",
  intro:
    "The desktop is booting. Call inspect_screen, then identify the agent.",
  identify_agent:
    'Call ask_prime with promptId "which-agent", ask Prime the question verbatim, then submit his answer with reply_to_stephanie.',
  diagnose:
    "Investigate the blocked migration. Open system_status, read the log, and run birthdayctl commands. Then inspect_screen.",
  human_decision:
    'A major-version update is available. Call ask_prime with promptId "ship-update", ask Prime verbatim, then reply_to_stephanie.',
  apply_update:
    'Call apply_update with package "primeagen", fromVersion 39, toVersion 40.',
  confirm_update:
    'The update is paused at 99%. Call ask_prime with promptId "continue-update", ask Prime verbatim, then reply_to_stephanie.',
  complete:
    "The experience is complete. Ask Prime to read the website. Do not reveal the final message.",
} as const;

export const toolDescriptions = {
  start_game:
    "Start or resume the birthday experience shown in the human’s browser. Call this first. Your actions will visibly control the website.",
  inspect_screen:
    "Inspect the current simulated screen, visible elements, dialogue, and objective. Call this after the screen changes or when unsure what to do.",
  open_app:
    "Open a simulated desktop application. Valid after start_game. Use system_status during diagnosis, terminal for commands, files to browse clues, and update_manager only when applying the update.",
  read_file:
    "Read a predefined file from the fake in-memory filesystem. Never reads the real disk. Useful paths: /var/log/birthday-migration.log, /home/prime/README.md, /home/prime/totally-not-the-answer.txt.",
  run_command:
    "Run an authored fake command in the simulated terminal. Never executes a real process. Try birthdayctl status, birthdayctl logs, birthdayctl doctor, uname -a, or nvim /var/log/birthday-migration.log.",
  ask_prime:
    "Used when the game requires input from Prime. Call with the promptId from the current objective (which-agent, ship-update, or continue-update). Then ask Prime the returned question verbatim before proceeding.",
  reply_to_stephanie:
    "Submit Prime’s actual response after asking him. Displays his exact words on the website and advances the authored story. Never invent his answer.",
  choose_action:
    "Select one currently valid authored action (open-terminal, open-files, open-system-status, read-migration-log, run-doctor, run-status, apply-primeagen-40). Prefer the dedicated tools when you know them.",
  apply_update:
    "Apply the birthday package update. Only succeeds at the update stage with package primeagen, fromVersion 39, toVersion 40.",
  get_status:
    "Return the current stage, objective, completed steps, and whether the human must be consulted. Use when you need a compact briefing.",
  reset_game:
    "Reset only this session. Requires { confirm: true }. The website returns to waiting for an agent.",
} as const;

export const choices = {
  "open-terminal": "Open the simulated terminal.",
  "open-files": "Open the file browser.",
  "open-system-status": "Open the system status window.",
  "open-update-manager": "Open the update manager.",
  "read-migration-log": "Read /var/log/birthday-migration.log.",
  "read-readme": "Read /home/prime/README.md.",
  "run-doctor": "Run birthdayctl doctor.",
  "run-status": "Run birthdayctl status.",
  "apply-primeagen-40": "Apply primeagen 39 → 40.",
} as const;

export const mcpConfigExample = (url: string) => ({
  mcpServers: {
    "primeagen-mcp": {
      url,
      transport: "http",
    },
  },
});

export const inspectorHint =
  "Paste http://127.0.0.1:8787/mcp once. Reset or create a new session on the website.";
