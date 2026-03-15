import traci
from pymongo import MongoClient
from datetime import datetime, UTC
import os
import sys

# -----------------------------
# Path Resolution
# -----------------------------
# Get the absolute path to the project root (Carrefour Projet)
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sumo_cfg = os.path.join(project_root, "sumo", "osm.sumocfg")
sumo_cfg = os.path.normpath(sumo_cfg)

print(f"Project Root: {project_root}")
print(f"SUMO Config: {sumo_cfg}")

if not os.path.exists(sumo_cfg):
    print(f"CRITICAL ERROR: SUMO config file not found at {sumo_cfg}")
    sys.exit(1)

# -----------------------------
# MongoDB connection
# -----------------------------
try:
    client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=5000)
    client.server_info() # trigger connection
    db = client["traffic_rl"]
    collection = db["simulation_data"]
    print("Connected to MongoDB successfully")
except Exception as e:
    print(f"WARNING: Could not connect to MongoDB: {e}. Data will not be saved.")
    collection = None

# -----------------------------
# SUMO start
# -----------------------------
sumo_binary = "sumo-gui"
sumo_cmd = [sumo_binary, "-c", sumo_cfg, "--start"]

print(f"Starting SUMO with command: {' '.join(sumo_cmd)}")
try:
    traci.start(sumo_cmd)
    print("Simulation started...")
except Exception as e:
    print(f"CRITICAL ERROR: Could not start TraCI: {e}")
    sys.exit(1)

step = 0
try:
    while traci.simulation.getMinExpectedNumber() > 0:
        traci.simulationStep()

        if collection is not None:
            # Vehicles
            vehicles = traci.vehicle.getIDList()
            vehicle_data = []
            for v in vehicles:
                vehicle_info = {
                    "vehicle_id": v,
                    "speed": traci.vehicle.getSpeed(v),
                    "lane": traci.vehicle.getLaneID(v),
                    "waiting_time": traci.vehicle.getWaitingTime(v),
                    "position": traci.vehicle.getPosition(v),
                    "route": traci.vehicle.getRouteID(v)
                }
                vehicle_data.append(vehicle_info)

            # Lanes
            lanes = traci.lane.getIDList()
            lane_state = []
            total_waiting = 0
            total_queue = 0
            for lane in lanes:
                waiting = traci.lane.getWaitingTime(lane)
                halted = traci.lane.getLastStepHaltingNumber(lane)
                speed = traci.lane.getLastStepMeanSpeed(lane)
                lane_info = {
                    "lane_id": lane,
                    "waiting_time": waiting,
                    "queue_length": halted,
                    "mean_speed": speed
                }
                lane_state.append(lane_info)
                total_waiting += waiting
                total_queue += halted

            # Traffic lights
            tls = traci.trafficlight.getIDList()
            traffic_lights = []
            for tl in tls:
                tl_info = {
                    "traffic_light_id": tl,
                    "phase": traci.trafficlight.getPhase(tl),
                    "phase_duration": traci.trafficlight.getPhaseDuration(tl),
                    "state": traci.trafficlight.getRedYellowGreenState(tl)
                }
                traffic_lights.append(tl_info)

            # Global state
            simulation_data = {
                "step": step,
                "timestamp": datetime.now(UTC),
                "vehicle_count": len(vehicles),
                "total_waiting_time": total_waiting,
                "total_queue_length": total_queue,
                "vehicles": vehicle_data,
                "lanes": lane_state,
                "traffic_lights": traffic_lights
            }
            collection.insert_one(simulation_data)

        if step % 100 == 0:
            print(f"Step {step} processed.")
        step += 1

except traci.exceptions.FatalTraCIError:
    print("TraCI Connection closed.")
except Exception as e:
    print(f"Error during simulation: {e}")
finally:
    print("Cleaning up...")
    try:
        traci.close()
    except:
        pass
    if client:
        client.close()
    print("Done.")