import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('192.168.0.138', username='trc', password='1234', timeout=5)
stdin, stdout, stderr = ssh.exec_command('/home/trc/Desktop/Projects/Streaming-Rpi/hm_releases/venv/bin/python -c "import sounddevice as sd; print(sd.query_devices())"')
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))
ssh.close()
