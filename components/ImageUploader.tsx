import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ImageUploaderProps {
  onUpload: (imgs: HTMLImageElement[]) => void;
  className?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onUpload, className }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
      toast.error("Please upload image files");
      return;
    }

    const promises = validFiles.map(file => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises)
      .then(images => {
        onUpload(images);
      })
      .catch(() => {
        toast.error("Failed to load some images");
      });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processFiles(e.target.files);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer bg-card",
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
        className
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input 
        ref={inputRef}
        type="file" 
        className="hidden" 
        accept="image/*" 
        multiple
        onChange={handleChange}
      />
      
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
        <Upload className="w-8 h-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">Upload Images</h3>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        Drag and drop your images here, or click to browse files
      </p>
    </div>
  );
};
