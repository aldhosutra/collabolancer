# collabolancer

Collabolancer is a proof-of-concept smart freelancing platform that enables seamless collaboration. Let's make a better world together, not alone. https://collabolancer.com

## Setup Dependencies

Run this script to setup and install all dependencies required to run Collabolancer Node:

```
curl -o- https://raw.githubusercontent.com/aldhosutra/collabolancer/master/install.sh | bash
```

## Configure & Run

First, copy template.env as .env, and configure it's value depend on your Node Settings:

```
USER_NAME=lisk
USER_PASSWORD=password
DB_NAME=lisk_dev
SEED_NODE_IP=0.0.0.0
API_WHITELIST_IP=0.0.0.0
IS_API_NODE=false
```

Then, run node using this command:

```
node index.js | npx bunyan -o short
```
