# Attendly - Fingerprint Login System

## Overview
This project includes a fingerprint-based login system that allows users (Admin/Teacher/Student) to authenticate using a fingerprint sensor connected to an ESP32.

## System Architecture

### Database Tables

#### `users` table
Stores user information with fingerprint mappings:
- `id` - UUID primary key
- `name` - User's full name
- `email` - Optional email address
- `role` - One of: 'admin', 'teacher', 'student'
- `admn_no` - Optional admission number
- `class` - Optional class (e.g., "10")
- `section` - Optional section (e.g., "A")
- `fingerprint_id` - Unique integer mapping to fingerprint sensor ID
- `created_at` - Timestamp

#### `finger_login_logs` table
Logs every fingerprint scan attempt:
- `id` - UUID primary key
- `fingerprint_id` - Integer from fingerprint sensor
- `user_id` - Reference to users table (null if unknown)
- `device_id` - Optional device identifier from ESP32
- `login_time` - Timestamp of login attempt

### Backend API

**Endpoint:** `https://vmyzqcjnrcvwgdeeshhk.supabase.co/functions/v1/finger-login`

**Method:** POST

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "fingerprint_id": 4,
  "device_id": "ESP32-01"
}
```

**Success Response (User Found):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "role": "student",
    "class": "10",
    "section": "A"
  },
  "fingerprint_id": 4,
  "logged_in_at": "2025-11-21T08:20:00Z"
}
```

**Error Response (Unknown Fingerprint):**
```json
{
  "success": false,
  "error": "Unknown fingerprint",
  "fingerprint_id": 4,
  "logged_in_at": "2025-11-21T08:20:00Z"
}
```

### Frontend Pages

#### 1. Finger Login Monitor (`/finger-login`)
- Displays real-time fingerprint login attempts
- Shows last login in a highlighted card
- Table of recent login activity
- Auto-updates via Supabase Realtime (no refresh needed)
- Color-coded role badges (Admin=Red, Teacher=Blue, Student=Green)

#### 2. Admin User Management (`/admin/users`)
- Add/Edit/Delete users
- Assign fingerprint IDs to users
- Manage user roles and details
- View all registered users

## Setup Instructions

### 1. Environment Variables
The following are already configured in your Lovable Cloud project:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

### 2. Add Your First User
1. Navigate to `/admin/users`
2. Click "Add User"
3. Fill in:
   - Name (required)
   - Role (required)
   - Fingerprint ID (the number from your sensor)
   - Optional: email, class, section, admission number
4. Click "Create User"

### 3. ESP32 Setup

#### Required Components
- ESP32 development board
- Fingerprint sensor (e.g., ZA620, R305, AS608)
- WiFi connection

#### ESP32 Code Example
```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* apiUrl = "https://vmyzqcjnrcvwgdeeshhk.supabase.co/functions/v1/finger-login";
const char* deviceId = "ESP32-01";

void sendFingerprint(int fingerId) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(apiUrl);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    StaticJsonDocument<200> doc;
    doc["fingerprint_id"] = fingerId;
    doc["device_id"] = deviceId;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    // Send POST request
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Response: " + response);
      
      // Parse response
      StaticJsonDocument<512> responseDoc;
      deserializeJson(responseDoc, response);
      
      if (responseDoc["success"]) {
        String userName = responseDoc["user"]["name"];
        String userRole = responseDoc["user"]["role"];
        Serial.println("Login successful: " + userName + " (" + userRole + ")");
      } else {
        Serial.println("Unknown fingerprint");
      }
    }
    
    http.end();
  }
}

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
  
  // Initialize your fingerprint sensor here
}

void loop() {
  // When fingerprint is detected, get the ID and send it
  // int fingerId = getFingerprintId(); // Your sensor reading function
  // if (fingerId > 0) {
  //   sendFingerprint(fingerId);
  // }
  
  delay(100);
}
```

## Testing the System

### 1. Without ESP32 (Manual Testing)
You can test using curl or Postman:

```bash
curl -X POST https://vmyzqcjnrcvwgdeeshhk.supabase.co/functions/v1/finger-login \
  -H "Content-Type: application/json" \
  -d '{"fingerprint_id": 4, "device_id": "TEST"}'
```

### 2. With ESP32
1. Register a user with fingerprint_id = 4 in `/admin/users`
2. Upload the ESP32 code with your WiFi credentials
3. Place finger on sensor
4. Watch the `/finger-login` page update in real-time!

## Features

✅ Real-time updates (no page refresh needed)  
✅ User role management (Admin/Teacher/Student)  
✅ Complete login history  
✅ Unknown fingerprint detection  
✅ Device tracking via device_id  
✅ Clean, school-friendly UI  
✅ No authentication required for ESP32 API  

## Security Notes

- The finger-login API is public (no JWT verification) to allow ESP32 access
- RLS policies are enabled on all tables
- Service role key is used on the backend (never exposed to client)
- All database operations use Row Level Security

## Troubleshooting

### ESP32 can't connect
- Verify WiFi credentials
- Check if ESP32 can reach internet (test with ping)
- Ensure API URL is correct

### Fingerprint not recognized
- Make sure fingerprint_id in database matches sensor ID
- Check if user exists in `/admin/users`
- View logs in `/finger-login` to see what ID was received

### Page doesn't update in real-time
- Check browser console for errors
- Verify Supabase realtime is enabled (it should be)
- Refresh the page once to reconnect

## Next Steps

1. Add more users with their fingerprint IDs
2. Test with multiple ESP32 devices (use different device_ids)
3. Customize the UI colors and branding
4. Add authentication for the admin page
5. Export login reports for attendance tracking

---

**Note:** This system is focused on fingerprint login monitoring. It does NOT include SMS, WhatsApp, or complex attendance rules - it's a clean, minimal fingerprint authentication system.