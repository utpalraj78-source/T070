# Development-only demo data

Run `PYTHONPATH=src python3 -m hsts seed` against a fresh database. These deterministic accounts are for local demonstration only and must never be reused in deployment:

| Role | Name | Email | Password |
|---|---|---|---|
| Student/Alumni | Laxita Bhimsaria | `24ucs144@lnmiit.ac.in` | `Laxita123!` |
| Student/Alumni | Vaibhav Goyal | `24ucs145@lnmiit.ac.in` | `Vaibhav12!` |
| Higher Studies Coordinator | Manan Jain | `24ucs146@lnmiit.ac.in` | `Manan1234!` |
| Administrator | Harsh Varshney | `24ucs148@lnmiit.ac.in` | `Harsh1234!` |

Seed data has three countries, three institutions, four programmes and four higher-study records: Draft, Submitted, Verified and Correction Required. It includes multiple admission and progression statuses and prior history for a completed record. Seed refuses to overwrite a nonempty database.

Demo order: sign in as Laxita (`24ucs144@lnmiit.ac.in`); create a Draft; submit it; sign out. Sign in as coordinator (`24ucs146@lnmiit.ac.in`); open Verification Queue; verify the new record or request correction on another Submitted record; update an Ongoing record to Completed; review histories, search and reports. Sign in as admin (`24ucs148@lnmiit.ac.in`); inspect users, change a role or activation status, add master data and review audit entries.
