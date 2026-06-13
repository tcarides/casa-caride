import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const dynamic = 'force-dynamic'

// Genera el token de subida para que el cliente suba el archivo directo al
// Blob store (sin pasar por la función serverless, así soporta archivos grandes).
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
          'application/pdf',
        ],
        maximumSizeInBytes: 25 * 1024 * 1024, // 25 MB
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => { /* la metadata se guarda con POST /api/estudios */ },
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
