# One Postgres server for staging and production

Staging and production run on one VPS (4 GB RAM, about €6.81/month) and share one Postgres server. Each environment has its own database and its own database user, so neither can read the other's data. We chose this because the cost limit (about €7/month) and the RAM do not allow two servers.

The cost: one server outage, or one wrong server setting, affects both environments. This is acceptable during solo development with few users. Revisit it when real user numbers grow: the first step is a separate Postgres server (or VPS) for production.
