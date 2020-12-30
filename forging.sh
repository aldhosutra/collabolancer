#!/bin/bash

if [[ -z $1 || -z $2 || -z $3 ]]; then
  echo 'First Argument [Public Key], Second Argument [password], and Third Argument [Forging Enabled] are all required!'
  exit 1
fi

curl -X PUT \
  http://127.0.0.1:4000/api/node/status/forging \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json' \
  -d '{
          "publicKey": "'"$1"'",
          "password": "'"$2"'",
          "forging": '"$3"'
      }'