import os

def safe_unlink(file_path: str):
    """
    Safely deletes a file if it exists.
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"[UTILS] Cleaned up: {file_path}")
    except Exception as e:
        print(f"[UTILS ERROR] Failed to delete {file_path}: {str(e)}")
