---
authors:
- roisin-sharma
categories:
- Reality Bending Lab
- University of Sussex
date: "2026-01-11"
image:
  caption: ''
  placement: 0
title: "How to send event triggers to Lab Streaming Layer from JsPsych"
subtitle: "Understand the steps involving in setting up event triggers for your JsPsych experiments, including creating the bridge to Lab Streaming Layer, ensuring synchronisation with other signals and highly accurate timestamps."
summary: "Understand the steps involving in setting up event triggers for your JsPsych experiments, including creating the bridge to Lab Streaming Layer, ensuring synchronisation with other signals and highly accurate timestamps."
tags:
- LSL
- Data Collection
- JsPsych
- Reality Bending Lab
- ReBeL
- University of Sussex
- Psychology
---

Hello there! 👋 Let's learn how to send event triggers to Lab Streaming Layer (LSL) from JsPsych.

Lets start with some basics!

## What does this mean and when is this useful?

Lab streaming layer (LSL) is a system used to receive, synchronise and stream signals from multiple inputs during experiments. LSL is designed to help researchers easily compare their data across multiple technologies, as time synchrony is integral for making valid comparisons.

When collecting data on stimulus response during experiments, it's important that the stimulus onset is recorded precisely, especially if this is mapped onto physiological responses as this has implications on how we interpret our data. One good example of a use case is that you have a Muse headband or any other device that can scream via LSL, and you want to precisely mark events in it.

Event triggers are coded into JsPsych online experiments to accurately mark events, such as when a stimulus appeared on the screen. We have found this method to yield the most precise timestamps of events, compared to alternative methods such as using the Bitalino LUX.

This tutorial will explain how to set this up for an experiment situated on GitHub, although you can adapt this for your hosting platform.

This blog will help you understand the set-up for event triggers. For an example of this in action, refer to <https://github.com/OliverACollins/muse-athena-test/tree/main/blackwhite>. This experiment recorded markers on a screen turning from white to black- you may want to follow along with lsl_bridge.py and blackwhite_jspsych.html [^1] for the full implementation.

[^1]: Special shoutout to our placement student Oliver Collins for preparing these scripts!

## How to set up event triggers

#### Requirements:

-   **Your experiment is in-person:** In order to use these event triggers, you will need to run your experiment on a local host server, which will need to be manually set up for each trial. Therefore, this setup is intended for in-person experiments that are led by a researcher to set up the participant's screen.

-   **The researcher and the participant(s) each have a computer:** The participant's computer will send the markers to the researcher's computer, which will be used to record the events (and all other signals using LSL) during the trial.

#### The LSL bridge script:

The LSL bridge will send the markers to LSL- it 'listens' for messages from the browser that the participant is doing the experiment from, and converts them into 'markers' for your recording software (such as LabRecorder) will receive.

1.  Configuration

    -   **Imports**: Load in standard python libraries for creating a web server (`http.server`, `urllib`) and the `mne_lsl` library to handle the data streaming.

    -   **Configure Variables**: Name the event trigger stream so you can find it in LabRecorder, e.g. `LSL_STREAM_NAME = "jsPsychMarkers"`.

    -   Add `SERVER_HOST = "0.0.0.0"` into the script to tell the server to listen to all available network interfaces, allowing the participant's computer to communicate with the researcher's.

    -   Specify the port for the html script to go to e.g. `SERVER_PORT = 5000`. You will add this port into the html script that holds the online experiment to, in order to send the experiment to this python script.

2.  Create the LSL outlet for event triggers

    -   Define the metadata for the stream: `info = StreamInfo( name=LSL_STREAM_NAME...`

    -   Create the outlet object that will push data out to the network: `outlet = StreamOutlet(info)`.

3.  Create the request handler to define what happens when the participant's browser contacts the server.

    -   The sync route:

        -   `if path == "/sync":`: Checks if the browser is asking to synchronize clocks.

        -   `ts = local_clock()`: Grabs the current high-precision time from the LSL clock on the Recording Machine.

        -   `self.wfile.write(...)`: Sends this timestamp back to the browser. The browser needs this to calculate the time difference (offset) between the two computers.

    -   The marker route:

        -   `elif path == "/marker"`: Checks if the browser is trying to send an event marker.
        -   It extracts `value` (the marker name, e.g., "1") and `ts` (the timestamp calculated by the browser) from the URL parameters.
        -   `outlet.push_sample([value], ts)`: This is the most important line. It injects the marker into the LSL stream *using the timestamp provided by the browser*. This ensures that even if there is network lag, the timestamp recorded in the EEG data remains accurate to when the event actually happened on the participant's screen.

4.  Run the Server

    -   `run_server()`: Starts the HTTP server and prints a confirmation message that it is ready for LabRecorder.
    -   `threading.Thread(...)`: Runs the server in a separate thread so it doesn't block the main Python process.

#### Synchronise your event triggers in the html script:

This is 'promise-based', meaning it is coded to wait until it receives a signal from the participant's computer. This javascript code is designed to track the exact time it is on the participant's computer and send markers precisely aligned to that time.

1.  Synchronisation

    -   `var lslBaseTime = null`: A variable to store the calculated time difference between the two computers.

    -   The function `syncLSL() {...}` can be looped three times to get an average reading.

    -   Get the time of the marker: `fetch("http://.../sync")`

    -   Record `startPerf` (when the request left) and `endPerf` (when the answer came back).

    -   You can assume the server received the message exactly halfway between start and end (`perfMid`).

    -   Calculates the difference between the browser's clock and the LSL clock: `offsets.push(lslTime - perfMid / 1000)`.

    -   Finally, average these offsets into `lslBaseTime`. Now the browser knows how to convert its own time to LSL time.

2.  Sending markers

    -   Safety check in case sync fails: `if (lslBaseTime === null)` can be coded to send markers based on the timing from the participant's computer without synchronisation, which is less accurate but better than nothing.

    -   Code the mathematical logic to account for the offset in time for the recording computer to receive the marker, so the generated timestamp aligns with the recording computer's timestamp: `var ts = lslBaseTime + performance.now() / 1000`.

    -   Send the marker name and this calculated timestamp to the python bridge: `fetch(url)`.

You are now ready to record event triggers during your experiment. For a guide on how to set this up, you can refer to the README.md file of: <https://github.com/OliverACollins/muse-athena-test>.
