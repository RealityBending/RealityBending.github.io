---
# Leave the homepage title empty to use the site title
type: landing

sections:
  - block: people
    content:
      title: The REBEL Team
      subtitle: ''
      text: "Meet the brilliant minds that form the Reality Bending Lab."
      user_groups:
        - Principal Investigator
        - Research Assistants
        - Final Year Students
        - Associates
        - Grad Students
        - Administration
        - Visitors
        - Close Collaborators
        - Consultants
        - Alumni
    design:
      show_interests: false
      show_role: true
      show_social: true
  - block: markdown
    content:
      title: Memories
      subtitle: ''
      text: |-
        {{< gallery album="social" order="desc" >}}
    design:
      columns: '1'

gallery_item:
  - album: social
    image: 2022_wakepark.jpg
    caption: 2022 - Outdoor work sesh (An Shu, Stephanie, Max and Dom)
  - album: social
    image: 2022_stephaniemax_eeg.jpg
    caption: 2022 - EEG test (Max and Stephanie)
  - album: social
    image: 2022_doman_ohbm.jpg
    caption: 2022 - OHBM, Glasgow (An Shu and Dom)
  - album: social
    image: 2021_tamzenan.jpg
    caption: 2021 - Hard at work (An Shu, Zen and Tam)
  - album: social
    image: 2021_Thermal1.jpg
    caption: 2021 - Thermal camera fun (Tam and Zen)
  - album: social
    image: 2021_tamzen_physio.jpg
    caption: 2021 - Resting-state synchronized physio recording (Zen and Tam)
  - album: social
    image: 2021_Thermal2.jpg
    caption: 2021 - Thermal camera fun (Zen)
  - album: social
    image: 2019_TMS_Tam.jpg
    caption: 2019 - Dom testing TMS on Tam
---