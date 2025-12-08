interface FileUploadProps {
  onImageUpload: (file: File) => void
}

export function FileUpload({ onImageUpload }: FileUploadProps) {
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onImageUpload(file)
    }
  }

  return (
    <div className="h-[300px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-4">
      <div className="text-center">
        <p className="text-lg font-medium mb-2">Upload Scanned Color Chart</p>
        <p className="text-muted-foreground mb-4">
          Take a photo of your printed color chart and upload it here
        </p>
        <label className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 cursor-pointer">
          Choose File
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}
