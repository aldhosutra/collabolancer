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
if [[ -z $TZ || -z $USER_NAME || -z $USER_PASSWORD || -z $DB_NAME ]]; then
  echo 'TZ, USER_NAME, USER_PASSWORD, and DB_NAME variable are required, please check .env file or manually set environment variables!'
  exit 1
fi

echo ""
echo "#################### Setup User ####################"
echo ""

sudo ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && sudo bash -c 'echo $TZ > /etc/timezone'
sudo apt-get update
sudo apt-get install -y nano lsb-release libtool automake autoconf python build-essential redis-server wget ca-certificates git language-pack-en
sudo adduser --disabled-password --gecos '' $USER_NAME && sudo usermod -a -G sudo $USER_NAME && echo "$USER_NAME:$USER_PASSWORD" | sudo chpasswd

echo ""
echo "#################### Setup Postgres ####################"
echo ""

which psql
if [ "$?" -gt "0" ]; then
  sudo apt-get purge -y postgres* 
  sudo apt-get update
  sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
  sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 7FCC7D46ACCC4CF8
  sudo apt-get update && sudo apt-get upgrade -y
  sudo apt-get install -y postgresql-10
  sudo pg_dropcluster --stop 10 main
  sudo pg_createcluster --locale en_US.UTF-8 --start 10 main
fi

sudo -u postgres -i psql postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='$USER_NAME'" | grep -q 1 || sudo -u postgres -i createuser --createdb $USER_NAME

if sudo -u postgres -i psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
  echo "Database $DB_NAME already exist, proceeding to next step!"
else
  sudo -u postgres -i createdb $DB_NAME --owner $USER_NAME
  sudo -u postgres psql -d $DB_NAME -c "alter user $USER_NAME with password '$USER_PASSWORD';"
fi

echo ""
echo "#################### Setup Nodejs via NVM ####################"
echo ""

sudo -u $USER_NAME -i <<'EOF'
echo "Installing Node as $(whoami), Home: $HOME"

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install 12.15.0

npm install pm2 -g
npm install --global --production lisk-commander@3.0.2
EOF

echo "Setup Dependencies Done! Please continue to Cloning Collabolancer Git Repository Manually!"
echo "Happy Collaborating! :)"