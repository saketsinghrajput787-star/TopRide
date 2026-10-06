import os
from pathlib import Path
from dotenv import load_dotenv

# Locate .env file in root directory
root_dir = Path(__file__).resolve().parent.parent
env_path = root_dir / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://jocpolzoovgpnbnhluoq.supabase.co")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "sb_publishable__zePG8Nbo4XvSq-0QHmzwQ_HKhIOoRA")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
PORT: int = int(os.getenv("PORT", "8000"))
