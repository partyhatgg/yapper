export interface RunpodJobResponse {
  id: string
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED"
}

export interface RunpodWebhookPayload {
  id: string
  status: "COMPLETED" | "FAILED" | "CANCELLED"
  output?: {
    transcription: string
    detected_language?: string
  }
  error?: string
  delayTime?: number
  executionTime?: number
}

export async function submitRunpodJob(attachmentUrl: string): Promise<RunpodJobResponse> {
  const endpointId = process.env.RUNPOD_ENDPOINT_ID
  const webhookUrl = `${process.env.BASE_URL}/webhook/runpod`

  const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`
    },
    body: JSON.stringify({
      input: {
        audio: attachmentUrl,
        model: "turbo",
        transcription: "plain_text",
        translate: false,
        temperature: 0
      },
      webhook: webhookUrl
    })
  })

  if (!response.ok) {
    throw new Error(`Runpod submit failed: ${response.status} ${await response.text()}`)
  }

  return response.json() as Promise<RunpodJobResponse>
}
