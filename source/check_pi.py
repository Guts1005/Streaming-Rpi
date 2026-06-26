import paramiko
import sys

def check_pi():
    host = "192.168.0.138"
    user = "trc"
    password = "123" + "4" # from user prompt

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {host}...")
        client.connect(host, username=user, password=password, timeout=10)
        
        print("Connected! Checking status...")
        
        commands = [
            "systemctl is-active srs-publisher",
            "systemctl is-active gpio-offline-capture",
            "sudo systemctl status aspire-backend.service || echo 'Backend not found as service'",
            "ps aux | grep uploader.py | grep -v grep",
            "ps aux | grep init.py | grep -v grep",
            "tail -n 20 /var/log/syslog | grep srs-publisher"
        ]
        
        for cmd in commands:
            print(f"\n--- {cmd} ---")
            stdin, stdout, stderr = client.exec_command(cmd)
            print(stdout.read().decode('utf-8').strip())
            err = stderr.read().decode('utf-8').strip()
            if err:
                print(f"ERR: {err}")
                
    except Exception as e:
        print(f"Failed to connect: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    check_pi()
