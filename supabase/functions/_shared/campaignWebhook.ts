/**
 * Fire-and-forget hook to the campaign orchestrator Worker after CPD approval.
 */
export async function triggerCampaignGeneration(requestId: string): Promise<void> {
  const workerUrl = Deno.env.get("CAMPAIGN_WORKER_URL")?.replace(/\/$/, "")
  const secret = Deno.env.get("CAMPAIGN_WEBHOOK_SECRET")

  if (!workerUrl || !secret) {
    console.warn(
      "Campaign worker not configured (CAMPAIGN_WORKER_URL / CAMPAIGN_WEBHOOK_SECRET). Skipping email campaign start.",
    )
    return
  }

  try {
    const response = await fetch(`${workerUrl}/internal/campaigns/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Campaign-Webhook-Secret": secret,
      },
      body: JSON.stringify({ request_id: requestId }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`Campaign worker start failed (${response.status}):`, text)
    }
  } catch (error) {
    console.error("Campaign worker start error:", error)
  }
}
