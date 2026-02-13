from fastapi.testclient import TestClient
from main import app, get_db
from database import Base, engine, SessionLocal
import models
import uuid

# Create tables
models.Base.metadata.create_all(bind=engine)

client = TestClient(app)

def test_voting_flow():
    # Create a suggestion
    response = client.post("/suggestions", json={"text": "Test Suggestion"})
    assert response.status_code == 200
    suggestion_id = response.json()["id"]
    print(f"Created suggestion {suggestion_id}")

    user1 = str(uuid.uuid4())
    user2 = str(uuid.uuid4())

    # 1. User 1 Upvote
    print("1. User 1 Upvote")
    response = client.post(f"/suggestions/{suggestion_id}/vote?vote_type=up&user_id={user1}")
    assert response.status_code == 200
    data = response.json()
    assert data["upvotes"] == 1
    assert data["downvotes"] == 0
    print("   Passed")

    # 2. User 1 Upvote again (Toggle off)
    print("2. User 1 Upvote again (Toggle off)")
    response = client.post(f"/suggestions/{suggestion_id}/vote?vote_type=up&user_id={user1}")
    assert response.status_code == 200
    data = response.json()
    assert data["upvotes"] == 0
    assert data["downvotes"] == 0
    print("   Passed")

    # 3. User 1 Upvote again (Toggle on)
    print("3. User 1 Upvote again (Toggle on)")
    response = client.post(f"/suggestions/{suggestion_id}/vote?vote_type=up&user_id={user1}")
    assert response.status_code == 200
    data = response.json()
    assert data["upvotes"] == 1
    assert data["downvotes"] == 0
    print("   Passed")

    # 4. User 1 Downvote (Switch)
    print("4. User 1 Downvote (Switch)")
    response = client.post(f"/suggestions/{suggestion_id}/vote?vote_type=down&user_id={user1}")
    assert response.status_code == 200
    data = response.json()
    assert data["upvotes"] == 0
    assert data["downvotes"] == 1
    print("   Passed")

    # 5. User 2 Upvote
    print("5. User 2 Upvote")
    response = client.post(f"/suggestions/{suggestion_id}/vote?vote_type=up&user_id={user2}")
    assert response.status_code == 200
    data = response.json()
    assert data["upvotes"] == 1
    assert data["downvotes"] == 1
    print("   Passed")

    print("\nAll voting tests passed!")

if __name__ == "__main__":
    try:
        test_voting_flow()
    except Exception as e:
        print(f"Test failed: {e}")
        exit(1)
