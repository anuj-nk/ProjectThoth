// API: /api/audio/transcribe
// Converts a short recorded interview response into editable transcript text.

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const TRANSCRIPTION_MODEL = process.env.TRANSCRIPTION_MODEL ?? 'openai/gpt-4o-mini-transcribe'
const OPENROUTER_TRANSCRIPTIONS_URL = 'https://openrouter.ai/api/v1/audio/transcriptions'

function audioFormatFor(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension) return extension
  if (file.type.includes('webm')) return 'webm'
  if (file.type.includes('mp4')) return 'mp4'
  if (file.type.includes('mpeg')) return 'mp3'
  if (file.type.includes('wav')) return 'wav'
  return 'webm'
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const formData = await req.formData()
    const audio = formData.get('audio')

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: 'audio file required' },
        { status: 400 }
      )
    }

    if (audio.size === 0) {
      return NextResponse.json(
        { error: 'audio file is empty' },
        { status: 400 }
      )
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: 'audio file exceeds 25 MB limit' },
        { status: 413 }
      )
    }

    const buffer = Buffer.from(await audio.arrayBuffer())
    const response = await fetch(OPENROUTER_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
        'X-Title': 'Project Thoth',
      },
      body: JSON.stringify({
        input_audio: {
          data: buffer.toString('base64'),
          format: audioFormatFor(audio),
        },
        language: 'en',
        temperature: 0,
        provider: {
          options: {
            openai: {
              prompt: 'Project Thoth interview about GIX, TECHIN, CPT, Handshake, SEVIS, internships, student services, and campus operations.',
            },
          },
        },
        model: TRANSCRIPTION_MODEL,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('OpenRouter transcription failed:', result)
      return NextResponse.json(
        { error: result?.error?.message || result?.error || 'Transcription failed' },
        { status: response.status }
      )
    }

    return NextResponse.json({
      text: typeof result.text === 'string' ? result.text.trim() : '',
      model: TRANSCRIPTION_MODEL,
      usage: result.usage,
    })
  } catch (error) {
    console.error('Audio transcription failed:', error)
    return NextResponse.json(
      { error: 'Transcription failed' },
      { status: 500 }
    )
  }
}
