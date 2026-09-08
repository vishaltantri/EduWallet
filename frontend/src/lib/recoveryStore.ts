import * as fs from "fs";
import * as path from "path";

export interface RecoveryConfiguration {
  studentId: string;
  guardianEmails: string[];
  guardianAddresses: string[];
  threshold: number;
  configuredAt: string;
}

const isServerless = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
const DB_PATH = isServerless
  ? path.join("/tmp", "eduwallet_recovery.json")
  : path.join(process.cwd(), "data", "recovery.json");

let inMemoryConfigurations: RecoveryConfiguration[] = [];

function getConfigurations(): RecoveryConfiguration[] {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, "[]");
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as RecoveryConfiguration[];
  } catch (error) {
    console.warn("Recovery configuration read failed; using in-memory storage:", error);
    return inMemoryConfigurations;
  }
}

function saveConfigurations(configurations: RecoveryConfiguration[]) {
  inMemoryConfigurations = configurations;
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(configurations, null, 2));
  } catch (error) {
    console.warn("Recovery configuration save failed; kept in memory:", error);
  }
}

export function getRecoveryConfiguration(studentId: string): RecoveryConfiguration | undefined {
  return getConfigurations().find((configuration) => configuration.studentId === studentId);
}

export function saveRecoveryConfiguration(configuration: RecoveryConfiguration) {
  const configurations = getConfigurations();
  const index = configurations.findIndex((item) => item.studentId === configuration.studentId);
  if (index === -1) configurations.push(configuration);
  else configurations[index] = configuration;
  saveConfigurations(configurations);
}
