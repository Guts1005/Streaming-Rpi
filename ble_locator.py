import asyncio
import json
import time
import os
import csv
import logging
import requests
from datetime import datetime
from bleak import BleakScanner

# --- Configuration ---
BEACONS_FILE = "beacons.json"
LOG_FILE = "beacon_logs.csv"
BACKEND_URL = "http://localhost:5000/api/update_gps"
SCAN_ACTIVE_SEC = 0.5
SCAN_SLEEP_SEC = 4.5
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

def log_detection(beacon_mac, location_info):
    file_exists = os.path.isfile(LOG_FILE)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lat = location_info.get("lat", 0.0)
    lon = location_info.get("lon", 0.0)
    name = location_info.get("name", "Unknown")
    
    try:
        with open(LOG_FILE, mode='a', newline='') as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["timestamp", "r_pi_id", "beacon_mac", "location_name", "lat", "lon"])
            writer.writerow([timestamp, DEVICE_ID, beacon_mac, name, lat, lon])
        logging.info(f"Logged detection: {name} ({beacon_mac})")
    except Exception as e:
        logging.error(f"Failed to write to {LOG_FILE}: {e}")

def update_backend(location_info):
    payload = {
        "lat": location_info.get("lat", 0.0),
        "lon": location_info.get("lon", 0.0),
        "accuracy": 10.0,
        "speed": 0.0
    }
    try:
        requests.post(BACKEND_URL, json=payload, timeout=2)
    except Exception as e:
        logging.error(f"Failed to post location to backend: {e}")

async def main():
    known_beacons = load_beacons()
    if not known_beacons:
        logging.error("No known beacons configured. Please add entries to beacons.json. Exiting.")
        return

    # Dictionary to hold the raw RSSI measurements over the last window
    rssi_history = {}
    current_beacon = None

    def detection_callback(device, advertisement_data):
        mac = device.address.upper()
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

        # Start scanning
        try:
            await scanner.start()
            await asyncio.sleep(SCAN_ACTIVE_SEC)
            await scanner.stop()
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
                    log_detection(current_beacon, known_beacons[current_beacon])
                    update_backend(known_beacons[current_beacon])
            else:
                current_beacon = best_beacon
                log_detection(current_beacon, known_beacons[current_beacon])
                update_backend(known_beacons[current_beacon])

        # Sleep to yield radio to Wi-Fi stack
        await asyncio.sleep(SCAN_SLEEP_SEC)

if __name__ == "__main__":
    logging.info("Starting BLE Indoor Positioning Service...")
    asyncio.run(main())
