import asyncio
import json
import time
import os
import logging
import requests
from datetime import datetime
from bleak import BleakScanner

# --- Configuration ---
BEACONS_FILE = os.path.join(os.path.dirname(__file__), "beacons.json")
BACKEND_URL = "http://localhost:5000/api/update_gps"
CLOUD_LOGS_URL = "https://helmet-live-viewer.vercel.app/api/beacons/logs"
BACKEND_URL = "http://localhost:5000/api/update_gps"
SCAN_ACTIVE_SEC = 2.5
SCAN_SLEEP_SEC = 2.5
HYSTERESIS_DB = 5.0

# Extract Device ID from init.py or environment
DEVICE_ID = "smart_hm_default"
try:
    with open("init.py", "r") as f:
        for line in f:
            if line.startswith("DEVICE_ID"):
                parts = line.split("=")
                if len(parts) == 2:
                    DEVICE_ID = parts[1].strip().strip('"').strip("'")
                break
except Exception as e:
    logging.warning(f"Could not read DEVICE_ID from init.py: {e}")

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

def load_beacons():
    if not os.path.exists(BEACONS_FILE):
        logging.warning(f"Configuration file {BEACONS_FILE} not found.")
        return {}
    try:
        with open(BEACONS_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logging.error(f"Error reading {BEACONS_FILE}: {e}")
        return {}

def log_detection(beacon_mac, location_info, rssi):
    # This function is kept for structural compatibility if needed elsewhere,
    # but we no longer write to local CSV.
    pass

def log_master(beacon_mac, location_info):
    # Master is now managed in the cloud database.
    pass

def log_to_cloud(beacon_mac, location_info):
    payload = {
        "r_pi_id": DEVICE_ID,
        "beacon_mac": beacon_mac,
        "site_id": location_info.get("site_id", "")
    }
    try:
        # Fire and forget request to log the scan to the cloud database
        requests.post(CLOUD_LOGS_URL, json=payload, timeout=2)
        logging.info(f"Logged to cloud: {location_info.get('name', 'Unknown')} ({beacon_mac})")
    except Exception as e:
        logging.warning(f"Failed to post log to cloud: {e}")

def update_backend(location_info, beacon_mac=None):
    payload = {
        "lat": location_info.get("lat", 0.0),
        "lon": location_info.get("lon", 0.0),
        "accuracy": 10.0,
        "speed": 0.0,
        "site_id": location_info.get("site_id", ""),
        "beacon_mac": beacon_mac or "",
        "location_name": location_info.get("name", "Unknown")
    }
    try:
        requests.post(BACKEND_URL, json=payload, timeout=2)
    except Exception as e:
        logging.error(f"Failed to post location to backend: {e}")

async def main():
    # Dictionary to hold the raw RSSI measurements over the last window
    rssi_history = {}
    current_beacon = None
    seen_all = {}
    known_beacons = {}
    def detection_callback(device, advertisement_data):
        mac = device.address.upper()
        name = device.name or advertisement_data.local_name or "Unknown"
        
        # Save for UI scanning (Only if name starts with ISC)
        if name.startswith("ISC"):
            seen_all[mac] = {
                "mac": mac, 
                "name": name, 
                "rssi": advertisement_data.rssi
            }
        
        if mac in known_beacons:
            if mac not in rssi_history:
                rssi_history[mac] = []
            rssi_history[mac].append(advertisement_data.rssi)

    scanner = BleakScanner(detection_callback)

    while True:
        # Refresh configuration dynamically if needed
        known_beacons = load_beacons()
        
        # Clear history for the new window
        rssi_history.clear()
        seen_all.clear()

        # Start scanning
        try:
            await scanner.start()
            await asyncio.sleep(SCAN_ACTIVE_SEC)
            await scanner.stop()
            
            # Write seen beacons to file for the UI to read
            try:
                import json
                with open("seen_beacons.json", "w") as f:
                    json.dump(list(seen_all.values()), f)
            except Exception as e:
                logging.error(f"Failed to write seen beacons: {e}")
                
        except Exception as e:
            logging.error(f"Scanner error: {e}")
            await asyncio.sleep(SCAN_SLEEP_SEC)
            continue

        # Evaluate the closest beacon based on smoothed (average) RSSI
        best_beacon = None
        best_rssi = -1000

        for mac, rssi_list in rssi_history.items():
            if not rssi_list:
                continue
            avg_rssi = sum(rssi_list) / len(rssi_list)
            if avg_rssi > best_rssi:
                best_rssi = avg_rssi
                best_beacon = mac

        # Apply Hysteresis
        if best_beacon and best_beacon != current_beacon:
            if current_beacon and current_beacon in rssi_history:
                curr_list = rssi_history[current_beacon]
                curr_avg = sum(curr_list) / len(curr_list) if curr_list else -1000
                if best_rssi > curr_avg + HYSTERESIS_DB:
                    current_beacon = best_beacon
            else:
                current_beacon = best_beacon

        # Log the current beacon continuously (every scan window)
        if current_beacon and current_beacon in known_beacons:
            log_to_cloud(current_beacon, known_beacons[current_beacon])
            update_backend(known_beacons[current_beacon], current_beacon)

        # Sleep to yield radio to Wi-Fi stack
        await asyncio.sleep(SCAN_SLEEP_SEC)

if __name__ == "__main__":
    logging.info("Starting BLE Indoor Positioning Service...")
    asyncio.run(main())
