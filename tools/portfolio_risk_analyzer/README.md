# Portfolio & Risk Analyzer

Read-only analysis of a Zerodha Kite portfolio. It never connects to a broker and cannot place orders.

## Workflow (Claude Desktop + this tool)

1. In Claude Desktop (with Kite MCP), ask for your holdings and save them as `holdings.json`, or download the holdings CSV from Kite Console.
2. Run the analyzer on your own machine. Your Kite credentials never leave it.

```bash
pip install -r requirements.txt
python analyze_portfolio.py --input holdings.csv --sectors sector_map.csv --output portfolio_report.xlsx
```

## Input

- Holdings as `.csv`, `.xlsx` or `.json`. Kite Console headers (`Instrument, Qty., Avg. cost, LTP`) and Kite API names (`tradingsymbol, quantity, average_price, last_price`) both work. Duplicate symbols are merged.
- Optional `--sectors` CSV with columns `symbol,sector`. See `sector_map.csv`; extend it for your stocks.

## Output

Invested vs current value, P&L, weight per stock, sector allocation, and risk flags:

| Flag | Default | Option |
|---|---|---|
| Single stock weight above | 20% | `--max-stock` |
| Sector weight above | 40% | `--max-sector` |
| Top 5 holdings above | 70% | `--max-top5` |
| Holding down by at least | -15% | `--loss-alert` |

## Not covered yet

- STCG/LTCG split: holdings exports have no purchase dates, so this needs a tradebook.
- Live prices: LTP comes from your export, so refresh it first.
- Order placement: deliberately out of scope.
