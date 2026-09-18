import csv
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

from opensearchpy import OpenSearch, helpers

from server.config import settings
from server.core.embeddings import get_embedding
from server.core.rules_parser import parse_deterministic_rules


def get_opensearch_client() -> OpenSearch:
    return OpenSearch(
        hosts=[settings.OPENSEARCH_HOST],
        http_compress=True,
        use_ssl=False,
        verify_certs=False,
        ssl_assert_hostname=False,
        ssl_show_warn=False,
    )


def setup_indices(client: OpenSearch, recreate: bool = True):
    programs_index = settings.OPENSEARCH_INDEX_PROGRAMS
    audit_index = settings.OPENSEARCH_INDEX_AUDIT
    bias_index = "bias-fairness-reports"

    # 1. Aid Programs Index with k-NN Vector Mapping
    programs_mapping = {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": 100,
                "number_of_shards": 1,
                "number_of_replicas": 0
            }
        },
        "mappings": {
            "properties": {
                "program_id": {"type": "keyword"},
                "name": {
                    "type": "text",
                    "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}
                },
                "organization": {
                    "type": "text",
                    "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}
                },
                "category": {"type": "keyword"},
                "description": {"type": "text"},
                "region": {"type": "keyword"},
                "eligible_household_size_min": {"type": "integer"},
                "eligible_household_size_max": {"type": "integer"},
                "income_threshold": {"type": "text"},
                "other_eligibility_notes": {"type": "text"},
                "eligibility_rules": {
                    "type": "object",
                    "dynamic": True
                },
                "languages_supported": {"type": "keyword"},
                "required_documents": {"type": "text"},
                "application_url": {"type": "keyword"},
                "application_method": {"type": "keyword"},
                "contact_phone": {"type": "keyword"},
                "last_verified_date": {"type": "keyword"},
                "source_url": {"type": "keyword"},
                "description_embedding": {
                    "type": "knn_vector",
                    "dimension": settings.EMBEDDING_DIMENSION,
                    "method": {
                        "name": "hnsw",
                        "space_type": "cosinesimil",
                        "engine": "lucene",
                        "parameters": {
                            "ef_construction": 128,
                            "m": 16
                        }
                    }
                }
            }
        }
    }

    # 2. Audit Log Index
    audit_mapping = {
        "settings": {
            "index": {
                "number_of_shards": 1,
                "number_of_replicas": 0
            }
        },
        "mappings": {
            "properties": {
                "timestamp": {"type": "date"},
                "session_id": {"type": "keyword"},
                "principal": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "keyword"},
                        "role": {"type": "keyword"},
                        "orgId": {"type": "keyword"}
                    }
                },
                "action": {"type": "keyword"},
                "resource": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "keyword"},
                        "type": {"type": "keyword"},
                        "orgId": {"type": "keyword"}
                    }
                },
                "decision": {"type": "keyword"},
                "details": {"type": "object", "enabled": False} 
            }
        }
    }

    bias_mapping = {
        "settings": {
            "index": {
                "number_of_shards": 1,
                "number_of_replicas": 0
            }
        },
        "mappings": {
            "properties": {
                "timestamp": {"type": "date"},
                "principal": {"type": "object", "dynamic": True},
                "action": {"type": "keyword"},
                "decision": {"type": "keyword"},
                # This explicitly tells OpenSearch to allow ANY fields inside 'details'
                "details": {"type": "object", "dynamic": True} 
            }
        }
    }

    if recreate:
        if client.indices.exists(index=programs_index):
            client.indices.delete(index=programs_index)
            print(f"Deleted existing index: {programs_index}")
        if client.indices.exists(index=audit_index):
            client.indices.delete(index=audit_index)
            print(f"Deleted existing index: {audit_index}")
        if client.indices.exists(index=bias_index):
            client.indices.delete(index=bias_index)
            print(f"Deleted existing index: {bias_index}")

    if not client.indices.exists(index=programs_index):
        client.indices.create(index=programs_index, body=programs_mapping)
        print(f"Created index: {programs_index} with k-NN vector search enabled.")

    if not client.indices.exists(index=audit_index):
        client.indices.create(index=audit_index, body=audit_mapping)
        print(f"Created index: {audit_index}")

    if not client.indices.exists(index=bias_index):
        client.indices.create(index=bias_index, body=bias_mapping)
        print(f"Created index: {bias_index} for bias/fairness audit reports")


def find_csv_path() -> Path:
    raw_path_str = str(settings.CSV_AID_PROGRAMS_PATH or "").strip()
    configured_path = Path(raw_path_str) if raw_path_str else Path("data/aid_programs_populated.csv")

    candidates = [
        configured_path,
        configured_path / "data" / "aid_programs_populated.csv",
        configured_path / "aid_programs_populated.csv",
        Path("data/aid_programs_populated.csv"),
        Path("../data/aid_programs_populated.csv"),
        Path(__file__).resolve().parent.parent.parent.parent / "data" / "aid_programs_populated.csv",
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            return p.resolve()
    raise FileNotFoundError(f"Could not locate aid programs CSV file. Checked candidates from settings: {configured_path}")


def seed_data(client: OpenSearch):
    csv_path = find_csv_path()
    print(f"Reading dataset from: {csv_path.resolve()}")

    programs: List[Dict[str, Any]] = []

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if not row.get("program_id"):
                continue

            # Parse delimited lists
            languages = [lang.strip() for lang in (row.get("languages_supported") or "").split(";") if lang.strip()]
            documents = [doc.strip() for doc in (row.get("required_documents") or "").split(";") if doc.strip()]

            # Parse deterministic rules
            eligibility_rules = parse_deterministic_rules(row)

            # Build semantic representation for dense embedding
            embed_text = f"Program: {row['name']}. Organization: {row['organization']}. Category: {row['category']}. Region: {row['region']}. Description: {row['description']}. Eligibility: {row['income_threshold']}. Notes: {row['other_eligibility_notes']}"
            embedding = get_embedding(embed_text, dimension=settings.EMBEDDING_DIMENSION)

            doc = {
                "_index": settings.OPENSEARCH_INDEX_PROGRAMS,
                "_id": row["program_id"],
                "program_id": row["program_id"],
                "name": row["name"],
                "organization": row.get("organization", ""),
                "category": row.get("category", ""),
                "description": row["description"],
                "region": row.get("region", "nyc"),
                "eligible_household_size_min": int(row["eligible_household_size_min"]) if row.get("eligible_household_size_min") and str(row["eligible_household_size_min"]).strip() else 1,
                "eligible_household_size_max": int(row["eligible_household_size_max"]) if row.get("eligible_household_size_max") and str(row["eligible_household_size_max"]).strip() else None,
                "income_threshold": row.get("income_threshold", ""),
                "other_eligibility_notes": row.get("other_eligibility_notes", ""),
                "eligibility_rules": eligibility_rules,
                "languages_supported": languages,
                "required_documents": documents,
                "application_url": row.get("application_url", ""),
                "application_method": row.get("application_method", "online"),
                "contact_phone": row.get("contact_phone", ""),
                "last_verified_date": row.get("last_verified_date", ""),
                "source_url": row.get("source_url", ""),
                "description_embedding": embedding
            }
            programs.append(doc)

    print(f"Indexing {len(programs)} aid programs into OpenSearch...")
    success_count, failed = helpers.bulk(client, programs, refresh=True)
    print(f"Successfully indexed {success_count} programs! (Failed: {len(failed) if isinstance(failed, list) else 0})")


def verify_search(client: OpenSearch):
    print("\n--- Running Verification Hybrid Search ---")
    query_text = "help paying rent disability benefits brooklyn"
    query_vector = get_embedding(query_text, dimension=settings.EMBEDDING_DIMENSION)

    search_query = {
        "size": 3,
        "query": {
            "bool": {
                "should": [
                    {
                        "multi_match": {
                            "query": query_text,
                            "fields": ["name^2", "description^2", "other_eligibility_notes", "category"],
                            "boost": 0.4
                        }
                    },
                    {
                        "knn": {
                            "description_embedding": {
                                "vector": query_vector,
                                "k": 3,
                                "boost": 0.6
                            }
                        }
                    }
                ]
            }
        }
    }

    res = client.search(index=settings.OPENSEARCH_INDEX_PROGRAMS, body=search_query)
    hits = res["hits"]["hits"]
    print(f"Found {len(hits)} matching candidate programs for query: '{query_text}':")
    for hit in hits:
        src = hit["_source"]
        score = hit["_score"]
        print(f" • [{score:.4f}] {src['name']} ({src['program_id']}) - Category: {src['category']}")
        print(f"   Rules: max_income=${src['eligibility_rules'].get('max_annual_income')}, disability_req={src['eligibility_rules'].get('requires_disability_benefit')}")


def setup_dashboards_index_patterns():
    """
    Registers 'aid-programs*' and 'audit-log*' index patterns in OpenSearch Dashboards
    so they immediately show up in the Discover UI without manual setup.
    """
    import urllib.request
    import urllib.error

    patterns = [
        {"id": "aid-programs", "title": "aid-programs*", "time_field": None},
        {"id": "audit-log", "title": "audit-log*", "time_field": "timestamp"},
        {"id": "bias-fairness-reports", "title": "bias-fairness-reports*", "time_field": "timestamp"} 
    ]

    for p in patterns:
        url = f"http://localhost:5601/api/saved_objects/index-pattern/{p['id']}"
        payload = {"attributes": {"title": p["title"]}}
        if p["time_field"]:
            payload["attributes"]["timeFieldName"] = p["time_field"]

        req = urllib.request.Request(
            url=url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "osd-xsrf": "true"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req) as resp:
                if resp.status in (200, 201):
                    print(f"Registered OpenSearch Dashboards index pattern: {p['title']}")
        except urllib.error.HTTPError as e:
            if e.code == 409:
                print(f"OpenSearch Dashboards index pattern already exists: {p['title']}")
            else:
                pass
        except Exception:
            # Dashboards may still be booting or offline
            pass


def main():
    client = get_opensearch_client()
    setup_indices(client, recreate=True)
    seed_data(client)
    verify_search(client)
    setup_dashboards_index_patterns()


if __name__ == "__main__":
    main()

