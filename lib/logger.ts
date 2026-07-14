type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "SILENT";

interface LogContext {
  userId?: string;
  symbol?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

interface Logger {
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, err?: Error, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
}

const logBuffer: LogEntry[] = [];

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
};

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
  return LOG_LEVELS[level] !== undefined ? level : "INFO";
}

function isLoggingEnabled(): boolean {
  return process.env.ENABLE_LOGS !== "false";
}

function isTestMode(): boolean {
  return process.env.TEST_MODE === "true";
}

function shouldLog(level: LogLevel): boolean {
  if (!isLoggingEnabled()) return false;
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;

  const sanitized = { ...context };
  const sensitiveKeys = ["privateKey", "password", "token", "secret"];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

function formatLogEntry(entry: LogEntry): string {
  const timestamp = entry.timestamp.toISOString();
  const level = entry.level.padEnd(5);

  let message = `${timestamp} [${level}] [smart-dca-bot]`;

  if (entry.context?.userId) {
    message += ` [User:${String(entry.context.userId).substring(0, 8)}]`;
  }

  if (entry.context?.symbol) {
    message += ` [${entry.context.symbol}]`;
  }

  message += ` ${entry.message}`;

  if (entry.context) {
    const contextWithoutUserIdAndSymbol = { ...entry.context };
    delete contextWithoutUserIdAndSymbol.userId;
    delete contextWithoutUserIdAndSymbol.symbol;

    if (Object.keys(contextWithoutUserIdAndSymbol).length > 0) {
      message += ` ${JSON.stringify(contextWithoutUserIdAndSymbol)}`;
    }
  }

  if (entry.error) {
    message += `\n  Error: ${entry.error.message}`;
    if (entry.error.stack) {
      message += `\n  Stack: ${entry.error.stack}`;
    }
  }

  return message;
}

function writeLog(
  level: LogLevel,
  message: string,
  err?: Error,
  context?: LogContext
): void {
  if (!shouldLog(level)) return;

  const sanitizedContext = sanitizeContext(context);
  const entry: LogEntry = {
    timestamp: new Date(),
    level,
    message,
    context: sanitizedContext,
    error: err,
  };

  if (isTestMode()) {
    logBuffer.push(entry);
  } else {
    const formatted = formatLogEntry(entry);

    if (level === "ERROR") {
      console.error(formatted);
    } else if (level === "WARN") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }
}

export function info(message: string, context?: LogContext): void {
  writeLog("INFO", message, undefined, context);
}

export function warn(message: string, context?: LogContext): void {
  writeLog("WARN", message, undefined, context);
}

export function error(message: string, err?: Error, context?: LogContext): void {
  writeLog("ERROR", message, err, context);
}

export function debug(message: string, context?: LogContext): void {
  writeLog("DEBUG", message, undefined, context);
}

export function createLogger(baseContext: LogContext): Logger {
  return {
    info: (message: string, context?: LogContext) =>
      info(message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      warn(message, { ...baseContext, ...context }),
    error: (message: string, err?: Error, context?: LogContext) =>
      error(message, err, { ...baseContext, ...context }),
    debug: (message: string, context?: LogContext) =>
      debug(message, { ...baseContext, ...context }),
  };
}

export function getLogBuffer(): LogEntry[] {
  return [...logBuffer];
}

export function clearLogBuffer(): void {
  logBuffer.length = 0;
}
