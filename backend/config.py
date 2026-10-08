import os
from pathlib import Path
from dotenv import load_dotenv

# Locate .env file in backend directory or root repository directory
backend_dir = Path(__file__).resolve().parent
backend_env_path = backend_dir / ".env"
root_env_path = backend_dir.parent / ".env"
if backend_env_path.exists():
    load_dotenv(dotenv_path=backend_env_path)
elif root_env_path.exists():
    load_dotenv(dotenv_path=root_env_path)
else:
    load_dotenv()

SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://jocpolzoovgpnbnhluoq.supabase.co")
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "sb_publishable__zePG8Nbo4XvSq-0QHmzwQ_HKhIOoRA")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
PORT: int = int(os.getenv("PORT", "8000"))

# Razorpay Test Mode Configuration
RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_TkWmgK8HUmJJGn")
RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "topride_whsec_test_2026")

# Matching Configuration
MAX_DEPARTURE_DELTA_MINUTES: int = int(os.getenv("MAX_DEPARTURE_DELTA_MINUTES", "180"))
MIN_AUTO_MATCH_SCORE: float = float(os.getenv("MIN_AUTO_MATCH_SCORE", "60.0"))

# Dynamic Market Pricing Configuration
BASE_PRICE_PER_KM: float = float(os.getenv("BASE_PRICE_PER_KM", "1.00"))
BASE_PRICE_PER_MINUTE: float = float(os.getenv("BASE_PRICE_PER_MINUTE", "0.15"))
MINIMUM_PLATFORM_PRICE: float = float(os.getenv("MINIMUM_PLATFORM_PRICE", "150.0"))
MIN_DEMAND_MULTIPLIER: float = float(os.getenv("MIN_DEMAND_MULTIPLIER", "0.90"))
MAX_DEMAND_MULTIPLIER: float = float(os.getenv("MAX_DEMAND_MULTIPLIER", "1.30"))
MIN_TIME_MULTIPLIER: float = float(os.getenv("MIN_TIME_MULTIPLIER", "0.95"))
MAX_TIME_MULTIPLIER: float = float(os.getenv("MAX_TIME_MULTIPLIER", "1.08"))
MIN_OCCUPANCY_MULTIPLIER: float = float(os.getenv("MIN_OCCUPANCY_MULTIPLIER", "1.00"))
MAX_OCCUPANCY_MULTIPLIER: float = float(os.getenv("MAX_OCCUPANCY_MULTIPLIER", "1.05"))
MIN_PRICE_MULTIPLIER: float = float(os.getenv("MIN_PRICE_MULTIPLIER", "0.85"))
MAX_PRICE_MULTIPLIER: float = float(os.getenv("MAX_PRICE_MULTIPLIER", "1.30"))
PRICE_ROUNDING_UNIT: float = float(os.getenv("PRICE_ROUNDING_UNIT", "10.0"))
PRICE_RECALCULATION_THRESHOLD: float = float(os.getenv("PRICE_RECALCULATION_THRESHOLD", "10.0"))
MARKET_GEO_RADIUS_KM: float = float(os.getenv("MARKET_GEO_RADIUS_KM", "40.0"))

