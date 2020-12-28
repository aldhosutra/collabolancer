#!/bin/bash

if [ ! -f ".env" ]; then
  while true; do
    read -p ".env file are not present, do you want to copy from template.env and use already defined values to proceed? [y/n] " yn
    case $yn in
        [Yy]* ) curl -o template.env https://raw.githubusercontent.com/aldhosutra/collabolancer/master/template.env; cp template.env .env; break;;
        [Nn]* ) break;;
        * ) echo "Please answer yes or no.";;
    esac
  done
fi

export $(egrep -v '^#' .env | xargs)
if [[ -z $TZ || -z $USER_NAME || -z $USER_PASSWORD || -z $DB_NAME ]]; then
  echo 'TZ, USER_NAME, USER_PASSWORD, and DB_NAME variable are required, please check .env file or manually set environment variables!'
  exit 1
fi

echo ""
echo "#################### Setup User ####################"
echo ""

ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
sudo apt-get update
sudo apt-get -y install nano

if id "$USER_NAME" &>/dev/null; then
  echo "User $USER_NAME already exist, proceeding to next step!"
else
  adduser --disabled-password --gecos '' $USER_NAME && usermod -a -G sudo $USER_NAME && echo "$USER_NAME:$USER_PASSWORD" | chpasswd
fi

echo ""
echo "#################### Setup Postgres ####################"
echo ""

which psql
if [ "$?" -gt "0" ]; then
  sudo apt-get purge -y postgres* 
  sudo apt-get update
  sudo apt-get install -y lsb-release libtool automake autoconf python2-minimal build-essential redis-server wget ca-certificates git language-pack-en
  sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
  sudo apt-get update && apt-get upgrade -y
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

if ! grep -Fxq "host all  all    0.0.0.0/0  md5" /etc/postgresql/10/main/pg_hba.conf
then
  echo "host all  all    0.0.0.0/0  md5" >> /etc/postgresql/10/main/pg_hba.conf
fi

if ! grep -Fxq "listen_addresses='*'" /etc/postgresql/10/main/postgresql.conf
then
  echo "listen_addresses='*'" >> /etc/postgresql/10/main/postgresql.conf
fi

sudo /etc/init.d/postgresql restart

echo ""
echo "#################### Setup Nodejs via NVM ####################"
echo ""

su $USER_NAME <<'EOF'
echo "Installing Node as $(whoami), Home: $HOME"

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install 12.15.0

npm install pm2 -g
npm install --global --production lisk-commander

echo $USER_PASSWORD | sudo -S ln -sfn "$NVM_DIR/versions/node/$(nvm version)/bin/node" "/usr/local/bin/node"
echo $USER_PASSWORD | sudo -S ln -sfn "$NVM_DIR/versions/node/$(nvm version)/bin/npm" "/usr/local/bin/npm"
echo $USER_PASSWORD | sudo -S ln -sfn "$NVM_DIR/versions/node/$(nvm version)/bin/lisk" "/usr/local/bin/lisk"
EOF

while true; do
  read -p "Setup Dependencies Done, do you want to automatically clone Collabolancer Node on ~/? [y/n] " yn
  case $yn in
      [Yy]* ) 
        sudo -u $USER_NAME -i <<'EOF'
          cd ~
          git clone https://github.com/aldhosutra/collabolancer
          cd collabolancer
          npm install
          echo "Collabolancer Node is Installed on $(pwd)"
          echo "Please Provide .env and run:" 
          echo ""
          echo "node index.js | npx bunyan -o short"
          echo ""
          echo "Using user '$(whoami)', to start the node!"
EOF
        break
        ;;
      [Nn]* ) exit 1;;
      * ) echo "Please answer yes or no.";;
  esac
done