import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

import torch
import numpy as np
from environment.sumo_env import SumoEnv
from agent.dqn_agent import DQNAgent

# Configuration
SUMO_CFG = r"c:\Users\pc\Desktop\Agent Carrefour Projet\sumo\osm.sumocfg"
BATCH_SIZE = 32
EPISODES = 10
MAX_STEPS = 500
TARGET_UPDATE = 5

def train():
    env = SumoEnv(SUMO_CFG, use_gui=False)
    state_size = env.state_size
    action_size = env.action_size
    
    agent = DQNAgent(state_size, action_size)
    
    # Load offline model if it exists to bootstrap
    offline_pth = "dqn_offline.pth"
    if os.path.exists(offline_pth):
        print(f"Loading offline pre-trained model: {offline_pth}")
        agent.load(offline_pth)
    
    print("Starting training...")
    
    try:
        for e in range(EPISODES):
            state = env.reset()
            total_reward = 0
            
            for step in range(MAX_STEPS):
                action = agent.act(state)
                next_state, reward, done, _ = env.step(action)
                
                agent.remember(state, action, reward, next_state, done)
                state = next_state
                total_reward += reward
                
                agent.train(BATCH_SIZE)
                
                if done:
                    break
            
            # Epsilon decay once per episode
            agent.decay_epsilon()
            
            if e % TARGET_UPDATE == 0:
                agent.update_target_model()
                
            print(f"Episode: {e+1}/{EPISODES}, Score: {total_reward:.2f}, Epsilon: {agent.epsilon:.2f}")
            
            # Save every 5 episodes
            if (e + 1) % 5 == 0:
                agent.save(f"dqn_agent_ep{e+1}.pth")
                
    except KeyboardInterrupt:
        print("\nTraining interrupted by user. Saving final model...")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
    finally:
        agent.save("dqn_agent_final.pth")
        env.close()
        print("Training finished/terminated!")

if __name__ == "__main__":
    train()
