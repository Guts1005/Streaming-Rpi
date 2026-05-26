#!/usr/bin/env python3
import RPi.GPIO as GPIO
import time
import threading

class GPIOHandler:
    def __init__(self, main_window):
        self.main_window = main_window
        # Define GPIO pins.
        self.btn_video = 17   # Video toggle pushbutton.
        self.btn_image = 27   # Image capture pushbutton.
        self.btn_audio = 22   # Audio toggle pushbutton.
        self.led_video = 23   # Video indicator LED.
        self.led_audio = 24   # Audio indicator LED.
        self.led_system = 25  # System "alive" LED.

        # Setup GPIO.
        GPIO.setmode(GPIO.BCM)
        # Setup buttons as inputs with pull-up resistors.
        GPIO.setup(self.btn_video, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(self.btn_image, GPIO.IN)
        GPIO.setup(self.btn_audio, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        # Setup LEDs as outputs.
        GPIO.setup(self.led_video, GPIO.OUT)
        GPIO.setup(self.led_audio, GPIO.OUT)
        GPIO.setup(self.led_system, GPIO.OUT)

        # Turn the system LED on.
        GPIO.output(self.led_system, GPIO.HIGH)

        self.running = True
        self.poll_thread = threading.Thread(target=self.poll_gpio, daemon=True)
        self.poll_thread.start()

    def poll_gpio(self):
        # Simple debouncing: remember last state.
        video_pressed = False
        image_pressed = False
        audio_pressed = False

        while self.running:
            # Check pushbuttons (active low).
            if GPIO.input(self.btn_video) == GPIO.LOW:
                if not video_pressed:
                    video_pressed = True
                    # Trigger video toggle in MainWindow.
                    self.main_window.toggle_video_recording()
            else:
                video_pressed = False

            if GPIO.input(self.btn_image) == GPIO.LOW:
                if not image_pressed:
                    image_pressed = True
                    # Trigger image capture.
                    self.main_window.handle_capture_image()
            else:
                image_pressed = False

            if GPIO.input(self.btn_audio) == GPIO.LOW:
                if not audio_pressed:
                    audio_pressed = True
                    # Trigger audio toggle.
                    self.main_window.toggle_audio_recording()
            else:
                audio_pressed = False

            # Update LED states based on the MainWindow flags.
            GPIO.output(self.led_video, GPIO.HIGH if self.main_window.video_recording else GPIO.LOW)
            GPIO.output(self.led_audio, GPIO.HIGH if self.main_window.audio_recording else GPIO.LOW)

            time.sleep(0.1)

    def cleanup(self):
        self.running = False
        self.poll_thread.join()
        # Turn off the system LED.
        GPIO.output(self.led_system, GPIO.LOW)
        GPIO.cleanup()
