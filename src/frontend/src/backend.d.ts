import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export type Time = bigint;
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface backendInterface {
    clearCache(prefix: string): Promise<void>;
    getCacheContents(): Promise<Array<[string, string, Time]>>;
    getCacheCount(): Promise<bigint>;
    getCacheExpiration(): Promise<bigint>;
    getCacheTimeRemaining(key: string): Promise<Time>;
    getCachedData(key: string): Promise<string | null>;
    getErrorLog(): Promise<Array<[Time, string]>>;
    getErrorLogCount(): Promise<bigint>;
    getIpApiGeolocation(): Promise<string>;
    getMaxConsecutiveErrors(): Promise<bigint>;
    getMaxLogEntries(): Promise<bigint>;
    getRequestStats(): Promise<[bigint, bigint, bigint]>;
    ping(): Promise<void>;
    proxyExternalApiGet(url: string): Promise<string>;
    proxyExternalApiPost(url: string, body: string): Promise<string>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
}
