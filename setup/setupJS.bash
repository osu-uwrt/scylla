# ! YOU MUST BE IN THE 'SETUP' DIRECTORY FOR THIS SCRIPT TO WORK CORRECTLY
# Get the setup file using cURL
sudo apt-get install curl 
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -

# Installing Node/npm 
sudo apt-get install nodejs 
echo "Node Version: "
node -v 

# Installing node-based dependencies (Electron, etc.)
cd ../
npm install 

