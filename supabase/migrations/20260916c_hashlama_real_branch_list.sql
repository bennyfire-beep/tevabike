-- Corrects hashlama_registrations.branch: the form was shipped with a
-- shortened 3-branch list (misgav/biriya/matzuva as English slugs) based on
-- a stale marketing blurb. The real set — matching groups.branch in
-- production and app/register/page.tsx's BRANCHES — is five branches/
-- satellites, stored as the Hebrew text itself so this table stays
-- joinable with the rest of the system: משגב, ביריה, מטה אשר, פרוד-אמירים,
-- צורית-גילון. Table has 0 rows at this point, so no data migration needed.
alter table hashlama_registrations drop constraint if exists hashlama_registrations_branch_check;

alter table hashlama_registrations
  add constraint hashlama_registrations_branch_check
  check (branch in ('משגב', 'ביריה', 'מטה אשר', 'פרוד-אמירים', 'צורית-גילון'));
