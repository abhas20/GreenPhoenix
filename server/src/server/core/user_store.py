import uuid
import datetime
import logging
from typing import Optional, Dict, Any
import bcrypt
import boto3
from botocore.exceptions import ClientError

from server.config import settings

log = logging.getLogger(__name__)

# In-memory fallback tracking for users if DynamoDB is offline
_MEMORY_USERS: Dict[str, Dict[str, Any]] = {}


def hash_password(password: str) -> str:
    """Hashes a password using bcrypt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def get_dynamodb_client():
    """Returns low-level boto3 DynamoDB client with appropriate endpoint."""
    if settings.DYNAMODB_ENDPOINT_URL:
        return boto3.client(
            "dynamodb",
            endpoint_url=settings.DYNAMODB_ENDPOINT_URL,
            region_name=settings.DYNAMODB_REGION,
            aws_access_key_id="local",
            aws_secret_access_key="local"
        )
    return boto3.client("dynamodb", region_name=settings.DYNAMODB_REGION)


def get_dynamodb_resource():
    """Returns high-level boto3 DynamoDB resource with appropriate endpoint."""
    if settings.DYNAMODB_ENDPOINT_URL:
        return boto3.resource(
            "dynamodb",
            endpoint_url=settings.DYNAMODB_ENDPOINT_URL,
            region_name=settings.DYNAMODB_REGION,
            aws_access_key_id="local",
            aws_secret_access_key="local"
        )
    return boto3.resource("dynamodb", region_name=settings.DYNAMODB_REGION)


def ensure_user_table():
    """Idempotently ensures the DynamoDB users table exists."""
    client = get_dynamodb_client()
    try:
        tables = client.list_tables().get("TableNames", [])
        if settings.DYNAMODB_TABLE_USERS not in tables:
            client.create_table(
                TableName=settings.DYNAMODB_TABLE_USERS,
                KeySchema=[{"AttributeName": "email", "KeyType": "HASH"}],
                AttributeDefinitions=[{"AttributeName": "email", "AttributeType": "S"}],
                BillingMode="PAY_PER_REQUEST"
            )
            log.info(f"[UserStore] Created DynamoDB table '{settings.DYNAMODB_TABLE_USERS}'")
        else:
            log.info(f"[UserStore] DynamoDB table '{settings.DYNAMODB_TABLE_USERS}' is ready.")
    except Exception as e:
        log.warning(f"[UserStore] Could not connect to DynamoDB at {settings.DYNAMODB_ENDPOINT_URL} ({e}); in-memory fallback active.")


class DynamoUserStore:
    """Manages sensitive user credentials, profiles, and roles in DynamoDB."""

    @property
    def table(self):
        try:
            dynamo = get_dynamodb_resource()
            return dynamo.Table(settings.DYNAMODB_TABLE_USERS)
        except Exception as e:
            log.warning(f"[UserStore] Failed to acquire table reference: {e}")
            return None

    def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        clean_email = email.strip().lower()
        t = self.table
        if t:
            try:
                res = t.get_item(Key={"email": clean_email})
                item = res.get("Item")
                if item:
                    return item
            except Exception as e:
                log.warning(f"[UserStore] DynamoDB get_item error for '{clean_email}': {e}")

        return _MEMORY_USERS.get(clean_email)

    def create_user(
        self,
        email: str,
        password: str,
        name: str,
        role: str,
        org_id: Optional[str] = None
    ) -> Dict[str, Any]:
        clean_email = email.strip().lower()
        if self.get_by_email(clean_email):
            raise ValueError(f"User with email '{clean_email}' already exists.")

        user_id = f"usr_{uuid.uuid4().hex[:10]}"
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        hashed = hash_password(password)

        item = {
            "id": user_id,
            "email": clean_email,
            "name": name.strip(),
            "role": role.strip(),
            "org_id": org_id.strip() if org_id else None,
            "hashed_password": hashed,
            "is_active": True,
            "created_at": now
        }

        t = self.table
        if t:
            try:
                t.put_item(
                    Item=item,
                    ConditionExpression="attribute_not_exists(email)"
                )
                return item
            except ClientError as ce:
                if ce.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    raise ValueError(f"User with email '{clean_email}' already exists.")
                log.warning(f"[UserStore] DynamoDB put_item failed ({ce}); saving to memory.")
            except Exception as e:
                log.warning(f"[UserStore] DynamoDB error ({e}); saving to memory.")

        _MEMORY_USERS[clean_email] = item
        return item


user_store = DynamoUserStore()
