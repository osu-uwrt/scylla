# Add the PPA
sudo apt-get install curl 
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -

# Installing nodejs itself 
sudo apt-get install nodejs 

# Debug output 
echo "Node Version: "
node -v 

# Actually installing the JS dependencies for the project 
cd ../
npm install 

