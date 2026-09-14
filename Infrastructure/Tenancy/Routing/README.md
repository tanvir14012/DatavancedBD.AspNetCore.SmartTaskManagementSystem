# Resolution and regional routing — SAAS-02 / SAAS-07

SAAS-02 supplies the canonical request resolver, durable SQL authority directory, membership reader,
organization-bound claim validation and immutable scoped context. Shared API authorities require an
explicit selector; tenant-specific authorities come from control-plane metadata, and unknown hosts
never fall back to a selector. Regional target selection and relocation fencing remain SAAS-07 work.
