---
widget: slider  # Use the Slider widget as this page section
weight: 90  # Position of this section on the page
active: false  # Publish this section?
headless: true  # This file represents a page section.

design:
  # Slide height is automatic unless you force a specific height (e.g. '400px')
  slide_height: ''
  is_fullscreen: true
  # Automatically transition through slides?
  loop: true
  # Duration of transition between slides (in ms)
  interval: 2000

content:
  slides:
    - title: 👋 Welcome to the lab
      content: Take a look at what we're working on...
      align: center
      background:
        position: right
        color: '#666'
        brightness: 0.9
        media: "albums/social/2022_wakepark.jpg"
        fit: cover
    - title: Lunch & Learn ☕️
      content: 'Share your knowledge with the group and explore exciting new topics together!'
      align: left
      background:
        position: center
        color: '#555'
        brightness: 0.7
        media: "Friedrich.jpg"
        fit: cover
    - title: World-Class Semiconductor Lab
      content: 'Just opened last month!'
      align: right
      background:
        position: center
        color: '#333'
        brightness: 0.5
        media: cerebro.png
        fit: cover
      link:
        icon: graduation-cap
        icon_pack: fas
        text: Join Us
        url: ../contact/
---