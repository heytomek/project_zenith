from datetime import UTC, datetime, timedelta


def test_workforce_crud_flow(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={
            "name": "Zenith Workforce Org",
            "slug": "zenith-workforce",
            "organization_type": "cooperative",
        },
    ).json()
    organization_id = organization["id"]

    location = client.post(
        f"/api/v1/organizations/{organization_id}/locations",
        json={
            "name": "Depot North",
            "code": "D-NORTH",
            "location_type": "depot",
            "timezone": "America/New_York",
        },
    ).json()
    planning_unit = client.post(
        f"/api/v1/organizations/{organization_id}/planning-units",
        json={"name": "Field Team Alpha", "unit_type": "team"},
    ).json()

    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "electrical", "name": "Electrical", "category": "trade"},
    ).json()
    certification = client.post(
        f"/api/v1/organizations/{organization_id}/certifications",
        json={
            "code": "osha-10",
            "name": "OSHA 10",
            "description": "Basic safety",
            "expires": True,
        },
    ).json()

    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={
            "worker_code": "W-001",
            "display_name": "Avery Stone",
            "employment_type": "full_time",
            "home_location_id": location["id"],
            "home_planning_unit_id": planning_unit["id"],
        },
    ).json()
    worker_id = worker["id"]

    worker_skill = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 4, "verified": True},
    ).json()
    worker_certification = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/certifications",
        json={
            "certification_id": certification["id"],
            "status": "active",
            "issued_at": "2026-01-01T00:00:00Z",
            "expires_at": "2027-01-01T00:00:00Z",
        },
    ).json()
    calendar = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/availability-calendars",
        json={
            "name": "Default Calendar",
            "timezone": "America/New_York",
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
        },
    ).json()
    calendar_id = calendar["id"]

    window = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/availability-calendars/{calendar_id}/windows",
        json={
            "start_at": "2026-03-10T13:00:00Z",
            "end_at": "2026-03-10T21:00:00Z",
            "availability_type": "available",
        },
    ).json()
    shift_template = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/shift-templates",
        json={
            "name": "Day Shift",
            "timezone": "America/New_York",
            "day_of_week": 1,
            "start_minute_local": 540,
            "end_minute_local": 1020,
            "effective_from": "2026-01-01T00:00:00Z",
            "effective_to": "2026-12-31T23:59:59Z",
            "status": "active",
        },
    ).json()
    break_rule = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/shift-templates/{shift_template['id']}/break-rules",
        json={
            "name": "Lunch",
            "start_minute_local": 720,
            "duration_minutes": 30,
            "status": "active",
        },
    ).json()

    updated_worker = client.patch(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}",
        json={"display_name": "Avery Stone Jr.", "status": "inactive"},
    ).json()
    updated_worker_skill = client.patch(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/skills/{worker_skill['id']}",
        json={"proficiency_level": 5},
    ).json()
    updated_worker_certification = client.patch(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/certifications/{worker_certification['id']}",
        json={"status": "expired"},
    ).json()
    updated_calendar = client.patch(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/availability-calendars/{calendar_id}",
        json={"status": "inactive"},
    ).json()
    updated_window = client.patch(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/availability-calendars/{calendar_id}/windows/{window['id']}",
        json={"availability_type": "unavailable"},
    ).json()
    updated_shift_template = client.patch(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/shift-templates/{shift_template['id']}",
        json={"status": "inactive"},
    ).json()
    updated_break_rule = client.patch(
        f"/api/v1/organizations/{organization_id}/workers/{worker_id}/shift-templates/{shift_template['id']}/break-rules/{break_rule['id']}",
        json={"duration_minutes": 45},
    ).json()

    assert updated_worker["display_name"] == "Avery Stone Jr."
    assert updated_worker_skill["proficiency_level"] == 5
    assert updated_worker_certification["status"] == "expired"
    assert updated_calendar["status"] == "inactive"
    assert updated_window["availability_type"] == "unavailable"
    assert updated_shift_template["status"] == "inactive"
    assert updated_break_rule["duration_minutes"] == 45

    assert len(client.get(f"/api/v1/organizations/{organization_id}/skills").json()) == 1
    assert len(client.get(f"/api/v1/organizations/{organization_id}/certifications").json()) == 1
    assert len(client.get(f"/api/v1/organizations/{organization_id}/workers").json()) == 1
    assert len(client.get(f"/api/v1/organizations/{organization_id}/workers/{worker_id}/skills").json()) == 1
    assert (
        len(client.get(f"/api/v1/organizations/{organization_id}/workers/{worker_id}/certifications").json())
        == 1
    )
    assert (
        len(
            client.get(
                f"/api/v1/organizations/{organization_id}/workers/{worker_id}/availability-calendars"
            ).json()
        )
        == 1
    )
    assert (
        len(
            client.get(
                f"/api/v1/organizations/{organization_id}/workers/{worker_id}/availability-calendars/{calendar_id}/windows"
            ).json()
        )
        == 1
    )
    assert (
        len(client.get(f"/api/v1/organizations/{organization_id}/workers/{worker_id}/shift-templates").json())
        == 1
    )
    assert (
        len(
            client.get(
                f"/api/v1/organizations/{organization_id}/workers/{worker_id}/shift-templates/{shift_template['id']}/break-rules"
            ).json()
        )
        == 1
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
            f"/api/v1/organizations/{organization_id}/workers/{worker_id}/availability-calendars/{calendar_id}/windows/{window['id']}"
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/workers/{worker_id}/shift-templates/{shift_template['id']}/break-rules/{break_rule['id']}"
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/workers/{worker_id}/shift-templates/{shift_template['id']}"
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/workers/{worker_id}/availability-calendars/{calendar_id}"
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/workers/{worker_id}/certifications/{worker_certification['id']}"
        ).status_code
        == 204
    )
    assert (
        client.delete(
            f"/api/v1/organizations/{organization_id}/workers/{worker_id}/skills/{worker_skill['id']}"
        ).status_code
        == 204
    )
    assert client.delete(f"/api/v1/organizations/{organization_id}/workers/{worker_id}").status_code == 204
    assert client.delete(f"/api/v1/organizations/{organization_id}/skills/{skill['id']}").status_code == 204
    assert (
        client.delete(f"/api/v1/organizations/{organization_id}/certifications/{certification['id']}").status_code
        == 204
    )
    assert client.delete(f"/api/v1/organizations/{organization_id}/locations/{location['id']}").status_code == 204
    assert (
        client.delete(f"/api/v1/organizations/{organization_id}/planning-units/{planning_unit['id']}").status_code
        == 204
    )


def test_worker_home_refs_and_window_ranges_are_validated(client) -> None:
    org_a = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a-workforce", "organization_type": "municipal"},
    ).json()
    org_b = client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b-workforce", "organization_type": "municipal"},
    ).json()

    foreign_location = client.post(
        f"/api/v1/organizations/{org_b['id']}/locations",
        json={"name": "Elsewhere", "code": "ELSE", "location_type": "site", "timezone": "UTC"},
    ).json()

    worker_response = client.post(
        f"/api/v1/organizations/{org_a['id']}/workers",
        json={
            "worker_code": "W-BAD",
            "display_name": "Invalid Worker",
            "home_location_id": foreign_location["id"],
        },
    )

    assert worker_response.status_code == 422
    assert "does not belong to organization" in worker_response.json()["detail"]

    local_worker = client.post(
        f"/api/v1/organizations/{org_a['id']}/workers",
        json={"worker_code": "W-OK", "display_name": "Valid Worker"},
    ).json()
    calendar = client.post(
        f"/api/v1/organizations/{org_a['id']}/workers/{local_worker['id']}/availability-calendars",
        json={"name": "Calendar", "timezone": "UTC"},
    ).json()

    invalid_window = client.post(
        f"/api/v1/organizations/{org_a['id']}/workers/{local_worker['id']}/availability-calendars/{calendar['id']}/windows",
        json={
            "start_at": "2026-03-10T21:00:00Z",
            "end_at": "2026-03-10T13:00:00Z",
            "availability_type": "available",
        },
    )

    assert invalid_window.status_code == 422
    assert "later than start_at" in invalid_window.json()["detail"]

    invalid_shift = client.post(
        f"/api/v1/organizations/{org_a['id']}/workers/{local_worker['id']}/shift-templates",
        json={
            "name": "Invalid Shift",
            "timezone": "UTC",
            "day_of_week": 1,
            "start_minute_local": 600,
            "end_minute_local": 600,
            "status": "active",
        },
    )
    assert invalid_shift.status_code == 422
    assert "must differ from start_minute_local" in invalid_shift.json()["detail"]

    valid_shift = client.post(
        f"/api/v1/organizations/{org_a['id']}/workers/{local_worker['id']}/shift-templates",
        json={
            "name": "Valid Shift",
            "timezone": "UTC",
            "day_of_week": 1,
            "start_minute_local": 540,
            "end_minute_local": 1020,
            "status": "active",
        },
    ).json()
    invalid_break = client.post(
        f"/api/v1/organizations/{org_a['id']}/workers/{local_worker['id']}/shift-templates/{valid_shift['id']}/break-rules",
        json={
            "name": "Late Break",
            "start_minute_local": 1100,
            "duration_minutes": 30,
            "status": "active",
        },
    )
    assert invalid_break.status_code == 422
    assert "must fall fully within the shift template interval" in invalid_break.json()["detail"]


def test_duplicate_worker_skill_and_certification_are_rejected(client) -> None:
    organization = client.post(
        "/api/v1/organizations",
        json={"name": "Dup Org", "slug": "dup-org", "organization_type": "cooperative"},
    ).json()
    organization_id = organization["id"]

    skill = client.post(
        f"/api/v1/organizations/{organization_id}/skills",
        json={"code": "ops", "name": "Ops", "category": "general"},
    ).json()
    certification = client.post(
        f"/api/v1/organizations/{organization_id}/certifications",
        json={"code": "forklift", "name": "Forklift", "expires": True},
    ).json()
    worker = client.post(
        f"/api/v1/organizations/{organization_id}/workers",
        json={"worker_code": "DUP-1", "display_name": "Taylor Reed"},
    ).json()

    first_skill = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 2},
    )
    duplicate_skill = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/skills",
        json={"skill_id": skill["id"], "proficiency_level": 3},
    )

    first_cert = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/certifications",
        json={
            "certification_id": certification["id"],
            "issued_at": datetime.now(UTC).isoformat(),
            "expires_at": (datetime.now(UTC) + timedelta(days=365)).isoformat(),
        },
    )
    duplicate_cert = client.post(
        f"/api/v1/organizations/{organization_id}/workers/{worker['id']}/certifications",
        json={"certification_id": certification["id"]},
    )

    assert first_skill.status_code == 201
    assert duplicate_skill.status_code == 409
    assert first_cert.status_code == 201
    assert duplicate_cert.status_code == 409
