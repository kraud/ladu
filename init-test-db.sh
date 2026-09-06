#!/bin/bash
# This script is automatically executed by the PostgreSQL Docker container on
# first startup (when the data volume is empty). It runs as the default
# superuser defined by POSTGRES_USER.
#
# Purpose: Create a separate "keelapp_test" database alongside the default
# "keelapp_dev" database. The test database is used exclusively by the
# Jest integration test suite so that tests never touch development data.

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE keelapp_test;
EOSQL
