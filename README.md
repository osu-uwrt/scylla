# Scylla

This is the current Ohio State Underwater Robotics bboxing application, currently under development. The app utilizes OpenLabeling (github.com/Cartucho/OpenLabeling) wrapped inside an Electron app. 


## Installation 

Just clone the repo, then execute `bash setup.bash` in the `setup` directory. You **must** be *in* the `setup` directory when running this command, or else it won't work correctly. This will likely take a few minutes; the pytorch download is pretty chunky. 

The script does the following: 

- Installs Electron and the other JS stuff we need
- Installs pip3 if you don't already have it, then OpenLabeling's required Python modules (torch, etc.) and bundles them with the project. 


### If you want to develop on Windows (and possibly Mac, I guess)  
 
Will be difficult, but we've had someone do it before. Some things that might help: 

- Most of the commands in the setup files are still valid, you just can't straight-up run the bash.
- Make sure you install the python packages (as outlined in requirements.txt) to the right place, bundled with the project. That's what the -t flag does on pip install

Honestly, I don't think setting up in Windows would be that bad. I really doubt you could build on Windows without a LOT of setup, though it's working on Ubuntu. 


## Usage 

After executing the setup script above, all you need to do is navigate to the base `Scylla` directory and execute `npm run start` or `yarn start` (make sure you have the respective one installed), which will start up the Electron app itself. 

Unless you are developing with a dev token (which is easy to set up, just google "Box Developer Tools" and make the app through it, then replace everything in keys.js with your own), find the variable usingDevToken in box.js and set it to false. This will take you through the full box authentication scheme. If you have a dev token it's way faster and just insta-skips this. 


## Other Notes 

### Notes on OpenLabeling and our usage of it 

The version of OpenLabeling on this repo is basically the same as if you would have cloned it, but I've made some minor modifications, like changing some paths and making it use our localized Python installation. Hence, it is not a subrepository; We're essentially using a slightly customized version that we can make commits to and everythingn. 

OpenLabeling is open source (github.com/Cartucho/OpenLabeling, I believe) and has a super permissive license that I think is basically just "do whatever". 