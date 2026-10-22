export const STATUS_LABEL = { pending: 'Pending', in_progress: 'In progress', filed: 'Filed / done', not_applicable: 'Not applicable' };
export const KIND_LABEL = { individual: 'Individual', business: 'Business / firm', company: 'Company (ROC)', it: 'IT / security audit' };
export const fmtDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
