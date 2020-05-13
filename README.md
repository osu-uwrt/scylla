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

### TODO 

- Implement some way to traverse the Box file tree, download files, and "enable them" as things we're boxing 
  - Because of how we name the zip files, it should point out in some way which files we still need to box. Do NOT do this until the basic traversal is done. This is an optimization thing. 
- Instead of uploading all the .zip files to a single directory, have the app create folders for each video and put the .zip files in the correct directory 
- (Other priorities right now) Make a button that traverses our entire output directory on Box and gets rid of redundancies, minimizing the number of .zip files we have to deal with 
  - Hell, this might even be good to incorporate to our upload procedure. Easier in the meantime to just parse in that directory though. Getting ahead of ourselves regardless.

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

This section is out of date. I will update this section at some point during break with a really nice list of things we have to do. 

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

## Misc. Workflow

  User opens the app. They are authenticated into Box, then presented with a content tree that starts with the "Raw" directory as its root. They can traverse the tree however they want and select whatever files we want. Most of the traversal's JavaScript is already done for us with Box's UI Elements, but we need to figure out how to actually incorporate those. 

  They can then select a video. When that happens, we download the video, then open OpenLabeling to that video. When the user is done boxing, they hit the "X" button on OpenLabeling. Because we only process one video at a time, we don't have to worry about processing multiple videos at once. We go into that video's folder in the "OL_Output" folder (create if there isn't one) and upload a zip file with each frame's data. Video size is pretty negligible, in terms of download size, but we can try and optimize that a bit or do something like downloading all the videos in whatever directory they're currently in so there's a little less wait.  
  
  The ZIP file should be of the format "[START_FRAME.END_FRAME] Video_Name". Video_Name is essentially what OpenLabeling outputs already; We need to figure out from the files generated which frames they got through. We can make the assumption that they bboxed a contiguous section, so just go from the lowest number to the highest number. 
  
  We are saving start/end frames so we can eventually search for just videos that haven't been bboxed yet, though that's not something I plan to build in until we have a minimally viable project (which I'm heavily gunning for by the end of break).

  Before MVP, we need a really nice README that covers what you need to run it. Essentially everything is bundled but the Python install, but that needs to be kind of specific in its setup and I'll want to do some experimentation. 

  ## Post-MVP (Minimally Viable Product) Goals / Timeline 

  Other Goals Post-MVP (in approximate order of importance / order): 
  - Make the front-end look nicer and give nice things like percentage reports on downloads, etc.
    - We want to optimize the sh*t out of this and make it really intuitive. This should be very good and usable for a *while*.
  - Highlight (or make them distinctive somehow) videos that have sections that haven't been bboxed yet
    - This is probaby one of the first things we will do after MVP because this is an important feature. 
  - Bundle the Python installation with the app 
    - This is honestly kind of important and is likely one of the first things I will do post-MVP. 
  - Make it work on Windows/Mac. This is honestly kind of complicated, and most people have access to a Linux install. 
  - Make changes to OpenLabeling itself rather than just the wrapper. This will be after we do a little bit of repetition testing (we need someone to just use it for a really long time and figure out what the bottlenecks are). 
    - Sidenote: We want to keep our own distinct copy of OpenLabeling because we want to make a lot of changes to OpenLabeling itself down the line and if we're tied too much to the original structure we can't go too far away. We don't have as much latitude. 

  Past a lot of the above, it's just making small changes based on feedback. 