-- Runtime application code may append and read audit events, but cannot rewrite history.
REVOKE UPDATE, DELETE ON TABLE "audit_logs" FROM crmkaro_app;
