import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    style={{
      position: 'relative',
      display: 'flex',
      width: '100%',
      touchAction: 'none',
      alignItems: 'center',
      userSelect: 'none',
      cursor: 'pointer',
    }}
    {...props}
  >
    <SliderPrimitive.Track
      style={{
        position: 'relative',
        height: '0.5rem',
        width: '100%',
        flexGrow: 1,
        overflow: 'hidden',
        borderRadius: '9999px',
        backgroundColor: '#e4e4e7',
      }}
    >
      <SliderPrimitive.Range
        style={{
          position: 'absolute',
          height: '100%',
          backgroundColor: '#18181b',
        }}
      />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      style={{
        display: 'block',
        height: '1.25rem',
        width: '1.25rem',
        borderRadius: '9999px',
        border: '2px solid #18181b',
        backgroundColor: '#fff',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        transition: 'box-shadow 0.2s',
        outline: 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 2px #fff, 0 0 0 4px #18181b'
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px 0 rgb(0 0 0 / 0.1)'
      }}
    />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
