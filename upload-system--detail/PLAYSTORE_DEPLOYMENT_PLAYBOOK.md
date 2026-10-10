# 🚀 Antigravity Google Play Store Deployment Playbook

> **Target Audience:** Antigravity AI Agents & Developers  
> **Purpose:** Ye document ensure karta hai ki Antigravity kisi bhi new app ya update ko directly terminal se build, sign aur Google Play Store par bina errors ke deploy kar sake.

---

## 📌 1. Core Rule: Kya Automated Hai aur Kya Manual Hai?

Google Play Developer API ki security aur legal restrictions ke mutabiq:

| Kaam | Automation Status | Details |
|---|---|---|
| **App Container Creation** | ⚠️ **Manual (Ek baar)** | Google API naya app create nahi kar sakta. Console UI me **"Create App"** par click karke Package Name aur basic options (Game/App, Free/Paid) select karne padte hain. |
| **Release Build (.aab)** | ✅ **100% Automated** | Code build, resource tree-shaking, aur release keystore signing terminal se hota hai. |
| **Play Store Upload** | ✅ **100% Automated** | Service Account API se `.aab` upload aur internal/closed/production track par assign hota hai. |
| **Store Listing Details** | ✅ **100% Automated** | Title, Short Description, Full Description API se live update hote hain. |
| **Policy Questionnaires** | ⚠️ **Manual (Console UI)** | Data safety, Privacy policy, Ads declaration, Content rating Console UI me complete karni hoti hai. |

---

## 🔑 2. Credentials & Service Account Setup

1. **Service Account JSON Key:**
   * File path root directory me honi chahiye: `play-service-account.json` (ya `noted-terra-*.json`).
   * Google Cloud Console me `Google Play Android Developer API` enable hona mandatory hai.
   * Play Console ke **Users and permissions** me is service account email ko **Admin / Release Manager** permissions granted honi chahiye.

2. **Python Environment Setup:**
   * Script chalane ke liye virtual environment aur Google client libraries zaroori hain:
   ```bash
   python3 -m venv .venv
   .venv/bin/pip install google-auth google-api-python-client
   ```

---

## ⚙️ 3. Mandatory Android & Gradle Configurations

> [!CRITICAL]
> Google Play Console par upload karte waqt niche diye gaye version rules strict hain. Agar inme se ek bhi galat hua to API upload reject (403 Error) kar dega:

### A. `minSdkVersion` >= 24
* **Kyu:** Google Play Automatic Protection / Play Integrity ke liye minimum SDK version **24** ya higher hona zaroori hai.
* **Fix (`android/app/build.gradle.kts`):**
  ```kotlin
  defaultConfig {
      minSdk = 24
      ...
  }
  ```

### B. `targetSdkVersion` & `compileSdkVersion` = 36 (Latest 2026 Requirement)
* **Kyu:** Google har saal target SDK requirement badhata hai. Target SDK kam hone par error aati hai:  
  `Target SDK of artifact is too low: <versionCode>`
* **Fix (`android/app/build.gradle.kts`):**
  ```kotlin
  android {
      compileSdk = 36
      defaultConfig {
          targetSdk = 36
          ...
      }
  }
  ```
* SDK machine par installed hona chahiye:
  ```bash
  echo "y" | sdkmanager "platforms;android-36"
  yes | flutter doctor --android-licenses
  ```

### C. NDK Version
* Modern Flutter plugins (jaise `shared_preferences_android`) ke liye NDK 27 zaroori hota hai:
  ```kotlin
  android {
      ndkVersion = "27.0.12077973"
      ...
  }
  ```

### D. Automated Release Signing (`key.properties`)
* `android/key.properties` create karo:
  ```properties
  storePassword=YOUR_STORE_PASSWORD
  keyPassword=YOUR_KEY_PASSWORD
  keyAlias=YOUR_ALIAS
  storeFile=release.keystore
  ```
* `android/app/build.gradle.kts` me configure karo:
  ```kotlin
  import java.util.Properties
  import java.io.FileInputStream

  val keystoreProperties = Properties()
  val keystorePropertiesFile = rootProject.file("key.properties")
  if (keystorePropertiesFile.exists()) {
      keystoreProperties.load(FileInputStream(keystorePropertiesFile))
  }

  android {
      ...
      signingConfigs {
          create("release") {
              keyAlias = keystoreProperties["keyAlias"] as String?
              keyPassword = keystoreProperties["keyPassword"] as String?
              storeFile = keystoreProperties["storeFile"]?.let { file(it) }
              storePassword = keystoreProperties["storePassword"] as String?
          }
      }
      buildTypes {
          release {
              signingConfig = signingConfigs.getByName("release")
          }
      }
  }
  ```

---

## 📝 4. Store Listing Rules & Character Limits

API ke through store listing update karte waqt strict limits hain:

* **App Title:** Maximum **30 characters**
* **Short Description:** Strictly Maximum **80 characters**  
  *(Note: 81 characters hone par bhi Google 403 PERMISSION_DENIED error throw karta hai!)*
* **Full Description:** Maximum **4,000 characters**

---

## 🛠️ 5. Flutter Project Creation Best Practice

Flutter project create karte waqt hamesha `--platforms=android` flag use karein:
```bash
flutter create --org com.yourcompany --platforms=android app_name
```
*(Bina is flag ke Flutter interactive terminal me Xcode signing certificate maangne lagta hai, jisse non-interactive agent execution atak sakta hai).*

---

## 🚀 6. Reusable Deployment Python Script

Upload karne ke liye ye standard script use karein (`upload_play_bundle.py`):

```python
import os
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

PACKAGE_NAME = 'com.zhoopinfotech.your_app'
SERVICE_ACCOUNT_FILE = 'play-service-account.json'
AAB_PATH = 'your_app/build/app/outputs/bundle/release/app-release.aab'
TRACK = 'internal'  # 'internal', 'alpha', 'beta', or 'production'
SCOPES = ['https://www.googleapis.com/auth/androidpublisher']

def deploy():
    print(f"Connecting to Google Play API for: {PACKAGE_NAME}...")
    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    service = build('androidpublisher', 'v3', credentials=credentials)

    try:
        # Step 1: Create Edit Session
        edit = service.edits().insert(body={}, packageName=PACKAGE_NAME).execute()
        edit_id = edit['id']
        print(f"Edit session created: {edit_id}")

        # Step 2: Upload Bundle
        print(f"Uploading AAB: {AAB_PATH}...")
        media = MediaFileUpload(AAB_PATH, mimetype='application/octet-stream', resumable=True)
        bundle_resp = service.edits().bundles().upload(
            editId=edit_id, packageName=PACKAGE_NAME, media_body=media
        ).execute()
        version_code = bundle_resp['versionCode']
        print(f"Uploaded successfully! Version Code: {version_code}")

        # Step 3: Assign to Track
        print(f"Assigning to '{TRACK}' track...")
        service.edits().tracks().update(
            editId=edit_id,
            packageName=PACKAGE_NAME,
            track=TRACK,
            body={
                'releases': [{
                    'versionCodes': [str(version_code)],
                    'status': 'completed',
                    'releaseNotes': [{
                        'language': 'en-US',
                        'text': 'Initial automated release via Antigravity'
                    }]
                }]
            }
        ).execute()

        # Step 4: Commit Edit
        print("Committing release...")
        service.edits().commit(editId=edit_id, packageName=PACKAGE_NAME).execute()
        print("🎉 SUCCESS! Released on Google Play Store!")

    except HttpError as err:
        print(f"Play Store API Error ({err.resp.status}): {err.content.decode('utf-8')}")

if __name__ == '__main__':
    deploy()
```

---

## ⚠️ 7. Common Errors & Ready Solutions

| Error Message | Cause | Solution |
|---|---|---|
| `Play automatic protection requires a minimum SDK version of 24 or higher` | `minSdkVersion` 21 ya lower tha. | `android/app/build.gradle.kts` me `minSdk = 24` set karo aur rebuild karo. |
| `Target SDK of artifact is too low: X` | `targetSdkVersion` current year ke mandate se kam hai. | `targetSdk = 36` aur `compileSdk = 36` set karo aur rebuild karo. |
| `The short description for the app is too long for language en-US` | Short description 80 characters se zyada hai. | Short description ko strictly <= 80 characters me trim karo. |
| `503 The service is currently unavailable` | Google Play API ka temporary glitch. | 3–5 seconds wait karke script dubara execute karo. |
| `Version code X has already been used` | Pichli build ka version code repeat ho gaya. | `pubspec.yaml` me `version: 1.0.0+(X+1)` badhao aur rebuild karo. |

---

## 📋 8. New App Release Standard Workflow (Cheat Sheet)

Jab partner ka Antigravity naya app release kare, bas ye steps follow karein:

1. **User Action:** Play Console UI me jao -> **Create App** click karo -> Package name decide karo (`com.zhoopinfotech.<app_name>`).
2. **Antigravity Action:**
   * Flutter project banao: `flutter create --org com.zhoopinfotech --platforms=android <app_name>`
   * `minSdk = 24`, `targetSdk = 36`, `compileSdk = 36` set karo.
   * `keytool` se release keystore banao aur `key.properties` link karo.
   * Build banao: `flutter build appbundle --release`
   * `upload_play_bundle.py` chala kar internal track par live push kar do!
