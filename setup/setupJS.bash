# Download NPM 
sudo apt-get install curl 
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -

# Add yarn's repo and install it (our builder has better support for yarn)
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt-get update
sudo apt-get install yarn 

# Installing nodejs itself 
sudo apt-get install nodejs 

# Actually installing the JS dependencies for the project 
cd ../
npm install 

