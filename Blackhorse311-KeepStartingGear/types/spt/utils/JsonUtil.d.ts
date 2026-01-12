export declare class JsonUtil {
    serialize<T>(data: T, prettify?: boolean): string;
    deserialize<T>(jsonString: string, filename?: string): T;
    deserializeWithCacheCheck<T>(jsonString: string, filename: string): T;
    clone<T>(data: T): T;
}
