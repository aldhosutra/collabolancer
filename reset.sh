#!/bin/bash

if [ ! -f ".env" ]; then
  read -p ".env file are not present, do you want to copy from template.env and use already defined values to proceed? [y/n] " yn
    case $yn in
        [Yy]* ) curl -o template.env https://raw.githubusercontent.com/aldhosutra/collabolancer/master/template.env; cp template.env .env; break;;
        [Nn]* ) echo "Selected Option: No";;
        * ) echo "Unkown answer!";;
    esac
fi

set -a && source .env && set +a
if [[ -z $USER_NAME || -z $USER_PASSWORD || -z $DB_NAME ]]; then
  echo 'USER_NAME, USER_PASSWORD, and DB_NAME variable are required, please check .env file or manually set environment variables!'
  exit 1
fi

echo ""
echo "#################### Reset PostgreSQL (Delete ALL Data In This Node) ####################"
echo ""

sudo pg_dropcluster --stop 10 main
sudo pg_createcluster --locale en_US.UTF-8 --start 10 main
sudo -u postgres -i createuser --createdb $USER_NAME
sudo -u postgres -i createdb $DB_NAME --owner $USER_NAME
sudo -u postgres psql -d $DB_NAME -c "alter user $USER_NAME with password '$USER_PASSWORD';"

echo "Reset PostgreSQL Done!"
echo "Happy Collaborating! :)"