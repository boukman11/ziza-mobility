import importlib

def test_import_main():
    importlib.import_module("main")

def test_import_models_and_tables():
    models = importlib.import_module("models")
    base = getattr(models, "Base")
    tables = set(base.metadata.tables.keys())
    # core tables that must exist in final backend
    for t in [
        "users","driver_profiles","pricing_rules","trips","trip_events","driver_location_history",
        "assistances","audit_logs","idempotency_keys",
        "payments","payouts","ledger_entries",
        "notifications","user_preferences",
        "email_outbox","jobs",
    ]:
        assert t in tables

def test_import_worker():
    importlib.import_module("worker")
