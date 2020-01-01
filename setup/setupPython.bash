# More descriptive output 
RED='\033[0;31m'
NC='\033[0m'

# We want this to all be done in the main directory... default script execution, 
# by personal convention, is defined to be in the setup directory 
cd ../

# Getting rid of previous versions of the archive and the folder 
sudo rm -f Python-3.6.10.tar.xz*
sudo rm -rf Python-3.6.10 # TODO: In final script when the setup sequence is done, remove this 

# Needed to build Python; Not sure why, but it doesn't really matter 
sudo apt-get install zlib1g-dev -y
sudo apt-get install libssl-dev -y

# Unpacking a Python installation to the current directory 
wget "https://www.python.org/ftp/python/3.6.10/Python-3.6.10.tar.xz"
tar -xf Python-3.6.10.tar.xz 
rm Python-3.6.10.tar.xz* # We extracted it, so no need to have it around any more

# Compiling Python, to my understanding 
cd Python-3.6.10
sudo ./configure --prefix=/home/ros/Projects/Scylla/Python-3.6.10 # TODO: Figure out how to make this a relative path, because --prefix apparently doesn't allow relative paths 
sudo make 
sudo make install 
cd ../setup

# Verifying the correct version was installed 
echo "Current Directory: " && pwd
echo "This should say 3.6.10: "
../Python-3.6.10/bin/python3.6 -v 


