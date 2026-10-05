-- Remove the temporary Phase 22 verification probe used during implementation.
drop function if exists private.phase22_sla_probe();
