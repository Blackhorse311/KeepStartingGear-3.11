export interface ILogger {
    debug(data: string | Record<string, unknown>): void;
    info(data: string | Record<string, unknown>): void;
    warning(data: string | Record<string, unknown>): void;
    error(data: string | Record<string, unknown>): void;
    success(data: string | Record<string, unknown>): void;
}
