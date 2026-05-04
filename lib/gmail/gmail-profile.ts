export type GmailProfileResponse = {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
};

export async function fetchGmailProfile(accessToken: string): Promise<GmailProfileResponse> {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail profile request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as GmailProfileResponse;
}
