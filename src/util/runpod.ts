import { env } from "node:process"

export interface RunpodJobResponse {
  id: string
  status: string
}

export interface RunpodJobStatus {
  id: string
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED"
  output?: {
    transcription: string
    detected_language?: string
  }
  error?: string
  delayTime?: number
  executionTime?: number
}

export async function submitRunpodJob(attachmentUrl: string): Promise<RunpodJobResponse> {
  const endpointId = env.RUNPOD_ENDPOINT_ID
  const webhookUrl = `${env.CALLBACK_URL}/webhook/runpod`

  const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    signal: AbortSignal.timeout(10_000),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`
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

export async function getRunpodJobStatus(jobId: string): Promise<RunpodJobStatus> {
  const endpointId = env.RUNPOD_ENDPOINT_ID
  const response = await fetch(`https://api.runpod.ai/v2/${endpointId}/status/${jobId}`, {
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${env.RUNPOD_API_KEY}`
    }
  })
  if (!response.ok) {
    throw new Error(`Runpod status check failed: ${response.status} ${await response.text()}`)
  }
  return response.json() as Promise<RunpodJobStatus>
}
