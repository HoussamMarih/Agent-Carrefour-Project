from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import os

app = FastAPI()

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["traffic_rl"]
collection = db["simulation_data"]

@app.get("/trajectories")
async def get_trajectories(limit: int = 10):
    """Fetch the most recent simulation steps with trajectory data."""
    cursor = collection.find().sort("step", -1).limit(limit)
    data = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"]) # Convert ObjectId to string
        # Ensure timestamp is string for JSON
        if "timestamp" in doc:
            doc["timestamp"] = doc["timestamp"].isoformat()
        data.append(doc)
    return data[::-1] # Return in chronological order

@app.get("/stats")
async def get_stats():
    """Fetch overall simulation statistics."""
    last_doc = collection.find_one(sort=[("step", -1)])
    if not last_doc:
        return {"error": "No data found"}
    
    return {
        "step": last_doc.get("step"),
        "vehicle_count": last_doc.get("vehicle_count"),
        "total_waiting_time": last_doc.get("total_waiting_time"),
        "total_queue_length": last_doc.get("total_queue_length"),
        "traffic_lights": last_doc.get("traffic_lights")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
