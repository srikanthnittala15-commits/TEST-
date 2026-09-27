# GST Refund Calculator

Computes GST refund amounts for the two most common fact patterns:

- **Export without payment of tax (LUT/Bond)** — Rule 89(4), CGST Rules 2017
- **Inverted duty structure** — Rule 89(5), CGST Rules 2017

## Setup

```bash
pip install -r requirements.txt
```

## Usage

```bash
python calculate_refund.py --input sample_input.csv --output refund_working.csv
```

Accepts `.csv` or `.xlsx` input. See `sample_input.csv` for the expected columns.

## Input columns

Always required: `client_name`, `period`, `category` (`export_lut` or `inverted_duty`)

**category = export_lut**
| column | meaning |
|---|---|
| `zero_rated_turnover_goods` | Value of zero-rated goods exported without payment of tax during the period |
| `zero_rated_turnover_services` | Value of zero-rated services exported without payment of tax during the period |
| `domestic_like_supply_value` | Value of like goods supplied domestically (used for the 1.5x cap on goods; leave 0 if not applicable/services-only) |
| `adjusted_total_turnover` | As defined in Rule 89(4)(C) |
| `net_itc` | ITC availed on inputs + input services during the period (excludes capital goods and ITC already claimed under 89(4A)/(4B)) |

**category = inverted_duty**
| column | meaning |
|---|---|
| `inverted_turnover` | Turnover of inverted-rated supply of goods/services during the period |
| `adjusted_total_turnover` | As defined in Rule 89(4)(C), applied per Rule 89(5) |
| `net_itc_inputs` | ITC availed on **inputs only** during the period (input services and capital goods excluded per the formula substituted 18-04-2018) |
| `tax_payable_inverted` | Tax payable on such inverted-rated supply of goods/services |

## What it does

- **export_lut**: caps the zero-rated *goods* turnover at 1.5x the domestic like-supply value, computes `Turnover x Net ITC / Adjusted Total Turnover`, and caps the result at the available Net ITC.
- **inverted_duty**: computes `(Inverted turnover x Net ITC[inputs] / Adjusted Total Turnover) - Tax payable`, floored at zero (a negative result means the refund is NIL, not negative).

Output is a working CSV with the computed refund per row plus warnings (e.g. cap applied, refund floored to nil, missing data).

## Not covered / next steps

This tool computes the refund **amount** only. It does not:
- Validate shipping bill / EGM / GSTR-1 matching (needed before filing RFD-01)
- Check the 2-year limitation period under Sec 54(1)
- Handle export **with** payment of IGST (that refund = IGST paid, subject to shipping bill matching — different formula, not this tool)
- Handle excess balance in electronic cash ledger refunds

Always verify the period's Adjusted Total Turnover and Net ITC figures against the GSTR-3B/2B of the relevant period before filing.
