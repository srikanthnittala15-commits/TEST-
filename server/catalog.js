// Default Indian compliance catalog. Due dates are statutory defaults and are
// often extended by notification, so users can edit any generated task.
// rule types: monthly {day, monthOffset}, dates [[month, day, yearOffset]], annual {month, day, yearOffset}
// yearOffset is relative to the start year of the financial year (Apr..Mar).
const M = (day, monthOffset = 1) => ({ type: 'monthly', day, monthOffset });
const D = (...dates) => ({ type: 'dates', dates });

export const CATALOG = [
  // ---- GST
  { key: 'gstr1', title: 'GSTR-1 (outward supplies)', category: 'GST', applies: ['business'], rule: M(11) },
  { key: 'gstr3b', title: 'GSTR-3B (summary return & tax payment)', category: 'GST', applies: ['business'], rule: M(20) },
  { key: 'gstr9', title: 'GSTR-9 annual return', category: 'GST', applies: ['business'], rule: D([12, 31, 1]) },
  // ---- TDS / TCS
  { key: 'tds_pay', title: 'TDS/TCS payment (challan)', category: 'TDS/TCS', applies: ['business'], rule: M(7) },
  { key: 'tds_return', title: 'TDS return (24Q/26Q/27Q)', category: 'TDS/TCS', applies: ['business'], rule: D([7, 31, 0], [10, 31, 0], [1, 31, 1], [5, 31, 1]) },
  { key: 'tds_cert', title: 'TDS certificates (Form 16A / 16)', category: 'TDS/TCS', applies: ['business'], rule: D([8, 15, 0], [11, 15, 0], [2, 15, 1], [6, 15, 1]) },
  // ---- Income tax
  { key: 'adv_tax', title: 'Advance tax instalment', category: 'Income Tax', applies: ['business', 'individual'], rule: D([6, 15, 0], [9, 15, 0], [12, 15, 0], [3, 15, 1]) },
  { key: 'itr_nonaudit', title: 'ITR filing (non-audit / individual)', category: 'Income Tax', applies: ['individual', 'business'], rule: D([7, 31, 1]) },
  { key: 'tax_audit', title: 'Tax audit report (Form 3CA/3CB-3CD)', category: 'Income Tax', applies: ['business'], rule: D([9, 30, 1]) },
  { key: 'itr_audit', title: 'ITR filing (audit cases)', category: 'Income Tax', applies: ['business'], rule: D([10, 31, 1]) },
  { key: 'form26as', title: 'Reconcile Form 26AS / AIS / TIS', category: 'Income Tax', applies: ['individual', 'business'], rule: D([6, 30, 1]) },
  // ---- Companies Act / ROC
  { key: 'dir3kyc', title: 'DIR-3 KYC (directors)', category: 'ROC', applies: ['company'], rule: D([9, 30, 1]) },
  { key: 'adt1', title: 'ADT-1 (auditor appointment)', category: 'ROC', applies: ['company'], rule: D([10, 15, 0]) },
  { key: 'aoc4', title: 'AOC-4 (financial statements)', category: 'ROC', applies: ['company'], rule: D([10, 30, 0]) },
  { key: 'mgt7', title: 'MGT-7 / 7A (annual return)', category: 'ROC', applies: ['company'], rule: D([11, 29, 0]) },
  { key: 'msme1', title: 'MSME-1 (half-yearly outstanding dues)', category: 'ROC', applies: ['company'], rule: D([10, 31, 0], [4, 30, 1]) },
  // ---- Labour / payroll
  { key: 'pf', title: 'PF contribution & ECR', category: 'Labour', applies: ['business'], rule: M(15) },
  { key: 'esi', title: 'ESI contribution', category: 'Labour', applies: ['business'], rule: M(15) },
  { key: 'pt', title: 'Professional tax', category: 'Labour', applies: ['business'], rule: M(20) },
  // ---- FEMA / others
  { key: 'fla', title: 'FLA return (RBI)', category: 'FEMA', applies: ['company', 'business'], rule: D([7, 15, 0]) },
  // ---- IT / security audits
  { key: 'access_review', title: 'Quarterly user access review', category: 'IT/Security', applies: ['it'], rule: D([6, 30, 0], [9, 30, 0], [12, 31, 0], [3, 31, 1]) },
  { key: 'vapt', title: 'Annual VAPT / penetration test', category: 'IT/Security', applies: ['it'], rule: D([12, 31, 0]) },
  { key: 'bcp_test', title: 'BCP / DR test', category: 'IT/Security', applies: ['it'], rule: D([9, 30, 0]) },
  { key: 'iso_surv', title: 'ISO 27001 surveillance audit', category: 'IT/Security', applies: ['it'], rule: D([11, 30, 0]) },
  { key: 'soc2_evidence', title: 'SOC 2 evidence collection', category: 'IT/Security', applies: ['it'], rule: D([6, 30, 0], [12, 31, 0]) },
  { key: 'dpdp_review', title: 'DPDP Act privacy & consent review', category: 'IT/Security', applies: ['it'], rule: D([3, 31, 1]) },
  { key: 'cert_in', title: 'Policy & risk register annual review', category: 'IT/Security', applies: ['it'], rule: D([3, 31, 1]) },
];

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// fyStart: calendar year in which the financial year starts (2026 => FY 2026-27)
export function dueDates(rule, fyStart) {
  const out = [];
  if (rule.type === 'monthly') {
    for (let i = 0; i < 12; i++) {
      const periodMonth = ((3 + i) % 12) + 1; // Apr..Mar
      const periodYear = fyStart + (periodMonth >= 4 ? 0 : 1);
      const total = periodYear * 12 + (periodMonth - 1) + rule.monthOffset;
      const y = Math.floor(total / 12);
      const m = (total % 12) + 1;
      const day = Math.min(rule.day, new Date(y, m, 0).getDate());
      out.push({ due: iso(y, m, day), period: `${MONTHS[periodMonth - 1]} ${periodYear}` });
    }
  } else {
    for (const [m, d, yo] of rule.dates) {
      out.push({ due: iso(fyStart + yo, m, d), period: `FY ${fyStart}-${String(fyStart + 1).slice(2)}` });
    }
  }
  return out;
}
