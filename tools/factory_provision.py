#!/usr/bin/env python3
"""
Cloudflare Tunnel Auto-Provisioning Script for Factory setup.
Usage:
  python3 factory_provision.py
  
Requires CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID to be set in environment.
"""

import os
import sys
import json
import uuid
import urllib.request

CF_API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN")
CF_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID")

if not CF_API_TOKEN or not CF_ACCOUNT_ID:
    print("Error: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set.")
    sys.exit(1)

def cf_api_call(endpoint, method="GET", data=None):
    url = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/cfd_tunnel"
    if endpoint:
        url += f"/{endpoint}"
        
    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=payload, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"API call failed: {e}")
        if hasattr(e, 'read'):
            print(e.read().decode('utf-8'))
        return None

def main():
    # 1. Generate unique device ID
    device_id = f"helmet-{uuid.uuid4().hex[:8]}"
    print(f"Provisioning {device_id}...")
    
    # 2. Create tunnel
    tunnel_res = cf_api_call("", method="POST", data={"name": device_id, "tunnel_secret": uuid.uuid4().hex * 2})
    if not tunnel_res or not tunnel_res.get('success'):
        print("Failed to create tunnel")
        sys.exit(1)
        
    tunnel_id = tunnel_res['result']['id']
    print(f"Tunnel Created: {tunnel_id}")
    
    # 3. Get tunnel token
    token_res = cf_api_call(f"{tunnel_id}/token")
    if not token_res or not token_res.get('success'):
        print("Failed to get tunnel token")
        sys.exit(1)
        
    token = token_res['result']
    
    # 4. In a real scenario, you'd route a DNS record to this tunnel.
    # We will use Cloudflare Quick Tunnels for demo, or assume a custom domain:
    # URL = f"https://{device_id}.aspire-vision.co.in"
    tunnel_url = f"https://{device_id}.aspire-vision.co.in"
    
    print(f"Tunnel URL: {tunnel_url}")
    
    # 5. Write to /etc/environment
    env_vars = f"""
CLOUDFLARE_URL="{tunnel_url}"
CLOUDFLARE_TUNNEL_TOKEN="{token}"
"""
    try:
        with open("factory_env.txt", "w") as f:
            f.write(env_vars)
        print("Variables written to factory_env.txt. Please append this to /etc/environment on the Pi.")
    except Exception as e:
        print("Error writing env file:", e)

if __name__ == "__main__":
    main()
