# Install requirements from a requirements.txt file to a target directory
# -r tells pip to install from the requirements.txt file 
# -t (short for target) specifies the directory that everything will be installed to 
# --no-cache-dir tells pip to always reinstall to this specific directory and don't use global or user copies of the software (useful to ensure bundling works correctly)
# --upgrade tells pip to do the same thing as the last line did, but differently ????????
sudo apt-get install python3-pip -y
sudo python3 -mpip install -r requirements.txt -t ../extraResources/site_packages --no-cache-dir --upgrade