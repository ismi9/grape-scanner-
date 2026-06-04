'use client'

import { useRef, useState, useCallback } from 'react'

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    setError(null)
    setResult(null)
    setCaptured(null)
    setStreaming(false)

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStreaming(true)
      }
    } catch (err: any) {
      setError('Помилка камери: ' + (err?.message || err?.name || String(err)))
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setStreaming(false)
  }, [])

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    setCaptured(dataUrl)
    stopCamera()
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
  }, [stopCamera])

  const retake = useCallback(() => {
    setCaptured(null)
    setResult(null)
    setError(null)
    startCamera()
  }, [startCamera])

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px', maxWidth: '500px', margin: '0 auto', minHeight: '100vh' }}>
      <header style={{ textAlign: 'center', paddingBottom: '16px' }}>
        <h1 style={{ color: '#4ade80', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>🍇 VineGuard</h1>
        <p style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0' }}>AI-скаутер виноградників</p>
      </header>

      {/* Camera / Image area */}
      <div style={{ width: '100%', position: 'relative', background: '#111', borderRadius: '12px', overflow: 'hidden', aspectRatio: '3/4', maxHeight: '65vh' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: streaming ? 'block' : 'none' }}
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {captured && (
          <img src={captured} alt="Скан" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}

        {!streaming && !captured && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#4b5563', fontSize: '14px' }}>
            Камера вимкнена
          </div>
        )}

        {analyzing && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>🔍</div>
              <p style={{ color: '#4ade80', fontWeight: 600 }}>Аналізуємо листок...</p>
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '12px', width: '100%', justifyContent: 'center' }}>
        {!streaming && !captured && (
          <button onClick={startCamera} style={{ background: '#16a34a', color: 'white', padding: '14px 32px', borderRadius: '12px', fontSize: '16px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            📷 Відкрити камеру
          </button>
        )}
        {streaming && (
          <button onClick={handleCapture} style={{ background: 'white', color: 'black', padding: '14px 32px', borderRadius: '50px', fontSize: '16px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            ⚡ Сканувати
          </button>
        )}
        {(result || captured) && !analyzing && (
          <button onClick={retake} style={{ background: '#15803d', color: 'white', padding: '12px 24px', borderRadius: '10px', fontSize: '14px', border: 'none', cursor: 'pointer' }}>
            🔄 Сканувати ще
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ width: '100%', marginTop: '12px', background: 'rgba(153,27,27,0.3)', border: '1px solid #b91c1c', borderRadius: '10px', padding: '12px', fontSize: '13px', color: '#fca5a5' }}>
          ❌ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ width: '100%', marginTop: '12px', background: '#111827', border: '1px solid #166534', borderRadius: '12px', padding: '16px', fontSize: '13px', whiteSpace: 'pre-wrap', color: '#e5e7eb', marginBottom: '32px' }}>
          <div style={{ color: '#4ade80', fontWeight: 700, marginBottom: '8px' }}>📋 Висновок:</div>
          {result}
        </div>
      )}
    </main>
  )
}
