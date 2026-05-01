from fastapi.testclient import TestClient

from app.main import create_app


def test_health_endpoint_returns_healthy() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "autonexus-api",
    }
