# Streamlined Smart Helmet Setup (SOP)

This document outlines the ultra-fast, automated setup process for a new Raspberry Pi to run the Smart Helmet (Streaming-Rpi) project.

## 1. Prerequisites
- **Raspberry Pi 4B or 5** with power supply.
- **MicroSD Card** (16GB+ recommended).
- **Raspberry Pi Imager** installed on your PC.

## 2. Flash the OS
1. Open the Raspberry Pi Imager.
2. Select **Raspberry Pi OS (64-bit)** (Desktop or Lite, depending on your needs).
3. Open the Advanced Settings (gear icon) before writing:
   - Enable SSH.
   - Set the username and password (e.g., `trc`).
   - Configure your local Wi-Fi so the Pi connects automatically on boot.
4. Write the OS to the SD card.

## 3. Run the Automated Setup
Once the Pi has booted and connected to the internet, open a terminal on the Pi (either via SSH or directly on the desktop) and run the following command to download and execute the automated setup script:

```bash
wget -O setup_pi.sh "https://Guts1005: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@raw.githubusercontent.com/Guts1005/Streaming-Rpi/main/setup_pi.sh"
bash setup_pi.sh
```

*(Note: If you have already copied `setup_pi.sh` to the Pi via a USB stick or by manually creating it, simply run `bash setup_pi.sh` in the folder where it's located).*

### What the Script Asks For
The script is interactive for the first few seconds. It will ask you:
1. **Camera Type**: Select whether you are using the standard Raspberry Pi Camera (Option 1) or an IMX219 sensor (Option 2). The script will automatically edit `/boot/firmware/config.txt` to adjust `camera_auto_detect` and `dtoverlay=imx219`.

*(Note: LiveKit credentials and GitHub repository keys are now embedded in the script directly and require no input).*

After answering the prompts, you can walk away. The script will automatically:
- Install all system dependencies (`apt install ...`).
- Clone the repository securely using the embedded Personal Access Token.
- Create the Python virtual environment and install all PIP requirements.
- Copy all systemd services (`livekit-publisher`, `livekit-audio-bridge`, etc.) and enable them.
- Create the desktop autostart entry for the main updater interface.

## 4. Reboot
Once the script prints "Setup Complete!", reboot the system for the camera configuration and systemd daemons to take effect:

```bash
sudo reboot
```

You're done! The Pi will boot up, auto-connect, and begin publishing video/audio to LiveKit and the local APIs automatically.
