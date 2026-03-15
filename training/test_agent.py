import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

import torch
from environment.sumo_env import SumoEnv
from agent.dqn_agent import DQNAgent

# Configuration
SUMO_CFG = r"c:\Users\pc\Desktop\Agent Carrefour Projet\sumo\osm.sumocfg"
MODEL_PATH = "dqn_agent_final.pth"

def test():
    # use_gui=True allows you to watch the simulation
    env = SumoEnv(SUMO_CFG, use_gui=True)
    state_size = env.state_size
    action_size = env.action_size
    
    # Initialize agent with 0 epsilon (no exploration, only exploitation)
    agent = DQNAgent(state_size, action_size, epsilon=0.0)
    
    if os.path.exists(MODEL_PATH):
        print(f"Loading trained model: {MODEL_PATH}")
        agent.load(MODEL_PATH)
    else:
        print(f"Warning: {MODEL_PATH} not found. Running with random agent.")
    
    print("Starting evaluation...")
    state = env.reset()
    total_reward = 0
    done = False
    
    while not done:
        action = agent.act(state)
        state, reward, done, _ = env.step(action)
        total_reward += reward
        
    print(f"Testing finished! Total Reward: {total_reward:.2f}")
    env.close()

if __name__ == "__main__":
    test()
