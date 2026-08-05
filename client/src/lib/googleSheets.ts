const GOOGLE_SHEET_URL = import.meta.env.VITE_GOOGLE_SHEET_URL;

export async function submitToGoogleSheet(
  sheet: string,
  data: Record<string, any>
) {
  const response = await fetch(GOOGLE_SHEET_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: JSON.stringify({
      sheet,
      data,
    }),
  });

  return response.json();
}