'use client'

import { useEffect, useRef } from 'react'
import type { Map as LeafletMapInstance, TileLayer } from 'leaflet'

export interface LeafletMapBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

interface LeafletMapProps {
  bounds: LeafletMapBounds | null
  mode: 'road' | 'satellite'
}

const MOUNT_VERNON_CENTER: [number, number] = [40.3934, -82.4857]

export function LeafletMap({ bounds, mode }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMapInstance | null>(null)
  const layersRef = useRef<{ road: TileLayer | null; satellite: TileLayer | null }>({ road: null, satellite: null })

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      if (!containerRef.current || mapRef.current) return
      const L = await import('leaflet')
      if (cancelled || !containerRef.current) return

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      })

      const road = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      })

      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri',
        },
      )

      layersRef.current = { road, satellite }
      mapRef.current = map
      ;(mode === 'satellite' ? satellite : road).addTo(map)
      map.setView(MOUNT_VERNON_CENTER, 11)
      map.whenReady(() => map.invalidateSize())
    }

    void initMap()

    return () => {
      cancelled = true
      layersRef.current.road?.remove()
      layersRef.current.satellite?.remove()
      layersRef.current = { road: null, satellite: null }
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !bounds) return
    map.fitBounds(
      [
        [bounds.minLat, bounds.minLng],
        [bounds.maxLat, bounds.maxLng],
      ],
      { padding: [24, 24], maxZoom: 18, animate: false },
    )
    map.invalidateSize()
  }, [bounds])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const nextLayer = mode === 'satellite' ? layersRef.current.satellite : layersRef.current.road
    const otherLayer = mode === 'satellite' ? layersRef.current.road : layersRef.current.satellite
    if (otherLayer && map.hasLayer(otherLayer)) map.removeLayer(otherLayer)
    if (nextLayer && !map.hasLayer(nextLayer)) nextLayer.addTo(map)
  }, [mode])

  return <div ref={containerRef} className="absolute inset-0 z-0" aria-label={`${mode === 'satellite' ? 'Satellite' : 'Road'} territory map`} />
}
