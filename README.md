# Scylla

Scylla is the Underwater Robotics Team's in-house image labeling application. It interfaces with the API of Box (the team's chosen data storage system for bulk data) in order to download videos and images, feed them through a labeling application, and upload the results back to Box. These results can then be fed into YOLO Darknet (the team's chosen machine learning computer vision system). 

Version 1.0.0 of the app is the most recently released major version, and offers complete functionality. Executable packages for Linux are available via GitHub's release system. The application has been specifically catered to our team's file structure (something we plan to remedy as part of a project this fall), so may not work correctly for you out of the box, though only minor modification should be necessary.

## Development Installation

While the application itself in its current state is catered towards our team's folder structure in Box, it is designed very modularly, so if other teams would like to make changes and use it, it is not too difficult. We plan to significantly improve support for other teams in the fall, so we would recommend waiting if there is not a dire need, but if you would like to, the changes necessary should be the following: 

- Fresh registration of your own "version" of the app through Box's Developer Tools, and modification of these details inside the `keys.js` file.
- Modification of the default Box folder to open to, and the folder uploaded to by default. 

### Linux 

To install for development, the process is simple.

First, clone the repository, and change it to be your current directory.

```bash
git clone https://github.com/osu-uwrt/scylla.git
cd scylla
```

Then, change your directory to the `setup` folder and execute `setup.bash`, which will set up all development requirements for you.

```bash
cd setup
bash setup.bash
```

For the curious, this script does the following:
- Installs all of our JavaScript dependencies, including Electron
- Installs all our Python dependencies, as outlined in the `requirements.txt` file. The image labeling application we use is written in Python, and we wanted to include everything except for the Python installation itself inside the executable whenever we build, so these are downloaded locally regardless of if they exist at the global or user level. 

You should now be able to run the application using the below "Usage" instructions.

### Windows / Mac 

We can't guarantee that the build system will work smoothly right off the bat, as we only verified building works for Linux, as that's what most of our team uses, but the application development environment itself should work fine on other operating systems. You will have to execute everything in `setup.bash` on your own, but there's not too much content. You may also have to tinker with the Python installation OpenLabeling uses.

## Usage

Once you start up the app and select "Box Files", you will be asked to authenticate into Box. From there, you can traverse the Box file heirarchy and select which files you want to label. When you are ready, hit the "Box Selected" button. Those files will be downloaded, and OpenLabeling (the labeling application we wrap around) will open with your downloaded images. 

Instructions for using OpenLabeling can be found at its repository, located at https://github.com/Cartucho/OpenLabeling. Many thanks to Cartucho for the wonderful application.

When you are done labeling your images, hit `Q`. This will create a .zip file that is named in a way that identifies the video labeled and the frames that were labeled (we plan to later programmatically read Box to figure out which files still need boxed, just from video names) and upload it to Box to a location specified by a folder ID in the code.


## Planned Improvements

This project, while functional, still needs improvement to feel smooth, optimized, and widely applicable. We anticipate many features, the following included, implemented by the end of the Autumn 2020 Semester, likely as part of a project for new members:

- A design overhaul. The current design is functional, but there exists significant room for improvement, both in terms of aesthetic appeal and overall UX design.
- Easier configuration for teams other than our own, likely through a settings menu in the app. Much of our current design is specific to our file structure; Ideally other teams don't even need to clone this repository and build to work in their own ecosystems.
- The implementation of a "filter" in the file explorer that will show you which videos still need to be labeled.
- Optimization to minimize number of .zip files needed in Box.
- Better, more formalized error handling.
- Better user feedback.
- Windows / Mac executables.

We also have other "reach" goals that likely won't be part of the project encompassing the above guidelines, but we'd like to implement eventually:

- Support for file storage solutions other than Box (i.e. Google Drive, OneDrive)
