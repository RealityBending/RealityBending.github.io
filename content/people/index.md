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
        - PhD Students
        - Research Assistants
        - Final Year Students
        - Associates
        - Grad Students
        - Administration
        - Visitors
        - Close Collaborators
        - Consultants
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
  - block: people
    content:
      title: "Alumni"
      subtitle: 'For Auld Lang Syne'
      text: ""
      user_groups:
        - Alumni
    design:
      show_interests: false
      show_role: true
      show_social: true

gallery_item:
  - album: social
    image: 2024_LightFest.png
    caption: "2024 - Lightfest (summer solstice celebration)"
  - album: social
    image: 2024_Basel.jpg
    caption: "2024 - Workshop on physiological signals at the University of Basel (Dom and Basel PhD students)"
  - album: social
    image: 2024_IllusionCardGame.gif
    caption: "2024 - Beta-testing the Illusion Card Game (Dom, Ana Neves and friends)"
  - album: social
    image: 2023_dommarco_escop.jpg
    caption: "2023 - ESCOP Porto: Men in Black (Dom and Marco Sperduti)"
  - album: social
    image: 2023_dom_ohbm.jpg
    caption: "2023 - OHBM Montréal: Dom exposing 'NeuropsyXart'"
  - album: social
    image: 2023_domstefano_ohbm.jpg
    caption: "2023 - OHBM Montréal: Panel with Dom and the PhysioPy team"
  - album: social
    image: 2023_domstephanie_ohbm.jpg
    caption: "2023 - OHBM Montréal: Party (Danielle Benesch, Stephanie Kirk, and Dom)"
  - album: social
    image: 2022_wakepark.jpg
    caption: 2022 - Singapore, Outdoor work sesh (An Shu, Stephanie, Max and Dom)
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