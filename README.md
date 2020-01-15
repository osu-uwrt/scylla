# Scylla

This is the Ohio State Underwater Robotics new bboxing application, currently under development. The app utilizes OpenLabeling (github.com/Cartucho/OpenLabeling) wrapped inside an Electron app. 

Our planned completion date is likely somewhere late February, but is heavily variable depending on how things go. 


## Installation 

Just clone the repo, then execute `bash setup.bash` in the `setup` directory. You **must** be *in* the `setup` directory when running this command, or else it won't work correctly. This will likely take 5-10 minutes. 

The script does the following: 

- Builds and bundles the Python installation (3.6.10) that is used by the rest of the project
- Installs OpenLabeling's required Python modules (torch, etc.) and bundles them with the project
- Installs Electron and the other JS stuff we need 

### If you want to develop on windows 
 
I don't guarantee functionality; The bash scripts, etc. only work on Linux and it's a lot of effort to change stuff for Windows. 

You will need Node (12.x Preferably), npm, and the following Python packages alongside a Python3 install: 
- pip
- opencv-python 
- opencv-contrib-python
- numpy 
- tqdm 
- lxml 
- torch 
- torchvision 

There are also a different set of instructions in the OpenLabeling repo, look at that. 

## Usage 

After executing the setup script above, all you need to do is navigate to the base `Scylla` directory and execute `npm run start`, which will start up the Electron app itself. 

## Other Notes 

### Workflow

#### Files From Box 

1. User authenticates into Box, going through OSU login, Duo if necessary, etc. 
2. User selects from Box which files they want to bbox 
3. Those files are downloaded from Box into OpenLabeling's input folder 
4. OpenLabeling is started up, using those just-downloaded files by default 
5. When the User finishes bboxing, we get our desired output, which is correctly named and automatically uploaded to the correct folder in Box 

#### Local Files 

1. User selects the files they want to bbox from anywhere on their computer
2. Files still in the input folder from last time are backed up to somewhere as a precaution 
3. These files are copied into OpenLabeling's input folder, then OpenLabeling is started up 
4. The files are processed by the user in OpenLabeling, then output in our desired format 
5. The output in our desired format (correctly named) is saved to the `output` folder. It's up to the user to do stuff with that, whether that means uploading to Box itself, or just somewhere local. Thi

### Notes on OpenLabeling

The version of OpenLabeling on this repo is basically the same as if you would have cloned it, but I've made some minor modifications, like changing some paths and making it use our localized Python installation. Hence, it is not a subrepository; We're essentially using a slightly customized version that we can make commits to and everythingn. 

### To-Do 

- Implement our protocol for how we want to deal with our files from Box 
    - This is more with respect to where the Box files will go and how we'll feed them into OpenLabeling
- Implement actual Box authentication (you have to log in when you start up the application)
- Figure out and configure our build system (needs to be usable on Windows/Mac/Linux)
    - I'm pretty sure I've made everything localized (the Python installation, Python modules) so most of the work for this should already be done 
    - Check out `electron-forge` on npm, might be what we're looking for  
- Superimpose controls for how to use OpenLabeling
    - In retrospect we probably don't need to do this unless it's easy; Putting the instructions in the documentation or on GitHub is probably sufficient because it's not that complicated 
- Do the front-end for the box integration and local files part (homepage is the only part that's already done)

That's all that I can think of at the moment, but I'm pretty sure there's more to be done than that. 

### Gitbook Migration

I've written this README so that it can hopefully just be copy-pasted over to save some work for our incredibly hard-working documentation team. 
