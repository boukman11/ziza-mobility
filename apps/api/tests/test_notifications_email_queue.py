import main


def test_enqueue_email_helper_exists():
    assert hasattr(main, "enqueue_email")
    assert callable(main.enqueue_email)
