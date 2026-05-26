#!/usr/bin/env python3
import subprocess

def merge_audio_video(video_file, audio_file, output_file):
    """
    Merges the given video file and audio file into a single output file using ffmpeg.
    
    Parameters:
      video_file (str): Path to the video file.
      audio_file (str): Path to the audio file.
      output_file (str): Path where the merged file should be saved.
      
    Returns:
      bool: True if merging is successful, False otherwise.
    """
    cmd = [
        "ffmpeg",
        "-y",               # Overwrite output if exists.
        "-i", video_file,   # Input video.
        "-i", audio_file,   # Input audio.
        "-c:v", "copy",     # Copy the video stream without re-encoding.
        "-c:a", "aac",      # Encode the audio to AAC.
        output_file
    ]
    try:
        subprocess.run(cmd, check=True)
        print(f"Merged {video_file} and {audio_file} into {output_file}")
        return True
    except subprocess.CalledProcessError as e:
        print("ffmpeg merge error:", e)
        return False

if __name__ == '__main__':
    # Example test: This code will only run if you execute merger.py directly.
    video_file = "Videos/test_video.mp4"
    audio_file = "Audios/test_audio.wav"
    output_file = "Videos/test_merged.mp4"
    merge_audio_video(video_file, audio_file, output_file)
