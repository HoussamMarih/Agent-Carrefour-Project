import traci
import numpy as np
import os
import sys

# Ensure tools are in the path
if 'SUMO_HOME' in os.environ:
    tools = os.path.join(os.environ['SUMO_HOME'], 'tools')
    sys.path.append(tools)
else:
    sys.exit("Please declare environment variable 'SUMO_HOME'")

class SumoEnv:
    def __init__(self, sumo_cfg, use_gui=False):
        self.sumo_cfg = sumo_cfg
        self.use_gui = use_gui
        self.sumo_binary = "sumo-gui" if use_gui else "sumo"
        
        # TL ID and its main green phases
        self.tl_id = "GS_cluster_1129520357_2244985060_429317110_6657741371"
        self.green_phases = [0, 2]  # rrrrrGGGggrrrrrGGGgg and GGGggrrrrrGGGggrrrrr
        self.yellow_phases = [1, 3] # rrrrryyyyyrrrrryyyyy and yyyyyrrrrryyyyyrrrrr
        
        self.incoming_lanes = [
            '97561122#0_0', '97561122#0_1',
            '1312222683#0_0', '1312222683#0_1',
            '215135062#0_0', '215135062#0_1',
            '215078584#0_0', '215078584#0_1'
        ]
        
        self.state_size = len(self.incoming_lanes) * 2 # waiting_time and queue_length
        self.action_size = len(self.green_phases)
        
        self.current_phase = -1
        self.yellow_duration = 4
        self.step_duration = 5
        
    def reset(self):
        if traci.isLoaded():
            traci.close()
        
        # Adding --start and --quit-on-end for a smoother experience
        sumo_cmd = [self.sumo_binary, "-c", self.sumo_cfg, "--no-warnings", 
                    "--waiting-time-memory", "1000", "--start", "--quit-on-end"]
        
        traci.start(sumo_cmd)
        self.current_phase = 0
        traci.trafficlight.setPhase(self.tl_id, self.green_phases[0])
        return self._get_state()
        
    def _get_state(self):
        state = []
        for lane in self.incoming_lanes:
            # Normalized queue length (max expected ~20-30m per lane in this small area)
            queue = traci.lane.getLastStepHaltingNumber(lane) / 20.0
            # Normalized waiting time (max expected ~100s)
            waiting = traci.lane.getWaitingTime(lane) / 100.0
            state.extend([queue, waiting])
        return np.array(state, dtype=np.float32)

    def step(self, action):
        reward = 0
        done = False
        
        try:
            # Check if we need a yellow transition
            if action != self.current_phase:
                # Set yellow
                traci.trafficlight.setPhase(self.tl_id, self.yellow_phases[self.current_phase])
                for _ in range(self.yellow_duration):
                    traci.simulationStep()
                
            # Set green
            traci.trafficlight.setPhase(self.tl_id, self.green_phases[action])
            self.current_phase = action
            
            # Advance simulation
            prev_waiting = sum([traci.lane.getWaitingTime(l) for l in self.incoming_lanes])
            
            for _ in range(self.step_duration):
                traci.simulationStep()
                
            next_state = self._get_state()
            curr_waiting = sum([traci.lane.getWaitingTime(l) for l in self.incoming_lanes])
            
            # Reward: negative change in waiting time (improvement) and negative queue length
            reward = (prev_waiting - curr_waiting) / 100.0
            
            if traci.simulation.getMinExpectedNumber() <= 0:
                done = True
        except traci.exceptions.FatalTraCIError:
            done = True
            next_state = self._get_state() if traci.isLoaded() else np.zeros(self.state_size, dtype=np.float32)
            
        return next_state, reward, done, {}
        
    def close(self):
        traci.close()
