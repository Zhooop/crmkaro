import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SERVICE_ACCOUNT_FILE = r'd:\Tushar\crmkaro web\upload-system--detail\noted-terra-511108-a9-9e240e69f34e.json'
PACKAGE_NAME = 'com.crmkaro.app'
SCOPES = ['https://www.googleapis.com/auth/androidpublisher']

try:
    creds = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    service = build('androidpublisher', 'v3', credentials=creds)
    edit = service.edits().insert(body={}, packageName=PACKAGE_NAME).execute()
    edit_id = edit['id']
    print(f"Created edit session: {edit_id}")
    
    # Assign existing versionCode 2 to production track
    service.edits().tracks().update(
        editId=edit_id,
        packageName=PACKAGE_NAME,
        track='production',
        body={
            'releases': [{
                'versionCodes': ['2'],
                'status': 'completed',
                'name': '1.0.0 (Public Release)',
                'releaseNotes': [{
                    'language': 'en-US',
                    'text': 'Initial public release of CRMKaro - Modern CRM, GST Invoicing and Business Operations.'
                }]
            }]
        }
    ).execute()
    print("Assigned to production track successfully.")
    
    # Commit edit
    service.edits().commit(editId=edit_id, packageName=PACKAGE_NAME).execute()
    print("SUCCESS: COMMITTED TO PRODUCTION!")
except HttpError as err:
    print(f"HTTP Error ({err.resp.status}):")
    print(err.content.decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
