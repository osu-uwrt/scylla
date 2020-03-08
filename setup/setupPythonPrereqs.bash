# We need pip to do the next command 
apt-get purge -y python3-pip 
apt-get install -y python3-pip

# Install requirements from a requirements.txt file to a target directory
# -r tells pip to install from the requirements.txt file 
# -t (short for target) specifies the directory that everything will be installed to 
# --no-cache-dir tells pip to always reinstall to this specific directory and don't use global or user copies of the software (useful to ensure bundling works correctly)
python3 -mpip install  -r requirements.txt -t ../extraResources/site_packages --no-cache-dir