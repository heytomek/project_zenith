def test_org_identity_crud_flow(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Zenith Cooperative",
            "slug": "zenith-coop",
            "organization_type": "cooperative",
            "status": "active",
        },
    ).json()
    organization_id = organization["id"]

    role = client.post(
        "/api/v1/roles",
        json={"code": "planner", "name": "Planner", "description": "Planning operator"},
    ).json()
    role_id = role["id"]

    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "North Dispatch", "unit_type": "dispatch"},
    ).json()
    planning_unit_id = planning_unit["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Depot A",
            "code": "DEPOT-A",
            "location_type": "depot",
            "timezone": "America/New_York",
        },
    ).json()
    location_id = location["id"]

    user = client.post(
        f"/api/v1/organizations/{organization_id}/users",
        json={
            "email": "planner@zenith.local",
            "display_name": "Morgan Lee",
            "role_ids": [role_id],
        },
    ).json()
    user_id = user["id"]

    assert user["roles"][0]["code"] == "planner"

    updated_org = client.patch(
        f"/api/v1/organizations/{organization_id}",
        json={"name": "Zenith Planning Cooperative"},
    ).json()
    updated_unit = client.patch(
        f"/api/v1/organizations/{organization_id}/planning-units/{planning_unit_id}",
        json={"status": "inactive"},
    ).json()
    updated_location = client.patch(
        f"/api/v1/organizations/{organization_id}/locations/{location_id}",
        json={"code": "DEPOT-A-1"},
    ).json()
    updated_role = client.patch(
        f"/api/v1/roles/{role_id}",
        json={"name": "Lead Planner"},
    ).json()
    updated_user = client.patch(
        f"/api/v1/organizations/{organization_id}/users/{user_id}",
        json={"display_name": "Morgan Singh", "role_ids": [role_id]},
    ).json()

    assert updated_org["name"] == "Zenith Planning Cooperative"
    assert updated_unit["status"] == "inactive"
    assert updated_location["code"] == "DEPOT-A-1"
    assert updated_role["name"] == "Lead Planner"
    assert updated_user["display_name"] == "Morgan Singh"
    assert updated_user["roles"][0]["name"] == "Lead Planner"

    assert len(client.get("/api/v1/organizations").json()) == 1
    assert len(client.get("/api/v1/roles").json()) == 1
    assert len(client.get(f"/api/v1/organizations/{organization_id}/planning-units").json()) == 1
    assert len(client.get(f"/api/v1/organizations/{organization_id}/locations").json()) == 1
    assert len(client.get(f"/api/v1/organizations/{organization_id}/users").json()) == 1

    role_delete_conflict = client.delete(f"/api/v1/roles/{role_id}")
    assert role_delete_conflict.status_code == 409

    assert client.delete(f"/api/v1/organizations/{organization_id}/users/{user_id}").status_code == 204
    assert client.delete(f"/api/v1/organizations/{organization_id}/locations/{location_id}").status_code == 204
    assert (
        client.delete(f"/api/v1/organizations/{organization_id}/planning-units/{planning_unit_id}").status_code
        == 204
    )
    assert client.delete(f"/api/v1/roles/{role_id}").status_code == 204
    assert client.delete(f"/api/v1/organizations/{organization_id}").status_code == 204


def test_planning_unit_parent_must_belong_to_same_organization(client) -> None:
    org_a = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a", "organization_type": "municipal"},
    ).json()
    org_b = client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b", "organization_type": "municipal"},
    ).json()

    parent_unit = client.post(
        f"/api/v1/organizations/{org_a['id']}/planning-units",
        json={"name": "Parent Unit", "unit_type": "team"},
    ).json()

    response = client.post(
        f"/api/v1/organizations/{org_b['id']}/planning-units",
        json={
            "name": "Invalid Child",
            "unit_type": "team",
            "parent_unit_id": parent_unit["id"],
        },
    )

    assert response.status_code == 422
    assert "does not belong to organization" in response.json()["detail"]


def test_duplicate_org_slug_is_rejected(client) -> None:
    first = client.post(
        "/api/v1/organizations",
        json={"name": "Alpha", "slug": "alpha", "organization_type": "cooperative"},
    )
    duplicate = client.post(
        "/api/v1/organizations",
        json={"name": "Beta", "slug": "alpha", "organization_type": "cooperative"},
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409
