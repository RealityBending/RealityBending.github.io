---
authors:
- roisin-sharma
categories:
- Reality Bending Lab
- University of Sussex
date: "2026-01-09"
image:
  caption: ''
  placement: 0
title: "How to send event triggers to Lab Streaming Layer from JsPsych"
subtitle: "Learn how to set up DataPipe to collect and save data in OSF, including creating an OSF project, linking it to DataPipe, configuring data collection, and saving data from an experiment hosted on GitHub."
summary: "Learn how to set up DataPipe to collect and save data in OSF, including creating an OSF project, linking it to DataPipe, configuring data collection, and saving data from an experiment hosted on GitHub."
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

IDEAS:

-   add image of lux marker and show diagram from validation experiments to illustrate that it's comparatively the 'best' in terms of consistency of delay making it yield more accurate data

-   You can find a simple example of this in action from our recent validation experiments, which compared when the event triggers (referred to as 'markers') picked up the screen changing from white to black, to the Bitalino LUX: <https://github.com/OliverACollins/muse-athena-test/tree/main/blackwhite>.

## What does this mean and when is this useful?

Lab streaming layer (LSL) is a system used to receive, synchronise and stream signals from multiple inputs during experiments. LSL is designed to help researchers easily compare their data across multiple technologies, as time synchrony is integral for making valid comparisons.

When collecting data on stimulus response during experiments, it's important that the stimulus onset is recorded precisely, especially if this is mapped onto physiological responses as this has implications on how we interpret our data. One good example of a use case is that you have a Muse headband or any other device that can scream via LSL, and you want to precisely mark events in it.

Event triggers are coded into JsPsych online experiments to accurately mark events, such as when a stimulus appeared on the screen.

This tutorial will explain how to set this up for an experiment situated on GitHub, although you can adapt this for your hosting platform.

## How to set up event triggers

1.  **Create the LSL bridge in your repository:**

2.  **Synchronise your event triggers in the html script of your experiment:**

## How to record event triggers during your experiment
