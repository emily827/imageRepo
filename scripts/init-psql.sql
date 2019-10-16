
DROP DATABASE imagerepo;
DROP USER nodejs;
CREATE USER nodejs WITH LOGIN PASSWORD 'password';
CREATE DATABASE imagerepo OWNER nodejs;

\connect imagerepo

CREATE TABLE IF NOT EXISTS raw_images (
    id VARCHAR(64) PRIMARY KEY,
    imgtype VARCHAR(16),
    rawdata BYTEA,
    thumbnail BYTEA,
    created_on TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 0,
    created_on TIMESTAMP NOT NULL,
    modified_on TIMESTAMP,
    email VARCHAR(256) UNIQUE NOT NULL,
    displayname VARCHAR(64) NOT NULL,
    firstname VARCHAR(64) NOT NULL,
    lastname VARCHAR(64) NOT NULL,
    gender  CHAR(1),
    passwd VARCHAR(64) NOT NULL,
    dob DATE
);

CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 0,
    created_on TIMESTAMP NOT NULL,
    modified_on TIMESTAMP,
    name VARCHAR(256) NOT NULL,
    owner_id INTEGER REFERENCES users(id),
    raw_id VARCHAR(64) REFERENCES raw_images(id),
    tags VARCHAR(64)[],
    time_taken TIMESTAMP,
    loc POINT,
    info TEXT
);

CREATE TABLE IF NOT EXISTS image_share (
    image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT image_share_key PRIMARY KEY (image_id, user_id)
);

CREATE TABLE IF NOT EXISTS logins (
    token VARCHAR(256) UNIQUE NOT NULL,
    validity TIMESTAMP NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX users_email_idx ON users(email);
CREATE INDEX users_name_idx ON users(firstname,lastname);
CREATE INDEX users_fname_idx ON users(firstname);
CREATE INDEX users_lname_idx ON users(lastname);
CREATE INDEX users_dname_idx ON users(displayname);
CREATE INDEX users_dob_idx ON users(dob);
CREATE INDEX images_tags_idx ON images USING GIN (tags);
CREATE INDEX images_loc_idx ON images USING GiST (loc);
CREATE UNIQUE INDEX logins_token_idx ON logins(token);

CREATE OR REPLACE FUNCTION cleanup_login_token() RETURNS VOID AS $$
BEGIN
    delete from logins where validity < clock_timestamp();
END;
$$ LANGUAGE plpgsql;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nodejs;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nodejs;
