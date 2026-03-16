from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import os
import subprocess
import signal
import xml.etree.ElementTree as ET

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

# Keep track of simulation process
simulation_process = None

# Network File Path
net_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "sumo", "osm.net.xml")

@app.get("/network")
async def get_network():
    """Parse the SUMO network XML and return basic geometry for drawing."""
    if not os.path.exists(net_file_path):
        return {"error": "Network file not found"}

    try:
        tree = ET.parse(net_file_path)
        root = tree.getroot()
        
        edges = []
        # Find all edges (roads)
        for edge in root.findall('edge'):
            # Filter out internal edges (within junctions) if desired, or keep them to draw intersections
            # For a basic map, we keep all that have shapes
            lanes = edge.findall('lane')
            for lane in lanes:
                if 'shape' in lane.attrib:
                    shape_str = lane.attrib['shape']
                    # shape="x1,y1 x2,y2 ..."
                    points = []
                    for pt_str in shape_str.split():
                        coords = pt_str.split(',')
                        if len(coords) == 2:
                            x, y = float(coords[0]), float(coords[1])
                            points.append({"x": x, "y": y})
                    if points:
                        edges.append({
                            "id": lane.attrib.get('id', ''),
                            "shape": points,
                            "type": edge.attrib.get('type', ''),
                            "is_internal": edge.attrib.get('function') == "internal"
                        })
        return {"edges": edges}
    except Exception as e:
        return {"error": str(e)}

@app.post("/simulation/start")
async def start_simulation():
    """Start the SUMO simulation subprocess."""
    global simulation_process
    
    if simulation_process is not None and simulation_process.poll() is None:
        return {"status": "already_running"}
        
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "store_simulation.py")
    
    try:
        # Launch process in background
        simulation_process = subprocess.Popen(
            ["python", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP # Required for sending signals on Windows
        )
        return {"status": "started"}
    except Exception as e:
        return {"error": str(e)}

@app.post("/simulation/stop")
async def stop_simulation():
    """Stop the running SUMO simulation subprocess."""
    global simulation_process
    
    if simulation_process is None or simulation_process.poll() is not None:
        return {"status": "not_running"}
        
    try:
        # On Windows, sending CTRL_BREAK_EVENT to the process group
        os.kill(simulation_process.pid, signal.CTRL_BREAK_EVENT)
        simulation_process.wait(timeout=5)
        simulation_process = None
        return {"status": "stopped"}
    except subprocess.TimeoutExpired:
        if simulation_process:
            simulation_process.terminate()
            simulation_process = None
        return {"status": "force_killed"}
    except Exception as e:
        return {"error": str(e)}

@app.get("/simulation/status")
async def get_simulation_status():
    """Check if simulation is currently running."""
    global simulation_process
    is_running = simulation_process is not None and simulation_process.poll() is None
    return {"running": is_running}

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
    
    avg_speed = last_doc.get("average_speed")
    if avg_speed is None and last_doc.get("vehicles"):
        speeds = [v.get("speed", 0) for v in last_doc["vehicles"]]
        avg_speed = sum(speeds) / len(speeds) if speeds else 0

    return {
        "step": last_doc.get("step"),
        "vehicle_count": last_doc.get("vehicle_count"),
        "average_speed": avg_speed,
        "total_waiting_time": last_doc.get("total_waiting_time"),
        "total_queue_length": last_doc.get("total_queue_length"),
        "traffic_lights": last_doc.get("traffic_lights")
    }

@app.get("/replay/info")
async def get_replay_info():
    """Return info about stored simulation: min/max step, total count."""
    total = collection.count_documents({})
    if total == 0:
        return {"total_steps": 0, "min_step": 0, "max_step": 0}
    min_doc = collection.find_one(sort=[("step", 1)])
    max_doc = collection.find_one(sort=[("step", -1)])
    return {
        "total_steps": total,
        "min_step": min_doc.get("step", 0),
        "max_step": max_doc.get("step", 0),
    }

@app.get("/replay/step/{step_num}")
async def get_replay_step(step_num: int):
    """Return simulation data for a specific step number."""
    doc = collection.find_one({"step": step_num})
    if not doc:
        # Try to find the closest step
        doc = collection.find_one(sort=[("step", 1)], filter={"step": {"$gte": step_num}})
    if not doc:
        return {"error": "Step not found"}
    
    doc["_id"] = str(doc["_id"])
    if "timestamp" in doc:
        doc["timestamp"] = doc["timestamp"].isoformat()
    
    # Calculate average speed if missing
    if "average_speed" not in doc and doc.get("vehicles"):
        speeds = [v.get("speed", 0) for v in doc["vehicles"]]
        doc["average_speed"] = sum(speeds) / len(speeds) if speeds else 0
        
    return doc

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
