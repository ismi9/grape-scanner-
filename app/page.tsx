'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment')
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startCamera = useCallback(async () => {
    setError(null)
    setResult(null)
    setCaptured(null)
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 1080 }, height: { ideal: 1920 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          setStreaming(true)
        }
      }
    } catch (e) {
      setError('Не вдалося відкрити камеру. Дозвольте доступ до камери в браузері.')
    }
  }, [cameraFacing])

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStreaming(false)
  }, [])

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    return canvas.toDataURL('image/jpeg', 0.85)
  }, [])

  const analyzeImage = useCallback(async (dataUrl: string) => {
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Помилка аналізу')
      setResult(data.advice)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }, [])

  const handleCapture = useCallback(() => {
    const dataUrl = captureFrame()
    if (!dataUrl) return
    setCaptured(dataUrl)
    stopCamera()
    analyzeImage(dataUrl)
  }, [captureFrame, stopCamera, analyzeImage])

  const toggleCamera = useCallback(() => {
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment')
  }, [])

  const retake = useCallback(() => {
    setCaptured(null)
    setResult(null)
    setError(null)
    startCamera()
  }, [startCamera])

  // Auto-scan every 3 seconds when streaming
  useEffect(() => {
    if (streaming) {
      scanIntervalRef.current = setInterval(() => {
        const dataUrl = captureFrame()
        if (dataUrl) {
          setCaptured(dataUrl)
          stopCamera()
          analyzeImage(dataUrl)
        }
      }, 3000)
    }
    return () => { if (scanIntervalRef.current) clearInterval(scanIntervalRef.current) }
  }, [streaming])

  return (
    <main className="flex flex-col items-center p-2 max-w-lg mx-auto min-h-screen">
      <header className="w-full text-center py-3">
        <h1 className="text-2xl font-bold text-green-400">🍇 VineGuard</h1>
        <p className="text-xs text-gray-400">AI-скаутер виноградників</p>
      </header>

      {!streaming && !captured && (
        <div className="flex flex-col items-center gap-4 mt-12">
          <button onClick={startCamera} className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg shadow-green-900/50">
            📷 Відкрити камеру
          </button>
          <div className="text-xs text-gray-500 text-center max-w-xs">
            Наведіть камеру на листок винограду — сканування почнеться автоматично кожні 3 секунди
          </div>
        </div>
      )}

      <div className={`relative w-full ${streaming || captured ? 'mt-2' : 'hidden'}`} style={{ aspectRatio: '3/4', maxHeight: '70vh' }}>
        {streaming && (
          <>
            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover rounded-xl ${captured ? 'hidden' : ''}`} />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-green-300">
              Авто-сканування активне
            </div>
            <button onClick={toggleCamera} className="absolute top-2 right-2 bg-black/60 px-3 py-1 rounded text-xs text-white">
              🔄 {cameraFacing === 'environment' ? 'Фронт' : 'Тил'}
            </button>
            <button onClick={handleCapture} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 text-black px-6 py-3 rounded-full font-semibold shadow-lg">
              ⚡ Сканувати зараз
            </button>
          </>
        )}

        {captured && (
          <>
            <img src={captured} alt="Скан" className="w-full h-full object-cover rounded-xl" />
            {analyzing && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-xl">
                <div className="text-center">
                  <div className="text-4xl mb-2 animate-pulse">🔍</div>
                  <p className="text-green-300 font-semibold">Аналізуємо листок...</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="w-full mt-3 bg-red-900/40 border border-red-700 rounded-lg p-3 text-sm text-red-200">
          ❌ {error}
          <button onClick={retake} className="ml-2 underline">Спробувати знову</button>
        </div>
      )}

      {result && (
        <div className="w-full mt-3 bg-gray-900 border border-green-800 rounded-xl p-4 text-sm whitespace-pre-wrap">
          <div className="text-green-400 font-bold mb-2">📋 Висновок:</div>
          {result}
        </div>
      )}

      {result && (
        <button onClick={retake} className="mt-4 mb-8 bg-green-700 hover:bg-green-600 text-white px-6 py-2 rounded-lg text-sm">
          🔄 Сканувати ще
        </button>
      )}
    </main>
  )
}