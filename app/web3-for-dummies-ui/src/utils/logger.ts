type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private context: string;
  private isDev: boolean;

  constructor(context: string) {
    this.context = context;
    this.isDev = process.env.NODE_ENV === 'development';
  }

  private formatMessage(level: LogLevel, message: any): string {
    return `[${this.context}][${level.toUpperCase()}] ${message}`;
  }

  debug(...args: any[]): void {
    if (this.isDev) {
      console.debug(this.formatMessage('debug', args[0]), ...args.slice(1));
    }
  }

  info(...args: any[]): void {
    if (this.isDev) {
      console.info(this.formatMessage('info', args[0]), ...args.slice(1));
    }
  }

  warn(...args: any[]): void {
    console.warn(this.formatMessage('warn', args[0]), ...args.slice(1));
  }

  error(...args: any[]): void {
    console.error(this.formatMessage('error', args[0]), ...args.slice(1));
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}