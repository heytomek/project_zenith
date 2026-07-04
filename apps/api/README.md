# Zenith API

This app is the backend HTTP surface for the Zenith planning platform.

Phase-zero purpose:

- establish the FastAPI entrypoint
- define the `/api/v1` namespace
- prove the API can use shared schemas and the planner package cleanly

The current implementation is intentionally small. It includes:

- a health endpoint
- a dry-run planning endpoint backed by the planner stub

