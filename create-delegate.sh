#!/bin/bash

if [[ -z $1 || -z $2 ]]; then
  echo 'First Argument [Delegate Name], and Second Argument [Passphrase] are required!'
  exit 1
fi

export SECRET_PASSPHRASE=$2
lisk transaction:create:delegate $1 -p=env:SECRET_PASSPHRASE --networkIdentifier=3c38d5036e1b31c224edcc438d10ca1fca653e9157ba5f4975c357ecb410908d | tee >(curl -X POST -H "Content-Type: application/json" -d @- localhost:4000/api/transactions)