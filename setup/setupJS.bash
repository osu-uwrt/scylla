# Add the PPA
sudo apt-get install curl 
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -

# Installing nodejs itself 
sudo apt-get install nodejs 

# Actually installing the JS dependencies for the project 
cd ../
npm install 

