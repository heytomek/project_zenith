def test_resources_crud_flow(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Resource Org",
            "slug": "resource-org",
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

    material = client.post(
        f"/api/v1/organizations/{organization_id}/materials",
        json={
            "sku": "copper-wire",
            "name": "Copper Wire",
            "unit_of_measure": "roll",
            "material_type": "electrical",
        },
    ).json()
    inventory_position = client.post(
        f"/api/v1/organizations/{organization_id}/inventory-positions",
        json={
            "material_id": material["id"],
            "location_id": location["id"],
            "on_hand_quantity": 12,
            "reserved_quantity": 2,
        },
    ).json()

    equipment_type = client.post(
        f"/api/v1/organizations/{organization_id}/equipment-types",
        json={
            "code": "bucket-truck",
            "name": "Bucket Truck",
            "category": "vehicle",
        },
    ).json()
    equipment = client.post(
        f"/api/v1/organizations/{organization_id}/equipment",
        json={
            "equipment_type_id": equipment_type["id"],
            "location_id": location["id"],
            "equipment_code": "EQ-001",
            "serial_number": "SN-001",
        },
    ).json()
    calendar = client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars",
        json={
            "name": "Primary",
            "timezone": "UTC",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
        },
    ).json()
    window = client.post(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars/{calendar['id']}/windows",
        json={
            "start_at": "2026-03-10T08:00:00Z",
            "end_at": "2026-03-10T17:00:00Z",
            "availability_type": "available",
        },
    ).json()

    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Field Team", "unit_type": "team"},
    ).json()
    work_order = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders",
        json={
            "title": "Repair line",
            "priority": 60,
            "location_id": location["id"],
            "planning_unit_id": planning_unit["id"],
            "requested_start_at": "2026-03-10T09:00:00Z",
            "due_at": "2026-03-10T11:00:00Z",
        },
    ).json()
    material_requirement = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "material",
            "reference_id": material["id"],
            "quantity": 2,
        },
    ).json()
    equipment_requirement = client.post(
        f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements",
        json={
            "requirement_type": "equipment_type",
            "reference_id": equipment_type["id"],
            "quantity": 1,
        },
    ).json()

    updated_material = client.patch(
        f"/api/v1/organizations/{organization_id}/materials/{material['id']}",
        json={"name": "Copper Wire Spool"},
    ).json()
    updated_inventory = client.patch(
        f"/api/v1/organizations/{organization_id}/inventory-positions/{inventory_position['id']}",
        json={"reserved_quantity": 3},
    ).json()
    updated_equipment_type = client.patch(
        f"/api/v1/organizations/{organization_id}/equipment-types/{equipment_type['id']}",
        json={"name": "Bucket Truck XL"},
    ).json()
    updated_equipment = client.patch(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}",
        json={"status": "maintenance"},
    ).json()
    updated_calendar = client.patch(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars/{calendar['id']}",
        json={"status": "inactive"},
    ).json()
    updated_window = client.patch(
        f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars/{calendar['id']}/windows/{window['id']}",
        json={"availability_type": "unavailable"},
    ).json()

    assert updated_material["name"] == "Copper Wire Spool"
    assert updated_inventory["reserved_quantity"] == 3
    assert updated_equipment_type["name"] == "Bucket Truck XL"
    assert updated_equipment["status"] == "maintenance"
    assert updated_calendar["status"] == "inactive"
    assert updated_window["availability_type"] == "unavailable"

    assert len(client.get(f"/api/v1/organizations/{organization_id}/materials").json()) == 1
    assert len(client.get(f"/api/v1/organizations/{organization_id}/inventory-positions").json()) == 1
    assert len(client.get(f"/api/v1/organizations/{organization_id}/equipment-types").json()) == 1
    assert len(client.get(f"/api/v1/organizations/{organization_id}/equipment").json()) == 1

    assert client.delete(f"/api/v1/organizations/{organization_id}/materials/{material['id']}").status_code == 409
    assert (
        client.delete(f"/api/v1/organizations/{organization_id}/equipment-types/{equipment_type['id']}").status_code
        == 409
    )
    assert client.delete(f"/api/v1/organizations/{organization_id}/locations/{location['id']}").status_code == 409

    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements/{material_requirement['id']}"
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}/requirements/{equipment_requirement['id']}"
        ).status_code
        == 204
    )
    assert client.delete(f"/api/v1/organizations/{organization_id}/work-orders/{work_order['id']}").status_code == 204
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars/{calendar['id']}/windows/{window['id']}"
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}/availability-calendars/{calendar['id']}"
        ).status_code
        == 204
    )
    assert client.delete(f"/api/v1/organizations/{organization_id}/equipment/{equipment['id']}").status_code == 204
    assert (
        client.delete(f"/api/v1/organizations/{organization_id}/equipment-types/{equipment_type['id']}").status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/inventory-positions/{inventory_position['id']}"
        ).status_code
        == 204
    )
    assert client.delete(f"/api/v1/organizations/{organization_id}/materials/{material['id']}").status_code == 204


def test_resource_validations_reject_cross_org_and_bad_quantities(client) -> None:
    org_a = client.post(
        "/api/v1/organizations",
        json={"name": "Res A", "slug": "res-a", "organization_type": "municipal"},
    ).json()
    org_b = client.post(
        "/api/v1/organizations",
        json={"name": "Res B", "slug": "res-b", "organization_type": "municipal"},
    ).json()

    foreign_location = client.post(
        f"/api/v1/organizations/{org_b['id']}/locations",
        json={"name": "Elsewhere", "code": "ELSE", "location_type": "site", "timezone": "UTC"},
    ).json()
    material = client.post(
        f"/api/v1/organizations/{org_a['id']}/materials",
        json={"sku": "pipe", "name": "Pipe", "unit_of_measure": "unit", "material_type": "plumbing"},
    ).json()
    equipment_type = client.post(
        f"/api/v1/organizations/{org_a['id']}/equipment-types",
        json={"code": "van", "name": "Service Van", "category": "vehicle"},
    ).json()

    invalid_inventory = client.post(
        f"/api/v1/organizations/{org_a['id']}/inventory-positions",
        json={
            "material_id": material["id"],
            "location_id": foreign_location["id"],
            "on_hand_quantity": 5,
            "reserved_quantity": 1,
        },
    )
    invalid_inventory_quantities = client.post(
        f"/api/v1/organizations/{org_a['id']}/inventory-positions",
        json={
            "material_id": material["id"],
            "location_id": client.post(
                f"/api/v1/organizations/{org_a['id']}/locations",
                json={"name": "Local", "code": "LOCAL", "location_type": "site", "timezone": "UTC"},
            ).json()["id"],
            "on_hand_quantity": 1,
            "reserved_quantity": 2,
        },
    )
    invalid_equipment = client.post(
        f"/api/v1/organizations/{org_a['id']}/equipment",
        json={
            "equipment_type_id": equipment_type["id"],
            "location_id": foreign_location["id"],
            "equipment_code": "EQ-BAD",
        },
    )

    assert invalid_inventory.status_code == 422
    assert "does not belong to organization" in invalid_inventory.json()["detail"]
    assert invalid_inventory_quantities.status_code == 422
    assert "reserved_quantity cannot exceed on_hand_quantity" in invalid_inventory_quantities.json()["detail"]
    assert invalid_equipment.status_code == 422
    assert "does not belong to organization" in invalid_equipment.json()["detail"]
