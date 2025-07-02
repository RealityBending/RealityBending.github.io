---
authors:
- Ana Neves
categories:
- Reality Bending Lab
- University of Sussex
date: "2025-07-02"
image:
  caption: ''
  placement: 0
title: "How to collect and save data with DataPipe in OSF"
subtitle: "Learn how to set up DataPipe to collect and save data in OSF, including creating an OSF project, linking it to DataPipe, configuring data collection, and saving data from an experiment hosted on GitHub."
summary: "Learn how to set up DataPipe to collect and save data in OSF, including creating an OSF project, linking it to DataPipe, configuring data collection, and saving data from an experiment hosted on GitHub."
tags:
- DataPipe
- Data Collection
- OSF
- Reality Bending Lab
- ReBeL
- University of Sussex
- Psychology
---

Hello there! 👋
Let's learn how to set up DataPipe to collect and save data in OSF. 

Lets start with some basics!

## What is DataPipe?

DataPipe is a tool that allows you to collect and save data in OSF (Open Science Framework). It is designed to help researchers manage their data collection process efficiently, ensuring that data is stored securely and can be easily accessed for analysis.

## How to set up DataPipe in OSF

1. **Create an OSF Project**: Start by creating a new project in [OSF](https://osf.io/). This will be the container for your data and any related files. You can set up an account if you don't have one already, quite easily!

   - Go to the OSF homepage and log in or create an account. You can easily sign up through institutional access.
   - Click on "Create a New Project" and fill in the necessary details such as project title, description, and visibility settings. ***DO NOT SET IT AS PUBLIC*** as the data being saved will not be anonymized and may contain sensitive information.

2. **Create OSF Token**: You will need to create a token to grant DataPipe the necessary permissions to access your OSF project.

   - Go to your OSF account settings and navigate to the "personal access tokens" section.
   - Click on "Create a new token" and give it a name (e.g., "DataPipe Token").
   - Set the permissions for the token, ensuring it has access to read and write data in your project.
   - Copy the generated token; you will need it later.

3. **Link OSF to DataPipe**: In DataPipe, you will need to link your OSF project using the token you created.

   - Open DataPipe, click Account on the top right corner and select settings.
   - Click on the 'Set OSF Token' button and paste the token you copied earlier.

4. **Create new experiment on DataPipe**: Now that your OSF project is linked, you can create a new experiment in DataPipe.

   - Click on "Create New Experiment" in DataPipe.
   - Give the experiment a name - I recommend using the same name as your OSF project for consistency.
   - Add the OSF project ID to the experiment settings. You can find the project ID in the URL of your OSF project (it is the alphanumeric string after osf.io/) 
   - Create a new OSF Data component called 'data'. This will create a folder - named data -  in your OSF project where all the data collected will be saved.
   - Choose Germany - Frankfurt as the server location for your DataPipe experiment. This is important for data privacy and compliance with regulations such as GDPR.

5. **Configure Data Collection**: Once the experiment is set up on DataPipe enable data collection on the Status section. 

6. **Save the data from the experiment hosted on GitHub**: If you are using a GitHub repository to host your experiment, you can save the data collected by writing the bellow code to the experiment HTML file. This bit of code should be called at the end of your experiment to ensure that all data is saved to the OSF project

    - Here is what the code should look like in your experiment HTML file:

    ```javascript
    // Save data via DataPipe
        timeline.push({
            type: jsPsychPipe,
            action: "save",
            experiment_id: "xxxxxxxxxx", // This in generated in the DataPipe interface
            filename: `${participantID}.csv`,
            data_string: () => jsPsych.data.get().csv(),
        })
    ```  

    - On the experiment created on DataPipe, there is an 'Experiment ID' field. This is the ID you need to add to the `experiment_id` field in the code above.
    - The `filename` field can be customized to include the participant ID or any other identifier you prefer. 


7. **Run Your Experiment**: With everything set up, you can now run your experiment. DataPipe will automatically collect and save the data to your OSF project as specified. *Give it a try!*