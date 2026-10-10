import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

SERVICE_ACCOUNT_FILE = r'd:\Tushar\crmkaro web\upload-system--detail\noted-terra-511108-a9-9e240e69f34e.json'
PACKAGE_NAME = 'com.crmkaro.app'
SCOPES = ['https://www.googleapis.com/auth/androidpublisher']

try:
    creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build('androidpublisher', 'v3', credentials=creds)
    edit = service.edits().insert(body={}, packageName=PACKAGE_NAME).execute()
    edit_id = edit['id']
    print('Current Edit ID:', edit_id)
    tracks = service.edits().tracks().list(editId=edit_id, packageName=PACKAGE_NAME).execute()
    for t in tracks.get('tracks', []):
        track_name = t.get('track')
        releases = t.get('releases', [])
        print(f"Track: {track_name}, Releases count: {len(releases)}")
        for r in releases:
            print(f"  Release status={r.get('status')}, versionCodes={r.get('versionCodes')}")
except Exception as e:
    print('Error:', e)
