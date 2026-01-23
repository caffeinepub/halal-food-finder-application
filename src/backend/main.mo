import Text "mo:core/Text";
import OutCall "http-outcalls/outcall";
import Time "mo:core/Time";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";

actor {
  let retryLimit = 2;
  var consecutiveErrors = 0;
  let maxConsecutiveErrors = 10;

  type CacheEntry = {
    data : Text;
    timestamp : Time.Time;
  };

  let apiCache = Map.empty<Text, CacheEntry>();
  let cacheValidity = 5 * 60 * 1000000000;
  type ErrorEntry = {
    timestamp : Time.Time;
    message : Text;
  };

  let errorLog = Map.empty<Nat, ErrorEntry>();
  var logCounter = 0;
  let maxLogEntries = 100;

  public query ({ caller }) func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

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

        if (consecutiveErrors >= maxConsecutiveErrors) {
          consecutiveErrors := 0;
        };
      };
    };

    switch (lastError) {
      case (?err) { Runtime.trap(err.message) };
      case (null) { Runtime.trap("Unexpected error in proxyExternalApiGet: GET request failed after retries") };
    };
  };

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

        if (consecutiveErrors >= maxConsecutiveErrors) {
          consecutiveErrors := 0;
        };
      };
    };

    switch (lastError) {
      case (?err) { Runtime.trap(err.message) };
      case (null) { Runtime.trap("post failed after retries") };
    };
  };

  public query ({ caller }) func ping() : async () {
    if (consecutiveErrors >= maxConsecutiveErrors) {
      Runtime.trap("Canister exceeded retries. Restarting.");
    };
    ();
  };

  func logErrorPublic(_message : Text) {
    let emptyLog = Map.empty<Nat, ErrorEntry>();
    let logEntry : ErrorEntry = {
      timestamp = Time.now();
      message = "1";
    };
    emptyLog.add(0, logEntry);
  };

  public query ({ caller }) func getErrorLog() : async [(Time.Time, Text)] {
    errorLog.values().toArray().map(
      func(entry) { (entry.timestamp, entry.message) }
    );
  };
};
