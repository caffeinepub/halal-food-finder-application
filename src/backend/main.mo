import Time "mo:core/Time";
import Map "mo:core/Map";
import Iter "mo:core/Iter";
import OutCall "http-outcalls/outcall";
import Text "mo:core/Text";

actor {
  // Types for geolocation and API proxying
  public type CacheEntry = {
    data : Text;
    timestamp : Time.Time;
  };

  public type ErrorEntry = {
    timestamp : Time.Time;
    message : Text;
  };

  public type RequestStats = {
    totalRequests : Nat;
    successfulRequests : Nat;
    failedRequests : Nat;
    lastErroredRequest : ?ErrorEntry;
  };

  let retryLimit = 2;
  var consecutiveErrors = 0;
  let maxConsecutiveErrors = 10;
  var requestStats : RequestStats = {
    totalRequests = 0;
    successfulRequests = 0;
    failedRequests = 0;
    lastErroredRequest = null;
  };

  let apiCache = Map.empty<Text, CacheEntry>();
  let errorLog = Map.empty<Nat, ErrorEntry>();
  var logCounter = 0;
  let cacheValidity = 5 * 60 * 1000000000; // 5 minutes in nanoseconds
  let maxLogEntries = 100;

  // Error log management
  func clearErrorLog() {
    let currentTime = Time.now();
    let errorsToKeep = errorLog.filter(
      func(_id, entry) {
        currentTime - entry.timestamp < 24 * 3600 * 1000000000;
      }
    );
    errorLog.clear();

    for ((key, entry) in errorsToKeep.entries()) {
      errorLog.add(key, entry);
    };
  };

  func logError(message : Text) {
    let currentTime = Time.now();
    let logEntry = {
      timestamp = currentTime;
      message;
    };

    clearErrorLog();

    if (logCounter >= maxLogEntries) {
      let entries = errorLog.toArray();
      if (entries.size() > 0) {
        let oldest = entries[0];
        for ((id, entry) in entries.values()) {
          if (entry.timestamp < oldest.1.timestamp) {
            errorLog.remove(oldest.0);
          };
        };
      };
    };

    errorLog.add(logCounter, logEntry);
    logCounter += 1;
  };

  // Cache management
  func isCacheValid(entry : CacheEntry) : Bool {
    Time.now() - entry.timestamp < cacheValidity;
  };

  func updateCache(key : Text, data : Text) {
    let entry = {
      data;
      timestamp = Time.now();
    };
    apiCache.add(key, entry);
  };

  // Endpoint to clear cache based on prefix
  public shared ({ caller }) func clearCache(prefix : Text) : async () {
    let keysToRemove = apiCache.filter(
      func(k, _v) {
        k.startsWith(#text prefix);
      }
    );
    for ((key, _v) in keysToRemove.entries()) {
      apiCache.remove(key);
    };
  };

  // Proxy GET requests to external APIs with caching and retry logic
  public shared ({ caller }) func proxyExternalApiGet(url : Text) : async Text {
    let cacheKey = "GET:" # url;
    switch (apiCache.get(cacheKey)) {
      case (?entry) {
        if (isCacheValid(entry)) {
          return entry.data;
        };
      };
      case (null) {};
    };

    var attempts = 0;
    var lastError : ?ErrorEntry = null;

    while (attempts <= retryLimit) {
      try {
        let response = await OutCall.httpGetRequest(url, [], transform);
        updateCache(cacheKey, response);
        consecutiveErrors := 0;
        requestStats := {
          requestStats with
          totalRequests = requestStats.totalRequests + 1;
          successfulRequests = requestStats.successfulRequests + 1;
        };
        return response;
      } catch (e) {
        let errorMessage = "HTTP GET attempt " # attempts.toText() # " failed: " # e.message();
        let errorEntry = {
          timestamp = Time.now();
          message = errorMessage;
        };
        logError(errorMessage);
        lastError := ?errorEntry;
        attempts += 1;
        consecutiveErrors += 1;

        requestStats := {
          requestStats with
          totalRequests = requestStats.totalRequests + 1;
          failedRequests = requestStats.failedRequests + 1;
          lastErroredRequest = lastError;
        };

        if (consecutiveErrors >= maxConsecutiveErrors) {
          consecutiveErrors := 0;
        };
      };
    };

    switch (lastError) {
      case (?err) { "Error: " # err.message };
      case (null) {
        requestStats := {
          requestStats with
          failedRequests = requestStats.failedRequests + 1;
        };
        "Error: Unexpected error in proxyExternalApiGet: GET request failed after retries";
      };
    };
  };

  // Proxy POST requests to external APIs with caching and retry logic
  public shared ({ caller }) func proxyExternalApiPost(url : Text, body : Text) : async Text {
    let cacheKey = "POST:" # url # ":" # body;
    switch (apiCache.get(cacheKey)) {
      case (?entry) {
        if (isCacheValid(entry)) {
          return entry.data;
        };
      };
      case (null) {};
    };

    var attempts = 0;
    var lastError : ?ErrorEntry = null;

    while (attempts <= retryLimit) {
      try {
        let response = await OutCall.httpPostRequest(url, [], body, transform);
        updateCache(cacheKey, response);
        consecutiveErrors := 0;
        requestStats := {
          requestStats with
          totalRequests = requestStats.totalRequests + 1;
          successfulRequests = requestStats.successfulRequests + 1;
        };
        return response;
      } catch (e) {
        let errorMessage = "POST attempt " # attempts.toText() # " failed: " # e.message();
        let errorEntry = {
          timestamp = Time.now();
          message = errorMessage;
        };
        logError(errorMessage);
        lastError := ?errorEntry;
        attempts += 1;
        consecutiveErrors += 1;

        requestStats := {
          requestStats with
          totalRequests = requestStats.totalRequests + 1;
          failedRequests = requestStats.failedRequests + 1;
          lastErroredRequest = lastError;
        };

        if (consecutiveErrors >= maxConsecutiveErrors) {
          consecutiveErrors := 0;
        };
      };
    };

    switch (lastError) {
      case (?err) { "Error: " # err.message };
      case (null) {
        requestStats := {
          requestStats with
          failedRequests = requestStats.failedRequests + 1;
        };
        "Error: post failed after retries";
      };
    };
  };

  // Supported transformation function for HTTP outcalls
  public query ({ caller }) func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  // Ping function to check system status
  public shared ({ caller }) func ping() : async () {
    if (consecutiveErrors >= maxConsecutiveErrors) {
      consecutiveErrors := 0;
    };
  };

  // Retrieve error log with timestamps and messages
  public query ({ caller }) func getErrorLog() : async [(Time.Time, Text)] {
    errorLog.values().toArray().map(
      func(entry) { (entry.timestamp, entry.message) }
    );
  };

  // Retrieve current cache entries as array of (key, data, timestamp)
  public query ({ caller }) func getCacheContents() : async [(Text, Text, Time.Time)] {
    let currentTime = Time.now();
    apiCache.entries().toArray().map(
      func((key, entry)) { (key, entry.data, currentTime) }
    );
  };

  // Get current request statistics
  public query ({ caller }) func getRequestStats() : async (Nat, Nat, Nat) {
    (requestStats.totalRequests, requestStats.successfulRequests, requestStats.failedRequests);
  };

  // Get API cache expiration time in nanoseconds
  public query ({ caller }) func getCacheExpiration() : async Nat {
    cacheValidity;
  };

  // GET geolocation data from ip-api.com (with HTTPS)
  public shared ({ caller }) func getIpApiGeolocation() : async Text {
    let url = "https://ip-api.com/json/?fields=lat,lon,city,country,status,message";
    await OutCall.httpGetRequest(url, [], transform);
  };

  // GET cached data for a specific key, returns null if not found or expired
  public query ({ caller }) func getCachedData(key : Text) : async ?Text {
    switch (apiCache.get(key)) {
      case (?entry) {
        if (Time.now() - entry.timestamp < cacheValidity) {
          ?entry.data;
        } else { null };
      };
      case (null) { null };
    };
  };

  // Expose max log entries for frontend display
  public query ({ caller }) func getMaxLogEntries() : async Nat {
    maxLogEntries;
  };

  // Expose max consecutive errors for frontend queries
  public query ({ caller }) func getMaxConsecutiveErrors() : async Nat {
    maxConsecutiveErrors;
  };

  // Get error log entry count as fallback for separate array entries
  public query ({ caller }) func getErrorLogCount() : async Nat {
    errorLog.size();
  };

  // Get current cache entry count
  public query ({ caller }) func getCacheCount() : async Nat {
    apiCache.size();
  };

  // Get time remaining until a cache entry expires (returns 0 if expired/not found)
  public query ({ caller }) func getCacheTimeRemaining(key : Text) : async Time.Time {
    switch (apiCache.get(key)) {
      case (?entry) {
        let remaining = cacheValidity - (Time.now() - entry.timestamp);
        if (remaining > 0) { remaining } else { 0 };
      };
      case (null) { 0 };
    };
  };
};
