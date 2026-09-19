import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
import boto3
from boto3.dynamodb.conditions import Key
from server.config import settings

log = logging.getLogger("greenphoenix.translation_store")


import os


def _get_dynamodb_kwargs():
    endpoint = (settings.DYNAMODB_ENDPOINT_URL or "").strip()
    is_local = bool(
        endpoint
        and any(h in endpoint.lower() for h in ["localhost", "127.0.0.1", "dynamodb-local", "8001"])
    )

    ak = (settings.AWS_ACCESS_KEY_ID or "").strip()
    sk = (settings.AWS_SECRET_ACCESS_KEY or "").strip()
    token = (getattr(settings, "AWS_SESSION_TOKEN", None) or os.getenv("AWS_SESSION_TOKEN", "")).strip()

    if is_local and not (ak and not ak.startswith("local")):
        return {
            "endpoint_url": endpoint,
            "region_name": settings.DYNAMODB_REGION,
            "aws_access_key_id": "local",
            "aws_secret_access_key": "local",
        }

    kwargs = {"region_name": settings.DYNAMODB_REGION}
    if ak and sk:
        kwargs["aws_access_key_id"] = ak
        kwargs["aws_secret_access_key"] = sk
        if token:
            kwargs["aws_session_token"] = token
        elif ak.startswith("AKIA"):
            # Explicitly prevent botocore from attaching stale/invalid security tokens
            # to permanent IAM user credentials
            kwargs["aws_session_token"] = None

    if endpoint and not is_local:
        kwargs["endpoint_url"] = endpoint

    return kwargs


def get_dynamodb_client():
    """Returns low-level boto3 DynamoDB client with appropriate endpoint and credentials."""
    kwargs = _get_dynamodb_kwargs()
    return boto3.client("dynamodb", **kwargs)


def get_dynamodb_resource():
    """Returns high-level boto3 DynamoDB resource with appropriate endpoint and credentials."""
    kwargs = _get_dynamodb_kwargs()
    return boto3.resource("dynamodb", **kwargs)


def ensure_translations_table():
    """Idempotently ensures the DynamoDB translations table exists."""
    client = get_dynamodb_client()
    try:
        tables = client.list_tables().get("TableNames", [])
        if settings.DYNAMODB_TABLE_TRANSLATIONS not in tables:
            client.create_table(
                TableName=settings.DYNAMODB_TABLE_TRANSLATIONS,
                KeySchema=[
                    {"AttributeName": "lang", "KeyType": "HASH"},
                    {"AttributeName": "text", "KeyType": "RANGE"},
                ],
                AttributeDefinitions=[
                    {"AttributeName": "lang", "AttributeType": "S"},
                    {"AttributeName": "text", "AttributeType": "S"},
                ],
                BillingMode="PAY_PER_REQUEST",
            )
            log.info(
                f"[TranslationStore] Created DynamoDB table '{settings.DYNAMODB_TABLE_TRANSLATIONS}'"
            )
        else:
            log.info(
                f"[TranslationStore] DynamoDB table '{settings.DYNAMODB_TABLE_TRANSLATIONS}' is ready."
            )
    except Exception as e:
        log.warning(
            f"[TranslationStore] Could not connect to DynamoDB ({e}); in-memory fallback active."
        )


class DynamoTranslationStore:
    """Manages persistent translation storage in DynamoDB."""

    @property
    def table(self):
        try:
            dynamo = get_dynamodb_resource()
            return dynamo.Table(settings.DYNAMODB_TABLE_TRANSLATIONS)
        except Exception as e:
            log.warning(f"[TranslationStore] Failed to acquire table reference: {e}")
            return None

    def get_translations(self, lang: str, texts: List[str]) -> Dict[str, str]:
        """
        Retrieves cached translations for a list of English texts in a target language.
        Uses batch_get_item for efficiency.
        """
        if not texts or not lang:
            return {}

        results: Dict[str, str] = {}
        t = self.table
        if not t:
            return results

        try:
            dynamo = get_dynamodb_resource()
            table_name = settings.DYNAMODB_TABLE_TRANSLATIONS

            # DynamoDB batch_get_item supports up to 100 items per call
            chunk_size = 100
            for i in range(0, len(texts), chunk_size):
                chunk = texts[i : i + chunk_size]
                keys = [{"lang": lang, "text": item} for item in chunk]
                response = dynamo.batch_get_item(
                    RequestItems={
                        table_name: {
                            "Keys": keys,
                            "ProjectionExpression": "#l, #t, translated_text",
                            "ExpressionAttributeNames": {"#l": "lang", "#t": "text"},
                        }
                    }
                )
                items = response.get("Responses", {}).get(table_name, [])
                for it in items:
                    orig_text = it.get("text")
                    trans_text = it.get("translated_text")
                    if orig_text and trans_text:
                        results[orig_text] = trans_text
        except Exception as e:
            log.warning(f"[TranslationStore] batch_get_item error for lang '{lang}': {e}")

        return results

    def get_all_for_language(self, lang: str) -> Dict[str, str]:
        """
        Retrieves the entire persistent translation dictionary for a language.
        Queries the partition key 'lang' efficiently.
        """
        if not lang or lang == "en":
            return {}

        results: Dict[str, str] = {}
        t = self.table
        if not t:
            return results

        try:
            response = t.query(
                KeyConditionExpression=Key("lang").eq(lang),
                ProjectionExpression="#t, translated_text",
                ExpressionAttributeNames={"#t": "text"},
            )
            items = response.get("Items", [])
            for it in items:
                orig_text = it.get("text")
                trans_text = it.get("translated_text")
                if orig_text and trans_text:
                    results[orig_text] = trans_text

            # Handle pagination if more than 1MB of translations
            while "LastEvaluatedKey" in response:
                response = t.query(
                    KeyConditionExpression=Key("lang").eq(lang),
                    ProjectionExpression="#t, translated_text",
                    ExpressionAttributeNames={"#t": "text"},
                    ExclusiveStartKey=response["LastEvaluatedKey"],
                )
                for it in response.get("Items", []):
                    orig_text = it.get("text")
                    trans_text = it.get("translated_text")
                    if orig_text and trans_text:
                        results[orig_text] = trans_text
        except Exception as e:
            log.warning(f"[TranslationStore] query error for lang '{lang}': {e}")

        return results

    def save_translations(self, lang: str, translations: Dict[str, str]) -> int:
        """
        Persists newly translated string pairs to DynamoDB using batch_writer.
        """
        if not translations or not lang:
            return 0

        t = self.table
        if not t:
            return 0

        saved_count = 0
        now = datetime.now(timezone.utc).isoformat()

        try:
            with t.batch_writer() as batch:
                for orig_text, trans_text in translations.items():
                    if orig_text and trans_text:
                        batch.put_item(
                            Item={
                                "lang": lang,
                                "text": orig_text,
                                "translated_text": trans_text,
                                "created_at": now,
                            }
                        )
                        saved_count += 1
            log.info(f"[TranslationStore] Saved {saved_count} items to DynamoDB for lang '{lang}'")
        except Exception as e:
            log.warning(f"[TranslationStore] batch_writer save error for lang '{lang}': {e}")

        return saved_count


translation_store = DynamoTranslationStore()
