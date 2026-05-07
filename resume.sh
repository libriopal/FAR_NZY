#!/usr/bin/env bash

# Exit immediately if a command fails
set -e

SESSION_ID="b1146d38-5630-498a-bf40-46dced98eabd"

echo "Resuming Claude session: $SESSION_ID"

claude --resume "$SESSION_ID"


