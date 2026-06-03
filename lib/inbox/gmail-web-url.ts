export function buildGmailThreadUrl(args: {
  mailboxEmail: string;
  providerThreadId: string;
}): string | null {
  const threadId = args.providerThreadId.trim();
  const email = args.mailboxEmail.trim();
  if (!threadId.length || !email.length) {
    return null;
  }

  const params = new URLSearchParams({ authuser: email });
  return `https://mail.google.com/mail/?${params.toString()}#inbox/${encodeURIComponent(threadId)}`;
}
