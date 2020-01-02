# TODO: Install all these packages bundled with the project and not universally (which I assume the -U does) 
# See https://stackoverflow.com/questions/2915471/install-a-python-package-into-a-different-directory-using-pip for details 

# Install requirements from a requirements.txt file to a target directory
../Python-3.6.10/bin/python3.6 -mpip install  -r requirements.txt -t ../OpenLabeling/main/site_packages --no-cache-dir