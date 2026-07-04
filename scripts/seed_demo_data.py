#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient


def iso_z(value: datetime) -> str:
    return value.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def request_json(
    client: TestClient,
    method: str,
    path: str,
    *,
    payload: dict[str, Any] | None = None,
    expected_statuses: tuple[int, ...] = (200, 201),
) -> Any:
    response = client.request(method, f"/api/v1{path}", json=payload)
    if response.status_code not in expected_statuses:
        raise RuntimeError(
            f"{method} {path} failed with {response.status_code}: {response.text}"
        )
    if response.status_code == 204:
        return None
    return response.json()


@dataclass(frozen=True)
class SeedContext:
    organization: dict[str, Any]
    published_run: dict[str, Any] | None
    latest_draft_run: dict[str, Any] | None
    sample_template: dict[str, Any] | None
    sample_horizon: dict[str, Any] | None


def ensure_role(
    client: TestClient,
    *,
    code: str,
    name: str,
    description: str,
) -> dict[str, Any]:
    roles: list[dict[str, Any]] = request_json(client, "GET", "/roles")
    for role in roles:
        if role["code"] == code:
            return role
    return request_json(
        client,
        "POST",
        "/roles",
        payload={
            "code": code,
            "name": name,
            "description": description,
        },
    )


def seed_organization(
    client: TestClient,
    *,
    organization_name: str,
    slug: str,
    start_anchor: datetime,
    publish_run: bool,
    role_ids: dict[str, str],
) -> SeedContext:
    org = request_json(
        client,
        "POST",
        "/organizations",
        payload={
            "name": organization_name,
            "slug": slug,
            "organization_type": "utility",
            "status": "active",
        },
    )
    org_id = org["id"]

    locations = [
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/locations",
            payload={
                "name": "Central Depot",
                "code": "CENTRAL",
                "location_type": "yard",
                "timezone": "America/New_York",
                "latitude": 40.7128,
                "longitude": -74.0060,
            },
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/locations",
            payload={
                "name": "North District",
                "code": "NORTH",
                "location_type": "district",
                "timezone": "America/New_York",
                "latitude": 40.7891,
                "longitude": -73.9597,
            },
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/locations",
            payload={
                "name": "South District",
                "code": "SOUTH",
                "location_type": "district",
                "timezone": "America/New_York",
                "latitude": 40.6782,
                "longitude": -73.9442,
            },
        ),
    ]

    planning_units = [
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/planning-units",
            payload={"name": "Grid Operations", "unit_type": "team", "status": "active"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/planning-units",
            payload={"name": "Field Service", "unit_type": "team", "status": "active"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/planning-units",
            payload={"name": "Restoration", "unit_type": "team", "status": "active"},
        ),
    ]

    users = [
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/users",
            payload={
                "email": f"planner+{slug}@example.com",
                "display_name": "Casey Planner",
                "status": "active",
                "role_ids": [role_ids["planner"]],
            },
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/users",
            payload={
                "email": f"dispatch+{slug}@example.com",
                "display_name": "Morgan Dispatch",
                "status": "active",
                "role_ids": [role_ids["dispatch_manager"]],
            },
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/users",
            payload={
                "email": f"viewer+{slug}@example.com",
                "display_name": "Riley Viewer",
                "status": "active",
                "role_ids": [role_ids["dispatch_viewer"]],
            },
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/users",
            payload={
                "email": f"manager+{slug}@example.com",
                "display_name": "Jordan Manager",
                "status": "active",
                "role_ids": [role_ids["operations_manager"]],
            },
        ),
    ]

    skills = [
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/skills",
            payload={"code": "electrical", "name": "Electrical", "category": "trade"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/skills",
            payload={"code": "mechanical", "name": "Mechanical", "category": "trade"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/skills",
            payload={"code": "fiber", "name": "Fiber", "category": "network"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/skills",
            payload={"code": "inspection", "name": "Inspection", "category": "compliance"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/skills",
            payload={"code": "traffic", "name": "Traffic Control", "category": "safety"},
        ),
    ]

    certifications = [
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/certifications",
            payload={
                "code": "confined_space",
                "name": "Confined Space",
                "description": "Permit-required confined space entry.",
                "expires": True,
            },
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/certifications",
            payload={
                "code": "hv_switching",
                "name": "HV Switching",
                "description": "High-voltage switching authorization.",
                "expires": True,
            },
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/certifications",
            payload={
                "code": "cdl",
                "name": "Commercial Driver License",
                "description": "Required for heavy equipment operation.",
                "expires": True,
            },
        ),
    ]

    worker_names = [
        "Alex Chen",
        "Taylor Ortiz",
        "Samir Khan",
        "Brooke Patel",
        "Devin Russell",
        "Cameron Price",
        "Nia Hall",
        "Parker Scott",
    ]
    workers: list[dict[str, Any]] = []
    for index, worker_name in enumerate(worker_names):
        location = locations[index % len(locations)]
        unit = planning_units[index % len(planning_units)]
        worker = request_json(
            client,
            "POST",
            f"/organizations/{org_id}/workers",
            payload={
                "worker_code": f"W-{index + 1:03d}",
                "display_name": worker_name,
                "employment_type": "full_time",
                "status": "active",
                "home_location_id": location["id"],
                "home_planning_unit_id": unit["id"],
            },
        )
        workers.append(worker)

        primary_skill = skills[index % len(skills)]
        secondary_skill = skills[(index + 1) % len(skills)]
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/workers/{worker['id']}/skills",
            payload={
                "skill_id": primary_skill["id"],
                "proficiency_level": 4 if index % 3 == 0 else 3,
                "verified": True,
            },
        )
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/workers/{worker['id']}/skills",
            payload={
                "skill_id": secondary_skill["id"],
                "proficiency_level": 3,
                "verified": index % 2 == 0,
            },
        )
        if index % 2 == 0:
            request_json(
                client,
                "POST",
                f"/organizations/{org_id}/workers/{worker['id']}/certifications",
                payload={
                    "certification_id": certifications[index % len(certifications)]["id"],
                    "status": "active",
                    "issued_at": iso_z(start_anchor - timedelta(days=90)),
                    "expires_at": iso_z(start_anchor + timedelta(days=365)),
                },
            )

        calendar = request_json(
            client,
            "POST",
            f"/organizations/{org_id}/workers/{worker['id']}/availability-calendars",
            payload={
                "name": "Primary",
                "timezone": "America/New_York",
                "effective_from": iso_z(start_anchor - timedelta(days=30)),
                "effective_to": iso_z(start_anchor + timedelta(days=90)),
                "status": "active",
            },
        )
        for day_offset in range(5):
            window_start = start_anchor + timedelta(days=day_offset, hours=8)
            window_end = start_anchor + timedelta(days=day_offset, hours=17)
            request_json(
                client,
                "POST",
                f"/organizations/{org_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
                payload={
                    "start_at": iso_z(window_start),
                    "end_at": iso_z(window_end),
                    "availability_type": "available",
                },
            )

        for weekday in range(1, 6):
            shift_template = request_json(
                client,
                "POST",
                f"/organizations/{org_id}/workers/{worker['id']}/shift-templates",
                payload={
                    "name": "Day Shift",
                    "timezone": "America/New_York",
                    "day_of_week": weekday,
                    "start_minute_local": 8 * 60,
                    "end_minute_local": 17 * 60,
                    "effective_from": iso_z(start_anchor - timedelta(days=30)),
                    "effective_to": iso_z(start_anchor + timedelta(days=90)),
                    "status": "active",
                },
            )
            request_json(
                client,
                "POST",
                f"/organizations/{org_id}/workers/{worker['id']}/shift-templates/{shift_template['id']}/break-rules",
                payload={
                    "name": "Lunch",
                    "start_minute_local": 12 * 60,
                    "duration_minutes": 30,
                    "status": "active",
                },
            )

    materials = [
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/materials",
            payload={"sku": "conductor-kit", "name": "Conductor Kit", "unit_of_measure": "kit", "material_type": "electrical"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/materials",
            payload={"sku": "fuse-pack", "name": "Fuse Pack", "unit_of_measure": "pack", "material_type": "electrical"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/materials",
            payload={"sku": "fiber-spool", "name": "Fiber Spool", "unit_of_measure": "roll", "material_type": "network"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/materials",
            payload={"sku": "warning-sign", "name": "Warning Sign", "unit_of_measure": "unit", "material_type": "safety"},
        ),
    ]

    for material in materials:
        for location_index, location in enumerate(locations):
            request_json(
                client,
                "POST",
                f"/organizations/{org_id}/inventory-positions",
                payload={
                    "material_id": material["id"],
                    "location_id": location["id"],
                    "on_hand_quantity": 40 + (location_index * 10),
                    "reserved_quantity": 0,
                },
            )

    equipment_types = [
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/equipment-types",
            payload={"code": "bucket-truck", "name": "Bucket Truck", "category": "vehicle"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/equipment-types",
            payload={"code": "line-tester", "name": "Line Tester", "category": "tool"},
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/equipment-types",
            payload={"code": "fiber-trailer", "name": "Fiber Trailer", "category": "vehicle"},
        ),
    ]

    equipment_units: list[dict[str, Any]] = []
    equipment_counter = 1
    for equipment_type in equipment_types:
        for location in locations:
            equipment = request_json(
                client,
                "POST",
                f"/organizations/{org_id}/equipment",
                payload={
                    "equipment_type_id": equipment_type["id"],
                    "location_id": location["id"],
                    "equipment_code": f"{equipment_type['code'].upper()}-{equipment_counter:03d}",
                    "serial_number": f"SN-{slug.upper()}-{equipment_counter:04d}",
                    "status": "active",
                },
            )
            equipment_units.append(equipment)
            equipment_counter += 1

            calendar = request_json(
                client,
                "POST",
                f"/organizations/{org_id}/equipment/{equipment['id']}/availability-calendars",
                payload={
                    "name": "Primary",
                    "timezone": "America/New_York",
                    "effective_from": iso_z(start_anchor - timedelta(days=30)),
                    "effective_to": iso_z(start_anchor + timedelta(days=90)),
                    "status": "active",
                },
            )
            request_json(
                client,
                "POST",
                f"/organizations/{org_id}/equipment/{equipment['id']}/availability-calendars/{calendar['id']}/windows",
                payload={
                    "start_at": iso_z(start_anchor + timedelta(hours=8)),
                    "end_at": iso_z(start_anchor + timedelta(days=5, hours=17)),
                    "availability_type": "available",
                },
            )

    policies = [
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/service-level-policies",
            payload={
                "name": "Priority Restore",
                "scope": "work_order",
                "target_minutes": 240,
                "description": "High-priority outage restoration.",
                "status": "active",
            },
        ),
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/service-level-policies",
            payload={
                "name": "Standard Maintenance",
                "scope": "work_order",
                "target_minutes": 1440,
                "description": "Routine non-emergency target.",
                "status": "active",
            },
        ),
    ]

    work_orders: list[dict[str, Any]] = []
    for index in range(18):
        location = locations[index % len(locations)]
        unit = planning_units[index % len(planning_units)]
        policy = policies[0] if index % 4 == 0 else policies[1]
        requested_start = start_anchor + timedelta(days=index % 5, hours=8 + ((index * 2) % 8))
        due_at = requested_start + timedelta(hours=2)
        work_order = request_json(
            client,
            "POST",
            f"/organizations/{org_id}/work-orders",
            payload={
                "title": f"Seeded work order {index + 1}",
                "description": "Generated for UI and workflow testing.",
                "status": "open",
                "priority": min(95, 35 + (index * 3)),
                "requested_start_at": iso_z(requested_start),
                "due_at": iso_z(due_at),
                "location_id": location["id"],
                "planning_unit_id": unit["id"],
                "service_level_policy_id": policy["id"],
            },
        )
        work_orders.append(work_order)

        skill = skills[index % len(skills)]
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/work-orders/{work_order['id']}/requirements",
            payload={
                "requirement_type": "skill",
                "reference_id": skill["id"],
                "min_level": 2 if index % 3 else 3,
                "quantity": 2 if index % 5 == 0 else 1,
            },
        )
        if index % 3 == 0:
            certification = certifications[index % len(certifications)]
            request_json(
                client,
                "POST",
                f"/organizations/{org_id}/work-orders/{work_order['id']}/requirements",
                payload={
                    "requirement_type": "certification",
                    "reference_id": certification["id"],
                    "quantity": 1,
                },
            )
        if index % 2 == 0:
            material = materials[index % len(materials)]
            request_json(
                client,
                "POST",
                f"/organizations/{org_id}/work-orders/{work_order['id']}/requirements",
                payload={
                    "requirement_type": "material",
                    "reference_id": material["id"],
                    "quantity": 1 + (index % 3),
                },
            )
        if index % 6 == 1:
            equipment_type = equipment_types[index % len(equipment_types)]
            request_json(
                client,
                "POST",
                f"/organizations/{org_id}/work-orders/{work_order['id']}/requirements",
                payload={
                    "requirement_type": "equipment_type",
                    "reference_id": equipment_type["id"],
                    "quantity": 1,
                },
            )

    for index in range(1, min(8, len(work_orders))):
        request_json(
            client,
            "POST",
            f"/organizations/{org_id}/work-order-dependencies",
            payload={
                "predecessor_work_order_id": work_orders[index - 1]["id"],
                "successor_work_order_id": work_orders[index]["id"],
                "dependency_type": "finish_to_start",
            },
        )

    planning_horizon = request_json(
        client,
        "POST",
        f"/organizations/{org_id}/planning-horizons",
        payload={
            "name": "Seeded Ops Week",
            "description": "Default seeded week for quick planner iteration.",
            "timezone": "America/New_York",
            "start_at": iso_z(start_anchor + timedelta(hours=7)),
            "end_at": iso_z(start_anchor + timedelta(days=5, hours=18)),
            "status": "active",
        },
    )

    sample_template = request_json(
        client,
        "POST",
        f"/organizations/{org_id}/dispatch-queue-templates",
        payload={
            "name": "Published Pending Handoff",
            "description": "Reusable queue for not-started published assignments pending handoff.",
            "assignment_statuses": ["published"],
            "execution_statuses": ["not_started", "blocked"],
            "handoff_statuses": ["pending", "ready"],
            "source_kinds": [],
            "canned_handoff_status": "ready",
            "allowed_role_codes": ["dispatch_manager"],
            "status": "active",
        },
    )

    run_payload = {
        "scenario_name": "seeded-ops-week",
        "planning_horizon_id": planning_horizon["id"],
    }
    initial_run = request_json(
        client,
        "POST",
        f"/organizations/{org_id}/plan-runs",
        payload=run_payload,
    )
    published_run: dict[str, Any] | None = None

    if publish_run:
        if initial_run["status"] == "completed":
            try:
                request_json(
                    client,
                    "POST",
                    f"/organizations/{org_id}/plan-runs/{initial_run['id']}/approve",
                    payload={
                        "actor_name": users[1]["display_name"],
                        "note": "Seeded run approved for dispatch testing.",
                    },
                )
                published_run = request_json(
                    client,
                    "POST",
                    f"/organizations/{org_id}/plan-runs/{initial_run['id']}/publish",
                    payload={"actor_name": users[1]["display_name"]},
                )
            except RuntimeError:
                published_run = None

            if published_run is not None:
                assignments: list[dict[str, Any]] = request_json(
                    client,
                    "GET",
                    f"/organizations/{org_id}/plan-runs/{initial_run['id']}/assignments",
                )
                request_json(
                    client,
                    "POST",
                    f"/organizations/{org_id}/plan-runs/{initial_run['id']}/dispatch-queues",
                    payload={"template_id": sample_template["id"]},
                )
                if assignments:
                    first_assignment = assignments[0]
                    request_json(
                        client,
                        "POST",
                        f"/organizations/{org_id}/plan-runs/{initial_run['id']}/assignments/{first_assignment['id']}/events",
                        payload={
                            "event_type": "started",
                            "occurred_at": iso_z(start_anchor + timedelta(days=1, hours=9)),
                            "actor_name": users[1]["display_name"],
                            "note": "Crew departed depot.",
                        },
                    )
                    request_json(
                        client,
                        "POST",
                        f"/organizations/{org_id}/plan-runs/{initial_run['id']}/assignments/{first_assignment['id']}/events",
                        payload={
                            "event_type": "blocked",
                            "occurred_at": iso_z(start_anchor + timedelta(days=1, hours=10)),
                            "actor_name": users[1]["display_name"],
                            "note": "Temporary access hold for permit check.",
                            "reason_code": "site_access",
                        },
                    )

                    request_json(
                        client,
                        "POST",
                        f"/organizations/{org_id}/plan-runs/{initial_run['id']}/assignments/handoff",
                        payload={
                            "assignment_ids": [item["id"] for item in assignments[: min(4, len(assignments))]],
                            "handoff_status": "ready",
                            "actor_name": users[1]["display_name"],
                            "note": "Seeded bulk handoff state update for UI testing.",
                            "occurred_at": iso_z(start_anchor + timedelta(days=1, hours=11)),
                        },
                    )
                    request_json(
                        client,
                        "POST",
                        (
                            f"/organizations/{org_id}/plan-runs/{initial_run['id']}/dispatch-queue-templates/"
                            f"{sample_template['id']}/apply-action"
                        ),
                        payload={
                            "actor_name": users[1]["display_name"],
                            "actor_user_id": users[1]["id"],
                            "note": "Seeded governed template apply for testing.",
                        },
                    )
        else:
            published_run = None

        latest_draft_run = request_json(
            client,
            "POST",
            f"/organizations/{org_id}/plan-runs/{initial_run['id']}/rerun",
        )
    else:
        latest_draft_run = initial_run

    return SeedContext(
        organization=org,
        published_run=published_run,
        latest_draft_run=latest_draft_run,
        sample_template=sample_template,
        sample_horizon=planning_horizon,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed demo organizations and planning data.")
    parser.add_argument(
        "--database-url",
        default="sqlite:///./zenith_local.db",
        help="Database URL for API app config (default: sqlite:///./zenith_local.db).",
    )
    parser.add_argument(
        "--suffix",
        default=datetime.now(UTC).strftime("%Y%m%d%H%M%S"),
        help="Slug suffix for seeded organizations (default: current UTC timestamp).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    os.environ["ZENITH_DATABASE_URL"] = args.database_url

    from app.main import create_app

    app = create_app()
    seed_anchor = datetime(2026, 4, 7, 0, 0, tzinfo=UTC)

    with TestClient(app) as client:
        role_ids = {
            "planner": ensure_role(
                client,
                code="planner",
                name="Planner",
                description="Can manage planning and scenario workflows.",
            )["id"],
            "dispatch_manager": ensure_role(
                client,
                code="dispatch_manager",
                name="Dispatch Manager",
                description="Can execute governed queue and dispatch actions.",
            )["id"],
            "dispatch_viewer": ensure_role(
                client,
                code="dispatch_viewer",
                name="Dispatch Viewer",
                description="Can review queue state without apply permissions.",
            )["id"],
            "operations_manager": ensure_role(
                client,
                code="operations_manager",
                name="Operations Manager",
                description="Can review analytics and operational performance.",
            )["id"],
        }

        seeded_orgs = [
            seed_organization(
                client,
                organization_name=f"MetroGrid Utilities Demo ({args.suffix})",
                slug=f"metrogrid-demo-{args.suffix}",
                start_anchor=seed_anchor,
                publish_run=True,
                role_ids=role_ids,
            ),
            seed_organization(
                client,
                organization_name=f"Harbor Transit Field Ops Demo ({args.suffix})",
                slug=f"harbor-ops-demo-{args.suffix}",
                start_anchor=seed_anchor + timedelta(days=2),
                publish_run=False,
                role_ids=role_ids,
            ),
        ]

    print()
    print("Seed completed.")
    for seeded in seeded_orgs:
        org = seeded.organization
        org_id = org["id"]
        print(f"- {org['name']}")
        print(f"  org_id: {org_id}")
        print(f"  slug: {org['slug']}")
        print(f"  overview: /orgs/{org_id}/overview")
        print(f"  planner run: /orgs/{org_id}/planning/run")
        print(f"  planner results: /orgs/{org_id}/planning/results")
        print(f"  reports: /orgs/{org_id}/planning/reports")
        if seeded.published_run is not None:
            print(f"  published_run_id: {seeded.published_run['id']}")
        if seeded.latest_draft_run is not None:
            print(f"  latest_draft_run_id: {seeded.latest_draft_run['id']}")
        if seeded.sample_template is not None:
            print(f"  dispatch_template_id: {seeded.sample_template['id']}")
        if seeded.sample_horizon is not None:
            print(f"  planning_horizon_id: {seeded.sample_horizon['id']}")
        print()


if __name__ == "__main__":
    main()
