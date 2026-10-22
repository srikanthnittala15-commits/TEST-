# Scheme & Compliance Hub

Profile in, personalised output:

1. **Schemes** (central + state, business + individual) the user may qualify for.
2. **Compliance calendar**: GST, income tax/TDS, MCA/LLP, EPF/ESI, labour, professional tax, FSSAI, DGFT, FCRA, with the next due dates.
3. **Live announcements** (extensions, notifications, new schemes) scraped from official portals and filtered to the profile.
4. Optional weekly e-mail digest.

## Run

    pip install -r requirements.txt
    python collectors.py --check   # test each source; fix any that report 0 items or FAIL
    python collectors.py           # store announcements (schedule daily, e.g. cron)
    python app.py                  # http://127.0.0.1:5000
    python digest.py [--send]      # weekly digest (SMTP_* env vars for --send)
    python -m unittest discover -s tests

API: `POST /api/match` with JSON profile (`entity_type`, `state`, `sector`, `turnover`, `employees`, `age`, `income`, `gender`, `occupation`, `registrations: [...]`, `startup`, `new_business`, ...).

## Fixing a source

    python collectors.py --debug gst-news     # saves debug_gst-news.html and lists the links it can see

Sources marked `render: true` need a headless browser: `pip install playwright` then `playwright install chromium`.

## How matching works

Every rule in `data/schemes.yaml` and `data/compliances.yaml` has a `when:` block (entity types, states,
turnover/employee/age/income bounds, required/excluded registrations, flags). A profile fact that is
missing never excludes a rule; it adds a "Confirm ..." note instead. Tax-audit applicability and MSME class are
derived from turnover. Compliance rules carry `monthly_day` or `dates: [[month, day], ...]`.

## Extending coverage

- **More schemes / states**: append entries to `data/schemes.yaml` (copy an existing one; `level: state`, `states: [...]`).
  The seed has ~36 schemes and only a handful of state ones; state coverage is the biggest gap.
  `myscheme.gov.in` (listed in `data/sources.yaml`) is the best single index to mine for more.
- **More compliance rules**: append to `data/compliances.yaml`.
- **More announcement sources**: append to `data/sources.yaml` (`rss`, or `html` with a CSS selector).

## Known limits - read before launching publicly

- The seed data was written from general knowledge and **must be reviewed by a CA / compliance professional**. Each scheme has a `verify:` line
  naming what changes most often (limits, subsidy %, open windows).
- Statutory due dates are routinely extended; the calendar shows the standard dates. Extension notices appear in the announcements feed only
  if a source captures them.
- Source URLs/selectors in `sources.yaml` are unverified: they could not be fetched from the build sandbox (government hosts were blocked).
  Run `python collectors.py --check` from a normal network and fix selectors; government sites change layout often.
- Local-body rules (trade licence, property tax) are generic placeholders; municipality-level data needs per-city sources.
- AOC-4 / MGT-7 dates assume an AGM on 30 September.
- Profiles are stored (e-mail + answers) only when a user subscribes; add consent text, unsubscribe and data-protection handling (DPDP Act) before public launch.
