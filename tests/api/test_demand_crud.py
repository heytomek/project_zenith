def test_demand_crud_flow(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Demand Org",
            "slug": "demand-org",
            "organization_type": "municipal",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Central Depot",
            "code": "CENTRAL",
            "location_type": "depot",
            "timezone": "UTC",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Maintenance Team", "unit_type": "team"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "plumbing", "name": "Plumbing", "category": "trade"},
    ).json()
    certification = client.post(
        f"/api/v1/organizations/{organization_id}/certifications",
        json={"code": "safety", "name": "Safety", "expires": True},
    ).json()

    policy = client.post(
        f"/api/v1/organizations/{organization_id}/service-level-policies",
        json={
            "name": "Urgent Maintenance",
            "scope": "work_order",
            "target_minutes": 240,
            "status": "active",
        },
    ).json()
    policy_id = policy["id"]

    work_order_a = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Repair main line",
            "description": "Critical repair",
            "status": "open",
            "priority": 90,
            "requested_start_at": "2026-03-10T08:00:00Z",
            "due_at": "2026-03-10T12:00:00Z",
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
            "service_level_policy_id": policy_id,
        },
    ).json()
    work_order_b = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Inspect valve",
            "status": "open",
            "priority": 40,
            "location_id": location["id"],
        },
    ).json()

    skill_requirement = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order_a['id']}/requirements",
        json={
            "requirement_type": "skill",
            "reference_id": skill["id"],
            "min_level": 3,
            "quantity": 1,
        },
    ).json()
    cert_requirement = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order_a['id']}/requirements",
        json={
            "requirement_type": "certification",
            "reference_id": certification["id"],
            "quantity": 1,
        },
    ).json()
    headcount_requirement = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order_b['id']}/requirements",
        json={
            "requirement_type": "headcount",
            "quantity": 2,
        },
    ).json()

    dependency = client.post(
        f"/api/v1/organizations/{organization_id}/work-order-dependencies",
        json={
            "predecessor_work_order_id": work_order_b["id"],
            "successor_work_order_id": work_order_a["id"],
            "dependency_type": "finish_to_start",
        },
    ).json()

    updated_policy = client.patch(
        f"/api/v1/organizations/{organization_id}/service-level-policies/{policy_id}",
        json={"target_minutes": 180},
    ).json()
    updated_work_order = client.patch(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order_a['id']}",
        json={"status": "in_progress"},
    ).json()
    updated_requirement = client.patch(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order_a['id']}/requirements/{skill_requirement['id']}",
        json={"min_level": 4},
    ).json()
    updated_dependency = client.patch(
        f"/api/v1/organizations/{organization_id}/work-order-dependencies/{dependency['id']}",
        json={"dependency_type": "start_to_start"},
    ).json()

    assert updated_policy["target_minutes"] == 180
    assert updated_work_order["status"] == "in_progress"
    assert updated_requirement["min_level"] == 4
    assert updated_dependency["dependency_type"] == "start_to_start"
    assert len(client.get(f"/api/v1/organizations/{organization_id}/service-level-policies").json()) == 1
    assert len(client.get(f"/api/v1/organizations/{organization_id}/work-orders").json()) == 2
    assert (
        len(
            client.get(
                f"/api/v1/organizations/{organization_id}/work-orders/{work_order_a['id']}/requirements"
            ).json()
        )
        == 2
    )
    assert len(client.get(f"/api/v1/organizations/{organization_id}/work-order-dependencies").json()) == 1

    assert (
        client.delete(f"/api/v1/organizations/{organization_id}/service-level-policies/{policy_id}").status_code
        == 409
    )
    assert client.delete(f"/api/v1/organizations/{organization_id}/skills/{skill['id']}").status_code == 409
    assert (
        client.delete(f"/api/v1/organizations/{organization_id}/certifications/{certification['id']}").status_code
        == 409
    )
    assert (
        client.delete(f"/api/v1/organizations/{organization_id}/locations/{location['id']}").status_code == 409
    )
    assert (
        client.delete(f"/api/v1/organizations/{organization_id}/planning-units/{planning_unit['id']}").status_code
        == 409
    )

    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/work-order-dependencies/{dependency['id']}"
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order_a['id']}/requirements/{skill_requirement['id']}"
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order_a['id']}/requirements/{cert_requirement['id']}"
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order_b['id']}/requirements/{headcount_requirement['id']}"
        ).status_code
        == 204
    )
    assert client.delete(f"/api/v1/organizations/{organization_id}/work-orders/{work_order_a['id']}").status_code == 204
    assert client.delete(f"/api/v1/organizations/{organization_id}/work-orders/{work_order_b['id']}").status_code == 204
    assert client.delete(f"/api/v1/organizations/{organization_id}/service-level-policies/{policy_id}").status_code == 204


def test_dependency_cycle_and_requirement_validation(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={"name": "Validation Org", "slug": "validation-org", "organization_type": "municipal"},
    ).json()
    organization_id = organization["id"]
    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={"name": "Site", "code": "SITE", "location_type": "site", "timezone": "UTC"},
    ).json()
    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "electrical", "name": "Electrical", "category": "trade"},
    ).json()

    work_order_a = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={"title": "A", "priority": 10, "location_id": location["id"]},
    ).json()
    work_order_b = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={"title": "B", "priority": 20, "location_id": location["id"]},
    ).json()

    first_dependency = client.post(
        f"/api/v1/organizations/{organization_id}/work-order-dependencies",
        json={
            "predecessor_work_order_id": work_order_a["id"],
            "successor_work_order_id": work_order_b["id"],
            "dependency_type": "finish_to_start",
        },
    )
    cycle_dependency = client.post(
        f"/api/v1/organizations/{organization_id}/work-order-dependencies",
        json={
            "predecessor_work_order_id": work_order_b["id"],
            "successor_work_order_id": work_order_a["id"],
            "dependency_type": "finish_to_start",
        },
    )
    invalid_requirement = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order_a['id']}/requirements",
        json={
            "requirement_type": "headcount",
            "reference_id": skill["id"],
            "quantity": 2,
        },
    )

    assert first_dependency.status_code == 201
    assert cycle_dependency.status_code == 422
    assert "create a cycle" in cycle_dependency.json()["detail"]
    assert invalid_requirement.status_code == 422
    assert "must not include a reference_id" in invalid_requirement.json()["detail"]
