import main


def test_safe_notify_user_exists():
    assert hasattr(main, "safe_notify_user")
    assert callable(main.safe_notify_user)
