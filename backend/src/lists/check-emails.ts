import { promises as dns } from 'dns';

const PLACEHOLDERS = /^(youremail|email|test|example|noreply|no-reply)@/i;
const FAKE_DOMAINS = new Set(['email.com', 'example.com', 'test.com', 'mailinator.com']);
const DOMAIN_TYPOS: Record<string, string> = {
  'gmal.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
};
const LOCAL_TYPOS: Record<string, string> = {
  tinfo: 'info',
  infor: 'info',
  enquiries: 'enquiries',
};

export type CheckRow = {
  id: number;
  email: string;
  name: string;
  status: 'ok' | 'fixed' | 'removed';
  reason: string;
};

function syntaxOk(email: string) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email);
}

export function normalizeEmail(raw: string) {
  let s = (raw || '').trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep */
  }
  s = s.replace(/\s+/g, '').replace(/^mailto:/i, '').toLowerCase();
  return s;
}

export async function planContact(
  emailRaw: string,
  hasMx: (domain: string) => Promise<boolean>,
): Promise<{ email: string; drop: boolean; reason: string; changed: boolean }> {
  const original = normalizeEmail(emailRaw);
  let email = original;
  let [local, domain] = email.split('@');

  if (!syntaxOk(email) || !domain) {
    return { email: original, drop: true, reason: 'Invalid format', changed: false };
  }
  if (PLACEHOLDERS.test(email) || FAKE_DOMAINS.has(domain)) {
    return { email, drop: true, reason: 'Placeholder / fake address', changed: false };
  }

  const domainFix = DOMAIN_TYPOS[domain];
  if (domainFix) {
    domain = domainFix;
    email = `${local}@${domain}`;
  }
  const localFix = LOCAL_TYPOS[local];
  if (localFix) {
    local = localFix;
    email = `${local}@${domain}`;
  }

  const mx = await hasMx(domain);
  if (!mx) {
    return { email, drop: true, reason: `No MX on ${domain}`, changed: email !== original };
  }

  return {
    email,
    drop: false,
    reason: email !== original ? `Fixed ${original} → ${email}` : 'Syntax + MX ok',
    changed: email !== original,
  };
}

export function mxChecker() {
  const mxCache = new Map<string, boolean>();
  return async (domain: string) => {
    if (mxCache.has(domain)) return mxCache.get(domain)!;
    try {
      const rec = await dns.resolveMx(domain);
      const ok = Array.isArray(rec) && rec.length > 0;
      mxCache.set(domain, ok);
      return ok;
    } catch {
      mxCache.set(domain, false);
      return false;
    }
  };
}
