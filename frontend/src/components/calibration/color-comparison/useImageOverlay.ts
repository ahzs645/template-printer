import { useState, useEffect, useCallback, useRef } from 'react'

interface ImageDimensions {
  width: number
  height: number
  left: number
  top: number
}

export function useImageOverlay(
  containerRef: React.RefObject<HTMLDivElement | null>,
  imageRef: React.RefObject<HTMLImageElement | null>
) {
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null)
  const rafRef = useRef<number | null>(null)

  const calculateImageDimensions = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return null

    const container = containerRef.current
    const image = imageRef.current

    // Wait for image to load
    if (!image.naturalWidth || !image.naturalHeight) return null

    const containerRect = container.getBoundingClientRect()
    const imageRect = image.getBoundingClientRect()
    const containerStyle = window.getComputedStyle(container)
    const borderLeft = Number.parseFloat(containerStyle.borderLeftWidth) || 0
    const borderTop = Number.parseFloat(containerStyle.borderTopWidth) || 0

    // Ensure container has dimensions
    if (containerRect.width === 0 || containerRect.height === 0) return null

    const imageAspect = image.naturalWidth / image.naturalHeight
    const imageElementAspect = imageRect.width / imageRect.height
    const imageElementLeft = imageRect.left - containerRect.left - borderLeft
    const imageElementTop = imageRect.top - containerRect.top - borderTop

    let renderedWidth, renderedHeight, renderedLeft, renderedTop

    if (imageAspect > imageElementAspect) {
      renderedWidth = imageRect.width
      renderedHeight = imageRect.width / imageAspect
      renderedLeft = imageElementLeft
      renderedTop = imageElementTop + ((imageRect.height - renderedHeight) / 2)
    } else {
      renderedHeight = imageRect.height
      renderedWidth = imageRect.height * imageAspect
      renderedTop = imageElementTop
      renderedLeft = imageElementLeft + ((imageRect.width - renderedWidth) / 2)
    }

    return {
      width: renderedWidth,
      height: renderedHeight,
      left: renderedLeft,
      top: renderedTop
    }
  }, [containerRef, imageRef])

  const updateDimensions = useCallback(() => {
    // Cancel any pending RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    // Use RAF to ensure DOM has settled
    rafRef.current = requestAnimationFrame(() => {
      const dimensions = calculateImageDimensions()
      if (dimensions) {
        setImageDimensions(dimensions)
      } else {
        // Retry after a short delay if dimensions not ready
        setTimeout(() => {
          const retryDimensions = calculateImageDimensions()
          if (retryDimensions) {
            setImageDimensions(retryDimensions)
          }
        }, 100)
      }
    })
  }, [calculateImageDimensions])

  useEffect(() => {
    updateDimensions()

    // Update on window resize
    const handleResize = () => updateDimensions()
    window.addEventListener('resize', handleResize)

    // Update when image loads
    const image = imageRef.current
    if (image) {
      image.addEventListener('load', updateDimensions)
      // Also trigger on image decode complete
      if (image.complete) {
        updateDimensions()
      }
    }

    // Use ResizeObserver for container size changes
    const container = containerRef.current
    let resizeObserver: ResizeObserver | null = null
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateDimensions())
      resizeObserver.observe(container)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      if (image) {
        image.removeEventListener('load', updateDimensions)
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [updateDimensions, imageRef, containerRef])

  return { imageDimensions, updateDimensions }
}
