from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from zenith_schemas.demand import (
    ServiceLevelPolicyCreate,
    ServiceLevelPolicyRead,
    ServiceLevelPolicyUpdate,
    WorkOrderCreate,
    WorkOrderDependencyCreate,
    WorkOrderDependencyRead,
    WorkOrderDependencyUpdate,
    WorkOrderRead,
    WorkOrderUpdate,
    WorkRequirementCreate,
    WorkRequirementRead,
    WorkRequirementUpdate,
)

from app.api.dependencies import db_session_dependency
from app.services.demand_service import (
    create_service_level_policy,
    create_work_order,
    create_work_order_dependency,
    create_work_requirement,
    delete_service_level_policy,
    delete_work_order,
    delete_work_order_dependency,
    delete_work_requirement,
    get_service_level_policy,
    get_work_order,
    get_work_order_dependency,
    get_work_requirement,
    list_service_level_policies,
    list_work_order_dependencies,
    list_work_orders,
    list_work_requirements,
    update_service_level_policy,
    update_work_order,
    update_work_order_dependency,
    update_work_requirement,
)

router = APIRouter(prefix="/organizations/{organization_id}")
DBSession = Annotated[Session, Depends(db_session_dependency)]


@router.get("/service-level-policies", response_model=list[ServiceLevelPolicyRead])
def service_level_policies_index(
    organization_id: UUID, session: DBSession
) -> list[ServiceLevelPolicyRead]:
    return list_service_level_policies(session, organization_id)


@router.post(
    "/service-level-policies",
    response_model=ServiceLevelPolicyRead,
    status_code=status.HTTP_201_CREATED,
)
def service_level_policies_create(
    organization_id: UUID,
    payload: ServiceLevelPolicyCreate,
    session: DBSession,
) -> ServiceLevelPolicyRead:
    return create_service_level_policy(session, organization_id, payload)


@router.get("/service-level-policies/{policy_id}", response_model=ServiceLevelPolicyRead)
def service_level_policies_get(
    organization_id: UUID, policy_id: UUID, session: DBSession
) -> ServiceLevelPolicyRead:
    return get_service_level_policy(session, organization_id, policy_id)


@router.patch("/service-level-policies/{policy_id}", response_model=ServiceLevelPolicyRead)
def service_level_policies_update(
    organization_id: UUID,
    policy_id: UUID,
    payload: ServiceLevelPolicyUpdate,
    session: DBSession,
) -> ServiceLevelPolicyRead:
    return update_service_level_policy(session, organization_id, policy_id, payload)


@router.delete("/service-level-policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def service_level_policies_delete(
    organization_id: UUID, policy_id: UUID, session: DBSession
) -> Response:
    delete_service_level_policy(session, organization_id, policy_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/work-orders", response_model=list[WorkOrderRead])
def work_orders_index(organization_id: UUID, session: DBSession) -> list[WorkOrderRead]:
    return list_work_orders(session, organization_id)


@router.post("/work-orders", response_model=WorkOrderRead, status_code=status.HTTP_201_CREATED)
def work_orders_create(
    organization_id: UUID, payload: WorkOrderCreate, session: DBSession
) -> WorkOrderRead:
    return create_work_order(session, organization_id, payload)


@router.get("/work-orders/{work_order_id}", response_model=WorkOrderRead)
def work_orders_get(
    organization_id: UUID, work_order_id: UUID, session: DBSession
) -> WorkOrderRead:
    return get_work_order(session, organization_id, work_order_id)


@router.patch("/work-orders/{work_order_id}", response_model=WorkOrderRead)
def work_orders_update(
    organization_id: UUID,
    work_order_id: UUID,
    payload: WorkOrderUpdate,
    session: DBSession,
) -> WorkOrderRead:
    return update_work_order(session, organization_id, work_order_id, payload)


@router.delete("/work-orders/{work_order_id}", status_code=status.HTTP_204_NO_CONTENT)
def work_orders_delete(
    organization_id: UUID, work_order_id: UUID, session: DBSession
) -> Response:
    delete_work_order(session, organization_id, work_order_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/work-orders/{work_order_id}/requirements", response_model=list[WorkRequirementRead])
def work_requirements_index(
    organization_id: UUID,
    work_order_id: UUID,
    session: DBSession,
) -> list[WorkRequirementRead]:
    return list_work_requirements(session, organization_id, work_order_id)


@router.post(
    "/work-orders/{work_order_id}/requirements",
    response_model=WorkRequirementRead,
    status_code=status.HTTP_201_CREATED,
)
def work_requirements_create(
    organization_id: UUID,
    work_order_id: UUID,
    payload: WorkRequirementCreate,
    session: DBSession,
) -> WorkRequirementRead:
    return create_work_requirement(session, organization_id, work_order_id, payload)


@router.get(
    "/work-orders/{work_order_id}/requirements/{requirement_id}",
    response_model=WorkRequirementRead,
)
def work_requirements_get(
    organization_id: UUID,
    work_order_id: UUID,
    requirement_id: UUID,
    session: DBSession,
) -> WorkRequirementRead:
    return get_work_requirement(session, organization_id, work_order_id, requirement_id)


@router.patch(
    "/work-orders/{work_order_id}/requirements/{requirement_id}",
    response_model=WorkRequirementRead,
)
def work_requirements_update(
    organization_id: UUID,
    work_order_id: UUID,
    requirement_id: UUID,
    payload: WorkRequirementUpdate,
    session: DBSession,
) -> WorkRequirementRead:
    return update_work_requirement(session, organization_id, work_order_id, requirement_id, payload)


@router.delete(
    "/work-orders/{work_order_id}/requirements/{requirement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def work_requirements_delete(
    organization_id: UUID,
    work_order_id: UUID,
    requirement_id: UUID,
    session: DBSession,
) -> Response:
    delete_work_requirement(session, organization_id, work_order_id, requirement_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/work-order-dependencies", response_model=list[WorkOrderDependencyRead])
def work_order_dependencies_index(
    organization_id: UUID,
    session: DBSession,
) -> list[WorkOrderDependencyRead]:
    return list_work_order_dependencies(session, organization_id)


@router.post(
    "/work-order-dependencies",
    response_model=WorkOrderDependencyRead,
    status_code=status.HTTP_201_CREATED,
)
def work_order_dependencies_create(
    organization_id: UUID,
    payload: WorkOrderDependencyCreate,
    session: DBSession,
) -> WorkOrderDependencyRead:
    return create_work_order_dependency(session, organization_id, payload)


@router.get("/work-order-dependencies/{dependency_id}", response_model=WorkOrderDependencyRead)
def work_order_dependencies_get(
    organization_id: UUID,
    dependency_id: UUID,
    session: DBSession,
) -> WorkOrderDependencyRead:
    return get_work_order_dependency(session, organization_id, dependency_id)


@router.patch("/work-order-dependencies/{dependency_id}", response_model=WorkOrderDependencyRead)
def work_order_dependencies_update(
    organization_id: UUID,
    dependency_id: UUID,
    payload: WorkOrderDependencyUpdate,
    session: DBSession,
) -> WorkOrderDependencyRead:
    return update_work_order_dependency(session, organization_id, dependency_id, payload)


@router.delete("/work-order-dependencies/{dependency_id}", status_code=status.HTTP_204_NO_CONTENT)
def work_order_dependencies_delete(
    organization_id: UUID,
    dependency_id: UUID,
    session: DBSession,
) -> Response:
    delete_work_order_dependency(session, organization_id, dependency_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
