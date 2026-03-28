from pathlib import Path
import sys

# Ensure imports like `import main` work when tests run from apps/api.
API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))
