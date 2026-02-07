import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export interface Location {
    latitude: number;
    longitude: number;
}
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export type Time = bigint;
export interface ConfirmationResponse {
    success: string;
}
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface UserProfile {
    name: string;
}
export interface http_header {
    value: string;
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    clearApiCache(): Promise<ConfirmationResponse>;
    clearCachePrefix(prefix: string): Promise<void>;
    clearFoursquareApiKey(): Promise<ConfirmationResponse>;
    foursquarePlacesSearch(url: string): Promise<string>;
    getCacheContents(): Promise<Array<[string, string, Time]>>;
    getCacheExpiration(): Promise<bigint>;
    getCacheTimeRemaining(key: string): Promise<Time>;
    getCachedData(key: string): Promise<string | null>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getErrorLog(): Promise<Array<[Time, string]>>;
    getFoursquareApiKey(): Promise<string | null>;
    getIpApiGeolocation(): Promise<string>;
    getPageViews(): Promise<bigint>;
    getRequestStats(): Promise<[bigint, bigint, bigint]>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    incrementPageViews(): Promise<bigint>;
    isCallerAdmin(): Promise<boolean>;
    ping(): Promise<void>;
    proxyExternalApiGet(url: string): Promise<string>;
    proxyExternalApiPost(url: string, body: string): Promise<string>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setFoursquareApiKey(key: string): Promise<ConfirmationResponse>;
    transform(input: TransformationInput): Promise<TransformationOutput>;
    validateCoordinates(location: Location): Promise<boolean>;
}
