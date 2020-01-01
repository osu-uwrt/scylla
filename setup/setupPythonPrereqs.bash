# TODO: Install all these packages bundled with the project and not universally (which I assume the -U does) 
# See https://stackoverflow.com/questions/2915471/install-a-python-package-into-a-different-directory-using-pip for details 

# Install OpenCV
../Python-3.6.10/bin/python3.6 -mpip install --user pip
../Python-3.6.10/bin/python3.6 -mpip install --user opencv-python 
../Python-3.6.10/bin/python3.6 -mpip install --user opencv-contrib-python 

# Install numpy, tqdm, lxml 
../Python-3.6.10/bin/python3.6 -mpip install --user numpy
../Python-3.6.10/bin/python3.6 -mpip install --user tqdm
../Python-3.6.10/bin/python3.6 -mpip install --user lxml

# Install pytorch, which OpenLabeling uses under the table for its computer vision stuff 
../Python-3.6.10/bin/python3.6 -mpip install --user torch torchvision

