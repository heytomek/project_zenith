from app.main import app
from fastapi.testclient import TestClient


def test_dry_run_plan_returns_assignment_summary() -> None:
    client = TestClient(app)

    response = client.post(
        "/api/v1/plans/dry-run",
        json={
            "scenario_name": "api-test",
            "workers": [
                {
                    "worker_id": "w-1",
                    "display_name": "Morgan",
                    "skill_codes": ["electrical"],
                    "available": True,
                }
            ],
            "work_orders": [
                {
                    "work_order_id": "wo-1",
                    "title": "Repair pump",
                    "required_skill_codes": ["electrical"],
                    "priority": 10,
                }
            ],
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["status"] == "completed"
    assert payload["assignments"][0]["worker_id"] == "w-1"


def test_org_dry_run_plan_projects_database_state(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Planner Org",
            "slug": "planner-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Central Yard",
            "code": "CENTRAL",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Line Crew", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "electrical", "name": "Electrical", "category": "trade"},
    ).json()
    certification = client.post(
        f"/api/v1/organizations/{organization_id}/certifications",
        json={"code": "osha-10", "name": "OSHA 10", "expires": True},
    ).json()
    material = client.post(
        f"/api/v1/organizations/{organization_id}/materials",
        json={
            "sku": "copper-wire",
            "name": "Copper Wire",
            "unit_of_measure": "roll",
            "material_type": "electrical",
        },
    ).json()
    equipment_type = client.post(
        f"/api/v1/organizations/{organization_id}/equipment-types",
        json={"code": "bucket-truck", "name": "Bucket Truck", "category": "vehicle"},
    ).json()
    equipment = client.post(
        f"/api/v1/organizations/{organization_id}/equipment",
        json={
            "equipment_type_id": equipment_type["id"],
            "location_id": location["id"],
            "equipment_code": "EQ-001",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/inventory-positions",
        json={
            "material_id": material["id"],
            "location_id": location["id"],
            "on_hand_quantity": 2,
            "reserved_quantity": 0,
        },
    )

    worker_a = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-001",
            "display_name": "Avery Stone",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    worker_b = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-002",
            "display_name": "Bailey Shaw",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()

    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_a['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_b['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 5, "verified": True},
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_a['id']}/certifications",
        json={
            "certification_id": certification["id"],
            "status": "active",
            "issued_at": "2026-01-01T00:00:00Z",
            "expires_at": "2026-12-31T23:59:59Z",
        },
    )

    calendar_a = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_a['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    calendar_b = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_b['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()

    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_a['id']}/availability-calendars/{calendar_a['id']}/windows",
        json={
            "start_at": "2026-03-10T08:00:00Z",
            "end_at": "2026-03-10T12:00:00Z",
            "availability_type": "available",
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_b['id']}/availability-calendars/{calendar_b['id']}/windows",
        json={
            "start_at": "2026-03-10T13:00:00Z",
            "end_at": "2026-03-10T17:00:00Z",
            "availability_type": "available",
        },
    )
    equipment_calendar = client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars/{equipment_calendar['id']}/windows",
        json={
            "start_at": "2026-03-10T08:00:00Z",
            "end_at": "2026-03-10T12:00:00Z",
            "availability_type": "available",
        },
    )

    policy = client.post(
        f"/api/v1/organizations/{organization_id}/service-level-policies",
        json={
            "name": "Urgent Repairs",
            "scope": "work_order",
            "target_minutes": 240,
            "status": "active",
        },
    ).json()
    work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Repair feeder line",
            "status": "open",
            "priority": 80,
            "requested_start_at": "2026-03-10T09:00:00Z",
            "due_at": "2026-03-10T11:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
            "service_level_policy_id": policy["id"],
        },
    ).json()
    work_order_2 = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Follow-up inspection",
            "status": "open",
            "priority": 40,
            "requested_start_at": "2026-03-10T11:00:00Z",
            "due_at": "2026-03-10T12:00:00Z",
            "location_id": location["id"],
        },
    ).json()

    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 3,
            "quantity": 1,
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "certification",
            "reference_id": certification["id"],
            "quantity": 1,
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "material",
            "reference_id": material["id"],
            "quantity": 1,
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "equipment_type",
            "reference_id": equipment_type["id"],
            "quantity": 1,
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order_2['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 1,
            "quantity": 1,
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order_2['id']}/requirements",
        json={
            "requirement_type": "material",
            "reference_id": material["id"],
            "quantity": 1,
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order_2['id']}/requirements",
        json={
            "requirement_type": "equipment_type",
            "reference_id": equipment_type["id"],
            "quantity": 1,
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/work-order-dependencies",
        json={
            "predecessor_work_order_id": work_order["id"],
            "successor_work_order_id": work_order_2["id"],
            "dependency_type": "finish_to_start",
        },
    )

    response = client.post(
        f"/api/v1/organizations/{organization_id}/plans/dry-run",
        json={
            "scenario_name": "db-connected",
            "window_start": "2026-03-10T08:00:00Z",
            "window_end": "2026-03-10T12:00:00Z",
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["status"] == "completed"
    assert len(payload["assignments"]) == 2
    assert payload["assignments"][0]["worker_id"] == worker_a["id"]
    assert payload["assignments"][0]["work_order_id"] == work_order["id"]
    assert payload["assignments"][1]["worker_id"] == worker_a["id"]
    assert payload["assignments"][1]["work_order_id"] == work_order_2["id"]
    assert payload["assignments"][0]["reserved_material_quantities"] == {"copper-wire": 1}
    assert payload["assignments"][1]["reserved_material_quantities"] == {"copper-wire": 1}
    assert payload["assignments"][0]["reserved_equipment_ids"] == [equipment["id"]]
    assert payload["assignments"][1]["reserved_equipment_ids"] == [equipment["id"]]
    assert payload["assignments"][0]["scheduled_start_at"] == "2026-03-10T09:00:00Z"
    assert payload["assignments"][1]["scheduled_start_at"] == "2026-03-10T11:00:00Z"


def test_org_dry_run_plan_projects_multi_worker_crews(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Crew Org",
            "slug": "crew-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Crew Yard",
            "code": "CREW",
            "location_type": "yard",
            "timezone": "UTC",
            "latitude": 40.0,
            "longitude": -73.0,
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Crew Team", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "electrical", "name": "Electrical", "category": "trade"},
    ).json()

    workers: list[dict[str, str]] = []
    for worker_code, display_name in (("W-301", "Alex Crew"), ("W-302", "Jordan Crew")):
        worker = client.post(
            f"/api/v1/organizations/{organization_id}/workers",
            json={
                "worker_code": worker_code,
                "display_name": display_name,
                "employment_type": "full_time",
                "status": "active",
                "home_location_id": location["id"],
                "home_planning_unit_id": planning_unit["id"],
            },
        ).json()
        workers.append(worker)
        client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
            json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
        )
        calendar = client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
            json={
                "name": "Primary",
                "timezone": "UTC",
                "effective_from": "2026-01-01T00:00:00Z",
                "effective_to": "2026-12-31T23:59:59Z",
                "status": "active",
            },
        ).json()
        client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
            json={
                "start_at": "2026-03-18T08:00:00Z",
                "end_at": "2026-03-18T17:00:00Z",
                "availability_type": "available",
            },
        )

    work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Two-person feeder repair",
            "status": "open",
            "priority": 70,
            "requested_start_at": "2026-03-18T09:00:00Z",
            "due_at": "2026-03-18T11:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 2,
            "quantity": 2,
        },
    )

    response = client.post(
        f"/api/v1/organizations/{organization_id}/plans/dry-run",
        json={
            "scenario_name": "crew-dry-run",
            "window_start": "2026-03-18T08:00:00Z",
            "window_end": "2026-03-18T17:00:00Z",
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["status"] == "completed"
    assert len(payload["assignments"]) == 1
    assert payload["assignments"][0]["crew_size_required"] == 2
    assert set(payload["assignments"][0]["crew_worker_ids"]) == {workers[0]["id"], workers[1]["id"]}
    assert payload["assignments"][0]["estimated_travel_minutes"] == 0


def test_plan_scenarios_and_runs_are_persisted(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Scenario Org",
            "slug": "scenario-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "North Yard",
            "code": "NORTH",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Ops Team", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "mechanical", "name": "Mechanical", "category": "trade"},
    ).json()
    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-100",
            "display_name": "Jordan Vale",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 3, "verified": True},
    )
    calendar = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
        json={
            "start_at": "2026-03-12T08:00:00Z",
            "end_at": "2026-03-12T12:00:00Z",
            "availability_type": "available",
        },
    )
    work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Inspect cooling system",
            "status": "open",
            "priority": 60,
            "requested_start_at": "2026-03-12T09:00:00Z",
            "due_at": "2026-03-12T11:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 2,
            "quantity": 1,
        },
    )

    scenario_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-scenarios",
        json={
            "name": "Week 11 Draft",
            "description": "Baseline weekly maintenance scope.",
            "status": "active",
            "planning_request": {
                "scenario_name": "week-11-draft",
                "worker_ids": [],
                "work_order_ids": [],
                "location_ids": [location["id"]],
                "planning_unit_ids": [planning_unit["id"]],
                "worker_statuses": ["active"],
                "work_order_statuses": ["open"],
                "window_start": "2026-03-12T08:00:00Z",
                "window_end": "2026-03-12T12:00:00Z",
            },
        },
    )

    assert scenario_response.status_code == 201
    scenario = scenario_response.json()
    assert scenario["name"] == "Week 11 Draft"

    run_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_id": scenario["id"],
            "scenario_name": "ad-hoc-ignored-when-scenario-is-linked",
            "worker_ids": [],
            "work_order_ids": [],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
            "window_start": "2026-03-12T08:00:00Z",
            "window_end": "2026-03-12T12:00:00Z",
        },
    )

    assert run_response.status_code == 201
    run = run_response.json()
    assert run["scenario_id"] == scenario["id"]
    assert run["scenario_name"] == scenario["name"]
    assert run["summary"]["status"] == "completed"
    assert run["summary"]["assignments"][0]["worker_id"] == worker["id"]
    assert run["summary"]["assignments"][0]["work_order_id"] == work_order["id"]

    latest_response = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/latest"
    )
    latest_run = latest_response.json()

    assert latest_response.status_code == 200
    assert latest_run["id"] == run["id"]

    scenarios_index = client.get(f"/api/v1/organizations/{organization_id}/plan-scenarios")
    runs_index = client.get(f"/api/v1/organizations/{organization_id}/plan-runs")

    assert scenarios_index.status_code == 200
    assert len(scenarios_index.json()) == 1
    assert runs_index.status_code == 200
    assert runs_index.json()[0]["id"] == run["id"]


def test_plan_run_comparison_reports_assignment_and_unassigned_deltas(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Compare Org",
            "slug": "compare-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "West Yard",
            "code": "WEST",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Field Team", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "electrical", "name": "Electrical", "category": "trade"},
    ).json()
    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-200",
            "display_name": "Parker Ives",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
    )
    calendar = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
        json={
            "start_at": "2026-03-15T08:00:00Z",
            "end_at": "2026-03-15T12:00:00Z",
            "availability_type": "available",
        },
    )
    work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Repair switchboard",
            "status": "open",
            "priority": 75,
            "requested_start_at": "2026-03-15T09:00:00Z",
            "due_at": "2026-03-15T11:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 2,
            "quantity": 1,
        },
    )

    baseline_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "baseline",
            "worker_ids": [],
            "work_order_ids": [],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
            "window_start": "2026-03-15T08:00:00Z",
            "window_end": "2026-03-15T12:00:00Z",
            "scenario_id": None,
        },
    ).json()

    client.patch(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}",
        json={"status": "inactive"},
    )

    candidate_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "candidate",
            "worker_ids": [],
            "work_order_ids": [],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
            "window_start": "2026-03-15T08:00:00Z",
            "window_end": "2026-03-15T12:00:00Z",
            "scenario_id": None,
        },
    ).json()

    response = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/compare",
        params={
            "baseline_run_id": baseline_run["id"],
            "candidate_run_id": candidate_run["id"],
        },
    )

    payload = response.json()

    assert response.status_code == 200
    assert payload["baseline_run"]["id"] == baseline_run["id"]
    assert payload["candidate_run"]["id"] == candidate_run["id"]
    assert payload["summary"]["assignments_before"] == 1
    assert payload["summary"]["assignments_after"] == 0
    assert payload["summary"]["newly_unassigned_work_orders"] == 1
    assert payload["assignment_changes"][0]["change_type"] == "removed"
    assert payload["assignment_changes"][0]["work_order_id"] == work_order["id"]
    assert payload["assignment_changes"][0]["work_order_title"] == "Repair switchboard"
    assert payload["unassigned_changes"][0]["change_type"] == "added"
    assert payload["unassigned_changes"][0]["candidate_reason"] == (
        "No available worker satisfies the required skills, certifications, and schedule."
    )
    assert any(
        change["message"] == "No workers were supplied to the planner."
        and change["change_type"] == "added"
        for change in payload["issue_changes"]
    )


def test_plan_scenario_clone_creates_unique_copy_names(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Scenario Clone Org",
            "slug": "scenario-clone-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "North Yard",
            "code": "NORTH",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Ops Team", "unit_type": "team"},
    ).json()

    scenario = client.post(
        f"/api/v1/organizations/{organization_id}/plan-scenarios",
        json={
            "name": "Week 13 Plan",
            "description": "Base planning scope.",
            "notes": "Base branch for the week 13 maintenance cycle.",
            "labels": ["weekly", "maintenance"],
            "status": "active",
            "planning_request": {
                "scenario_name": "week-13-plan",
                "worker_ids": [],
                "work_order_ids": [],
                "location_ids": [location["id"]],
                "planning_unit_ids": [planning_unit["id"]],
                "worker_statuses": ["active"],
                "work_order_statuses": ["open"],
                "window_start": "2026-03-18T08:00:00Z",
                "window_end": "2026-03-18T12:00:00Z",
            },
        },
    ).json()

    clone_one_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-scenarios/{scenario['id']}/clone"
    )
    clone_two_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-scenarios/{scenario['id']}/clone"
    )

    clone_one = clone_one_response.json()
    clone_two = clone_two_response.json()

    assert clone_one_response.status_code == 201
    assert clone_two_response.status_code == 201
    assert clone_one["name"] == "Week 13 Plan Copy"
    assert clone_one["description"] == "Base planning scope."
    assert clone_one["notes"] == "Base branch for the week 13 maintenance cycle."
    assert clone_one["labels"] == ["weekly", "maintenance"]
    assert clone_one["scenario_type"] == "cloned"
    assert clone_one["base_scenario_id"] == scenario["id"]
    assert clone_one["source_run_id"] is None
    assert clone_one["planning_request"]["scenario_name"] == "Week 13 Plan Copy"
    assert clone_two["name"] == "Week 13 Plan Copy 2"
    assert clone_two["scenario_type"] == "cloned"
    assert clone_two["base_scenario_id"] == scenario["id"]
    assert clone_two["planning_request"]["scenario_name"] == "Week 13 Plan Copy 2"


def test_plan_run_rerun_and_save_scenario_actions(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Plan Actions Org",
            "slug": "plan-actions-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Central Yard",
            "code": "CENTRAL",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Line Crew", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "hvac", "name": "HVAC", "category": "trade"},
    ).json()
    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-310",
            "display_name": "Casey Wynn",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
    )
    calendar = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
        json={
            "start_at": "2026-03-20T08:00:00Z",
            "end_at": "2026-03-20T12:00:00Z",
            "availability_type": "available",
        },
    )
    work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Inspect vents",
            "status": "open",
            "priority": 55,
            "requested_start_at": "2026-03-20T09:00:00Z",
            "due_at": "2026-03-20T11:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 2,
            "quantity": 1,
        },
    )

    scenario = client.post(
        f"/api/v1/organizations/{organization_id}/plan-scenarios",
        json={
            "name": "Facility Draft",
            "description": "Original saved scenario.",
            "notes": "Initial facility branch.",
            "labels": ["facility", "baseline"],
            "status": "active",
            "planning_request": {
                "scenario_name": "facility-draft",
                "worker_ids": [],
                "work_order_ids": [],
                "location_ids": [location["id"]],
                "planning_unit_ids": [planning_unit["id"]],
                "worker_statuses": ["active"],
                "work_order_statuses": ["open"],
                "window_start": "2026-03-20T08:00:00Z",
                "window_end": "2026-03-20T12:00:00Z",
            },
        },
    ).json()

    run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_id": scenario["id"],
            "scenario_name": "ignored-when-linked",
            "worker_ids": [],
            "work_order_ids": [],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
            "window_start": "2026-03-20T08:00:00Z",
            "window_end": "2026-03-20T12:00:00Z",
        },
    ).json()

    rerun_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/rerun"
    )
    scenario_from_run_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/save-scenario"
    )

    rerun = rerun_response.json()
    scenario_from_run = scenario_from_run_response.json()

    assert rerun_response.status_code == 201
    assert rerun["id"] != run["id"]
    assert rerun["scenario_id"] == run["scenario_id"]
    assert rerun["scenario_name"] == run["scenario_name"]
    assert rerun["planning_request"] == run["planning_request"]
    assert rerun["summary"]["assignments"][0]["work_order_id"] == work_order["id"]

    assert scenario_from_run_response.status_code == 201
    assert scenario_from_run["name"] == "Facility Draft Copy"
    assert scenario_from_run["description"] == "Original saved scenario."
    assert scenario_from_run["notes"] == "Initial facility branch."
    assert scenario_from_run["labels"] == ["facility", "baseline"]
    assert scenario_from_run["scenario_type"] == "from_run"
    assert scenario_from_run["base_scenario_id"] == scenario["id"]
    assert scenario_from_run["source_run_id"] == run["id"]
    assert scenario_from_run["planning_request"]["location_ids"] == [location["id"]]
    assert scenario_from_run["planning_request"]["planning_unit_ids"] == [planning_unit["id"]]
    assert scenario_from_run["planning_request"]["scenario_name"] == "Facility Draft Copy"


def test_plan_run_override_approval_and_publication_flow(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Execution Org",
            "slug": "execution-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "South Yard",
            "code": "SOUTH",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Repair Team", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "mechanical", "name": "Mechanical", "category": "trade"},
    ).json()

    worker_one = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-401",
            "display_name": "Avery Lake",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    worker_two = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-402",
            "display_name": "Morgan Hale",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()

    for worker in (worker_one, worker_two):
        client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
            json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
        )
        calendar = client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
            json={
                "name": "Primary",
                "timezone": "UTC",
                "effective_from": "2026-01-01T00:00:00Z",
                "effective_to": "2026-12-31T23:59:59Z",
                "status": "active",
            },
        ).json()
        client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
            json={
                "start_at": "2026-03-25T08:00:00Z",
                "end_at": "2026-03-25T12:00:00Z",
                "availability_type": "available",
            },
        )

    work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Repair gate motor",
            "status": "open",
            "priority": 65,
            "requested_start_at": "2026-03-25T09:00:00Z",
            "due_at": "2026-03-25T11:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 2,
            "quantity": 1,
        },
    )

    run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "execution-draft",
            "worker_ids": [],
            "work_order_ids": [],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
            "window_start": "2026-03-25T08:00:00Z",
            "window_end": "2026-03-25T12:00:00Z",
            "scenario_id": None,
        },
    ).json()

    assignments_response = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments"
    )
    assignment = assignments_response.json()[0]

    override_response = client.patch(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}",
        json={
            "worker_id": worker_two["id"],
            "scheduled_start_at": "2026-03-25T09:00:00Z",
            "scheduled_end_at": "2026-03-25T11:00:00Z",
            "override_reason": "Balance the field workload across qualified mechanics.",
            "override_note": "Moved to Morgan after dispatcher review.",
            "actor_name": "planner-1",
        },
    )
    overridden_assignment = override_response.json()

    assert assignments_response.status_code == 200
    assert override_response.status_code == 200
    assert overridden_assignment["worker_id"] == worker_two["id"]
    assert overridden_assignment["source_kind"] == "manual_override"
    assert overridden_assignment["override_reason"] == (
        "Balance the field workload across qualified mechanics."
    )

    run_after_override = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}"
    ).json()
    assert run_after_override["review_status"] == "draft"
    assert run_after_override["summary"]["assignments"][0]["worker_id"] == worker_two["id"]

    approval_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/approve",
        json={"actor_name": "planner-1", "note": "Ready for dispatch."},
    )
    approved_run = approval_response.json()

    assert approval_response.status_code == 200
    assert approved_run["review_status"] == "approved"
    assert approved_run["approval_note"] == "Ready for dispatch."

    publish_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/publish",
        json={"actor_name": "dispatcher-1", "published_at": "2026-03-25T08:50:00Z"},
    )
    published_run = publish_response.json()

    assert publish_response.status_code == 200
    assert published_run["publication_status"] == "published"
    assert published_run["published_by_name"] == "dispatcher-1"

    published_assignments = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments"
    ).json()
    assert published_assignments[0]["assignment_status"] == "published"
    assert published_assignments[0]["execution_status"] == "not_started"

    blocked_before_publish = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/events",
        json={
            "event_type": "blocked",
            "occurred_at": "2026-03-25T08:55:00Z",
            "actor_name": "dispatcher-1",
            "reason_code": "site_access",
            "note": "Crew waiting on access clearance.",
        },
    )
    assert blocked_before_publish.status_code == 201

    restart_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/events",
        json={
            "event_type": "started",
            "occurred_at": "2026-03-25T09:05:00Z",
            "actor_name": "dispatcher-1",
        },
    )
    complete_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/events",
        json={
            "event_type": "completed",
            "occurred_at": "2026-03-25T11:20:00Z",
            "actor_name": "dispatcher-1",
        },
    )
    execution_events_response = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/events"
    )
    actuals_review_response = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/actuals-review"
    )
    assignment_after_execution = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments"
    ).json()[0]
    actuals_review = actuals_review_response.json()

    assert restart_response.status_code == 201
    assert restart_response.json()["event_type"] == "started"
    assert complete_response.status_code == 201
    assert complete_response.json()["event_type"] == "completed"
    assert execution_events_response.status_code == 200
    assert actuals_review_response.status_code == 200
    assert [event["event_type"] for event in execution_events_response.json()] == [
        "blocked",
        "started",
        "completed",
    ]
    assert assignment_after_execution["execution_status"] == "completed"
    assert assignment_after_execution["actual_start_at"] == "2026-03-25T09:05:00"
    assert assignment_after_execution["actual_end_at"] == "2026-03-25T11:20:00"
    assert assignment_after_execution["actual_duration_minutes"] == 135
    assert actuals_review["summary"]["assignments_total"] == 1
    assert actuals_review["summary"]["assignments_completed"] == 1
    assert actuals_review["summary"]["assignments_blocked"] == 0
    assert actuals_review["summary"]["delayed_start_count"] == 1
    assert actuals_review["summary"]["overdue_completion_count"] == 1
    assert actuals_review["summary"]["blocked_event_count"] == 1
    assert actuals_review["summary"]["total_duration_variance_minutes"] == 15
    assert actuals_review["blocked_reason_counts"] == [
        {"reason_code": "site_access", "count": 1}
    ]
    assert actuals_review["worker_breakdown"][0]["label"] == "Morgan Hale"
    assert actuals_review["worker_breakdown"][0]["assignments_completed"] == 1
    assert actuals_review["location_breakdown"][0]["label"] == "South Yard"
    assert actuals_review["location_breakdown"][0]["blocked_event_count"] == 1
    assert actuals_review["work_type_breakdown"][0]["label"] == "Repair Team"
    assert actuals_review["work_type_breakdown"][0]["total_duration_variance_minutes"] == 15
    assert actuals_review["items"][0]["start_variance_minutes"] == 5
    assert actuals_review["items"][0]["completion_variance_minutes"] == 20
    assert actuals_review["items"][0]["duration_variance_minutes"] == 15
    assert actuals_review["items"][0]["latest_event_type"] == "completed"

    blocked_override = client.patch(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}",
        json={
            "worker_id": worker_one["id"],
            "scheduled_start_at": "2026-03-25T09:00:00Z",
            "scheduled_end_at": "2026-03-25T11:00:00Z",
            "override_reason": "Too late after publication.",
            "actor_name": "planner-2",
        },
    )
    blocked_execution_after_completion = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/events",
        json={
            "event_type": "blocked",
            "occurred_at": "2026-03-25T11:30:00Z",
            "actor_name": "dispatcher-2",
            "reason_code": "other",
            "note": "Should be rejected because work is already complete.",
        },
    )
    assert blocked_override.status_code == 409
    assert blocked_execution_after_completion.status_code == 409


def test_published_assignment_reassignment_and_cancellation_flow(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Published Ops Org",
            "slug": "published-ops-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Dispatch Yard",
            "code": "DISPATCH",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Dispatch Crew", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "mechanical", "name": "Mechanical", "category": "trade"},
    ).json()
    material = client.post(
        f"/api/v1/organizations/{organization_id}/materials",
        json={
            "sku": "filter-kit",
            "name": "Filter Kit",
            "unit_of_measure": "kit",
            "material_type": "maintenance",
        },
    ).json()
    equipment_type = client.post(
        f"/api/v1/organizations/{organization_id}/equipment-types",
        json={"code": "service-van", "name": "Service Van", "category": "vehicle"},
    ).json()
    equipment = client.post(
        f"/api/v1/organizations/{organization_id}/equipment",
        json={
            "equipment_type_id": equipment_type["id"],
            "location_id": location["id"],
            "equipment_code": "VAN-01",
        },
    ).json()
    inventory = client.post(
        f"/api/v1/organizations/{organization_id}/inventory-positions",
        json={
            "material_id": material["id"],
            "location_id": location["id"],
            "on_hand_quantity": 2,
            "reserved_quantity": 0,
        },
    ).json()

    workers: list[dict[str, str]] = []
    for worker_code, display_name in (("W-401", "Robin Flux"), ("W-402", "Jules Hart")):
        worker = client.post(
            f"/api/v1/organizations/{organization_id}/workers",
            json={
                "worker_code": worker_code,
                "display_name": display_name,
                "employment_type": "full_time",
                "status": "active",
                "home_location_id": location["id"],
                "home_planning_unit_id": planning_unit["id"],
            },
        ).json()
        workers.append(worker)
        client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
            json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
        )
        calendar = client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
            json={
                "name": "Primary",
                "timezone": "UTC",
                "effective_from": "2026-01-01T00:00:00Z",
                "effective_to": "2026-12-31T23:59:59Z",
                "status": "active",
            },
        ).json()
        client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
            json={
                "start_at": "2026-03-28T08:00:00Z",
                "end_at": "2026-03-28T17:00:00Z",
                "availability_type": "available",
            },
        )

    equipment_calendar = client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars/{equipment_calendar['id']}/windows",
        json={
            "start_at": "2026-03-28T08:00:00Z",
            "end_at": "2026-03-28T17:00:00Z",
            "availability_type": "available",
        },
    )

    def create_work_order(title: str, *, include_resources: bool = True) -> dict[str, str]:
        work_order = client.post(
            f"/api/v1/organizations/{organization_id}/work-orders",
            json={
                "title": title,
                "status": "open",
                "priority": 70,
                "requested_start_at": "2026-03-28T09:00:00Z",
                "due_at": "2026-03-28T11:00:00Z",
                "location_id": location["id"],
                "planning_unit_id": planning_unit["id"],
            },
        ).json()
        client.post(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
            json={
                "requirement_type": "skill",
                "reference_id": skill["id"],
                "min_level": 2,
                "quantity": 1,
            },
        )
        if include_resources:
            client.post(
                f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
                json={
                    "requirement_type": "material",
                    "reference_id": material["id"],
                    "quantity": 1,
                },
            )
            client.post(
                f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
                json={
                    "requirement_type": "equipment_type",
                    "reference_id": equipment_type["id"],
                    "quantity": 1,
                },
            )
        return work_order

    create_work_order("Published maintenance visit")
    run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "published-maintenance",
            "window_start": "2026-03-28T08:00:00Z",
            "window_end": "2026-03-28T17:00:00Z",
        },
    ).json()
    assignment = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments"
    ).json()[0]
    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/approve",
        json={"actor_name": "dispatch-lead", "note": "Ready to dispatch."},
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/publish",
        json={"actor_name": "dispatch-lead"},
    )

    reassign_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/reassign",
        json={
            "worker_id": workers[1]["id"],
            "reason": "Primary technician called out sick.",
            "note": "Move the stop to the backup mechanic.",
            "actor_name": "dispatcher-2",
        },
    )
    reassigned_assignment = reassign_response.json()

    assert reassign_response.status_code == 200
    assert reassigned_assignment["worker_id"] == workers[1]["id"]
    assert reassigned_assignment["source_kind"] == "published_reassignment"
    assert reassigned_assignment["assignment_status"] == "published"
    assert reassigned_assignment["execution_status"] == "not_started"

    events_after_reassign = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/events"
    ).json()
    assert events_after_reassign[-1]["event_type"] == "reassigned"

    follow_up_work_order = create_work_order("Follow-up visit", include_resources=False)
    worker_one_available_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "worker-one-free",
            "worker_ids": [workers[0]["id"]],
            "work_order_ids": [follow_up_work_order["id"]],
            "window_start": "2026-03-28T08:00:00Z",
            "window_end": "2026-03-28T17:00:00Z",
        },
    ).json()
    worker_two_blocked_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "worker-two-blocked",
            "worker_ids": [workers[1]["id"]],
            "work_order_ids": [follow_up_work_order["id"]],
            "window_start": "2026-03-28T08:00:00Z",
            "window_end": "2026-03-28T17:00:00Z",
        },
    ).json()

    assert worker_one_available_run["summary"]["assignments"][0]["worker_id"] == workers[0]["id"]
    assert worker_two_blocked_run["summary"]["assignments"] == []

    cancel_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/cancel",
        json={
            "reason": "Customer deferred the stop.",
            "note": "Release the crew and hold the scope for the next cycle.",
            "actor_name": "dispatcher-2",
        },
    )
    cancelled_assignment = cancel_response.json()

    assert cancel_response.status_code == 200
    assert cancelled_assignment["assignment_status"] == "cancelled"
    assert cancelled_assignment["execution_status"] == "cancelled"

    events_after_cancel = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/events"
    ).json()
    assert events_after_cancel[-1]["event_type"] == "cancelled"

    inventory_after_cancel = client.get(
        f"/api/v1/organizations/{organization_id}/inventory-positions/{inventory['id']}"
    ).json()
    assert inventory_after_cancel["reserved_quantity"] == 0
    assert inventory_after_cancel["on_hand_quantity"] == 2

    worker_two_after_cancel_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "worker-two-after-cancel",
            "worker_ids": [workers[1]["id"]],
            "work_order_ids": [follow_up_work_order["id"]],
            "window_start": "2026-03-28T08:00:00Z",
            "window_end": "2026-03-28T17:00:00Z",
        },
    ).json()

    assert worker_two_after_cancel_run["summary"]["assignments"][0]["worker_id"] == workers[1]["id"]


def test_crew_override_and_published_reassignment_flow(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Crew Dispatch Org",
            "slug": "crew-dispatch-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Crew Dispatch Yard",
            "code": "CRWDSP",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Crew Dispatch Team", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "electrical", "name": "Electrical", "category": "trade"},
    ).json()

    workers: list[dict[str, str]] = []
    for worker_code, display_name in (
        ("W-511", "Alex One"),
        ("W-512", "Blake Two"),
        ("W-513", "Casey Three"),
    ):
        worker = client.post(
            f"/api/v1/organizations/{organization_id}/workers",
            json={
                "worker_code": worker_code,
                "display_name": display_name,
                "employment_type": "full_time",
                "status": "active",
                "home_location_id": location["id"],
                "home_planning_unit_id": planning_unit["id"],
            },
        ).json()
        workers.append(worker)
        client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
            json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
        )
        calendar = client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
            json={
                "name": "Primary",
                "timezone": "UTC",
                "effective_from": "2026-01-01T00:00:00Z",
                "effective_to": "2026-12-31T23:59:59Z",
                "status": "active",
            },
        ).json()
        client.post(
            f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
            json={
                "start_at": "2026-03-29T08:00:00Z",
                "end_at": "2026-03-29T17:00:00Z",
                "availability_type": "available",
            },
        )

    work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Two-person feeder repair",
            "status": "open",
            "priority": 80,
            "requested_start_at": "2026-03-29T09:00:00Z",
            "due_at": "2026-03-29T11:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 2,
            "quantity": 2,
        },
    )

    run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "crew-dispatch",
            "window_start": "2026-03-29T08:00:00Z",
            "window_end": "2026-03-29T17:00:00Z",
        },
    ).json()
    assignment = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments"
    ).json()[0]
    assert assignment["crew_size_required"] == 2

    invalid_override_response = client.patch(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}",
        json={
            "worker_id": workers[2]["id"],
            "crew_worker_ids": [workers[2]["id"]],
            "scheduled_start_at": "2026-03-29T09:00:00Z",
            "scheduled_end_at": "2026-03-29T11:00:00Z",
            "override_reason": "Invalid crew size test.",
            "actor_name": "dispatcher-a",
        },
    )
    assert invalid_override_response.status_code == 422
    assert "requires a crew of 2 workers" in invalid_override_response.json()["detail"]

    override_response = client.patch(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}",
        json={
            "worker_id": workers[2]["id"],
            "crew_worker_ids": [workers[2]["id"], workers[1]["id"]],
            "scheduled_start_at": "2026-03-29T09:00:00Z",
            "scheduled_end_at": "2026-03-29T11:00:00Z",
            "override_reason": "Shift lead to the specialized technician.",
            "override_note": "Crew changed during dispatch review.",
            "actor_name": "dispatcher-a",
        },
    )
    overridden_assignment = override_response.json()

    assert override_response.status_code == 200
    assert overridden_assignment["worker_id"] == workers[2]["id"]
    assert set(overridden_assignment["crew_worker_ids"]) == {workers[1]["id"], workers[2]["id"]}
    assert overridden_assignment["source_kind"] == "manual_override"

    run_after_override = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}"
    ).json()
    assert run_after_override["summary"]["assignments"][0]["worker_id"] == workers[2]["id"]
    assert set(run_after_override["summary"]["assignments"][0]["crew_worker_ids"]) == {
        workers[1]["id"],
        workers[2]["id"],
    }

    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/approve",
        json={"actor_name": "dispatcher-a", "note": "Crew dispatch approved."},
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/publish",
        json={"actor_name": "dispatcher-a"},
    )

    reassign_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/reassign",
        json={
            "worker_id": workers[0]["id"],
            "crew_worker_ids": [workers[0]["id"], workers[1]["id"]],
            "reason": "Update field lead and partner for this stop.",
            "note": "Crew changed before any field execution started.",
            "actor_name": "dispatcher-b",
        },
    )
    reassigned_assignment = reassign_response.json()

    assert reassign_response.status_code == 200
    assert reassigned_assignment["worker_id"] == workers[0]["id"]
    assert set(reassigned_assignment["crew_worker_ids"]) == {workers[0]["id"], workers[1]["id"]}
    assert reassigned_assignment["source_kind"] == "published_reassignment"

    events_after_reassign = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment['id']}/events"
    ).json()
    assert events_after_reassign[-1]["event_type"] == "reassigned"
    assert set(events_after_reassign[-1]["payload_json"]["previous_crew_worker_ids"]) == {
        workers[1]["id"],
        workers[2]["id"],
    }
    assert set(events_after_reassign[-1]["payload_json"]["new_crew_worker_ids"]) == {
        workers[0]["id"],
        workers[1]["id"],
    }

    follow_up_work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Follow-up crew visit",
            "status": "open",
            "priority": 40,
            "requested_start_at": "2026-03-29T09:30:00Z",
            "due_at": "2026-03-29T10:30:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{follow_up_work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 1,
            "quantity": 1,
        },
    )

    worker_three_available_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "worker-three-available",
            "worker_ids": [workers[2]["id"]],
            "work_order_ids": [follow_up_work_order["id"]],
            "window_start": "2026-03-29T08:00:00Z",
            "window_end": "2026-03-29T17:00:00Z",
        },
    ).json()
    worker_one_reserved_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "worker-one-reserved",
            "worker_ids": [workers[0]["id"]],
            "work_order_ids": [follow_up_work_order["id"]],
            "window_start": "2026-03-29T08:00:00Z",
            "window_end": "2026-03-29T17:00:00Z",
        },
    ).json()

    assert worker_three_available_run["summary"]["assignments"][0]["worker_id"] == workers[2]["id"]
    assert worker_one_reserved_run["summary"]["assignments"] == []


def test_bulk_dispatch_handoff_controls(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Dispatch Handoff Org",
            "slug": "dispatch-handoff-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Handoff Yard",
            "code": "HNDOFF",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Handoff Team", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "mechanical", "name": "Mechanical", "category": "trade"},
    ).json()
    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-601",
            "display_name": "Handoff Worker",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
    )
    calendar = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
        json={
            "start_at": "2026-03-30T08:00:00Z",
            "end_at": "2026-03-30T17:00:00Z",
            "availability_type": "available",
        },
    )

    for title, requested_start_at, due_at in (
        ("Dispatch handoff stop 1", "2026-03-30T09:00:00Z", "2026-03-30T10:00:00Z"),
        ("Dispatch handoff stop 2", "2026-03-30T10:00:00Z", "2026-03-30T11:00:00Z"),
    ):
        work_order = client.post(
            f"/api/v1/organizations/{organization_id}/work-orders",
            json={
                "title": title,
                "status": "open",
                "priority": 60,
                "requested_start_at": requested_start_at,
                "due_at": due_at,
                "location_id": location["id"],
                "planning_unit_id": planning_unit["id"],
            },
        ).json()
        client.post(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
            json={
                "requirement_type": "skill",
                "reference_id": skill["id"],
                "min_level": 2,
                "quantity": 1,
            },
        )

    run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "handoff-controls",
            "window_start": "2026-03-30T08:00:00Z",
            "window_end": "2026-03-30T17:00:00Z",
        },
    ).json()

    draft_handoff_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/handoff",
        json={
            "assignment_ids": ["00000000-0000-0000-0000-000000000001"],
            "handoff_status": "ready",
            "actor_name": "dispatch-supervisor",
            "note": "Draft runs should reject handoff updates.",
        },
    )
    assert draft_handoff_response.status_code == 409

    assignments = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments"
    ).json()
    assignment_ids = [assignment["id"] for assignment in assignments]
    assert len(assignment_ids) == 2

    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/approve",
        json={"actor_name": "dispatch-supervisor", "note": "Ready for field handoff."},
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/publish",
        json={"actor_name": "dispatch-supervisor"},
    )

    handoff_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/handoff",
        json={
            "assignment_ids": assignment_ids,
            "handoff_status": "ready",
            "actor_name": "dispatch-supervisor",
            "note": "Ready for field dispatch board.",
        },
    )
    handoff_payload = handoff_response.json()

    assert handoff_response.status_code == 200
    assert handoff_payload["updated_count"] == 2
    assert set(handoff_payload["updated_assignment_ids"]) == set(assignment_ids)

    updated_assignments = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments"
    ).json()
    assert all(
        assignment["dispatch_handoff_status"] == "ready" for assignment in updated_assignments
    )
    assert all(
        assignment["dispatch_handoff_actor_name"] == "dispatch-supervisor"
        for assignment in updated_assignments
    )
    assert all(
        assignment["dispatch_handoff_note"] == "Ready for field dispatch board."
        for assignment in updated_assignments
    )

    assignment_events = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment_ids[0]}/events"
    ).json()
    assert assignment_events[-1]["event_type"] == "handoff_updated"
    assert assignment_events[-1]["payload_json"]["previous_handoff_status"] == "pending"
    assert assignment_events[-1]["payload_json"]["new_handoff_status"] == "ready"

    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/{assignment_ids[0]}/cancel",
        json={
            "reason": "Cancelled after handoff status check.",
            "actor_name": "dispatch-supervisor",
        },
    )
    cancelled_handoff_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments/handoff",
        json={
            "assignment_ids": [assignment_ids[0]],
            "handoff_status": "sent",
            "actor_name": "dispatch-supervisor",
            "note": "Should fail because assignment is cancelled.",
        },
    )
    assert cancelled_handoff_response.status_code == 409


def test_saved_dispatch_queue_filters_and_canned_actions(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Dispatch Queue Org",
            "slug": "dispatch-queue-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Queue Yard",
            "code": "QUEUE",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Queue Team", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "electrical", "name": "Electrical", "category": "trade"},
    ).json()
    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-701",
            "display_name": "Queue Worker",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
    )
    calendar = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
        json={
            "start_at": "2026-03-31T08:00:00Z",
            "end_at": "2026-03-31T17:00:00Z",
            "availability_type": "available",
        },
    )

    for title, requested_start_at, due_at in (
        ("Queue stop 1", "2026-03-31T09:00:00Z", "2026-03-31T10:00:00Z"),
        ("Queue stop 2", "2026-03-31T10:00:00Z", "2026-03-31T11:00:00Z"),
    ):
        work_order = client.post(
            f"/api/v1/organizations/{organization_id}/work-orders",
            json={
                "title": title,
                "status": "open",
                "priority": 70,
                "requested_start_at": requested_start_at,
                "due_at": due_at,
                "location_id": location["id"],
                "planning_unit_id": planning_unit["id"],
            },
        ).json()
        client.post(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
            json={
                "requirement_type": "skill",
                "reference_id": skill["id"],
                "min_level": 2,
                "quantity": 1,
            },
        )

    run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "saved-queue",
            "window_start": "2026-03-31T08:00:00Z",
            "window_end": "2026-03-31T17:00:00Z",
        },
    ).json()

    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/approve",
        json={"actor_name": "dispatch-queue-lead", "note": "Queue ready for publication."},
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/publish",
        json={"actor_name": "dispatch-queue-lead"},
    )

    queue_create_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/dispatch-queues",
        json={
            "name": "Pending not-started",
            "description": "Published work that has not started and is pending handoff.",
            "status": "active",
            "assignment_statuses": ["published"],
            "execution_statuses": ["not_started"],
            "handoff_statuses": ["pending"],
            "source_kinds": [],
            "canned_handoff_status": "ready",
        },
    )
    queue = queue_create_response.json()

    assert queue_create_response.status_code == 201
    assert queue["name"] == "Pending not-started"
    assert queue["canned_handoff_status"] == "ready"

    queue_index_response = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/dispatch-queues"
    )
    queue_index = queue_index_response.json()

    assert queue_index_response.status_code == 200
    assert len(queue_index) == 1
    assert queue_index[0]["id"] == queue["id"]

    queue_assignments_response = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/dispatch-queues/{queue['id']}/assignments"
    )
    queue_assignments = queue_assignments_response.json()

    assert queue_assignments_response.status_code == 200
    assert len(queue_assignments) == 2
    assert all(assignment["dispatch_handoff_status"] == "pending" for assignment in queue_assignments)

    queue_action_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/dispatch-queues/{queue['id']}/apply-action",
        json={
            "actor_name": "dispatch-queue-lead",
            "note": "Queue canned action: mark ready.",
        },
    )
    queue_action = queue_action_response.json()

    assert queue_action_response.status_code == 200
    assert queue_action["matched_count"] == 2
    assert queue_action["updated_count"] == 2
    assert queue_action["handoff_status"] == "ready"

    assignments_after_action = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments"
    ).json()
    assert all(
        assignment["dispatch_handoff_status"] == "ready" for assignment in assignments_after_action
    )

    queue_assignments_after_action = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/dispatch-queues/{queue['id']}/assignments"
    ).json()
    assert queue_assignments_after_action == []

    queue_update_response = client.patch(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/dispatch-queues/{queue['id']}",
        json={
            "handoff_statuses": ["ready"],
        },
    )
    assert queue_update_response.status_code == 200

    queue_assignments_after_update = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/dispatch-queues/{queue['id']}/assignments"
    ).json()
    assert len(queue_assignments_after_update) == 2

    queue_delete_response = client.delete(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/dispatch-queues/{queue['id']}"
    )
    assert queue_delete_response.status_code == 204

    queue_index_after_delete = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/dispatch-queues"
    ).json()
    assert queue_index_after_delete == []


def test_dispatch_queue_templates_reuse_and_role_gated_apply(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Queue Template Org",
            "slug": "queue-template-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    dispatch_role = client.post(
        "/api/v1/roles",
        json={
            "code": "dispatch_manager",
            "name": "Dispatch Manager",
            "description": "Can apply governed dispatch queues.",
        },
    ).json()
    viewer_role = client.post(
        "/api/v1/roles",
        json={
            "code": "dispatch_viewer",
            "name": "Dispatch Viewer",
            "description": "Can review dispatch queues.",
        },
    ).json()
    dispatcher_user = client.post(
        f"/api/v1/organizations/{organization_id}/users",
        json={
            "email": "dispatcher@example.com",
            "display_name": "Dispatch Lead",
            "status": "active",
            "role_ids": [dispatch_role["id"]],
        },
    ).json()
    viewer_user = client.post(
        f"/api/v1/organizations/{organization_id}/users",
        json={
            "email": "viewer@example.com",
            "display_name": "Dispatch Viewer",
            "status": "active",
            "role_ids": [viewer_role["id"]],
        },
    ).json()

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Template Yard",
            "code": "TMPL",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Template Team", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "network", "name": "Network", "category": "trade"},
    ).json()
    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-751",
            "display_name": "Template Worker",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
    )
    calendar = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
        json={
            "start_at": "2026-04-01T08:00:00Z",
            "end_at": "2026-04-01T17:00:00Z",
            "availability_type": "available",
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{calendar['id']}/windows",
        json={
            "start_at": "2026-04-02T08:00:00Z",
            "end_at": "2026-04-02T17:00:00Z",
            "availability_type": "available",
        },
    )

    first_day_work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Template stop 1",
            "status": "open",
            "priority": 70,
            "requested_start_at": "2026-04-01T09:00:00Z",
            "due_at": "2026-04-01T10:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{first_day_work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 2,
            "quantity": 1,
        },
    )
    second_day_work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Template stop 2",
            "status": "open",
            "priority": 70,
            "requested_start_at": "2026-04-02T09:00:00Z",
            "due_at": "2026-04-02T10:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{second_day_work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 2,
            "quantity": 1,
        },
    )

    run_one = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "queue-template-run-1",
            "window_start": "2026-04-01T08:00:00Z",
            "window_end": "2026-04-01T17:00:00Z",
        },
    ).json()
    run_two = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "queue-template-run-2",
            "window_start": "2026-04-02T08:00:00Z",
            "window_end": "2026-04-02T17:00:00Z",
        },
    ).json()

    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_one['id']}/approve",
        json={"actor_name": "dispatch-lead", "note": "Ready for publication."},
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_one['id']}/publish",
        json={"actor_name": "dispatch-lead"},
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_two['id']}/approve",
        json={"actor_name": "dispatch-lead", "note": "Ready for publication."},
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_two['id']}/publish",
        json={"actor_name": "dispatch-lead"},
    )

    template_response = client.post(
        f"/api/v1/organizations/{organization_id}/dispatch-queue-templates",
        json={
            "name": "Published pending queue",
            "description": "Published work awaiting handoff.",
            "status": "active",
            "assignment_statuses": ["published"],
            "execution_statuses": ["not_started"],
            "handoff_statuses": ["pending"],
            "source_kinds": [],
            "canned_handoff_status": "ready",
            "allowed_role_codes": ["DISPATCH_MANAGER"],
        },
    )
    template = template_response.json()

    assert template_response.status_code == 201
    assert template["allowed_role_codes"] == ["dispatch_manager"]

    queue_from_template_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_one['id']}/dispatch-queues",
        json={"template_id": template["id"]},
    )
    queue_from_template = queue_from_template_response.json()

    assert queue_from_template_response.status_code == 201
    assert queue_from_template["name"] == template["name"]
    assert queue_from_template["queue_template_id"] == template["id"]
    assert queue_from_template["allowed_role_codes"] == ["dispatch_manager"]

    unauthorized_apply_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_one['id']}/dispatch-queues/{queue_from_template['id']}/apply-action",
        json={"actor_name": viewer_user["email"]},
    )
    assert unauthorized_apply_response.status_code == 403

    authorized_apply_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_one['id']}/dispatch-queues/{queue_from_template['id']}/apply-action",
        json={"actor_name": dispatcher_user["email"], "note": "Queue manager apply."},
    )
    authorized_apply_payload = authorized_apply_response.json()

    assert authorized_apply_response.status_code == 200
    assert authorized_apply_payload["source_kind"] == "run_queue"
    assert authorized_apply_payload["updated_count"] == 1

    run_one_assignments = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_one['id']}/assignments"
    ).json()
    assert len(run_one_assignments) == 1
    assert run_one_assignments[0]["dispatch_handoff_status"] == "ready"

    template_run_two_assignments = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_two['id']}/dispatch-queue-templates/{template['id']}/assignments"
    )
    assert template_run_two_assignments.status_code == 200
    assert len(template_run_two_assignments.json()) == 1

    template_apply_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_two['id']}/dispatch-queue-templates/{template['id']}/apply-action",
        json={
            "actor_name": "dispatch-lead",
            "actor_user_id": dispatcher_user["id"],
            "note": "Template-driven apply.",
        },
    )
    template_apply_payload = template_apply_response.json()

    assert template_apply_response.status_code == 200
    assert template_apply_payload["source_kind"] == "template"
    assert template_apply_payload["updated_count"] == 1

    run_two_assignments = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_two['id']}/assignments"
    ).json()
    assert len(run_two_assignments) == 1
    assert run_two_assignments[0]["dispatch_handoff_status"] == "ready"

    template_delete_conflict = client.delete(
        f"/api/v1/organizations/{organization_id}/dispatch-queue-templates/{template['id']}"
    )
    assert template_delete_conflict.status_code == 409

    queue_delete_response = client.delete(
        f"/api/v1/organizations/{organization_id}/plan-runs/{run_one['id']}/dispatch-queues/{queue_from_template['id']}"
    )
    assert queue_delete_response.status_code == 204

    template_delete_success = client.delete(
        f"/api/v1/organizations/{organization_id}/dispatch-queue-templates/{template['id']}"
    )
    assert template_delete_success.status_code == 204


def test_published_reservations_block_future_runs_and_completion_releases_capacity(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Reservation Org",
            "slug": "reservation-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Central Depot",
            "code": "DEPOT",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Dispatch Crew", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "electrical", "name": "Electrical", "category": "trade"},
    ).json()
    material = client.post(
        f"/api/v1/organizations/{organization_id}/materials",
        json={
            "sku": "fuse-kit",
            "name": "Fuse Kit",
            "unit_of_measure": "kit",
            "material_type": "electrical",
        },
    ).json()
    inventory_position = client.post(
        f"/api/v1/organizations/{organization_id}/inventory-positions",
        json={
            "material_id": material["id"],
            "location_id": location["id"],
            "on_hand_quantity": 2,
            "reserved_quantity": 0,
        },
    ).json()
    equipment_type = client.post(
        f"/api/v1/organizations/{organization_id}/equipment-types",
        json={"code": "bucket-truck", "name": "Bucket Truck", "category": "vehicle"},
    ).json()
    equipment = client.post(
        f"/api/v1/organizations/{organization_id}/equipment",
        json={
            "equipment_type_id": equipment_type["id"],
            "location_id": location["id"],
            "equipment_code": "EQ-700",
        },
    ).json()

    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-700",
            "display_name": "Taylor North",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
    )
    worker_calendar = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{worker_calendar['id']}/windows",
        json={
            "start_at": "2026-03-28T08:00:00Z",
            "end_at": "2026-03-28T18:00:00Z",
            "availability_type": "available",
        },
    )
    equipment_calendar = client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars/{equipment_calendar['id']}/windows",
        json={
            "start_at": "2026-03-28T08:00:00Z",
            "end_at": "2026-03-28T18:00:00Z",
            "availability_type": "available",
        },
    )

    def create_work_order(
        title: str,
        start_at: str,
        end_at: str,
        *,
        require_material: bool = False,
        require_equipment: bool = False,
    ) -> dict[str, object]:
        work_order = client.post(
            f"/api/v1/organizations/{organization_id}/work-orders",
            json={
                "title": title,
                "status": "open",
                "priority": 70,
                "requested_start_at": start_at,
                "due_at": end_at,
                "location_id": location["id"],
                "planning_unit_id": planning_unit["id"],
            },
        ).json()
        client.post(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
            json={
                "requirement_type": "skill",
                "reference_id": skill["id"],
                "min_level": 2,
                "quantity": 1,
            },
        )
        if require_material:
            client.post(
                f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
                json={
                    "requirement_type": "material",
                    "reference_id": material["id"],
                    "quantity": 1,
                },
            )
        if require_equipment:
            client.post(
                f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
                json={
                    "requirement_type": "equipment_type",
                    "reference_id": equipment_type["id"],
                    "quantity": 1,
                },
            )
        return work_order

    primary_work_order = create_work_order(
        "Primary repair",
        "2026-03-28T09:00:00Z",
        "2026-03-28T11:00:00Z",
        require_material=True,
        require_equipment=True,
    )
    published_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "published-shift",
            "worker_ids": [worker["id"]],
            "work_order_ids": [primary_work_order["id"]],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
            "window_start": "2026-03-28T08:00:00Z",
            "window_end": "2026-03-28T12:00:00Z",
            "scenario_id": None,
        },
    ).json()

    assignment = client.get(
        f"/api/v1/organizations/{organization_id}/plan-runs/{published_run['id']}/assignments"
    ).json()[0]
    approval_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{published_run['id']}/approve",
        json={"actor_name": "planner-1", "note": "Ready for field execution."},
    )
    publish_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{published_run['id']}/publish",
        json={"actor_name": "dispatcher-1", "published_at": "2026-03-28T09:00:00Z"},
    )
    inventory_after_publish = client.get(
        f"/api/v1/organizations/{organization_id}/inventory-positions/{inventory_position['id']}"
    ).json()

    assert approval_response.status_code == 200
    assert publish_response.status_code == 200
    assert inventory_after_publish["reserved_quantity"] == 1
    assert inventory_after_publish["on_hand_quantity"] == 2

    equipment_blocked_work_order = create_work_order(
        "Overlapping truck job",
        "2026-03-28T09:30:00Z",
        "2026-03-28T10:30:00Z",
        require_material=True,
        require_equipment=True,
    )
    equipment_blocked_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "equipment-blocked",
            "worker_ids": [worker["id"]],
            "work_order_ids": [equipment_blocked_work_order["id"]],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
            "window_start": "2026-03-28T08:00:00Z",
            "window_end": "2026-03-28T12:00:00Z",
            "scenario_id": None,
        },
    ).json()

    assert equipment_blocked_run["summary"]["assignments"] == []
    assert equipment_blocked_run["summary"]["unassigned"][0]["reason"] == (
        f"Insufficient equipment type 'bucket-truck' available at location {location['id']}."
    )

    worker_blocked_work_order = create_work_order(
        "Overlapping labor job",
        "2026-03-28T09:30:00Z",
        "2026-03-28T10:30:00Z",
        require_material=False,
        require_equipment=False,
    )
    worker_blocked_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "worker-blocked",
            "worker_ids": [worker["id"]],
            "work_order_ids": [worker_blocked_work_order["id"]],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
            "window_start": "2026-03-28T08:00:00Z",
            "window_end": "2026-03-28T12:00:00Z",
            "scenario_id": None,
        },
    ).json()

    assert worker_blocked_run["summary"]["assignments"] == []
    assert worker_blocked_run["summary"]["unassigned"][0]["reason"] == (
        "No available worker satisfies the required skills, certifications, and schedule."
    )

    complete_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{published_run['id']}/assignments/{assignment['id']}/events",
        json={
            "event_type": "completed",
            "occurred_at": "2026-03-28T10:45:00Z",
            "actor_name": "dispatcher-1",
        },
    )
    inventory_after_completion = client.get(
        f"/api/v1/organizations/{organization_id}/inventory-positions/{inventory_position['id']}"
    ).json()

    assert complete_response.status_code == 201
    assert inventory_after_completion["reserved_quantity"] == 0
    assert inventory_after_completion["on_hand_quantity"] == 1

    released_work_order = create_work_order(
        "Post-completion follow-up",
        "2026-03-28T11:00:00Z",
        "2026-03-28T12:00:00Z",
        require_material=True,
        require_equipment=True,
    )
    released_run = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "released-capacity",
            "worker_ids": [worker["id"]],
            "work_order_ids": [released_work_order["id"]],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
            "window_start": "2026-03-28T10:30:00Z",
            "window_end": "2026-03-28T12:30:00Z",
            "scenario_id": None,
        },
    ).json()

    assert released_run["summary"]["assignments"][0]["worker_id"] == worker["id"]
    assert released_run["summary"]["assignments"][0]["reserved_equipment_ids"] == [equipment["id"]]
    assert released_run["summary"]["assignments"][0]["reserved_material_quantities"] == {"fuse-kit": 1}


def test_operations_report_and_csv_export_include_execution_and_reservations(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Reporting Org",
            "slug": "reporting-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "North Depot",
            "code": "NDEPOT",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Managerial Ops", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "electrical", "name": "Electrical", "category": "trade"},
    ).json()
    material = client.post(
        f"/api/v1/organizations/{organization_id}/materials",
        json={
            "sku": "relay-kit",
            "name": "Relay Kit",
            "unit_of_measure": "kit",
            "material_type": "electrical",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/inventory-positions",
        json={
            "material_id": material["id"],
            "location_id": location["id"],
            "on_hand_quantity": 3,
            "reserved_quantity": 0,
        },
    )
    equipment_type = client.post(
        f"/api/v1/organizations/{organization_id}/equipment-types",
        json={"code": "bucket-truck", "name": "Bucket Truck", "category": "vehicle"},
    ).json()
    equipment = client.post(
        f"/api/v1/organizations/{organization_id}/equipment",
        json={
            "equipment_type_id": equipment_type["id"],
            "location_id": location["id"],
            "equipment_code": "EQ-910",
        },
    ).json()

    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-910",
            "display_name": "Drew Mercer",
            "employment_type": "full_time",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
    )
    worker_calendar = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{worker_calendar['id']}/windows",
        json={
            "start_at": "2026-03-29T08:00:00Z",
            "end_at": "2026-03-29T18:00:00Z",
            "availability_type": "available",
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/availability-calendars/{worker_calendar['id']}/windows",
        json={
            "start_at": "2026-03-30T08:00:00Z",
            "end_at": "2026-03-30T18:00:00Z",
            "availability_type": "available",
        },
    )
    equipment_calendar = client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars/{equipment_calendar['id']}/windows",
        json={
            "start_at": "2026-03-29T08:00:00Z",
            "end_at": "2026-03-29T18:00:00Z",
            "availability_type": "available",
        },
    )
    client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars/{equipment_calendar['id']}/windows",
        json={
            "start_at": "2026-03-30T08:00:00Z",
            "end_at": "2026-03-30T18:00:00Z",
            "availability_type": "available",
        },
    )

    def create_and_publish_work_order(
        title: str,
        start_at: str,
        end_at: str,
    ) -> tuple[dict[str, object], dict[str, object]]:
        work_order = client.post(
            f"/api/v1/organizations/{organization_id}/work-orders",
            json={
                "title": title,
                "status": "open",
                "priority": 75,
                "requested_start_at": start_at,
                "due_at": end_at,
                "location_id": location["id"],
                "planning_unit_id": planning_unit["id"],
            },
        ).json()
        client.post(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
            json={
                "requirement_type": "skill",
                "reference_id": skill["id"],
                "min_level": 2,
                "quantity": 1,
            },
        )
        client.post(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
            json={
                "requirement_type": "material",
                "reference_id": material["id"],
                "quantity": 1,
            },
        )
        client.post(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
            json={
                "requirement_type": "equipment_type",
                "reference_id": equipment_type["id"],
                "quantity": 1,
            },
        )
        run = client.post(
            f"/api/v1/organizations/{organization_id}/plan-runs",
            json={
                "scenario_name": title.lower().replace(" ", "-"),
                "worker_ids": [worker["id"]],
                "work_order_ids": [work_order["id"]],
                "location_ids": [location["id"]],
                "planning_unit_ids": [planning_unit["id"]],
                "worker_statuses": ["active"],
                "work_order_statuses": ["open"],
                "window_start": "2026-03-29T08:00:00Z",
                "window_end": "2026-03-30T18:00:00Z",
                "scenario_id": None,
            },
        ).json()
        client.post(
            f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/approve",
            json={"actor_name": "planner-1", "note": "Ready for management review."},
        )
        publish_response = client.post(
            f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/publish",
            json={"actor_name": "dispatcher-1", "published_at": start_at},
        )
        assert publish_response.status_code == 200
        assignment = client.get(
            f"/api/v1/organizations/{organization_id}/plan-runs/{run['id']}/assignments"
        ).json()[0]
        return run, assignment

    first_run, first_assignment = create_and_publish_work_order(
        "Morning repair",
        "2026-03-29T09:00:00Z",
        "2026-03-29T10:00:00Z",
    )
    complete_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{first_run['id']}/assignments/{first_assignment['id']}/events",
        json={
            "event_type": "completed",
            "occurred_at": "2026-03-29T10:15:00Z",
            "actor_name": "dispatcher-1",
        },
    )
    assert complete_response.status_code == 201

    second_run, second_assignment = create_and_publish_work_order(
        "Afternoon repair",
        "2026-03-30T11:00:00Z",
        "2026-03-30T12:00:00Z",
    )
    blocked_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs/{second_run['id']}/assignments/{second_assignment['id']}/events",
        json={
            "event_type": "blocked",
            "occurred_at": "2026-03-30T11:20:00Z",
            "actor_name": "dispatcher-1",
            "reason_code": "material_delay",
            "note": "Supplier staging delay.",
        },
    )
    assert blocked_response.status_code == 201

    report_response = client.get(
        f"/api/v1/organizations/{organization_id}/reports/operations",
        params={
          "window_start": "2026-03-29T08:00:00Z",
          "window_end": "2026-03-30T18:00:00Z",
          "location_id": location["id"],
          "planning_unit_id": planning_unit["id"],
        },
    )
    csv_response = client.get(
        f"/api/v1/organizations/{organization_id}/reports/operations/export.csv",
        params={
          "window_start": "2026-03-29T08:00:00Z",
          "window_end": "2026-03-30T18:00:00Z",
          "location_id": location["id"],
          "planning_unit_id": planning_unit["id"],
        },
    )

    report = report_response.json()
    csv_content = csv_response.text

    assert report_response.status_code == 200
    assert report["summary"]["published_runs_count"] == 2
    assert report["summary"]["assignments_total"] == 2
    assert report["summary"]["assignments_completed"] == 1
    assert report["summary"]["assignments_blocked"] == 1
    assert report["summary"]["blocked_event_count"] == 1
    assert report["summary"]["active_worker_reservations"] == 1
    assert report["summary"]["active_equipment_reservations"] == 1
    assert report["summary"]["active_material_reservations"] == 1
    assert report["summary"]["active_reserved_material_units"] == 1
    assert report["summary"]["consumed_material_units"] == 1
    assert report["published_runs"][0]["run_id"] == second_run["id"]
    assert report["published_runs"][0]["assignments_blocked"] == 1
    assert any(item["worker_name"] == "Drew Mercer" for item in report["worker_breakdown"])
    assert report["location_breakdown"][0]["location_name"] == "North Depot"
    assert report["material_breakdown"][0]["material_code"] == "relay-kit"
    assert report["equipment_breakdown"][0]["equipment_code"] == "EQ-910"
    assert report["trend_granularity"] == "day"
    assert len(report["trends"]) == 2
    assert report["trends"][0]["bucket_label"] == "Mar 29"
    assert report["trends"][1]["assignments_blocked"] == 1
    assert report["trends"][1]["blocked_event_count"] == 1
    assert report["bottlenecks"][0]["category"] in {"worker", "location", "material", "equipment"}
    assert any(item["category"] == "material" for item in report["bottlenecks"])
    assert any(item["category"] == "equipment" for item in report["bottlenecks"])
    assert len(report["assignment_rows"]) == 2

    assert csv_response.status_code == 200
    assert csv_response.headers["content-type"].startswith("text/csv")
    assert "Morning repair" in csv_content
    assert "Afternoon repair" in csv_content
    assert "relay-kit:1" in csv_content


def test_planning_horizon_crud_and_run_scope(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Horizon Org",
            "slug": "horizon-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Horizon Yard",
            "code": "HYARD",
            "location_type": "yard",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Ops Unit", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "inspection", "name": "Inspection", "category": "trade"},
    ).json()
    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "H-001",
            "display_name": "Harper Lane",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 3, "verified": True},
    )
    work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Meter bank inspection",
            "status": "open",
            "priority": 50,
            "requested_start_at": "2026-03-16T09:00:00Z",
            "due_at": "2026-03-16T10:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 2,
            "quantity": 1,
        },
    )

    horizon = client.post(
        f"/api/v1/organizations/{organization_id}/planning-horizons",
        json={
            "name": "Week 12",
            "description": "March week horizon",
            "timezone": "UTC",
            "start_at": "2026-03-16T00:00:00Z",
            "end_at": "2026-03-22T23:59:59Z",
            "status": "active",
        },
    ).json()

    run_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "week-12-scope",
            "planning_horizon_id": horizon["id"],
            "worker_ids": [worker["id"]],
            "work_order_ids": [work_order["id"]],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
        },
    )
    run = run_response.json()

    assert run_response.status_code == 201
    assert run["planning_request"]["planning_horizon_id"] == horizon["id"]
    assert run["planning_request"]["window_start"] == "2026-03-16T00:00:00Z"
    assert run["planning_request"]["window_end"] == "2026-03-22T23:59:59Z"
    assert len(run["summary"]["assignments"]) == 1

    updated_horizon = client.patch(
        f"/api/v1/organizations/{organization_id}/planning-horizons/{horizon['id']}",
        json={"name": "Week 12 Updated", "status": "inactive"},
    ).json()
    assert updated_horizon["name"] == "Week 12 Updated"
    assert updated_horizon["status"] == "inactive"

    horizons = client.get(f"/api/v1/organizations/{organization_id}/planning-horizons").json()
    assert len(horizons) == 1
    assert horizons[0]["id"] == horizon["id"]

    delete_response = client.delete(
        f"/api/v1/organizations/{organization_id}/planning-horizons/{horizon['id']}"
    )
    assert delete_response.status_code == 409


def test_shift_templates_and_break_rules_constrain_org_planning_runs(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Shift Org",
            "slug": "shift-org",
            "organization_type": "municipal",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={"name": "Shift Yard", "code": "SYARD", "location_type": "yard", "timezone": "UTC"},
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Shift Team", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "electrical", "name": "Electrical", "category": "trade"},
    ).json()
    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "S-001",
            "display_name": "Casey Vale",
            "status": "active",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
    )

    shift_template = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/shift-templates",
        json={
            "name": "Tuesday Day Shift",
            "timezone": "UTC",
            "day_of_week": 1,
            "start_minute_local": 540,
            "end_minute_local": 1020,
            "status": "active",
        },
    ).json()
    client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/shift-templates/{shift_template['id']}/break-rules",
        json={
            "name": "Lunch",
            "start_minute_local": 720,
            "duration_minutes": 60,
            "status": "active",
        },
    )

    morning_work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Morning panel check",
            "status": "open",
            "priority": 60,
            "requested_start_at": "2026-03-10T10:00:00Z",
            "due_at": "2026-03-10T11:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    lunch_work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Lunch-hour emergency",
            "status": "open",
            "priority": 60,
            "requested_start_at": "2026-03-10T12:15:00Z",
            "due_at": "2026-03-10T12:45:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
        },
    ).json()
    for work_order in (morning_work_order, lunch_work_order):
        client.post(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
            json={
                "requirement_type": "skill",
                "reference_id": skill["id"],
                "min_level": 2,
                "quantity": 1,
            },
        )

    run_response = client.post(
        f"/api/v1/organizations/{organization_id}/plan-runs",
        json={
            "scenario_name": "shift-constrained",
            "worker_ids": [worker["id"]],
            "work_order_ids": [morning_work_order["id"], lunch_work_order["id"]],
            "location_ids": [location["id"]],
            "planning_unit_ids": [planning_unit["id"]],
            "worker_statuses": ["active"],
            "work_order_statuses": ["open"],
            "window_start": "2026-03-10T08:00:00Z",
            "window_end": "2026-03-10T18:00:00Z",
        },
    )
    run = run_response.json()
    assigned_work_order_ids = {assignment["work_order_id"] for assignment in run["summary"]["assignments"]}
    unassigned_reasons = {item["work_order_id"]: item["reason"] for item in run["summary"]["unassigned"]}

    assert run_response.status_code == 201
    assert str(morning_work_order["id"]) in assigned_work_order_ids
    assert str(lunch_work_order["id"]) in unassigned_reasons
    assert "schedule" in unassigned_reasons[str(lunch_work_order["id"])].lower()
