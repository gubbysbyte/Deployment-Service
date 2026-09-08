const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9000";
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:9001";

export type DeployResponse = {
  status: string;
  data: {
    projectSlug: string;
    url: string;
  };
};

export async function deployProject(
  gitURL: string,
  slug?: string
): Promise<DeployResponse> {
  const res = await fetch(`${API_URL}/project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(slug ? { gitURL, slug } : { gitURL }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  return res.json();
}
