#!/bin/bash
cd /home/kavia/workspace/code-generation/user-request-test-project-2321-2330/frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

