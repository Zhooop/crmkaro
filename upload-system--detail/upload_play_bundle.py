import os
import sys
import socket
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

# Set 10-minute timeout for large bundle uploads
socket.setdefaulttimeout(600)

PACKAGE_NAME = 'com.crmkaro.app'
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_ACCOUNT_FILE = os.path.join(CURRENT_DIR, 'noted-terra-511108-a9-9e240e69f34e.json')
AAB_PATH = os.path.normpath(os.path.join(CURRENT_DIR, '..', 'apps', 'mobile', 'android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab'))
TRACK = sys.argv[1] if len(sys.argv) > 1 else 'internal'  # 'internal', 'alpha', or 'production'
SCOPES = ['https://www.googleapis.com/auth/androidpublisher']

def deploy():
    print(f"Connecting to Google Play Developer API for package: {PACKAGE_NAME}...", flush=True)
    if not os.path.exists(SERVICE_ACCOUNT_FILE):
        print(f"ERROR: Service account file not found: {SERVICE_ACCOUNT_FILE}", flush=True)
        return False
        
    if not os.path.exists(AAB_PATH):
        print(f"ERROR: AAB bundle file not found at: {AAB_PATH}", flush=True)
        return False

    file_size_mb = os.path.getsize(AAB_PATH) / (1024 * 1024)
    print(f"AAB Bundle Found: {AAB_PATH} ({file_size_mb:.2f} MB)", flush=True)

    credentials = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES
    )
    service = build('androidpublisher', 'v3', credentials=credentials)

    try:
        # Step 1: Create Edit Session
        print("Creating edit session...", flush=True)
        edit = service.edits().insert(body={}, packageName=PACKAGE_NAME).execute()
        edit_id = edit['id']
        print(f"Edit session created successfully. Edit ID: {edit_id}", flush=True)

        # Step 2: Upload Bundle with Resumable Chunks
        print(f"Starting chunked upload for AAB bundle ({file_size_mb:.2f} MB)...", flush=True)
        media = MediaFileUpload(
            AAB_PATH,
            mimetype='application/octet-stream',
            resumable=True,
            chunksize=2 * 1024 * 1024  # 2MB chunks
        )
        
        request = service.edits().bundles().upload(
            editId=edit_id,
            packageName=PACKAGE_NAME,
            media_body=media
        )
        
        response = None
        while response is None:
            status, response = request.next_chunk()
            if status:
                progress = int(status.progress() * 100)
                print(f"Upload progress: {progress}%", flush=True)

        version_code = response.get('versionCode')
        print(f"Uploaded successfully! Version Code: {version_code}", flush=True)

        # Step 3: Assign to Track
        print(f"Assigning release to '{TRACK}' track...", flush=True)
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
                        'text': 'Initial release of CRMKaro - CRM, Invoicing, Members and Business Management'
                    }]
                }]
            }
        ).execute()
        print(f"Assigned to '{TRACK}' track successfully.", flush=True)

        # Step 4: Commit Edit
        print("Committing release to Google Play Store...", flush=True)
        service.edits().commit(editId=edit_id, packageName=PACKAGE_NAME).execute()
        print("SUCCESS! Released on Google Play Store successfully!", flush=True)
        return True

    except HttpError as err:
        print(f"Play Store API Error ({err.resp.status}): {err.content.decode('utf-8')}", flush=True)
        return False
    except Exception as e:
        print(f"Unexpected error: {e}", flush=True)
        return False

if __name__ == '__main__':
    success = deploy()
    sys.exit(0 if success else 1)
