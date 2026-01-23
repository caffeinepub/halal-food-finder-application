# Halal Food Finder Application

## Overview
A web application that helps users discover halal restaurants both locally and globally through location-based and city/country search functionality.

## Core Features

### Search Functionality
- **Location-based search**: Find nearby halal restaurants using the user's current GPS position with bulletproof geolocation handling
  - **Automatic permission request**: Request geolocation permission immediately on app load with clear, user-friendly prompts explaining the benefit
  - **Universal browser compatibility**: Support all major browsers (Chrome, Firefox, Safari, Edge) and handle browser-specific geolocation quirks
  - **Cross-device reliability**: Ensure consistent functionality across desktop, mobile, and tablet devices
  - **Intelligent retry system**: Provide manual retry button for users to attempt location access again after initial denial or failure
  - **Graceful degradation**: Handle browsers without geolocation support with clear messaging and alternative options
  - **Accurate coordinate handling**: Ensure precise GPS coordinates are properly retrieved and passed to search functions
  - **Comprehensive error states**: Handle all geolocation error scenarios (permission denied, position unavailable, timeout, unsupported)
- **Global search**: Search for halal restaurants by entering city or country names
- Real-time search results with filtering capabilities

### Restaurant Information Display
- Restaurant name and cuisine type
- Full address and location details
- Contact information (phone, website if available)
- User ratings and reviews
- Direct link to maps application for navigation directions

### User Interface
- Clean, modern design with responsive layout
- **Interactive map view**: Visual representation of restaurant locations with clickable markers
- **List view**: Detailed restaurant information in a scrollable list format
- Toggle between map and list views
- Search bar with location input and current location button
- **Enhanced geolocation permission flow**:
  - **Proactive permission request**: Automatically request location access on app load with clear explanation of benefits
  - **Universal browser support**: Handle geolocation across all major browsers with browser-specific optimizations
  - **Device-agnostic functionality**: Ensure consistent behavior on desktop, mobile, and tablet devices
  - **Clear permission prompts**: Display user-friendly messages explaining why location access improves the experience
  - **Intelligent fallback system**: When location is denied or fails, show clear message with manual retry option and guidance to search by city/country
  - **Comprehensive error handling**: Handle all geolocation error types with appropriate user messaging
  - **Retry mechanism**: Provide easy-to-use retry button for users to attempt location access again
  - **Graceful unsupported browser handling**: Detect browsers without geolocation support and provide clear alternative instructions
- **Enhanced error messaging**: Display user-friendly error messages instead of technical errors when API calls fail
- **Intelligent error recovery UI**:
  - Clear, friendly messages explaining temporary backend issues with automatic retry notifications
  - Automatic refresh functionality with visual countdown indicators
  - Safe mode fallback that enables global search functionality while backend recovers
  - Progressive error states that guide users through recovery options

### Data Integration
- Integration with Foursquare API for halal restaurant data
- Real-time data fetching based on user queries
- Handle API rate limits and error responses gracefully

## Technical Requirements

### Frontend Functionality
- **Bulletproof geolocation system**:
  - **Automatic initialization**: Request geolocation permission immediately when app loads
  - **Universal browser compatibility**: Handle Chrome, Firefox, Safari, Edge with browser-specific implementations
  - **Cross-platform reliability**: Ensure consistent functionality across all device types and operating systems
  - **Comprehensive error handling**: Handle permission denied, position unavailable, timeout, and unsupported browser scenarios
  - **Intelligent retry logic**: Allow users to manually retry location detection with clear retry button
  - **Accurate coordinate processing**: Ensure GPS coordinates are properly retrieved and passed to search functions
  - **Graceful fallback messaging**: Provide clear instructions for manual city/country search when location fails
  - **Performance optimization**: Implement efficient geolocation calls without blocking the UI
- Interactive map component with restaurant markers
- Responsive design for mobile and desktop devices
- Loading states and error handling for API calls
- Search history and favorites (stored locally in browser)
- Application content displayed in English language
- **Advanced error recovery system**:
  - Smart error detection in useQueries.ts, RestaurantResults.tsx, and RestaurantMap.tsx
  - Automatic retry mechanisms with exponential backoff
  - User-friendly error messages that explain temporary issues and recovery progress
  - Safe mode operation that maintains global search functionality during backend recovery
  - Visual indicators for retry attempts and recovery status

### Backend Operations
- HTTP outcall configuration with proper canister permissions for external API access
- **Mission-critical canister resilience system**:
  - Automatic canister restart mechanism with intelligent recovery logic
  - Advanced error detection and handling for IC0508 (canister stopped) and replication rejection errors
  - Comprehensive retry logic with exponential backoff for all API operations
  - Graceful error recovery that prevents trapping and maintains service continuity
  - Watchdog service that continuously monitors canister health and automatically restarts critical services
  - Self-healing architecture that recovers from stopped or error states without manual intervention
- **Bulletproof API proxy endpoints**:
  - Enhanced `proxyExternalApiGet` and `proxyExternalApiPost` with comprehensive error handling
  - Multi-layer retry logic for failed API requests with intelligent failure detection
  - Graceful degradation when external APIs are unavailable
  - Automatic service recovery after canister state issues
- **Advanced error management and logging**:
  - Detailed error logging with timestamps for all canister state changes and recovery events
  - Comprehensive logging of IC0508 errors, replication rejections, and recovery attempts
  - Structured error responses that provide actionable information without exposing technical details
  - Error categorization system that distinguishes between temporary and permanent failures
- Proper CORS headers configuration for all API responses
- Search query processing and result formatting
- Rate limiting and caching for external API requests

### Data Management
- Cache frequently searched locations and results
- Store user search preferences locally
- No user authentication required - public access application
- **Comprehensive error and recovery logging**: Maintain detailed logs of all error events, recovery attempts, and canister state changes for debugging and monitoring

## User Experience
- **Seamless location experience**:
  - **Automatic permission flow**: Request location access immediately on app load with clear, friendly explanation
  - **Universal reliability**: Consistent geolocation functionality across all browsers and devices
  - **Intelligent retry system**: Easy retry button for users to attempt location detection again
  - **Clear fallback guidance**: When location fails or is denied, provide clear instructions for manual city/country search
  - **Graceful unsupported browser handling**: Detect and handle browsers without geolocation support
  - **Immediate results**: Display nearby halal restaurants as soon as location permission is granted and coordinates are obtained
  - **Comprehensive error communication**: User-friendly messages for all geolocation error scenarios
- Simple search interface with clear call-to-action buttons
- Fast loading times with skeleton screens during data fetching
- Clear visual indicators for halal certification status
- Easy navigation between different restaurant details
- Smooth transitions between map and list views
- **Seamless error recovery experience**:
  - Transparent handling of backend issues with clear user communication
  - Automatic retry functionality that works in the background
  - Safe mode operation that ensures users can always search globally
  - Progressive recovery notifications that keep users informed without causing anxiety
- Comprehensive error messaging and graceful fallback handling

## Deployment Requirements
- Proper canister permissions configured for HTTP outcalls
- Valid transformation functions for all external API calls
- CORS headers properly configured for cross-origin requests
- **Advanced canister monitoring and recovery**:
  - Automated health checks with immediate restart capabilities
  - Continuous monitoring for IC0508 and replication rejection errors
  - Self-healing deployment that maintains service availability
  - Comprehensive error logging and recovery event tracking
- Successful deployment verification with functional location-based search
- **Production-grade reliability infrastructure**: Complete logging, monitoring, and automatic recovery system for uninterrupted service delivery
