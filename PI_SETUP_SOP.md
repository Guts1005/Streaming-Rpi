# Streamlined Smart Helmet Setup (SOP)

This document outlines the ultra-fast, automated setup process for a new Raspberry Pi to run the Smart Helmet project. It has been entirely refactored to support our new SRS (Simple Realtime Server) streaming architecture and multi-camera support.

## 1. Hardware & Software Requirements
- **Raspberry Pi**: Raspberry Pi 4B or 5 recommended.
- **Power Supply**: Official 15W or 27W USB-C power supply.
- **MicroSD Card**: 16GB+ recommended (Class 10 or higher).
- **Camera**: 
  - Standard Raspberry Pi Camera Module (CSI), or
  - IMX219 Camera Module (CSI), or
  - Any standard USB Camera (e.g., Logitech C920).
- **Microphone**: USB Microphone or built-in webcam mic.
- **Software**: [Raspberry Pi Imager](https://www.raspberrypi.com/software/) installed on your PC.

## 2. Flash the OS
1. Open the **Raspberry Pi Imager**.
2. **Choose OS**: Select **Raspberry Pi OS (64-bit)** (Desktop or Lite, depending on whether you need a UI).
3. **Choose Storage**: Select your inserted MicroSD Card.
4. **Advanced Settings (Gear Icon / OS Customization)**:
   - Check **Set hostname** (e.g., `smarthelmet`).
   - Check **Enable SSH** (Use password authentication).
   - Check **Set username and password** (e.g., username `trc`, and a secure password).
   - Check **Configure wireless LAN** and enter your local Wi-Fi details so the Pi connects automatically on boot.
5. Click **Next** and **Write** the OS to the SD card.

## 3. Run the Automated "One-Click" Setup
Once the Pi has booted and connected to your Wi-Fi, open a terminal on the Pi (either via SSH or directly on the desktop) and run the following commands to download and execute the automated setup script:

```bash
cd ~
wget -O setup_pi.sh "https://Guts1005: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@raw.githubusercontent.com/Guts1005/Streaming-Rpi/main/setup_pi.sh"
bash setup_pi.sh
```

*(Note: The embedded GitHub PAT allows secure cloning without prompting for passwords).*

### The Interactive Camera & Audio Selection
The script is interactive for the first few seconds. It will detect connected `/dev/video*` devices and ask you:
1. **Camera Selection**: 
   - Enter `1` for the Standard Pi Camera.
   - Enter `2` for an IMX219 Pi Camera.
   - Enter `3` (or higher) to select an auto-detected USB camera.
2. **Microphone Selection**:
   - The script defaults to `hw:3,0` (which corresponds to most USB microphones on the Pi). You can press `1` to accept this default, or `2` to type a custom ALSA device.

**What the script does next:**
- Saves your hardware selection to `.env`.
- Installs all system dependencies (`apt install ...`).
- Creates a Python virtual environment and installs all PIP requirements.
- Configures and launches the local **SRS (Simple Realtime Server)** Docker container for video streaming.
- Modifies `/boot/firmware/config.txt` to correctly initialize the CSI cameras (if selected).
- Sets up and enables `systemd` services (`smart-helmet-backend`, `srs-publisher`, `gpio-offline-capture`, `wifi-qr-connect`).

## 4. Reboot
Once the script prints "Setup Complete!", reboot the system so that camera kernel modules and systemd daemons can start properly:

```bash
sudo reboot
```

## 5. Verification
After the Pi reboots, it will automatically start streaming and serving APIs.
1. **Verify Backend API**: Open a browser on the same network and navigate to `http://<PI_IP_ADDRESS>:5001/api/health`. You should see a JSON payload confirming the camera is online.
2. **Verify Video Stream**: The video stream is ingested into the local SRS server. The Next.js dashboard uses HTTP-FLV to consume it. Verify by checking if `srs-publisher.service` is running:
   ```bash
   sudo systemctl status srs-publisher
   ```
3. **Verify Offline Capture**: Press the configured GPIO record/photo buttons to ensure videos save to the `recordings/` folder.
