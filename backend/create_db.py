import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from urllib.parse import urlparse, unquote

try:
    from .database import SQLALCHEMY_DATABASE_URL
except ImportError:
    from database import SQLALCHEMY_DATABASE_URL

# Parse the DATABASE_URL to get credentials
db_url = os.getenv("DATABASE_URL", SQLALCHEMY_DATABASE_URL)
# Remove the driver prefix to parse as standard URL
if "+psycopg2" in db_url:
    parse_url = db_url.replace("postgresql+psycopg2://", "postgresql://")
else:
    parse_url = db_url

parsed = urlparse(parse_url)

user = parsed.username
# Decode password if it was URL encoded
password = unquote(parsed.password or "")
host = parsed.hostname
port = parsed.port or 5432
dbname = parsed.path.lstrip("/")

print(f"Connecting to {host} as {user} to create database {dbname}...")

try:
    # Connect to default 'postgres' database to create the new db
    conn = psycopg2.connect(
        host=host,
        user=user,
        password=password,
        port=port,
        dbname="postgres"
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    # Check if exists
    cursor.execute(f"SELECT 1 FROM pg_database WHERE datname = '{dbname}'")
    exists = cursor.fetchone()
    
    if not exists:
        cursor.execute(f"CREATE DATABASE {dbname}")
        print(f"Database '{dbname}' created.")
    else:
        print(f"Database '{dbname}' already exists.")
        
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error creating database: {e}")
