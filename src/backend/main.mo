import Time "mo:core/Time";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Iter "mo:core/Iter";
import OutCall "http-outcalls/outcall";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";

actor {
  // Initialize the access control system
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  // Persistent page view counter
  var pageViews : Nat = 0;

  // User profile type
  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

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

  // Types for halal places search
  public type Location = {
    latitude : Float;
    longitude : Float;
  };

  public type Feature = {
    description : Text;
    source : Text;
  };

  public type Restaurant = {
    name : Text;
    address : Text;
    location : ?Location;
    features : [Feature];
    category : Text;
    halalCertified : Bool;
    distance : ?Nat;
    source : Text;
  };

  public type SuccessMessage = { success : Text };
  public type ErrorMessage = { error : Text };
  public type ConfirmationResponse = { success : Text };

  public type SearchQuery = {
    city : Text;
    country : Text;
    cuisine : ?Text;
    halalPreference : Bool;
    priceLevel : ?Nat;
    sortByDistance : Bool;
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

  // Types for restaurant features
  public type SupportedCuisine = {
    name : Text;
    description : Text;
    halal : Bool;
  };

  public type SupportedFeature = {
    name : Text;
    description : Text;
    source : Text;
  };

  // Caching for supported cuisines and features
  var supportedCuisinesCache = [
    {
      name = "Thai";
      description = "Fragrant and spicy dishes";
      halal = true;
    },
    {
      name = "Japanese";
      description = "Sushi, ramen, and tempura";
      halal = false;
    },
  ];
  var supportedFeaturesCache = [
    {
      name = "Halal Certification";
      description = "Official halal certification from trusted sources";
      source = "Multiple organizations";
    }
  ];

  var foursquareApiKey : ?Text = null;

  // Persistent Page View Counter
  public shared ({ caller }) func incrementPageViews() : async Nat {
    pageViews += 1;
    pageViews;
  };

  public query ({ caller }) func getPageViews() : async Nat {
    pageViews;
  };

  // User Profile Functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user: Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

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

  // Validate coordinates: Ensure latitude and longitude are within valid range
  // Any user including guests can validate coordinates
  public func validateCoordinates(location : Location) : async Bool {
    location.latitude >= -90.0 and location.latitude <= 90.0 and location.longitude >= -180.0 and location.longitude <= 180.0
  };

  // Foursquare API Key management - Admin only
  public shared ({ caller }) func setFoursquareApiKey(key : Text) : async ConfirmationResponse {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can set Foursquare API key");
    };
    foursquareApiKey := ?key;
    { success = "Foursquare API key set successfully" };
  };

  public query ({ caller }) func getFoursquareApiKey() : async ?Text {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view Foursquare API key");
    };
    foursquareApiKey;
  };

  public shared ({ caller }) func clearFoursquareApiKey() : async ConfirmationResponse {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can clear Foursquare API key");
    };
    foursquareApiKey := null;
    { success = "Foursquare API key cleared successfully" };
  };

  public shared ({ caller }) func clearApiCache() : async ConfirmationResponse {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can clear API cache");
    };
    apiCache.clear();
    { success = "API cache cleared successfully" };
  };

  // Clear specific cache prefix - Admin only
  public shared ({ caller }) func clearCachePrefix(prefix : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can clear cache prefix");
    };
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
  // Any user including guests (anonymous) can use this for location features
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
  // Any user including guests (anonymous) can use this for location features
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
  // Any user including guests can use this
  public query ({ caller }) func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
    OutCall.transform(input);
  };

  // Ping function to check system status - Any user including guests
  public shared ({ caller }) func ping() : async () {
    if (consecutiveErrors >= maxConsecutiveErrors) {
      consecutiveErrors := 0;
    };
  };

  // Retrieve error log with timestamps and messages - Admin only
  public query ({ caller }) func getErrorLog() : async [(Time.Time, Text)] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view error logs");
    };
    errorLog.values().toArray().map(
      func(entry) { (entry.timestamp, entry.message) }
    );
  };

  // Retrieve current cache entries as array of (key, data, timestamp) - Admin only
  public query ({ caller }) func getCacheContents() : async [(Text, Text, Time.Time)] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can view cache contents");
    };
    let currentTime = Time.now();
    apiCache.entries().toArray().map(
      func((key, entry)) { (key, entry.data, currentTime) }
    );
  };

  // Get current request statistics - Any user including guests
  public query ({ caller }) func getRequestStats() : async (Nat, Nat, Nat) {
    (requestStats.totalRequests, requestStats.successfulRequests, requestStats.failedRequests);
  };

  // Get API cache expiration time in nanoseconds - Any user including guests
  public query ({ caller }) func getCacheExpiration() : async Nat {
    cacheValidity;
  };

  // GET geolocation data from ip-api.com (with HTTPS)
  // Any user including guests (anonymous) can use this for location features
  public shared ({ caller }) func getIpApiGeolocation() : async Text {
    let url = "https://ip-api.com/json/?fields=lat,lon,city,country,status,message";
    await OutCall.httpGetRequest(url, [], transform);
  };

  // GET cached data for a specific key, returns null if not found or expired
  // Any user including guests can check cache
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

  // Get time remaining until a cache entry expires (returns 0 if expired/not found)
  // Any user including guests can check cache expiration
  public query ({ caller }) func getCacheTimeRemaining(key : Text) : async Time.Time {
    switch (apiCache.get(key)) {
      case (?entry) {
        let remaining = cacheValidity - (Time.now() - entry.timestamp);
        if (remaining > 0) { remaining } else { 0 };
      };
      case (null) { 0 };
    };
  };

  // Foursquare Places API search with Authorization header support
  // This function protects the API key by keeping it in the backend
  // Any user including guests (anonymous) can use this for location features
  public shared ({ caller }) func foursquarePlacesSearch(url : Text) : async Text {
    let apiKey = switch (foursquareApiKey) {
      case (null) {
        return "Error: Foursquare API key is not configured. Please set the API key before making requests.";
      };
      case (?key) { key };
    };
    let extraHeaders = [
      { name = "Accept"; value = "application/json" },
      { name = "Authorization"; value = apiKey },
    ];
    await OutCall.httpGetRequest(url, extraHeaders, transform);
  };
};
