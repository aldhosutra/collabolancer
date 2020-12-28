if [ ! -f ".env" ]; then
  while true; do
    read -p ".env file are not present, do you want to copy from template.env and use already defined values?" yn
    case $yn in
        [Yy]* ) cp template.env .env; break;;
        [Nn]* ) exit 1;;
        * ) echo "Please answer yes or no.";;
    esac
  done
fi

export $(egrep -v '^#' .env | xargs)
if [[ -z $TZ || -z $USER_NAME || -z $USER_PASSWORD || -z $DB_NAME || -z $DB_PASSWORD ]]; then
  echo 'TZ, USER_NAME, USER_PASSWORD, DB_NAME, and DB_PASSWORD,variable are required, please check .env file!'
  exit 1
fi

echo "#################### Setup User ####################"

ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
sudo apt-get update
sudo apt-get -y install nano

if id "$USER_NAME" &>/dev/null; then
  echo `User $USER_NAME already exist, proceeding to next step!`
else
  addgroup --gid $(id -g) $USER_NAME
  adduser --disabled-password --gecos '' --uid $(id -u) --gid $(id -g) $USER_NAME && usermod -a -G sudo $USER_NAME && echo "$USER_NAME:$USER_PASSWORD" | chpasswd
fi

echo "#################### Setup Postgres ####################"

which psql
if [ "$?" -gt "0" ]; then
  sudo apt-get purge -y postgres* 
  sudo apt-get update
  sudo apt-get install -y lsb-release libtool automake autoconf curl python2-minimal build-essential redis-server wget ca-certificates git language-pack-en
  sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
  sudo apt-get update && apt-get upgrade -y
  sudo apt-get install -y postgresql-10
  sudo pg_dropcluster --stop 10 main
  sudo pg_createcluster --locale en_US.UTF-8 --start 10 main
fi

if psql -t -c '\du' | cut -d \| -f 1 | grep -qw $USER_NAME; then
  echo `User $USER_NAME already exist on PostgreSQL, proceeding to next step!`
else
  sudo -u postgres -i createuser --createdb $USER_NAME
fi

if psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
  echo `Database $DB_NAME already exist, proceeding to next step!`
else
  sudo -u postgres -i createdb $DB_NAME --owner $USER_NAME
  sudo -u postgres psql -d $DB_NAME -c "alter user $USER_NAME with password '$DB_PASSWORD';"
fi

echo "#################### Setup Nodejs via NVM ####################"

su $USER_NAME <<'EOF'
which nvm
if [ "$?" -gt "0" ]; then
  echo "Installing Node as $(whoami), Home: $HOME"

  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
fi

nvm install 12.15.0

npm install pm2 -g
npm install --global --production lisk-commander
EOF

sudo -S ln -sfn "$NVM_DIR/versions/node/$(nvm version)/bin/node" "/usr/local/bin/node"
sudo -S ln -sfn "$NVM_DIR/versions/node/$(nvm version)/bin/npm" "/usr/local/bin/npm"
sudo -S ln -sfn "$NVM_DIR/versions/node/$(nvm version)/bin/lisk" "/usr/local/bin/lisk"

echo "#################### Configuring ####################"

if ! grep -Fxq "host all  all    0.0.0.0/0  md5" /etc/postgresql/10/main/pg_hba.conf
then
  echo "host all  all    0.0.0.0/0  md5" >> /etc/postgresql/10/main/pg_hba.conf
fi

if ! grep -Fxq "listen_addresses='*'" /etc/postgresql/10/main/postgresql.conf
then
  echo "listen_addresses='*'" >> /etc/postgresql/10/main/postgresql.conf
fi

echo "#################### Run Node ####################"
sudo /etc/init.d/postgresql restart
su $USER_NAME
node index.js | npx bunyan -o short