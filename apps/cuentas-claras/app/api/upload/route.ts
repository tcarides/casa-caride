import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/guard'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

export const dynamic = 'force-dynamic'

// Genera el token para que el navegador suba el comprobante directo al Blob
// (client-upload). La metadata del gasto se guarda después con POST del gasto.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = await requireSession()
  if (denied) return denied
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
        maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => { /* la metadata se guarda con el gasto */ },
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
