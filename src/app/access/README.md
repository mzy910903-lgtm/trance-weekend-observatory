# TRANCE WEEKEND LAB Access Gate

Configure both values only on the server or deployment platform:

- `ACCESS_GATE_PASSWORD`: at least 6 characters; keep the actual value in the server environment only.
- `ACCESS_GATE_COOKIE_SECRET`: a random value of at least 32 characters.

Successful login writes a signed, HttpOnly, SameSite cookie for 30 days. The
password is never serialized into client code or stored in the cookie.
